"use client"

import { Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VERBOSITY_LABELS, type SyncActivityVerbosity } from './constants'
import { useSyncActivityUi } from './sync-activity-ui-context'

export function SyncActivityVerbosityControl() {
  const { verbosity, setVerbosity } = useSyncActivityUi()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Log verbosity"
        >
          <Bug className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Verbosity</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={String(verbosity)}
          onValueChange={(v) => setVerbosity(Number(v) as SyncActivityVerbosity)}
        >
          {VERBOSITY_LABELS.map((opt) => (
            <DropdownMenuRadioItem
              key={opt.value}
              value={String(opt.value)}
              className="items-start py-2"
            >
              <span className="flex flex-col gap-0.5 text-left">
                <span className="font-medium leading-none">{opt.label}</span>
                <span className="text-xs font-normal text-muted-foreground leading-snug">
                  {opt.description}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
