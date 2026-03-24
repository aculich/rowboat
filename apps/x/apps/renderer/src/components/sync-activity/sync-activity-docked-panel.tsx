"use client"

import { LoaderIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { SERVICE_LABELS } from './constants'
import { SyncActivityLogView } from './sync-activity-log-view'
import { useSyncActivityUi } from './sync-activity-ui-context'
import { SyncActivityVerbosityControl } from './sync-activity-verbosity-control'

export function SyncActivityDockedPanel({ className }: { className?: string }) {
  const isMobile = useIsMobile()
  const {
    mode,
    verbosity,
    logEvents,
    logLoading,
    activeServices,
    expandedRowKey,
    toggleRowExpanded,
    undockToPopover,
  } = useSyncActivityUi()

  if (isMobile || mode !== 'docked') return null

  const isSyncing = activeServices.size > 0
  const activeServiceNames = [...new Set(activeServices.values())]
  const statusLabel = isSyncing
    ? activeServiceNames.map((s) => SERVICE_LABELS[s] || s).join(', ')
    : 'All caught up'

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l border-border bg-background',
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Sync Activity</h2>
          <p className="truncate text-xs text-muted-foreground">{statusLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <SyncActivityVerbosityControl />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => undockToPopover()}
                aria-label="Undock to sidebar popover"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Undock to sidebar popover</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {logLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoaderIcon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SyncActivityLogView
            events={logEvents}
            verbosity={verbosity}
            expandedRowKey={expandedRowKey}
            onToggleExpand={toggleRowExpanded}
          />
        )}
      </div>
    </div>
  )
}
