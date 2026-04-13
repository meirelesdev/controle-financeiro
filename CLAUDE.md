# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Engineering Rules

Before implementing any feature or change, consult the rule files in `.clauderules/`:

| File | What it governs |
|------|----------------|
| [`.claude/rules/architecture.md`](.claude/rules/architecture.md) | Layer boundaries, DI bootstrap, what belongs where |
| [`.claude/rules/state-management.md`](.claude/rules/state-management.md) | Derived balance (no stored balances), ledger immutability, selector pattern |
| [`.claude/rules/coding-standards.md`](.claude/rules/coding-standards.md) | TypeScript conventions, async/await, financial rounding, security, naming |
| [`.claude/rules/ui-ux-guidelines.md`](.claude/rules/ui-ux-guidelines.md) | Tailwind tokens, Mobile-First, PWA/SW, WCAG contrast, DOM rendering model |

## Commands

```bash
npm run dev          # Dev server → http://localhost:5173/controle-financeiro/
npm run type-check   # tsc --noEmit
npm run build        # tsc --noEmit && vite build → /dist
npm run preview      # Serve /dist locally → http://localhost:4173/controle-financeiro/
```

> `build` runs `tsc --noEmit` (type-check only) then Vite, which compiles TypeScript independently. Never run plain `tsc` without `--noEmit` — it emits `.js` files next to the `.ts` sources.

## Architecture

Clean Architecture with 4 strict layers — **no upward dependencies**:

```
domain → application → infrastructure
                     → presentation
```

- **`src/domain/`** — Pure TypeScript: entities (`Transaction`, `CreditCard`, `Savings`), repository interfaces, constants (`Categories.ts` — fixed category lists), and `SummaryService.ts` (business logic: billing month calculation, saldo real vs projetado, card bill computation). Zero external imports.
- **`src/application/use-cases/`** — Orchestrates domain + infra. Functions (not classes) that receive repositories via parameter injection. Exception: `categories/ManageCategories.ts` calls `getDB()` directly (no repo abstraction needed for a simple settings key).
- **`src/infrastructure/`** — IndexedDB via `idb`. `DatabaseHelper.ts` owns the schema (`CfpDB extends DBSchema`) and singleton `getDB()`. Migration versioning via `DB_VERSION` constant. `BackupCrypto.ts` uses Web Crypto API (PBKDF2 → AES-GCM 256-bit) with no external crypto deps.
- **`src/presentation/`** — Vanilla TypeScript DOM manipulation + Tailwind CSS classes. Hash-based router (`#dashboard`, `#transactions`, etc.). Each view is an async function `renderXxx(container, ...repos)` that rebuilds its DOM on every state change.

## Key Design Decisions

**No framework.** Views render by setting `innerHTML` and attaching event listeners. Re-render is a full view rebuild (simple but effective for this scale).

**Dependency injection via `main.ts`.** `getDB()` is called once at bootstrap; the resulting `db` instance is passed into each `IdbXxxRepository` constructor, which are then passed into route handlers. Views never import infra directly.

**`Transaction.status`** distinguishes `'confirmado'` (affects `saldoReal`) from `'pendente'` (affects only `saldoProjetado`). Both `SummaryService.computeMonthlySummary` and the dashboard differentiate these.

**Excel import auto-detects header row.** `detectHeaderRow()` in `ImportFromExcel.ts` scans the first 15 rows and picks the first with ≥ 3 non-numeric string cells, handling spreadsheets with title rows before the real header. Users can override manually in the UI.

**Credit card billing logic** in `SummaryService.getTransactionBillingMonth`: if `day(purchaseDate) <= card.closingDay` → current month's bill, else → next month's bill.

**Custom categories** are stored in the `settings` IndexedDB store under key `custom_categories` as `{ income: CategoryDef[], expense: CategoryDef[] }`. `getEffectiveCategories(type)` in `ManageCategories.ts` merges fixed + custom lists. Always use this function in forms — never read `INCOME_CATEGORIES`/`EXPENSE_CATEGORIES` directly when building category selects.

**Shared transaction modal** lives in `src/presentation/components/TransactionModal.ts`. Both `DashboardView` (quick-launch buttons) and `TransactionsView` (FAB + edit) use it. It accepts `{ existing?, initialType? }`. The payment method field is hidden for `income` type. Returning `false` from `Modal.onConfirm` keeps the modal open — used for validation errors.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`: `npm ci` → `type-check` → `build` → uploads `./dist` to GitHub Pages at `https://meireles-dev.github.io/controle-financeiro/`.

The Vite `base` is `/controle-financeiro/` — all asset paths and PWA manifest `start_url`/`scope` must use this prefix.

## PWA / Service Worker

`vite-plugin-pwa` generates `sw.js` at build time via Workbox. The SW precaches all built assets. Runtime caching for Google Fonts uses Cache-First. Do **not** manually write a `sw.js` — it is generated.

## Tailwind

Custom color tokens in `tailwind.config.js`: `bg`, `bg-card`, `bg-hover`, `primary`, `primary-dark`, `danger`, `warning`, `muted`, `subtle`. Reusable component classes (`.card`, `.btn-primary`, `.input`, `.modal-sheet`, `.bottom-nav`, etc.) are defined in `src/style.css` under `@layer components`. Money colors `.text-income` (#00C853) and `.text-expense` (#E53935) are utility classes in `@layer utilities` — use these instead of `text-primary`/`text-danger` for financial values. Custom colors are defined as hex strings, so Tailwind opacity modifiers (`bg-primary/50`) do **not** work with them.
