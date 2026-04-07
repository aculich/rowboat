import { ipcMain, BrowserWindow, shell, app, webContents } from 'electron';
import { ipc } from '@x/shared';
import path from 'node:path';
import os from 'node:os';
import {
  connectProvider,
  disconnectProvider,
  listProviders,
} from './oauth-handler.js';
import { watcher as watcherCore, workspace } from '@x/core';
import { workspace as workspaceShared } from '@x/shared';
import * as mcpCore from '@x/core/dist/mcp/mcp.js';
import * as runsCore from '@x/core/dist/runs/runs.js';
import { bus } from '@x/core/dist/runs/bus.js';
import { serviceBus } from '@x/core/dist/services/service_bus.js';
import type { FSWatcher } from 'chokidar';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import z from 'zod';
import { RunEvent } from '@x/shared/dist/runs.js';
import { ServiceEvent } from '@x/shared/dist/service-events.js';
import container from '@x/core/dist/di/container.js';
import { listOnboardingModels } from '@x/core/dist/models/models-dev.js';
import { testModelConnection } from '@x/core/dist/models/models.js';
import type { IModelConfigRepo } from '@x/core/dist/models/repo.js';
import type { IOAuthRepo } from '@x/core/dist/auth/repo.js';
import { IGranolaConfigRepo } from '@x/core/dist/knowledge/granola/repo.js';
import { triggerSync as triggerGranolaSync } from '@x/core/dist/knowledge/granola/sync.js';
import { triggerSync as triggerGmailSync } from '@x/core/dist/knowledge/sync_gmail.js';
import { triggerSync as triggerCalendarSync } from '@x/core/dist/knowledge/sync_calendar.js';
import { triggerSync as triggerFirefliesSync } from '@x/core/dist/knowledge/sync_fireflies.js';
import { isOnboardingComplete, markOnboardingComplete } from '@x/core/dist/config/note_creation_config.js';
import * as composioHandler from './composio-handler.js';
import { IAgentScheduleRepo } from '@x/core/dist/agent-schedule/repo.js';
import { IAgentScheduleStateRepo } from '@x/core/dist/agent-schedule/state-repo.js';
import { triggerRun as triggerAgentScheduleRun } from '@x/core/dist/agent-schedule/runner.js';
import { search } from '@x/core/dist/search/search.js';
import { versionHistory } from '@x/core';

type InvokeChannels = ipc.InvokeChannels;
type IPCChannels = ipc.IPCChannels;

/**
 * Type-safe handler function for invoke channels
 */
type InvokeHandler<K extends InvokeChannels> = (
  event: Electron.IpcMainInvokeEvent,
  args: IPCChannels[K]['req']
) => IPCChannels[K]['res'] | Promise<IPCChannels[K]['res']>;

/**
 * Type-safe handler registration map
 * Ensures all invoke channels have handlers
 */
type InvokeHandlers = {
  [K in InvokeChannels]: InvokeHandler<K>;
};

/**
 * Register all IPC handlers with type safety and runtime validation
 * 
 * This function ensures:
 * 1. All invoke channels have handlers (exhaustiveness checking)
 * 2. Handler signatures match channel definitions
 * 3. Request/response payloads are validated at runtime
 */
export function registerIpcHandlers(handlers: InvokeHandlers) {
  // Register each handler with runtime validation
  for (const [channel, handler] of Object.entries(handlers) as [
    InvokeChannels,
    InvokeHandler<InvokeChannels>
  ][]) {
    ipcMain.handle(channel, async (event, rawArgs) => {
      // Validate request payload
      const args = ipc.validateRequest(channel, rawArgs);
      
      // Call handler
      const result = await handler(event, args);
      
      // Validate response payload
      return ipc.validateResponse(channel, result);
    });
  }
}

// ============================================================================
// Electron-Specific Utilities
// ============================================================================

/**
 * Get application versions (Electron-specific)
 */
function getVersions(): {
  chrome: string;
  node: string;
  electron: string;
} {
  return {
    chrome: process.versions.chrome,
    node: process.versions.node,
    electron: process.versions.electron,
  };
}

/**
 * Get build info for version visibility (dev: commit, branch, date, upstream release; release: version only)
 */
function getBuildInfo(): {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildDate: string;
  isDevBuild: boolean;
  forkName: string;
  upstreamRelease: string;
} {
  const isDev = process.env.ROWBOAT_IS_DEV_BUILD === 'true';
  return {
    version: isDev
      ? (process.env.ROWBOAT_DEV_VERSION ?? app.getVersion())
      : app.getVersion(),
    gitCommit: process.env.ROWBOAT_GIT_COMMIT ?? '',
    gitBranch: process.env.ROWBOAT_GIT_BRANCH ?? '',
    buildDate: process.env.ROWBOAT_BUILD_DATE ?? '',
    isDevBuild: isDev,
    forkName: process.env.ROWBOAT_FORK_NAME ?? 'rowboatlabs',
    upstreamRelease: process.env.ROWBOAT_UPSTREAM_RELEASE ?? '',
  };
}

function toNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      out[key] = item;
    }
  }
  return out;
}

const MEMORY_LOG_DIR = path.join(os.homedir(), '.rowboat', 'logs');
const MEMORY_LOG_PATH = path.join(MEMORY_LOG_DIR, 'memory-debug.jsonl');
const MEMORY_LOG_MAX_BYTES = Number.parseInt(process.env.ROWBOAT_MEMORY_LOG_MAX_BYTES ?? '', 10) || 10 * 1024 * 1024;
const MEMORY_LOG_MAX_ROLLED_FILES = Number.parseInt(process.env.ROWBOAT_MEMORY_LOG_MAX_ROLLED_FILES ?? '', 10) || 5;
const MEMORY_LOG_RETENTION_DAYS = Number.parseInt(process.env.ROWBOAT_MEMORY_LOG_RETENTION_DAYS ?? '', 10) || 7;
const MEMORY_LOG_RETENTION_MS = MEMORY_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MEMORY_LOG_MAINTENANCE_INTERVAL_MS = 60 * 1000;

let lastMemoryLogMaintenanceAt = 0;

function memoryLogPathAtIndex(index: number): string {
  if (index <= 0) return MEMORY_LOG_PATH;
  return `${MEMORY_LOG_PATH}.${index}`;
}

async function readFileSizeSafe(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return 0;
    throw error;
  }
}

async function removeFileSafe(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') throw error;
  }
}

async function renameFileSafe(fromPath: string, toPath: string): Promise<void> {
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') throw error;
  }
}

async function rotateMemoryLogIfNeeded(nextLineBytes: number): Promise<void> {
  const currentSize = await readFileSizeSafe(MEMORY_LOG_PATH);
  if (currentSize + nextLineBytes <= MEMORY_LOG_MAX_BYTES) return;

  // Drop the oldest rolled file before shifting.
  await removeFileSafe(memoryLogPathAtIndex(MEMORY_LOG_MAX_ROLLED_FILES));

  // Shift .N => .N+1 (descending to avoid clobbering).
  for (let index = MEMORY_LOG_MAX_ROLLED_FILES - 1; index >= 1; index--) {
    await renameFileSafe(memoryLogPathAtIndex(index), memoryLogPathAtIndex(index + 1));
  }

  // Move the active log to .1.
  await renameFileSafe(MEMORY_LOG_PATH, memoryLogPathAtIndex(1));
}

async function runMemoryLogMaintenanceIfNeeded(nowMs: number): Promise<void> {
  if (nowMs - lastMemoryLogMaintenanceAt < MEMORY_LOG_MAINTENANCE_INTERVAL_MS) return;
  lastMemoryLogMaintenanceAt = nowMs;

  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(MEMORY_LOG_DIR, { withFileTypes: true, encoding: 'utf8' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return;
    throw error;
  }

  const basename = path.basename(MEMORY_LOG_PATH);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith(basename)) continue;

    const filePath = path.join(MEMORY_LOG_DIR, entry.name);
    try {
      const stat = await fs.stat(filePath);
      if (nowMs - stat.mtimeMs > MEMORY_LOG_RETENTION_MS) {
        await fs.unlink(filePath);
      }
    } catch {
      // Best effort cleanup.
    }
  }
}

async function getMemoryStats(): Promise<{
  timestamp: number;
  processMemory: Record<string, number>;
  systemMemory: Record<string, number>;
  appMetrics: Array<{
    pid: number;
    type: string;
    cpuPercent: number | null;
    idleWakeupsPerSecond: number | null;
    memory: Record<string, number | null>;
  }>;
}> {
  const processMemoryRaw = await process.getProcessMemoryInfo();
  const systemMemoryRaw = process.getSystemMemoryInfo();
  const metrics = app.getAppMetrics();

  const appMetrics = metrics.map((metric) => {
    const metricRecord = metric as unknown as Record<string, unknown>;
    const memory = metricRecord.memory as Record<string, unknown> | undefined;
    const memoryRecord: Record<string, number | null> = {};
    if (memory && typeof memory === 'object') {
      for (const [key, value] of Object.entries(memory)) {
        memoryRecord[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
      }
    }

    const pid = typeof metricRecord.pid === 'number' ? metricRecord.pid : -1;
    const type = typeof metricRecord.type === 'string' ? metricRecord.type : 'unknown';
    const cpu = metricRecord.cpu as Record<string, unknown> | undefined;

    return {
      pid,
      type,
      cpuPercent: typeof cpu?.percentCPUUsage === 'number' ? cpu.percentCPUUsage : null,
      idleWakeupsPerSecond: typeof cpu?.idleWakeupsPerSecond === 'number' ? cpu.idleWakeupsPerSecond : null,
      memory: memoryRecord,
    };
  });

  return {
    timestamp: Date.now(),
    processMemory: toNumberRecord(processMemoryRaw),
    systemMemory: toNumberRecord(systemMemoryRaw),
    appMetrics,
  };
}

function getProcessDiagnostics(): {
  windows: Array<{
    id: number;
    title: string;
    url: string;
    isVisible: boolean;
    isFocused: boolean;
    isDestroyed: boolean;
    webContentsId: number;
  }>;
  webContents: Array<{
    id: number;
    pid: number;
    type: string;
    url: string;
    title: string;
    isDestroyed: boolean;
    isFocused: boolean;
    isDevToolsOpened: boolean;
    ownerWindowId: number | null;
    devToolsWebContentsId: number | null;
    hostWebContentsId: number | null;
  }>;
} {
  const windows = BrowserWindow.getAllWindows().map((win) => ({
    id: win.id,
    title: win.getTitle(),
    url: win.webContents?.getURL?.() ?? '',
    isVisible: win.isVisible(),
    isFocused: win.isFocused(),
    isDestroyed: win.isDestroyed(),
    webContentsId: win.webContents?.id ?? -1,
  }));

  const contents = webContents.getAllWebContents().map((wc) => {
    const ownerWindow = BrowserWindow.fromWebContents(wc);
    const metricsRecord = wc as unknown as Record<string, unknown>;
    const devToolsWebContents = metricsRecord.devToolsWebContents as Electron.WebContents | undefined;
    const hostWebContents = metricsRecord.hostWebContents as Electron.WebContents | undefined;

    return {
      id: wc.id,
      pid: wc.getProcessId?.() ?? -1,
      type: wc.getType(),
      url: wc.getURL(),
      title: wc.getTitle(),
      isDestroyed: wc.isDestroyed(),
      isFocused: wc.isFocused(),
      isDevToolsOpened: wc.isDevToolsOpened(),
      ownerWindowId: ownerWindow?.id ?? null,
      devToolsWebContentsId: devToolsWebContents?.id ?? null,
      hostWebContentsId: hostWebContents?.id ?? null,
    };
  });

  return {
    windows,
    webContents: contents,
  };
}

async function appendMemorySample(args: {
  at: string;
  rendererHeap: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
  counters: Record<string, number>;
  mainMemory: {
    timestamp: number;
    processMemory: Record<string, number>;
    systemMemory: Record<string, number>;
    appMetrics: Array<{
      pid: number;
      type: string;
      cpuPercent: number | null;
      idleWakeupsPerSecond: number | null;
      memory: Record<string, number | null>;
    }>;
  };
}): Promise<{ success: true; path: string }> {
  const diagnostics = getProcessDiagnostics();
  const line = JSON.stringify({
    at: args.at,
    recordedAt: new Date().toISOString(),
    rendererHeap: args.rendererHeap,
    counters: args.counters,
    mainMemory: args.mainMemory,
    diagnostics,
  });

  const lineWithNewline = `${line}\n`;
  const lineBytes = Buffer.byteLength(lineWithNewline, 'utf8');

  await fs.mkdir(MEMORY_LOG_DIR, { recursive: true });
  await runMemoryLogMaintenanceIfNeeded(Date.now());
  await rotateMemoryLogIfNeeded(lineBytes);
  await fs.appendFile(MEMORY_LOG_PATH, lineWithNewline, 'utf8');
  return { success: true, path: MEMORY_LOG_PATH };
}

// ============================================================================
// Workspace Watcher (with debouncing and lifecycle management)
// ============================================================================

let watcher: FSWatcher | null = null;
const changeQueue = new Set<string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Emit knowledge commit event to all renderer windows
 */
function emitKnowledgeCommitEvent(): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('knowledge:didCommit', {});
    }
  }
}

/**
 * Emit workspace change event to all renderer windows
 */
function emitWorkspaceChangeEvent(event: z.infer<typeof workspaceShared.WorkspaceChangeEvent>): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('workspace:didChange', event);
    }
  }
}

/**
 * Process queued changes and emit events (debounced)
 */
function processChangeQueue(): void {
  if (changeQueue.size === 0) {
    return;
  }

  const paths = Array.from(changeQueue);
  changeQueue.clear();

  if (paths.length === 1) {
    // For single path, try to determine kind from file stats
    const relPath = paths[0]!;
    try {
      const absPath = workspace.resolveWorkspacePath(relPath);
      fs.lstat(absPath)
        .then((stats) => {
          const kind = stats.isDirectory() ? 'dir' : 'file';
          emitWorkspaceChangeEvent({ type: 'changed', path: relPath, kind });
        })
        .catch(() => {
          // File no longer exists (edge case), emit without kind
          emitWorkspaceChangeEvent({ type: 'changed', path: relPath });
        });
    } catch {
      // Invalid path, ignore
    }
  } else {
    // Emit bulkChanged for multiple paths
    emitWorkspaceChangeEvent({ type: 'bulkChanged', paths });
  }
}

/**
 * Queue a path change for debounced emission
 */
function queueChange(relPath: string): void {
  changeQueue.add(relPath);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    processChangeQueue();
    debounceTimer = null;
  }, 150); // 150ms debounce
}

/**
 * Handle workspace change event from core watcher
 */
function handleWorkspaceChange(event: z.infer<typeof workspaceShared.WorkspaceChangeEvent>): void {
  // Debounce 'changed' events, emit others immediately
  if (event.type === 'changed' && event.path) {
    queueChange(event.path);
  } else {
    emitWorkspaceChangeEvent(event);
  }
}

/**
 * Start workspace watcher
 * Watches ~/.rowboat recursively and emits change events to renderer
 * 
 * This should be called once when the app starts (from main.ts).
 * The watcher runs as a main-process service and catches ALL filesystem changes
 * (both from IPC handlers and external changes like terminal/git).
 * 
 * Safe to call multiple times - guards against duplicate watchers.
 */
export async function startWorkspaceWatcher(): Promise<void> {
  if (watcher) {
    // Watcher already running - safe to ignore subsequent calls
    return;
  }

  watcher = await watcherCore.createWorkspaceWatcher(handleWorkspaceChange);
}

/**
 * Stop workspace watcher
 */
export function stopWorkspaceWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  changeQueue.clear();
}

function emitRunEvent(event: z.infer<typeof RunEvent>): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('runs:events', event);
    }
  }
}

function emitServiceEvent(event: z.infer<typeof ServiceEvent>): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('services:events', event);
    }
  }
}

export function emitOAuthEvent(event: { provider: string; success: boolean; error?: string }): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('oauth:didConnect', event);
    }
  }
}

let runsWatcher: (() => void) | null = null;
export async function startRunsWatcher(): Promise<void> {
  if (runsWatcher) {
    return;
  }
  runsWatcher = await bus.subscribe('*', async (event) => {
    emitRunEvent(event);
  });
}

let servicesWatcher: (() => void) | null = null;
export async function startServicesWatcher(): Promise<void> {
  if (servicesWatcher) {
    return;
  }
  servicesWatcher = await serviceBus.subscribe(async (event) => {
    emitServiceEvent(event);
  });
}

export function stopRunsWatcher(): void {
  if (runsWatcher) {
    runsWatcher();
    runsWatcher = null;
  }
}

export function stopServicesWatcher(): void {
  if (servicesWatcher) {
    servicesWatcher();
    servicesWatcher = null;
  }
}

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Register all IPC handlers
 * Add new handlers here as you add channels to IPCChannels
 */
export function setupIpcHandlers() {
  // Forward knowledge commit events to renderer for panel refresh
  versionHistory.onCommit(() => emitKnowledgeCommitEvent());

  registerIpcHandlers({
    'app:getVersions': async () => {
      return getVersions();
    },
    'app:getBuildInfo': async () => {
      return getBuildInfo();
    },
    'app:getMemoryStats': async () => {
      return getMemoryStats();
    },
    'app:appendMemorySample': async (_event, args) => {
      return appendMemorySample(args);
    },
    'app:getProcessDiagnostics': async () => {
      return getProcessDiagnostics();
    },
    'workspace:getRoot': async () => {
      return workspace.getRoot();
    },
    'workspace:exists': async (_, args) => {
      return workspace.exists(args.path);
    },
    'workspace:stat': async (_event, args) => {
      return workspace.stat(args.path);
    },
    'workspace:readdir': async (_event, args) => {
      return workspace.readdir(args.path, args.opts);
    },
    'workspace:readFile': async (_event, args) => {
      return workspace.readFile(args.path, args.encoding);
    },
    'workspace:writeFile': async (_event, args) => {
      return workspace.writeFile(args.path, args.data, args.opts);
    },
    'workspace:mkdir': async (_event, args) => {
      return workspace.mkdir(args.path, args.recursive);
    },
    'workspace:rename': async (_event, args) => {
      return workspace.rename(args.from, args.to, args.overwrite);
    },
    'workspace:copy': async (_event, args) => {
      return workspace.copy(args.from, args.to, args.overwrite);
    },
    'workspace:remove': async (_event, args) => {
      return workspace.remove(args.path, args.opts);
    },
    'mcp:listTools': async (_event, args) => {
      return mcpCore.listTools(args.serverName, args.cursor);
    },
    'mcp:executeTool': async (_event, args) => {
      return { result: await mcpCore.executeTool(args.serverName, args.toolName, args.input) };
    },
    'runs:create': async (_event, args) => {
      return runsCore.createRun(args);
    },
    'runs:createMessage': async (_event, args) => {
      return { messageId: await runsCore.createMessage(args.runId, args.message) };
    },
    'runs:authorizePermission': async (_event, args) => {
      await runsCore.authorizePermission(args.runId, args.authorization);
      return { success: true };
    },
    'runs:provideHumanInput': async (_event, args) => {
      await runsCore.replyToHumanInputRequest(args.runId, args.reply);
      return { success: true };
    },
    'runs:stop': async (_event, args) => {
      await runsCore.stop(args.runId, args.force);
      return { success: true };
    },
    'runs:fetch': async (_event, args) => {
      return runsCore.fetchRun(args.runId);
    },
    'runs:list': async (_event, args) => {
      return runsCore.listRuns(args.cursor);
    },
    'runs:delete': async (_event, args) => {
      await runsCore.deleteRun(args.runId);
      return { success: true };
    },
    'services:triggerSync': async () => {
      triggerGmailSync();
      triggerCalendarSync();
      triggerFirefliesSync();
      triggerGranolaSync();
      return { success: true };
    },
    'models:list': async () => {
      return await listOnboardingModels();
    },
    'models:test': async (_event, args) => {
      return await testModelConnection(args.provider, args.model);
    },
    'models:saveConfig': async (_event, args) => {
      const repo = container.resolve<IModelConfigRepo>('modelConfigRepo');
      await repo.setConfig(args);
      return { success: true };
    },
    'oauth:connect': async (_event, args) => {
      return await connectProvider(args.provider, args.clientId?.trim());
    },
    'oauth:disconnect': async (_event, args) => {
      return await disconnectProvider(args.provider);
    },
    'oauth:list-providers': async () => {
      return listProviders();
    },
    'oauth:getState': async () => {
      const repo = container.resolve<IOAuthRepo>('oauthRepo');
      const config = await repo.getClientFacingConfig();
      return { config };
    },
    'granola:getConfig': async () => {
      const repo = container.resolve<IGranolaConfigRepo>('granolaConfigRepo');
      const config = await repo.getConfig();
      return { enabled: config.enabled };
    },
    'granola:setConfig': async (_event, args) => {
      const repo = container.resolve<IGranolaConfigRepo>('granolaConfigRepo');
      await repo.setConfig({ enabled: args.enabled });

      // Trigger sync immediately when enabled
      if (args.enabled) {
        triggerGranolaSync();
      }

      return { success: true };
    },
    'onboarding:getStatus': async () => {
      // Show onboarding if it hasn't been completed yet
      const complete = isOnboardingComplete();
      return { showOnboarding: !complete };
    },
    'onboarding:markComplete': async () => {
      markOnboardingComplete();
      return { success: true };
    },
    // Composio integration handlers
    'composio:is-configured': async () => {
      return composioHandler.isConfigured();
    },
    'composio:set-api-key': async (_event, args) => {
      return composioHandler.setApiKey(args.apiKey);
    },
    'composio:initiate-connection': async (_event, args) => {
      return composioHandler.initiateConnection(args.toolkitSlug);
    },
    'composio:get-connection-status': async (_event, args) => {
      return composioHandler.getConnectionStatus(args.toolkitSlug);
    },
    'composio:sync-connection': async (_event, args) => {
      return composioHandler.syncConnection(args.toolkitSlug, args.connectedAccountId);
    },
    'composio:disconnect': async (_event, args) => {
      return composioHandler.disconnect(args.toolkitSlug);
    },
    'composio:list-connected': async () => {
      return composioHandler.listConnected();
    },
    'composio:execute-action': async (_event, args) => {
      return composioHandler.executeAction(args.actionSlug, args.toolkitSlug, args.input);
    },
    // Agent schedule handlers
    'agent-schedule:getConfig': async () => {
      const repo = container.resolve<IAgentScheduleRepo>('agentScheduleRepo');
      try {
        return await repo.getConfig();
      } catch {
        // Return empty config if file doesn't exist
        return { agents: {} };
      }
    },
    'agent-schedule:getState': async () => {
      const repo = container.resolve<IAgentScheduleStateRepo>('agentScheduleStateRepo');
      try {
        return await repo.getState();
      } catch {
        // Return empty state if file doesn't exist
        return { agents: {} };
      }
    },
    'agent-schedule:updateAgent': async (_event, args) => {
      const repo = container.resolve<IAgentScheduleRepo>('agentScheduleRepo');
      await repo.upsert(args.agentName, args.entry);
      // Trigger the runner to pick up the change immediately
      triggerAgentScheduleRun();
      return { success: true };
    },
    'agent-schedule:deleteAgent': async (_event, args) => {
      const repo = container.resolve<IAgentScheduleRepo>('agentScheduleRepo');
      const stateRepo = container.resolve<IAgentScheduleStateRepo>('agentScheduleStateRepo');
      await repo.delete(args.agentName);
      await stateRepo.deleteAgentState(args.agentName);
      return { success: true };
    },
    // Shell integration handlers
    'shell:openPath': async (_event, args) => {
      let filePath = args.path;
      if (filePath.startsWith('~')) {
        filePath = path.join(os.homedir(), filePath.slice(1));
      } else if (!path.isAbsolute(filePath)) {
        // Workspace-relative path — resolve against ~/.rowboat/
        filePath = path.join(os.homedir(), '.rowboat', filePath);
      }
      const error = await shell.openPath(filePath);
      return { error: error || undefined };
    },
    'shell:readFileBase64': async (_event, args) => {
      let filePath = args.path;
      if (filePath.startsWith('~')) {
        filePath = path.join(os.homedir(), filePath.slice(1));
      } else if (!path.isAbsolute(filePath)) {
        // Workspace-relative path — resolve against ~/.rowboat/
        filePath = path.join(os.homedir(), '.rowboat', filePath);
      }
      const stat = await fs.stat(filePath);
      if (stat.size > 10 * 1024 * 1024) {
        throw new Error('File too large (>10MB)');
      }
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp', '.ico': 'image/x-icon',
        '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac',
        '.pdf': 'application/pdf', '.json': 'application/json',
        '.txt': 'text/plain', '.md': 'text/markdown',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      return { data: buffer.toString('base64'), mimeType, size: stat.size };
    },
    // Knowledge version history handlers
    'knowledge:history': async (_event, args) => {
      const commits = await versionHistory.getFileHistory(args.path);
      return { commits };
    },
    'knowledge:fileAtCommit': async (_event, args) => {
      const content = await versionHistory.getFileAtCommit(args.path, args.oid);
      return { content };
    },
    'knowledge:restore': async (_event, args) => {
      await versionHistory.restoreFile(args.path, args.oid);
      return { ok: true };
    },
    // Search handler
    'search:query': async (_event, args) => {
      return search(args.query, args.limit, args.types);
    },
  });
}
