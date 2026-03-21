# Portfolio Cash Adjustment Design

## Goal

When a user adds, edits, or closes a shares or LEAPS holding in the Portfolio tab, show a live "Cash Impact" card inside the modal and — if the user leaves the toggle on — automatically adjust their cash position as part of the same operation.

---

## Scope

Applies to `holdingType` values: `'shares'`, `'leaps_call'`, `'leaps_put'`.
Excluded: `'cash'`, `'other'` — these show no Cash Impact section.

---

## Cash Impact Calculation

| Operation | Formula | Multiplier |
|-----------|---------|------------|
| Add       | `−(quantity × avgCost × multiplier)` | shares: 1, LEAPS: 100 |
| Edit      | `−((newQty × newAvgCost) − (oldQty × oldAvgCost)) × multiplier` | shares: 1, LEAPS: 100 |
| Close     | `+(quantity × closingPrice × multiplier)` | shares: 1, LEAPS: 100 |

`avgCost` is per share. One LEAPS contract = 100 shares, so the multiplier is 100.

For **Edit**: if delta is exactly $0, the Cash Impact section is hidden entirely.

---

## UI: Cash Impact Card

A styled card rendered inside each modal (Add, Edit, Close), positioned above the action buttons, visible only for eligible holding types.

### Content

- **Header:** "Cash Impact" with a dollar/wallet icon
- **Description line:** Human-readable summary of the transaction, e.g.:
  - Add: *"Buying 100 AAPL @ $113.20 will cost $11,320.00."*
  - Edit: *"Increasing your AAPL position will cost an additional $2,264.00."* (or *"Reducing… will return $2,264.00."*)
  - Close: *"Selling 100 AAPL @ $118.00 will return $11,800.00."*
- **Balance line:** `Balance: $45,000 → $33,680` (current → after adjustment), using `totalCashBalance` already computed in `Portfolio.tsx` at lines 1060–1062
- **Toggle:** `☑ Deduct from cash position` / `☑ Add to cash position` — defaults to **on**
- **Overdraft warning (amber):** Shown if adjustment would make cash negative: *"This would overdraw your cash balance"* — user can still proceed
- **No cash holding note:** If no cash holding exists and toggle is on: *"A cash holding will be created automatically"*

### Live updates

The card recalculates on every keystroke in quantity, avgCost (add/edit), or closingPrice (close) fields.

---

## Data Flow

### New helper: `adjustCash(delta: number)` in `usePortfolio.ts`

Mirrors the pattern already used in `usePositions.ts` for wheel position premiums.

**Query pattern** (match `usePositions.ts` exactly — do NOT filter by ticker):
```typescript
const { data: cashRows } = await supabase
  .from('portfolio_holdings')
  .select('id, quantity')
  .eq('user_id', user.id)
  .eq('holding_type', 'cash')
  .eq('status', 'open')
  .order('quantity', { ascending: false });
```

**Logic:**
1. Find open cash holdings filtered by `holding_type = 'cash'` and `status = 'open'` (no ticker filter — matches both `'USD'` rows from wheel operations and `'CASH'` rows from portfolio operations)
2. If found: update the largest one's `quantity` by `+ delta` via Supabase
3. If not found: insert a new cash holding `{ ticker: 'USD', holdingType: 'cash', quantity: delta, avgCost: 1, openedAt: today, status: 'open' }` — use `'USD'` to match the pattern from `usePositions.ts`
4. Do **not** call `loadData()` — the caller is responsible for refresh timing (see handler section below)

**Error handling** (match `usePositions.ts` toast pattern):
- On failure: show toast `'Holding saved — but failed to adjust cash position'` with level `'error'`
- Do not throw; degraded state is acceptable (holding was already saved)

**Export:** `adjustCash` must be exported from the `usePortfolio` hook return value.

### Handler signatures (Portfolio.tsx)

The handlers have access to original holding data via existing component state (`editingHolding`, `closingHolding`) — no need to change modal `onSubmit` signatures.

```typescript
handleAddHolding(data: AddHoldingData, shouldAdjustCash: boolean)
  → await addHolding(data)          // internally calls loadData()
  → if shouldAdjustCash: await adjustCash(-(qty × avgCost × multiplier))
  // No extra loadData() call needed — addHolding already refreshes

handleEditHolding(id: string, data: EditHoldingData, shouldAdjustCash: boolean)
  // originalHolding is available as editingHolding state in Portfolio.tsx
  → await editHolding(id, data)     // internally calls loadData()
  → if shouldAdjustCash && delta !== 0: await adjustCash(-delta)

handleCloseHolding(id: string, price: number, shouldAdjustCash: boolean)
  // holding is available as closingHolding state in Portfolio.tsx
  → await closeHolding(id, price)   // internally calls loadData()
  → if shouldAdjustCash: await adjustCash(+(qty × price × multiplier))
```

Note: `addHolding`, `editHolding`, and `closeHolding` each already call `loadData()` internally on success. `adjustCash` does **not** call `loadData()`. This means the cash holding update will be reflected on the next natural re-render or interaction — acceptable tradeoff to avoid a double refresh (which would trigger redundant Finnhub API calls for all tickers). If immediate cash reflection is required, a targeted single-row refresh could be added to `adjustCash` in a future iteration.

### Modal prop changes

Each modal receives one additional prop:
```typescript
totalCashBalance: number  // sum of all open cash holdings, already in Portfolio.tsx
```

The modal computes `cashImpact` internally from its own form state. The `multiplier` is derived from `holdingType` within the modal.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| No cash holding exists | Creates one with ticker `'USD'` |
| Cash would go negative | Amber warning shown; user can still proceed |
| Edit with $0 delta | Cash Impact section hidden entirely |
| User toggles off | Holding saved normally, cash untouched |
| LEAPS with 0 quantity | Impact = $0; section hidden |
| `avgCost` or `closingPrice` not yet entered | Balance line shows `—` (not yet computable) |
| `adjustCash` Supabase error | Toast shown; holding save is unaffected |

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePortfolio.ts` | Add `adjustCash(delta: number)` helper; export it from hook return value |
| `src/pages/Portfolio.tsx` | Add Cash Impact card to Add/Edit/Close modals; update handler signatures to accept `shouldAdjustCash` |

No new files. No schema changes.
