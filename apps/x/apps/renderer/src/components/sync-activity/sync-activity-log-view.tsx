"use client"

import { useMemo } from 'react'
import { ChevronDown, Copy } from 'lucide-react'
import { ServiceEvent } from '@x/shared/src/service-events.js'
import z from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { toast } from '@/lib/toast'
import {
  SERVICE_LABELS,
  type SyncActivityVerbosity,
} from './constants'
import { filterEventsByVerbosity } from './sync-activity-utils'

type ServiceEventType = z.infer<typeof ServiceEvent>

export function formatEventTime(ts: string): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function servicePillLabel(service: string): string {
  return SERVICE_LABELS[service]?.split(' ').slice(-1)[0] || service
}

function typeBadgeLabel(type: ServiceEventType['type']): string {
  switch (type) {
    case 'run_start':
      return 'start'
    case 'run_complete':
      return 'done'
    case 'changes_identified':
      return 'changes'
    case 'progress':
      return 'progress'
    case 'error':
      return 'error'
    default:
      return type
  }
}

function verboseSecondaryLine(event: ServiceEventType): string | null {
  const parts: string[] = []
  if (event.type === 'progress') {
    if (event.step) parts.push(event.step)
    if (event.current != null && event.total != null) {
      parts.push(`${event.current}/${event.total}`)
    }
  }
  if (event.type === 'changes_identified' && event.counts) {
    parts.push(
      Object.entries(event.counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', '),
    )
  }
  if (event.type === 'run_complete' && event.summary) {
    parts.push(
      Object.entries(event.summary)
        .map(([k, v]) => `${k}=${String(v)}`)
        .slice(0, 4)
        .join(', '),
    )
  }
  if (event.type === 'changes_identified' && event.items?.length) {
    parts.push(`${event.items.length} item(s)`)
  }
  if (event.type === 'run_complete' && event.items?.length) {
    parts.push(`${event.items.length} item(s)`)
  }
  return parts.length ? parts.join(' · ') : null
}

export function SyncActivityLogView({
  events,
  verbosity,
  expandedRowKey,
  onToggleExpand,
  className,
  emptyClassName,
}: {
  events: ServiceEventType[]
  verbosity: SyncActivityVerbosity
  expandedRowKey: string | null
  onToggleExpand: (key: string) => void
  className?: string
  emptyClassName?: string
}) {
  const filtered = useMemo(
    () => filterEventsByVerbosity(events, verbosity),
    [events, verbosity],
  )

  if (filtered.length === 0) {
    return (
      <div
        className={cn(
          'py-4 text-center text-xs text-muted-foreground',
          emptyClassName,
        )}
      >
        No recent activity.
      </div>
    )
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {filtered.map((event, idx) => {
        const rowKey = `${event.runId}-${event.ts}-${event.type}-${idx}`
        const expanded = expandedRowKey === rowKey
        const secondary = verbosity >= 2 ? verboseSecondaryLine(event) : null
        const showTypeBadge = verbosity >= 1

        return (
          <HoverCard key={rowKey} openDelay={400} closeDelay={100}>
            <div
              className={cn(
                'rounded px-2 py-1 text-xs hover:bg-accent',
                expanded && 'bg-accent/60',
              )}
            >
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 text-left"
                  aria-expanded={expanded}
                  onClick={() => onToggleExpand(rowKey)}
                >
                  <ChevronDown
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                      expanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                  <span className="shrink-0 text-[10px] leading-4 text-muted-foreground/70">
                    {formatEventTime(event.ts)}
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1">
                    <span
                      className={cn(
                        'inline-block rounded px-1 py-0.5 text-[10px] font-medium leading-none',
                        event.level === 'error'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : event.level === 'warn'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {servicePillLabel(event.service)}
                    </span>
                    {showTypeBadge ? (
                      <span className="rounded bg-muted/80 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        {typeBadgeLabel(event.type)}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 leading-4">
                    <span className="line-clamp-1 text-foreground/80">{event.message}</span>
                    {secondary ? (
                      <span className="mt-0.5 block line-clamp-2 text-[10px] text-muted-foreground">
                        {secondary}
                      </span>
                    ) : null}
                  </span>
                </button>
              </HoverCardTrigger>
              {expanded ? (
                <div className="mt-2 space-y-2 border-t border-border/60 pt-2 pl-7">
                  {verbosity >= 1 && verbosity < 3 ? (
                    <p className="whitespace-pre-wrap break-words text-xs text-foreground/90">
                      {event.message}
                    </p>
                  ) : null}
                  {verbosity >= 2 ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                      <dt className="font-medium text-foreground/70">runId</dt>
                      <dd className="font-mono break-all">{event.runId}</dd>
                      <dt className="font-medium text-foreground/70">type</dt>
                      <dd>{event.type}</dd>
                      {event.type === 'run_start' && event.trigger ? (
                        <>
                          <dt className="font-medium text-foreground/70">trigger</dt>
                          <dd>{event.trigger}</dd>
                        </>
                      ) : null}
                      {event.type === 'error' ? (
                        <>
                          <dt className="font-medium text-foreground/70">error</dt>
                          <dd className="break-words text-destructive">{event.error}</dd>
                        </>
                      ) : null}
                      {event.type === 'run_complete' ? (
                        <>
                          <dt className="font-medium text-foreground/70">outcome</dt>
                          <dd>{event.outcome}</dd>
                          <dt className="font-medium text-foreground/70">duration</dt>
                          <dd>{event.durationMs} ms</dd>
                        </>
                      ) : null}
                    </dl>
                  ) : null}
                  {verbosity >= 3 ? (
                    <div className="space-y-1">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation()
                            void navigator.clipboard.writeText(
                              JSON.stringify(event, null, 2),
                            )
                            toast('Copied JSON', 'success')
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Copy JSON
                        </Button>
                      </div>
                      <pre className="max-h-48 overflow-auto rounded border border-border bg-muted/40 p-2 text-[10px] leading-snug">
                        {JSON.stringify(event, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <HoverCardContent side="left" align="start" className="w-80 text-xs">
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">
                    {event.type} · {event.service}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{event.message}</p>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono break-all">runId: {event.runId}</span>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </div>
  )
}
