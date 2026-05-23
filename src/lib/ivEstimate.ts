/**
 * HV-to-IV estimator using empirically grounded adjustments.
 *
 * Since we compute volatility from historical price returns (HV30) rather than
 * from live options chain prices, we apply three multiplicative adjustments to
 * arrive at a more realistic implied-volatility estimate:
 *
 *  1. Variance Risk Premium (VRP) — markets systematically price options above
 *     realised vol (the seller's edge). Base: ~1.20× for single-stock equity.
 *     Adjusts with IV rank: low-vol regimes demand more insurance (VRP expands);
 *     high-vol regimes see VRP compress as realized vol "catches up".
 *
 *  2. Vol momentum — HV30/HV60 ratio captures whether recent vol is accelerating
 *     or decelerating. Rising vol → market prices in more; falling vol → less.
 *
 *  3. Earnings proximity — the market prices the discrete gap risk of an earnings
 *     release. IV inflates materially within 3 weeks of the event.
 *
 * Output is rounded to one decimal place, floored at 90% of HV30 (IV almost
 * never trades below realised vol for single-stock equity), and capped at 200%.
 */
export function estimateIV(
  hv30: number,              // 30-day realised HV in % (e.g. 35 for 35%)
  hvRatio: number | null,    // hv30 / hv60; > 1 = accelerating vol
  ivRank: number | null,     // 0–100 position in 52-wk HV range
  earningsDTE: number | null, // calendar days to next earnings; null = none known
): number {
  if (hv30 <= 0) return 0;

  // ── 1. Base VRP, adjusted for vol regime ────────────────────────────────
  let vrp = 1.20;
  if (ivRank !== null) {
    if (ivRank >= 80)      vrp = 1.10; // very high vol — VRP compresses
    else if (ivRank >= 60) vrp = 1.15;
    else if (ivRank >= 40) vrp = 1.20; // neutral
    else if (ivRank >= 20) vrp = 1.25;
    else                   vrp = 1.30; // very low vol — VRP expands
  }

  // ── 2. Vol momentum factor ───────────────────────────────────────────────
  let momentumFactor = 1.0;
  if (hvRatio !== null) {
    if (hvRatio >= 1.4)       momentumFactor = 1.12; // vol accelerating sharply
    else if (hvRatio >= 1.2)  momentumFactor = 1.07;
    else if (hvRatio >= 1.0)  momentumFactor = 1.03;
    else if (hvRatio >= 0.85) momentumFactor = 0.98; // vol decelerating
    else                      momentumFactor = 0.92; // vol collapsing
  }

  // ── 3. Earnings proximity premium ───────────────────────────────────────
  let earningsFactor = 1.0;
  if (earningsDTE !== null && earningsDTE >= 0) {
    if (earningsDTE <= 5)       earningsFactor = 1.60;
    else if (earningsDTE <= 10) earningsFactor = 1.40;
    else if (earningsDTE <= 14) earningsFactor = 1.25;
    else if (earningsDTE <= 21) earningsFactor = 1.12;
    else if (earningsDTE <= 30) earningsFactor = 1.05;
  }

  const raw = hv30 * vrp * momentumFactor * earningsFactor;

  // Floor at 90% of HV30; cap at 200%
  return Math.round(Math.min(Math.max(raw, hv30 * 0.90), 200) * 10) / 10;
}
