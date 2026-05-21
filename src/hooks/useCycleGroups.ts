import { useMemo } from 'react';
import type { WheelPosition } from '../types';

export interface CycleLeg {
  id: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;
  openedAt: string;
  closedAt: string | undefined;
  premiumCollected: number; // total dollars
  contracts: number;
  status: WheelPosition['status'];
}

export interface WheelCycle {
  id: string;          // unique key for React
  ticker: string;
  legs: CycleLeg[];
  totalPremium: number;
  capitalDeployed: number; // CSP strike × contracts × 100
  openedAt: string;    // date of first leg
  closedAt: string | undefined; // date of last leg close
  isComplete: boolean; // all legs closed/expired
  wasAssigned: boolean;
  annualisedReturn: number | null;
  daysHeld: number | null;
}

export interface CycleGroup {
  ticker: string;
  cycles: WheelCycle[];
  totalPremium: number;
  totalCycles: number;
  completedCycles: number;
}

// ─────────────────────────────────────────────────────────────────────────────

function buildCycles(positions: WheelPosition[]): WheelCycle[] {
  const closedStatuses = new Set(['closed', 'assigned', 'expired']);
  const closed = positions.filter((p) => closedStatuses.has(p.status));

  // Group by ticker
  const byTicker = new Map<string, WheelPosition[]>();
  for (const p of closed) {
    if (!byTicker.has(p.ticker)) byTicker.set(p.ticker, []);
    byTicker.get(p.ticker)!.push(p);
  }

  const cycles: WheelCycle[] = [];

  byTicker.forEach((legs, ticker) => {
    // Sort chronologically so we can walk the sequence
    const sorted = [...legs].sort((a, b) => a.openedAt.localeCompare(b.openedAt));

    let cycleLegs: WheelPosition[] = [];
    let cycleId = 0;

    const flush = () => {
      if (cycleLegs.length === 0) return;
      const cspLeg = cycleLegs.find((l) => l.strategy === 'CSP');
      const totalPremium = cycleLegs.reduce((s, l) => s + l.premiumCollected, 0);
      const capitalDeployed = cspLeg ? cspLeg.strike * cspLeg.contracts * 100 : 0;
      const openedAt = cycleLegs[0].openedAt;
      const allClosedDates = cycleLegs.map(l => l.closedAt).filter((d): d is string => d != null).sort();
      const closedAt = allClosedDates[allClosedDates.length - 1] ?? null;
      const isComplete = cycleLegs.every((l) => closedStatuses.has(l.status));
      const wasAssigned = cycleLegs.some((l) => l.status === 'assigned');

      let annualisedReturn: number | null = null;
      let daysHeld: number | null = null;
      if (isComplete && closedAt && capitalDeployed > 0) {
        const msHeld = new Date(closedAt).getTime() - new Date(openedAt).getTime();
        daysHeld = Math.max(1, Math.ceil(msHeld / 86_400_000));
        const r = totalPremium / capitalDeployed;
        annualisedReturn = Math.round(r * (365 / daysHeld) * 1000) / 10;
      }

      cycles.push({
        id: `${ticker}-${cycleId++}`,
        ticker,
        legs: cycleLegs.map((l) => ({
          id: l.id,
          strategy: l.strategy,
          strike: l.strike,
          expiry: l.expiry,
          openedAt: l.openedAt,
          closedAt: l.closedAt,
          premiumCollected: l.premiumCollected,
          contracts: l.contracts,
          status: l.status,
        })),
        totalPremium: Math.round(totalPremium * 100) / 100,
        capitalDeployed,
        openedAt,
        closedAt,
        isComplete,
        wasAssigned,
        annualisedReturn,
        daysHeld,
      });

      cycleLegs = [];
    };

    for (const pos of sorted) {
      // A new CSP that isn't part of an existing assignment chain starts a fresh cycle
      if (pos.strategy === 'CSP' && cycleLegs.length > 0) {
        // If current cycle has no open assignment, this CSP starts a new cycle
        const prevAssigned = cycleLegs.some((l) => l.status === 'assigned');
        const hasCCs = cycleLegs.some((l) => l.strategy === 'CC');
        if (!prevAssigned || hasCCs) {
          flush();
        }
      }
      cycleLegs.push(pos);

      // When a CC closes or expires (no more CCs open), cycle is complete
      if (pos.strategy === 'CC' && (pos.status === 'closed' || pos.status === 'expired')) {
        const openCCs = cycleLegs.filter(
          (l) => l.strategy === 'CC' && l.status === 'open',
        );
        if (openCCs.length === 0) {
          flush();
        }
      }

      // Non-assigned CSP closure ends the cycle immediately
      if (pos.strategy === 'CSP' && (pos.status === 'closed' || pos.status === 'expired')) {
        flush();
      }
    }

    // Flush any trailing legs (partial cycles or ongoing)
    if (cycleLegs.length > 0) flush();
  });

  // Sort: most recent first
  return cycles.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

// ─────────────────────────────────────────────────────────────────────────────

export function useCycleGroups(positions: WheelPosition[]): CycleGroup[] {
  return useMemo(() => {
    const cycles = buildCycles(positions);

    const groupMap = new Map<string, WheelCycle[]>();
    for (const c of cycles) {
      if (!groupMap.has(c.ticker)) groupMap.set(c.ticker, []);
      groupMap.get(c.ticker)!.push(c);
    }

    const groups: CycleGroup[] = [];
    groupMap.forEach((tickerCycles, ticker) => {
      groups.push({
        ticker,
        cycles: tickerCycles,
        totalPremium: Math.round(tickerCycles.reduce((s, c) => s + c.totalPremium, 0) * 100) / 100,
        totalCycles: tickerCycles.length,
        completedCycles: tickerCycles.filter((c) => c.isComplete).length,
      });
    });

    return groups.sort((a, b) => b.totalPremium - a.totalPremium);
  }, [positions]);
}
