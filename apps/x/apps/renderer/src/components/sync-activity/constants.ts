export const MAX_SYNC_EVENTS = 1000

export const RUN_STALE_MS = 2 * 60 * 60 * 1000

export const LS_SYNC_ACTIVITY_MODE = 'rowboat.syncActivity.mode'
export const LS_SYNC_ACTIVITY_VERBOSITY = 'rowboat.syncActivity.verbosity'

export const SERVICE_LABELS: Record<string, string> = {
  gmail: 'Syncing Gmail',
  calendar: 'Syncing Calendar',
  fireflies: 'Syncing Fireflies',
  granola: 'Syncing Granola',
  graph: 'Updating knowledge',
  voice_memo: 'Processing voice memo',
}

export type SyncActivityVerbosity = 0 | 1 | 2 | 3

export const VERBOSITY_LABELS: { value: SyncActivityVerbosity; label: string; description: string }[] = [
  { value: 0, label: 'Quiet', description: 'Runs and errors only; hides routine progress' },
  { value: 1, label: 'Normal', description: 'All events with type badges' },
  { value: 2, label: 'Verbose', description: 'Extra fields: steps, counts, item hints' },
  { value: 3, label: 'Debug', description: 'Full JSON per event when expanded' },
]
