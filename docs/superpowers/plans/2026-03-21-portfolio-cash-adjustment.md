 # Portfolio Cash Adjustment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding, editing, or closing a shares/LEAPS holding in Portfolio, show a live "Cash Impact" card inside the modal and automatically adjust cash if the user leaves the toggle on.

**Architecture:** Add `adjustCash(delta)` to `usePortfolio.ts` (mirroring the existing pattern in `usePositions.ts`). Each of the three modals gets a `totalCashBalance` prop, computes cash impact from its own form state, renders a styled card with a toggle, and passes `shouldAdjustCash` through `onSubmit`. Handlers in `Portfolio.tsx` call `adjustCash` after the primary operation when the flag is set.

**Tech Stack:** TypeScript, React 18, Supabase, existing hook patterns from `usePositions.ts`.

---

## Critical codebase facts

- **LEAPS multiplier:** `avgCost` is per-share; one LEAPS contract = 100 shares → total cost = `qty × avgCost × 100`. Shares multiplier = 1.
- **Cash query pattern** (must match `usePositions.ts` exactly): `.eq('holding_type', 'cash').eq('status', 'open').order('quantity', { ascending: false }).limit(1).maybeSingle()` — **no ticker filter**.
- **New cash rows** use `ticker: 'USD'` (matching `usePositions.ts` line 163).
- **`adjustCash` must NOT call `loadData()`** — `addHolding`, `editHolding`, `closeHolding` already call it internally.
- **`totalCashBalance`** is already computed in `Portfolio.tsx` at line 1060–1062 as the sum of open cash holding quantities.
- **Original holding** for edit delta is available as `editingHolding` state; for close proceeds use `closingHolding` state — no need to change modal `onSubmit` type beyond adding `shouldAdjustCash`.
- **Eligible types:** `'shares'`, `'leaps_call'`, `'leaps_put'`. Skip cash and other.
- **Error toast pattern** (from `usePositions.ts` line 154): `'Holding saved — but failed to adjust cash position. Update manually.'`

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/hooks/usePortfolio.ts` | Add `adjustCash(delta: number)`, export it |
| Modify | `src/pages/Portfolio.tsx` | Cash Impact card in Add/Edit/Close modals; updated handlers |

---

## Chunk 1: `adjustCash` helper in `usePortfolio.ts`

### Task 1: Add and export `adjustCash`

**Files:**
- Modify: `src/hooks/usePortfolio.ts:329–425`

#### Background

`adjustCash(delta)` finds the largest open cash holding and increments its quantity by `delta`. If none exists, creates a new one with `ticker: 'USD'`. Does not call `loadData()`. On Supabase error, shows a toast. This mirrors the exact pattern in `usePositions.ts` lines 137–175.

- [ ] **Step 1: Add `adjustCash` after `editHolding` (before the `return` statement at line 411)**

Add this function inside `usePortfolio()`, after the `editHolding` declaration and before the `return` block:

```typescript
const adjustCash = useCallback(
  async (delta: number) => {
    if (!user) return;

    const { data: cashRow } = await supabase
      .from('portfolio_holdings')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('holding_type', 'cash')
      .eq('status', 'open')
      .order('quantity', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cashRow) {
      const { error } = await supabase
        .from('portfolio_holdings')
        .update({ quantity: Number(cashRow.quantity) + delta })
        .eq('id', cashRow.id);
      if (error) {
        showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
      }
    } else {
      const { error } = await supabase
        .from('portfolio_holdings')
        .insert({
          user_id: user.id,
          holding_type: 'cash',
          ticker: 'USD',
          quantity: delta,
          avg_cost: 1,
          status: 'open',
          opened_at: new Date().toISOString().split('T')[0],
        });
      if (error) {
        showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
      }
    }
  },
  [user, showToast]
);
```

- [ ] **Step 2: Export `adjustCash` from the hook return value**

Find the `return {` block at line 411 and add `adjustCash` to it:

```typescript
return {
  holdingsWithPrice,
  openHoldings,
  snapshots,
  isLoading,
  addHolding,
  closeHolding,
  editHolding,
  adjustCash,      // ← add this
  totalValue,
  totalCost,
  unrealizedPnl,
  realizedPnl,
  optionsPremium,
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npx tsc --noEmit 2>&1 | grep usePortfolio
```

Expected: no output.

---

## Chunk 2: Cash Impact card + handler updates in `Portfolio.tsx`

### Task 2: Add Cash Impact card to `AddHoldingModal`

**Files:**
- Modify: `src/pages/Portfolio.tsx:150–473`

#### Background

The Cash Impact card sits above the submit button. It is shown only when `holdingType` is `'shares'`, `'leaps_call'`, or `'leaps_put'`, AND both `qty > 0` and `cost > 0`. The card shows the dollar impact, the before/after balance, and a toggle defaulting to on. The modal passes `shouldAdjustCash` as a second argument to `onSubmit`.

- [ ] **Step 1: Add `totalCashBalance` to `AddHoldingModalProps` and add `adjustCash` state**

Change the props interface (lines 150–163) and add state inside the component (after line 179):

```typescript
// Props interface change — add totalCashBalance:
interface AddHoldingModalProps {
  onClose: () => void;
  onSubmit: (data: {
    ticker: string;
    holdingType: HoldingType;
    quantity: number;
    avgCost: number;
    openedAt: string;
    expiry?: string;
    strike?: number;
    notes?: string;
  }, shouldAdjustCash: boolean) => void;
  livePrices: Map<string, number | null>;
  totalCashBalance: number;
}
```

Inside `AddHoldingModal` function body, after existing state declarations, add:

```typescript
const [doAdjustCash, setDoAdjustCash] = useState(true);

const isEligible = holdingType === 'shares' || holdingType === 'leaps_call' || holdingType === 'leaps_put';
const multiplier = isLeaps ? 100 : 1;
const cashImpact = isEligible && qty > 0 && cost > 0 ? -(qty * cost * multiplier) : null;
const balanceAfter = cashImpact !== null ? totalCashBalance + cashImpact : null;
const wouldOverdraw = balanceAfter !== null && balanceAfter < 0;
const noCashHolding = totalCashBalance === 0;
```

- [ ] **Step 2: Update `handleSubmit` in `AddHoldingModal` to pass `doAdjustCash`**

Find `handleSubmit` (lines 208–226) and change all `onSubmit(...)` calls to pass `doAdjustCash && isEligible` as the second arg:

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (isCash) {
    if (qty <= 0) return;
    onSubmit({ ticker: 'CASH', holdingType: 'cash', quantity: qty, avgCost: 1, openedAt, notes: notes.trim() || undefined }, false);
    return;
  }
  if (!ticker.trim() || qty <= 0 || cost <= 0) return;
  onSubmit({
    ticker: ticker.toUpperCase(),
    holdingType,
    quantity: qty,
    avgCost: cost,
    openedAt,
    expiry: isLeaps && expiry ? expiry : undefined,
    strike: isLeaps && strike ? parseFloat(strike) : undefined,
    notes: notes.trim() || undefined,
  }, doAdjustCash && isEligible);
};
```

- [ ] **Step 3: Add Cash Impact card JSX inside the form, between the preview row and the submit button**

After the existing preview block (after the closing `}` of `{!isCash && qty > 0 && cost > 0 && (...)}` at line ~450) and before the submit button (line ~452), insert:

```tsx
{/* Cash Impact card */}
{cashImpact !== null && (
  <div
    style={{
      background: wouldOverdraw ? 'rgba(245,200,66,0.06)' : 'rgba(0,229,196,0.04)',
      border: `1px solid ${wouldOverdraw ? 'rgba(245,200,66,0.25)' : 'rgba(0,229,196,0.1)'}`,
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>💵</span>
      <span style={{ color: '#e8f0fe', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
        Cash Impact
      </span>
    </div>
    <p style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
      Buying {qty} {ticker || '—'} @ ${cost.toFixed(2)}{isLeaps ? ' (×100/contract)' : ''} will cost{' '}
      <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
        {formatDollars(Math.abs(cashImpact))}
      </span>.
    </p>
    <p style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
      Balance:{' '}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
        {formatDollars(totalCashBalance)}
      </span>
      {' → '}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: wouldOverdraw ? '#f5c842' : '#00d68f' }}>
        {balanceAfter !== null ? formatDollars(balanceAfter) : '—'}
      </span>
    </p>
    {wouldOverdraw && (
      <p style={{ color: '#f5c842', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        ⚠ This would overdraw your cash balance.
      </p>
    )}
    {noCashHolding && doAdjustCash && (
      <p style={{ color: '#9ab4d4', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        A cash holding will be created automatically.
      </p>
    )}
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={doAdjustCash}
        onChange={(e) => setDoAdjustCash(e.target.checked)}
        style={{ accentColor: '#00e5c4', width: 14, height: 14 }}
      />
      <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
        Deduct {formatDollars(Math.abs(cashImpact))} from cash position
      </span>
    </label>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles (AddHoldingModal changes)**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only about `AddHoldingModal` props mismatch at the call site (we haven't updated the call site yet) — or no errors. Either is fine at this stage.

---

### Task 3: Add Cash Impact card to `EditHoldingModal`

**Files:**
- Modify: `src/pages/Portfolio.tsx:477–649`

#### Background

For edit, the cash impact is the **delta** between new cost basis and old cost basis. The old values come from the `holding` prop. If delta is $0, the card is hidden.

- [ ] **Step 1: Add `totalCashBalance` to `EditHoldingModalProps` and update `onSubmit` signature**

```typescript
interface EditHoldingModalProps {
  holding: HoldingWithPrice;
  onClose: () => void;
  onSubmit: (id: string, data: {
    ticker: string;
    holdingType: HoldingType;
    quantity: number;
    avgCost: number;
    openedAt: string;
    expiry?: string;
    strike?: number;
    notes?: string;
  }, shouldAdjustCash: boolean) => void;
  totalCashBalance: number;
}
```

- [ ] **Step 2: Add state and computed values inside `EditHoldingModal`**

After the existing state declarations (after line 505), add:

```typescript
const [doAdjustCash, setDoAdjustCash] = useState(true);

const isEligible = holdingType === 'shares' || holdingType === 'leaps_call' || holdingType === 'leaps_put';
const multiplier = isLeaps ? 100 : 1;
const origMultiplier = (holding.holdingType === 'leaps_call' || holding.holdingType === 'leaps_put') ? 100 : 1;

const newQty = parseFloat(quantity) || 0;
const newCost = parseFloat(avgCost) || 0;
const oldCostBasis = holding.quantity * holding.avgCost * origMultiplier;
const newCostBasis = newQty * newCost * multiplier;
const cashDelta = isEligible ? -(newCostBasis - oldCostBasis) : null; // negative = more cash out
const balanceAfter = cashDelta !== null && cashDelta !== 0 ? totalCashBalance + cashDelta : null;
const wouldOverdraw = balanceAfter !== null && balanceAfter < 0;
const noCashHolding = totalCashBalance === 0;
const showCard = cashDelta !== null && cashDelta !== 0;
```

- [ ] **Step 3: Update `handleSubmit` in `EditHoldingModal` to pass `doAdjustCash`**

Find `handleSubmit` (lines 510–529) and update the `onSubmit` calls:

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const qty = parseFloat(quantity);
  if (!qty) return;
  if (isCash) {
    onSubmit(holding.id, { ticker: 'CASH', holdingType: 'cash', quantity: qty, avgCost: 1, openedAt, notes: notes.trim() || undefined }, false);
    return;
  }
  const cost = parseFloat(avgCost);
  if (!cost) return;
  onSubmit(holding.id, {
    ticker: ticker.trim().toUpperCase(),
    holdingType,
    quantity: qty,
    avgCost: cost,
    openedAt,
    expiry: isLeaps && expiry ? expiry : undefined,
    strike: isLeaps && strike ? parseFloat(strike) : undefined,
    notes: notes.trim() || undefined,
  }, doAdjustCash && isEligible);
};
```

- [ ] **Step 4: Add Cash Impact card JSX to `EditHoldingModal`**

Place this before the submit button in the form JSX (look for the closing form tag `</form>` in `EditHoldingModal` around line ~640):

```tsx
{/* Cash Impact card */}
{showCard && cashDelta !== null && (
  <div
    style={{
      background: wouldOverdraw ? 'rgba(245,200,66,0.06)' : 'rgba(0,229,196,0.04)',
      border: `1px solid ${wouldOverdraw ? 'rgba(245,200,66,0.25)' : 'rgba(0,229,196,0.1)'}`,
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>💵</span>
      <span style={{ color: '#e8f0fe', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
        Cash Impact
      </span>
    </div>
    <p style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
      {cashDelta < 0
        ? `Increasing your ${ticker} position will cost an additional `
        : `Reducing your ${ticker} position will return `}
      <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
        {formatDollars(Math.abs(cashDelta))}
      </span>.
    </p>
    <p style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
      Balance:{' '}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
        {formatDollars(totalCashBalance)}
      </span>
      {' → '}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: wouldOverdraw ? '#f5c842' : (cashDelta > 0 ? '#00d68f' : '#e8f0fe') }}>
        {balanceAfter !== null ? formatDollars(balanceAfter) : '—'}
      </span>
    </p>
    {wouldOverdraw && (
      <p style={{ color: '#f5c842', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        ⚠ This would overdraw your cash balance.
      </p>
    )}
    {noCashHolding && doAdjustCash && cashDelta < 0 && (
      <p style={{ color: '#9ab4d4', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        A cash holding will be created automatically.
      </p>
    )}
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={doAdjustCash}
        onChange={(e) => setDoAdjustCash(e.target.checked)}
        style={{ accentColor: '#00e5c4', width: 14, height: 14 }}
      />
      <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
        {cashDelta < 0
          ? `Deduct ${formatDollars(Math.abs(cashDelta))} from cash position`
          : `Add ${formatDollars(Math.abs(cashDelta))} to cash position`}
      </span>
    </label>
  </div>
)}
```

---

### Task 4: Add Cash Impact card to `CloseHoldingModal`

**Files:**
- Modify: `src/pages/Portfolio.tsx:653–814`

#### Background

Closing returns proceeds to cash: `qty × closingPrice × multiplier`. The `holding` prop has `quantity`, `holdingType`, and `avgCost`.

- [ ] **Step 1: Update `CloseHoldingModalProps` and `onSubmit` signature**

```typescript
interface CloseHoldingModalProps {
  holding: HoldingWithPrice;
  onClose: () => void;
  onSubmit: (id: string, closingPrice: number, shouldAdjustCash: boolean) => void;
  totalCashBalance: number;
}
```

- [ ] **Step 2: Add state and computed values inside `CloseHoldingModal`**

After the existing state declarations (after line 669), add:

```typescript
const [doAdjustCash, setDoAdjustCash] = useState(true);

const isEligible = holding.holdingType === 'shares' || holding.holdingType === 'leaps_call' || holding.holdingType === 'leaps_put';
const multiplier = (holding.holdingType === 'leaps_call' || holding.holdingType === 'leaps_put') ? 100 : 1;
const cashProceeds = isEligible && price > 0 ? holding.quantity * price * multiplier : null;
const balanceAfter = cashProceeds !== null ? totalCashBalance + cashProceeds : null;
const noCashHolding = totalCashBalance === 0;
```

- [ ] **Step 3: Update `handleSubmit` in `CloseHoldingModal` to pass `doAdjustCash`**

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (price <= 0) return;
  onSubmit(holding.id, price, doAdjustCash && isEligible);
};
```

- [ ] **Step 4: Add Cash Impact card JSX to `CloseHoldingModal`**

Place between the Realized P&L block (ends ~line 792) and the submit button (~line 794):

```tsx
{/* Cash Impact card */}
{cashProceeds !== null && (
  <div
    style={{
      background: 'rgba(0,214,143,0.05)',
      border: '1px solid rgba(0,214,143,0.15)',
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>💵</span>
      <span style={{ color: '#e8f0fe', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
        Cash Impact
      </span>
    </div>
    <p style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
      Selling {holding.quantity} {holding.ticker} @ ${price.toFixed(2)}{isEligible && multiplier === 100 ? ' (×100/contract)' : ''} will return{' '}
      <span style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
        {formatDollars(cashProceeds)}
      </span>.
    </p>
    <p style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
      Balance:{' '}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
        {formatDollars(totalCashBalance)}
      </span>
      {' → '}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00d68f' }}>
        {balanceAfter !== null ? formatDollars(balanceAfter) : '—'}
      </span>
    </p>
    {noCashHolding && doAdjustCash && (
      <p style={{ color: '#9ab4d4', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        A cash holding will be created automatically.
      </p>
    )}
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={doAdjustCash}
        onChange={(e) => setDoAdjustCash(e.target.checked)}
        style={{ accentColor: '#00e5c4', width: 14, height: 14 }}
      />
      <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
        Add {formatDollars(cashProceeds)} to cash position
      </span>
    </label>
  </div>
)}
```

---

### Task 5: Update handlers and modal call sites in `Portfolio.tsx`

**Files:**
- Modify: `src/pages/Portfolio.tsx` — handlers (~line 1070–1083) and modal JSX (~line 1934–1951)

#### Background

`adjustCash` is now available from `usePortfolio`. Destructure it. Update the three handlers to accept `shouldAdjustCash` and call `adjustCash`. Pass `totalCashBalance` to all three modals at their call sites.

- [ ] **Step 1: Destructure `adjustCash` from `usePortfolio`**

Find the existing destructure of `usePortfolio()` in the `Portfolio` component and add `adjustCash`:

```typescript
const {
  holdingsWithPrice,
  openHoldings,
  snapshots,
  isLoading: portfolioLoading,
  addHolding,
  closeHolding,
  editHolding,
  adjustCash,          // ← add this
  totalValue: portfolioTotalValue,
  totalCost,
  unrealizedPnl: portfolioUnrealizedPnl,
  realizedPnl,
  optionsPremium,
} = usePortfolio();
```

(The exact names on the left may vary — match whatever is already in the destructure, just add `adjustCash`.)

- [ ] **Step 2: Update the three handlers**

Replace the handlers at lines 1070–1083:

```typescript
const handleAddHolding = async (
  data: Parameters<typeof addHolding>[0],
  shouldAdjustCash: boolean,
) => {
  await addHolding(data);
  if (shouldAdjustCash) {
    const multiplier = data.holdingType === 'leaps_call' || data.holdingType === 'leaps_put' ? 100 : 1;
    await adjustCash(-(data.quantity * data.avgCost * multiplier));
  }
  setShowAddModal(false);
};

const handleCloseHolding = async (
  id: string,
  price: number,
  shouldAdjustCash: boolean,
) => {
  const holding = closingHolding;
  await closeHolding(id, price);
  if (shouldAdjustCash && holding) {
    const multiplier = holding.holdingType === 'leaps_call' || holding.holdingType === 'leaps_put' ? 100 : 1;
    await adjustCash(holding.quantity * price * multiplier);
  }
  setClosingHolding(null);
};

const handleEditHolding = async (
  id: string,
  data: Parameters<typeof editHolding>[1],
  shouldAdjustCash: boolean,
) => {
  const original = editingHolding;
  await editHolding(id, data);
  if (shouldAdjustCash && original && data.quantity != null && data.avgCost != null) {
    const origMultiplier = original.holdingType === 'leaps_call' || original.holdingType === 'leaps_put' ? 100 : 1;
    const newMultiplier = (data.holdingType ?? original.holdingType) === 'leaps_call' || (data.holdingType ?? original.holdingType) === 'leaps_put' ? 100 : 1;
    const oldBasis = original.quantity * original.avgCost * origMultiplier;
    const newBasis = data.quantity * data.avgCost * newMultiplier;
    const delta = -(newBasis - oldBasis);
    if (delta !== 0) await adjustCash(delta);
  }
  setEditingHolding(null);
};
```

- [ ] **Step 3: Pass `totalCashBalance` to the three modal call sites**

Find where the modals are rendered (around lines 1934–1951) and add `totalCashBalance={totalCashBalance}` to each:

```tsx
{showAddModal && (
  <AddHoldingModal
    livePrices={livePriceMap}
    totalCashBalance={totalCashBalance}
    onClose={() => setShowAddModal(false)}
    onSubmit={handleAddHolding}
  />
)}

{editingHolding && (
  <EditHoldingModal
    holding={editingHolding}
    totalCashBalance={totalCashBalance}
    onClose={() => setEditingHolding(null)}
    onSubmit={handleEditHolding}
  />
)}

{closingHolding && (
  <CloseHoldingModal
    holding={closingHolding}
    totalCashBalance={totalCashBalance}
    onClose={() => setClosingHolding(null)}
    onSubmit={handleCloseHolding}
  />
)}
```

- [ ] **Step 4: Full TypeScript compile check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors). Fix any type errors before proceeding.

- [ ] **Step 5: Manual smoke test**

Run `npm run dev` and open the Portfolio page. Verify:
1. Add a shares holding → Cash Impact card appears with correct dollar amount, checkbox on, balance updates live as you type
2. Cash toggle off → submit → holding added, cash unchanged
3. Cash toggle on → submit → cash position decremented correctly
4. Edit a holding (change quantity) → card shows delta, not full cost
5. Edit with same values → card hidden (delta = 0)
6. Close a holding → card shows proceeds, checkbox on, submit → cash incremented
7. Add a LEAPS holding with qty=2, avgCost=$11.32 → impact shows $2,264.00 (2 × 11.32 × 100)
8. No cash holding initially → "A cash holding will be created automatically" note appears → after submit, USD cash holding created

---

## Notes for implementers

### `formatDollars` utility
The function `formatDollars` is already defined in `Portfolio.tsx`. Use it as-is.

### Finding exact insertion points
- The Cash Impact card goes **inside `<form>…</form>`**, between the last preview block and the submit `<button>`.
- In `EditHoldingModal`, read the form structure starting around line 576 to find the right spot.

### Edit handler data type
`data.holdingType` is `Partial<…>` — it may be `undefined` if the user didn't change the type. Use `data.holdingType ?? original.holdingType` to get the effective type for the multiplier calculation (as shown in the handler code above).
