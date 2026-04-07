type MemoryDebugControls = {
  start: () => void
  stop: () => void
  sample: () => Promise<void>
  isEnabled: () => boolean
}

type InstallMemoryDebugOptions = {
  autoStart: boolean
  intervalMs: number
  getCounters: () => Record<string, number>
}

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false
  const lowered = value.trim().toLowerCase()
  return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on'
}

function sanitizeInterval(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 5000
  return Math.max(1000, Math.floor(value))
}

export function memoryDebugEnabledFromEnv(): boolean {
  return parseBooleanEnv(import.meta.env.VITE_MEMORY_DEBUG)
}

export function memoryDebugIntervalFromEnv(): number {
  const raw = Number(import.meta.env.VITE_MEMORY_DEBUG_INTERVAL_MS)
  return sanitizeInterval(raw)
}

export function installMemoryDebugProbe(options: InstallMemoryDebugOptions): () => void {
  let enabled = false
  let timer: number | null = null

  const sample = async () => {
    const at = new Date().toISOString()
    const counters = options.getCounters()
    const perf = performance as PerformanceWithMemory
    const heap = perf.memory
      ? {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
        }
      : null

    let mainMemory: unknown = null
    try {
      mainMemory = await window.ipc.invoke('app:getMemoryStats', null)
    } catch (error) {
      mainMemory = {
        error: error instanceof Error ? error.message : 'Failed to read main process memory stats',
      }
    }

    let persistedPath: string | null = null
    if (mainMemory && typeof mainMemory === 'object' && !('error' in mainMemory)) {
      try {
        const persisted = await window.ipc.invoke('app:appendMemorySample', {
          at,
          rendererHeap: heap,
          counters,
          mainMemory,
        })
        persistedPath = persisted.path
      } catch {
        // Best-effort persistence: keep probe running even if disk logging fails.
      }
    }

    // Intentionally logs compact telemetry snapshots for leak hunting.
    console.info('[rowboat:memory]', {
      at,
      rendererHeap: heap,
      counters,
      mainMemory,
      persistedPath,
    })
  }

  const stop = () => {
    if (timer != null) {
      window.clearInterval(timer)
      timer = null
    }
    enabled = false
  }

  const start = () => {
    if (enabled) return
    enabled = true
    void sample()
    timer = window.setInterval(() => {
      void sample()
    }, options.intervalMs)
  }

  const controls: MemoryDebugControls = {
    start,
    stop,
    sample,
    isEnabled: () => enabled,
  }

  window.__rowboatMemoryDebug = controls

  if (options.autoStart) {
    start()
  }

  return () => {
    stop()
    if (window.__rowboatMemoryDebug === controls) {
      delete window.__rowboatMemoryDebug
    }
  }
}
