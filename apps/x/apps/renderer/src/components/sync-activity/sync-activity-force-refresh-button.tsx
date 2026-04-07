"use client"

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSyncActivityUi } from './sync-activity-ui-context'

export function SyncActivityForceRefreshButton({
  tooltipSide = 'bottom',
}: {
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const { triggerManualSync } = useSyncActivityUi()
  const [pending, setPending] = useState(false)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={pending}
          aria-label="Refresh sync"
          onClick={(e) => {
            e.stopPropagation()
            void (async () => {
              setPending(true)
              try {
                await triggerManualSync()
              } finally {
                setPending(false)
              }
            })()
          }}
        >
          <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>Refresh sync</TooltipContent>
    </Tooltip>
  )
}
