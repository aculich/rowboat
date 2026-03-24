import { ServiceEvent } from '@x/shared/src/service-events.js'
import z from 'zod'
import type { SyncActivityVerbosity } from './constants'

type ServiceEventType = z.infer<typeof ServiceEvent>

export function filterEventsByVerbosity(
  events: ServiceEventType[],
  verbosity: SyncActivityVerbosity,
): ServiceEventType[] {
  if (verbosity >= 1) return events
  return events.filter(
    (e) => e.type === 'run_complete' || e.type === 'error' || e.type === 'run_start',
  )
}
