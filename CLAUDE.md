# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server → http://localhost:5173/controle-financeiro/
npm run type-check   # tsc --noEmit (run before build)
npm run build        # tsc && vite build → /dist
npm run preview      # Serve /dist locally → http://localhost:4173/controle-financeiro/
```

> Always run `type-check` before `build`. The build script runs `tsc` internally but seeing errors early saves time.

## Architecture

Clean Architecture with 4 strict layers — **no upward dependencies**:

```
domain → application → infrastructure
                     → presentation
```

- **`src/domain/`** — Pure TypeScript: entities (`Transaction`, `CreditCard`, `Savings`), repository interfaces, constants (`Categories.ts`), and `SummaryService.ts` (business logic: billing month calculation, saldo real vs projetado, card bill computation). Zero external imports.
- **`src/application/use-cases/`** — Orchestrates domain + infra. Functions (not classes) that receive repositories via parameter injection.
- **`src/infrastructure/`** — IndexedDB via `idb`. `DatabaseHelper.ts` owns the schema (`CfpDB extends DBSchema`) and singleton `getDB()`. Migration versioning via `DB_VERSION` constant. `BackupCrypto.ts` uses Web Crypto API (PBKDF2 → AES-GCM 256-bit) with no external crypto deps.
- **`src/presentation/`** — Vanilla TypeScript DOM manipulation + Tailwind CSS classes. Hash-based router (`#dashboard`, `#transactions`, etc.). Each view is an async function `renderXxx(container, ...repos)` that rebuilds its DOM on every state change.

## Key Design Decisions

**No framework.** Views render by setting `innerHTML` and attaching event listeners. Re-render is a full view rebuild (simple but effective for this scale).

**Dependency injection via `main.ts`.** `getDB()` is called once at bootstrap; the resulting `db` instance is passed into each `IdbXxxRepository` constructor, which are then passed into route handlers. Views never import infra directly.

**`Transaction.status`** distinguishes `'confirmado'` (affects `saldoReal`) from `'pendente'` (affects only `saldoProjetado`). Both `SummaryService.computeMonthlySummary` and the dashboard differentiate these.

**Excel import auto-detects header row.** `detectHeaderRow()` in `ImportFromExcel.ts` scans the first 15 rows and picks the first with ≥ 3 non-numeric string cells, handling spreadsheets with title rows before the real header. Users can override manually in the UI.

**Credit card billing logic** in `SummaryService.getTransactionBillingMonth`: if `day(purchaseDate) <= card.closingDay` → current month's bill, else → next month's bill.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`: `npm ci` → `type-check` → `build` → uploads `./dist` to GitHub Pages at `https://meireles-dev.github.io/controle-financeiro/`.

The Vite `base` is `/controle-financeiro/` — all asset paths and PWA manifest `start_url`/`scope` must use this prefix.

## PWA / Service Worker

`vite-plugin-pwa` generates `sw.js` at build time via Workbox. The SW precaches all built assets. Runtime caching for Google Fonts uses Cache-First. Do **not** manually write a `sw.js` — it is generated.

## Tailwind

Custom color tokens in `tailwind.config.js`: `bg`, `bg-card`, `bg-hover`, `primary`, `primary-dark`, `danger`, `warning`, `muted`, `subtle`. Reusable component classes (`.card`, `.btn-primary`, `.input`, `.modal-sheet`, `.bottom-nav`, etc.) are defined in `src/style.css` under `@layer components`.
