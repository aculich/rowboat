"use client"

import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ServiceEvent } from '@x/shared/src/service-events.js'
import z from 'zod'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  LS_SYNC_ACTIVITY_MODE,
  LS_SYNC_ACTIVITY_VERBOSITY,
  MAX_SYNC_EVENTS,
  RUN_STALE_MS,
  type SyncActivityVerbosity,
} from './constants'

type ServiceEventType = z.infer<typeof ServiceEvent>

export type SyncActivityDisplayMode = 'popover' | 'docked'

function readStoredMode(): SyncActivityDisplayMode {
  try {
    const v = localStorage.getItem(LS_SYNC_ACTIVITY_MODE)
    if (v === 'docked' || v === 'popover') return v
  } catch {
    /* ignore */
  }
  return 'popover'
}

function readStoredVerbosity(): SyncActivityVerbosity {
  try {
    const v = localStorage.getItem(LS_SYNC_ACTIVITY_VERBOSITY)
    const n = v == null ? NaN : Number(v)
    if (n === 0 || n === 1 || n === 2 || n === 3) return n
  } catch {
    /* ignore */
  }
  return 1
}

function eventDedupeKey(e: ServiceEventType): string {
  return `${e.runId}|${e.ts}|${e.type}|${e.message}`
}

type SyncActivityUiContextValue = {
  mode: SyncActivityDisplayMode
  verbosity: SyncActivityVerbosity
  setVerbosity: (v: SyncActivityVerbosity) => void
  popoverOpen: boolean
  setPopoverOpen: (open: boolean) => void
  logEvents: ServiceEventType[]
  logLoading: boolean
  activeServices: Map<string, string>
  expandedRowKey: string | null
  setExpandedRowKey: (key: string | null) => void
  toggleRowExpanded: (key: string) => void
  dockFromPopover: () => void
  undockToPopover: () => void
  isLogPanelActive: boolean
  /** Footer: when docked, click returns to popover */
  onFooterActivate: () => void
}

const SyncActivityUiContext = React.createContext<SyncActivityUiContextValue | null>(null)

export function SyncActivityUiProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [mode, setModeState] = useState<SyncActivityDisplayMode>(() =>
    typeof window === 'undefined' ? 'popover' : readStoredMode(),
  )
  const [verbosity, setVerbosityState] = useState<SyncActivityVerbosity>(() =>
    typeof window === 'undefined' ? 1 : readStoredVerbosity(),
  )
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [logEvents, setLogEvents] = useState<ServiceEventType[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [activeServices, setActiveServices] = useState<Map<string, string>>(new Map())
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const runTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const setMode = useCallback((next: SyncActivityDisplayMode) => {
    setModeState(next)
    try {
      localStorage.setItem(LS_SYNC_ACTIVITY_MODE, next)
    } catch {
      /* ignore */
    }
  }, [])

  const setVerbosity = useCallback((v: SyncActivityVerbosity) => {
    setVerbosityState(v)
    try {
      localStorage.setItem(LS_SYNC_ACTIVITY_VERBOSITY, String(v))
    } catch {
      /* ignore */
    }
  }, [])

  const isLogPanelActive = popoverOpen || (mode === 'docked' && !isMobile)

  const loadLogs = useCallback(async () => {
    setLogLoading(true)
    try {
      const result = await window.ipc.invoke('workspace:readFile', {
        path: 'logs/services.jsonl',
        encoding: 'utf8',
      })
      const lines = result.data.trim().split('\n').filter(Boolean)
      const parsed: ServiceEventType[] = []
      for (const line of lines) {
        try {
          const raw = JSON.parse(line) as unknown
          const ok = ServiceEvent.safeParse(raw)
          if (ok.success) parsed.push(ok.data)
        } catch {
          /* skip */
        }
      }
      setLogEvents(parsed.reverse().slice(0, MAX_SYNC_EVENTS))
    } catch {
      setLogEvents([])
    } finally {
      setLogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLogPanelActive) return
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await loadLogs()
    })()
    return () => {
      cancelled = true
    }
  }, [isLogPanelActive, loadLogs])

  const mergeLiveEvent = useCallback((nextEvent: ServiceEventType) => {
    setLogEvents((prev) => {
      const key = eventDedupeKey(nextEvent)
      const exists = prev.some((e) => eventDedupeKey(e) === key)
      if (exists) return prev
      return [nextEvent, ...prev].slice(0, MAX_SYNC_EVENTS)
    })
  }, [])

  const isLogPanelActiveRef = useRef(isLogPanelActive)
  isLogPanelActiveRef.current = isLogPanelActive

  useEffect(() => {
    const cleanup = window.ipc.on('services:events', (event) => {
      const ok = ServiceEvent.safeParse(event)
      if (!ok.success) return
      const nextEvent = ok.data

      if (nextEvent.type === 'run_start') {
        setActiveServices((prev) => {
          const next = new Map(prev)
          next.set(nextEvent.runId, nextEvent.service)
          return next
        })
        const existingTimeout = runTimeoutsRef.current.get(nextEvent.runId)
        if (existingTimeout) clearTimeout(existingTimeout)
        const timeout = setTimeout(() => {
          setActiveServices((prev) => {
            if (!prev.has(nextEvent.runId)) return prev
            const n = new Map(prev)
            n.delete(nextEvent.runId)
            return n
          })
          runTimeoutsRef.current.delete(nextEvent.runId)
        }, RUN_STALE_MS)
        runTimeoutsRef.current.set(nextEvent.runId, timeout)
      } else if (nextEvent.type === 'run_complete') {
        setActiveServices((prev) => {
          const next = new Map(prev)
          next.delete(nextEvent.runId)
          return next
        })
        const existingTimeout = runTimeoutsRef.current.get(nextEvent.runId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          runTimeoutsRef.current.delete(nextEvent.runId)
        }
      }

      if (isLogPanelActiveRef.current) {
        mergeLiveEvent(ok.data)
      }
    })
    return cleanup
  }, [mergeLiveEvent])

  useEffect(() => {
    return () => {
      runTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      runTimeoutsRef.current.clear()
    }
  }, [])

  const dockFromPopover = useCallback(() => {
    setPopoverOpen(false)
    setMode('docked')
  }, [setMode])

  const undockToPopover = useCallback(() => {
    setMode('popover')
    setPopoverOpen(true)
  }, [setMode])

  const onFooterActivate = useCallback(() => {
    if (mode === 'docked') {
      undockToPopover()
    }
  }, [mode, undockToPopover])

  const toggleRowExpanded = useCallback((key: string) => {
    setExpandedRowKey((prev) => (prev === key ? null : key))
  }, [])

  const value = useMemo<SyncActivityUiContextValue>(
    () => ({
      mode,
      verbosity,
      setVerbosity,
      popoverOpen,
      setPopoverOpen,
      logEvents,
      logLoading,
      activeServices,
      expandedRowKey,
      setExpandedRowKey,
      toggleRowExpanded,
      dockFromPopover,
      undockToPopover,
      isLogPanelActive,
      onFooterActivate,
    }),
    [
      mode,
      verbosity,
      setVerbosity,
      popoverOpen,
      logEvents,
      logLoading,
      activeServices,
      expandedRowKey,
      toggleRowExpanded,
      dockFromPopover,
      undockToPopover,
      isLogPanelActive,
      onFooterActivate,
    ],
  )

  return (
    <SyncActivityUiContext.Provider value={value}>{children}</SyncActivityUiContext.Provider>
  )
}

export function useSyncActivityUi(): SyncActivityUiContextValue {
  const ctx = React.useContext(SyncActivityUiContext)
  if (!ctx) {
    throw new Error('useSyncActivityUi must be used within SyncActivityUiProvider')
  }
  return ctx
}
