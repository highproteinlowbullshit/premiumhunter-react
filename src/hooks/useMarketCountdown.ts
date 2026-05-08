import { useState, useEffect } from 'react'

export type MarketPhase = 'open' | 'pre' | 'closed'

export interface MarketState {
  phase: MarketPhase
  countdown: string
}

// NYSE/NASDAQ observed holidays 2025–2027
const HOLIDAYS = new Set([
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
  '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-04-02',
  '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06',
  '2027-11-25', '2027-12-24',
])

function getET(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const p: Record<string, string> = {}
  for (const { type, value } of parts) p[type] = value
  const year = parseInt(p.year), month = parseInt(p.month), day = parseInt(p.day)
  const hour = parseInt(p.hour), minute = parseInt(p.minute), second = parseInt(p.second)
  const dow = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
  }).format(date)
  return {
    year, month, day, hour, minute, second, dow,
    dateStr: `${year}-${p.month}-${p.day}`,
  }
}

function isTradingDay(et: ReturnType<typeof getET>) {
  return et.dow !== 'Sat' && et.dow !== 'Sun' && !HOLIDAYS.has(et.dateStr)
}

function fmt(totalSecs: number): string {
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function compute(now: Date): MarketState {
  const nowMs = now.getTime()
  const et = getET(now)

  // ET UTC offset: actual UTC - ET-components-read-as-UTC
  const etAsUTC = Date.UTC(et.year, et.month - 1, et.day, et.hour, et.minute, et.second)
  const etOffsetMs = nowMs - etAsUTC

  const secs = et.hour * 3600 + et.minute * 60 + et.second
  const OPEN = 9 * 3600 + 30 * 60  // 9:30 AM ET
  const CLOSE = 16 * 3600           // 4:00 PM ET
  const PRE = 4 * 3600              // 4:00 AM ET (pre-market start)

  if (isTradingDay(et)) {
    if (secs >= OPEN && secs < CLOSE)
      return { phase: 'open', countdown: fmt(CLOSE - secs) }
    if (secs >= PRE && secs < OPEN)
      return { phase: 'pre', countdown: fmt(OPEN - secs) }
  }

  // Find next trading day's 9:30 AM ET
  for (let offset = 1; offset <= 7; offset++) {
    const cand = getET(new Date(nowMs + offset * 86400000))
    if (isTradingDay(cand)) {
      const targetUTC = Date.UTC(cand.year, cand.month - 1, cand.day, 9, 30, 0) + etOffsetMs
      return { phase: 'closed', countdown: fmt(Math.max(0, Math.round((targetUTC - nowMs) / 1000))) }
    }
  }

  return { phase: 'closed', countdown: '–' }
}

export function useMarketCountdown(): MarketState {
  const [state, setState] = useState<MarketState>(() => compute(new Date()))
  useEffect(() => {
    const id = setInterval(() => setState(compute(new Date())), 1000)
    return () => clearInterval(id)
  }, [])
  return state
}
