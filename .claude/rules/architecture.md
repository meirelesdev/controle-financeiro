# Architecture Rules

## Paradigm: Clean Architecture + Simplified DDD

This project enforces **strict unidirectional dependency flow**:

```
domain → application → infrastructure
                     → presentation
```

No layer may import from a layer above it. Violations must be caught and corrected before merging.

---

## Layer Definitions

### `src/domain/`

**Purpose:** The pure business core. Zero external dependencies — no imports from `idb`, Tailwind, or any browser API.

**Contains:**
- **Entities** — `Transaction`, `CreditCard`, `Savings`. Plain TypeScript interfaces/types. No methods, no framework decorators.
- **Repository interfaces** — `ITransactionRepository`, `ICreditCardRepository`, `ISavingsRepository`. Define the contract; never implement it here.
- **Domain services** — `SummaryService.ts`. All financial calculation logic lives here:
  - `computeMonthlySummary(transactions)` — saldoReal, saldoProjetado, totalIncome, totalExpense, byCategory
  - `computeMonthlyHistory(allTransactions)` — 6-month bar chart data
  - `computeCardBill(card, allTransactions, year, month)` — fatura aggregation
  - `getTransactionBillingMonth(date, card)` — billing month assignment logic
  - `getBestPurchaseDay(card)` — maximizes repayment window
- **Constants** — `Categories.ts`. Fixed income/expense category lists (`INCOME_CATEGORIES`, `EXPENSE_CATEGORIES`). Never read these directly in UI — always use `getEffectiveCategories(type)`.

**Forbidden in domain:**
- `import { openDB } from 'idb'`
- Any DOM or browser-specific API
- Any reference to presentation or infrastructure modules

---

### `src/application/use-cases/`

**Purpose:** Orchestrates domain + infrastructure. Each use case is a **function** (not a class) that receives repositories as parameters (dependency injection).

**Naming:** `VerbNoun.ts` — e.g., `AddTransaction.ts`, `DeleteInstallmentGroup.ts`, `ManageSavings.ts`.

**Exception:** `categories/ManageCategories.ts` calls `getDB()` directly — acceptable because there is no repository abstraction needed for a simple `settings` key-value store.

**Rules:**
- Use cases call repository methods; they never query IndexedDB directly (except the `ManageCategories` exception above).
- No DOM manipulation, no `innerHTML`, no event listeners.
- All financial math delegated to `SummaryService` — never inline arithmetic for saldo/fatura calculations.

---

### `src/infrastructure/`

**Purpose:** Technical implementations. The only layer that touches IndexedDB, Web Crypto, or file I/O.

**Contains:**
- `database/DatabaseHelper.ts` — owns `CfpDB extends DBSchema`, singleton `getDB()`, and all migration logic via `DB_VERSION` + versioned `upgrade` blocks.
- `database/Idb*Repository.ts` — one file per entity, implementing the domain repository interface.
- `crypto/BackupCrypto.ts` — uses Web Crypto API exclusively (PBKDF2 → AES-GCM 256-bit). No third-party crypto libraries.
- `data/ImportFromExcel.ts` — Excel parsing, header detection, BRL value parsing, date normalization, AP MRV parser.

**Migration rules:**
- Increment `DB_VERSION` for every schema change.
- Add `if (oldVersion < N)` block in `upgrade` — never recreate existing stores.
- Indices (`by-date`, `by-type`, `by-status`) are defined once in the version-1 block.

---

### `src/presentation/`

**Purpose:** Vanilla TypeScript DOM manipulation with Tailwind CSS. Mobile-First, PWA-ready.

**Contains:**
- `views/` — one file per route (`DashboardView.ts`, `TransactionsView.ts`, `CreditCardsView.ts`, `SavingsView.ts`, `ImportView.ts`, `SettingsView.ts`).
- `components/` — shared UI components (`TransactionModal.ts`, etc.).
- Router — hash-based (`#dashboard`, `#transactions`, `#cards`, `#savings`, `#import`, `#settings`).

**Rendering model:** Each view exports an async `renderXxx(container, ...repos)` function. Re-render is a **full DOM rebuild** — set `innerHTML`, then attach event listeners. No virtual DOM, no diffing.

**Rules:**
- Views never import from `infrastructure` directly — repositories are injected via `main.ts`.
- `main.ts` is the **single** place where `getDB()` is called and `IdbXxxRepository` instances are created.
- No business logic in views — delegate to use cases and `SummaryService`.
- Category selects always use `getEffectiveCategories(type)` — never read `INCOME_CATEGORIES`/`EXPENSE_CATEGORIES` directly.

---

## Dependency Injection Bootstrap (`main.ts`)

```
getDB() → db instance
  ↓
new IdbTransactionRepository(db)
new IdbCreditCardRepository(db)
new IdbSavingsRepository(db)
  ↓
Route handlers → renderXxx(container, txRepo, cardRepo, savingsRepo)
```

This is the only wiring point. All other modules receive their dependencies; they never instantiate repositories themselves.
