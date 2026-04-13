# State Management Rules — Derived Balance (Event Sourcing Style)

## Core Principle: No Stored Balances

**All monetary balances are computed at read time from the transaction ledger. Never persist a running balance.**

This guarantees that editing or deleting any historical transaction automatically corrects every derived figure across the app without requiring cascading updates.

---

## Prohibited Patterns

```typescript
// FORBIDDEN — static balance field on a financial entity
interface Account {
  balance: number; // ← never do this
}

// FORBIDDEN — mutating a stored balance on write
async function addTransaction(tx: Transaction) {
  account.balance += tx.amount; // ← never do this
  await repo.save(account);
}
```

---

## Required Pattern: Selector Functions in `SummaryService`

Every balance figure the UI displays must trace back to a selector in `src/domain/services/SummaryService.ts` that processes the full transaction history.

### Current selectors (do not bypass them):

| Selector | Input | Output |
|----------|-------|--------|
| `computeMonthlySummary(transactions)` | Transactions for one month | `{ saldoReal, saldoProjetado, totalIncome, totalExpense, pendingCount, byCategory }` |
| `computeMonthlyHistory(allTransactions)` | All transactions | 6-month income/expense arrays |
| `computeCardBill(card, allTransactions, y, m)` | All transactions + card | Fatura value for a given month |
| `getTransactionBillingMonth(date, card)` | Purchase date + card | `{ year, month }` of the bill |
| `getBestPurchaseDay(card)` | Card entity | Best day to maximize repayment window |

When adding a new balance-derived figure, **add a new selector here** — never inline the aggregation in a view.

---

## The Ledger: Transaction as Source of Truth

Every financial event is a `Transaction` record. The ledger is the set of all `Transaction` records in IndexedDB.

### Status semantics (critical — do not change):

| `status` | Effect |
|----------|--------|
| `'confirmado'` | Enters `saldoReal`, `totalIncome`, `totalExpense`, and Patrimônio Total |
| `'pendente'` | Enters `saldoProjetado` only; invisible to Patrimônio and confirmed totals |

### Type semantics:

| `type` | Aggregation rule |
|--------|-----------------|
| `'income'` | `+amount` to saldo |
| `'expense'` | `−amount` from saldo |
| `'transfer'` | **Skipped entirely** in all saldo calculations — internal cofrinho movement |

---

## Patrimônio Total Formula

```
allTimeBalance = Σ(t.amount × sign)
  where t.status === 'confirmado'
    AND t.type   !== 'transfer'
    sign = +1 for income, −1 for expense

totalSavings = Σ(savings[i].balance)

patrimonio = allTimeBalance + totalSavings
```

> `Savings.balance` is the **only** balance field allowed to persist, because cofrinhos are operated via deposit/withdraw mutations (not a transaction ledger). All cofrinho mutations go through `ManageSavings.ts` use case, which validates and atomically updates the balance.

---

## Installment Immutability

Parcelas (installment transactions) are immutable once created as a group:

- Each parcela is an independent `Transaction` with its own `date` and `status`.
- **Editing** a parcela modifies only that individual record; the `installmentGroupId` is preserved.
- **Deleting** uses `deleteInstallmentGroup` to remove `date >= selected` parcelas — never mutates existing records.
- The `installmentGroupId` field is write-once — never reassign it after creation.

---

## Adding New Financial Metrics

Checklist before adding any new computed value:

1. Can it be derived entirely from `Transaction[]` + `CreditCard[]` + `Savings[]`? → Put it in `SummaryService`.
2. Does it require persisting extra state? → Question why. Justify in a code comment before storing anything new.
3. Does the new metric affect saldoReal or patrimônio? → It must respect the `status === 'confirmado'` filter.
4. Is it a monthly aggregate? → Use `getByMonth(year, month)` from the repo; do not filter in the view.
