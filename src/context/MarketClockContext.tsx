import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface MarketClockCtx {
  show: boolean
  toggle: () => void
}

const Ctx = createContext<MarketClockCtx>({ show: false, toggle: () => {} })

export function MarketClockProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem('ph_market_clock') === 'true' } catch { return false }
  })
  const toggle = () => setShow(v => {
    const next = !v
    try { localStorage.setItem('ph_market_clock', String(next)) } catch {}
    return next
  })
  return <Ctx.Provider value={{ show, toggle }}>{children}</Ctx.Provider>
}

export const useMarketClock = () => useContext(Ctx)
