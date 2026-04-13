# Coding Standards

## TypeScript

### Interfaces for data shapes and contracts

```typescript
// Correct — entity as interface
interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  status: 'pendente' | 'confirmado';
  amount: number;
  // ...
}

// Correct — repository as interface
interface ITransactionRepository {
  getAll(): Promise<Transaction[]>;
  getByMonth(year: number, month: number): Promise<Transaction[]>;
  save(tx: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
}
```

- Use `interface` for data structures and repository contracts.
- Use `type` only for union types, aliases, or mapped types.
- No `any`. Use `unknown` + narrowing when the type is genuinely unknown.
- Prefer explicit return types on exported functions.

### No classes in domain or application layers

- Domain entities are plain interfaces.
- Use cases are exported functions, not class instances.
- Classes are acceptable in infrastructure (repository implementations) and presentation (only when DOM lifecycle requires it — prefer functions otherwise).

---

## Async / Await

**All IndexedDB interactions must use `async/await`.** No `.then()` chains.

```typescript
// Correct
async function getMonthSummary(year: number, month: number): Promise<MonthlySummary> {
  const transactions = await txRepo.getByMonth(year, month);
  return SummaryService.computeMonthlySummary(transactions);
}

// Forbidden — promise chains in new code
txRepo.getByMonth(year, month).then(txs => { ... });
```

**Error handling:** Use `try/catch` at the view boundary (the `renderXxx` function). Propagate errors up from use cases — do not swallow them silently in the repository layer.

---

## Financial Arithmetic

### Always round to 2 decimal places

```typescript
// Correct — avoid floating-point drift in installment splits
const baseAmount = Math.round((totalAmount / n) * 100) / 100;
const lastAmount  = Math.round((totalAmount - baseAmount * (n - 1)) * 100) / 100;
```

- All `amount` fields are stored and displayed in BRL to 2 decimal places.
- Never add/subtract raw floats without rounding the final result.
- The last installment absorbs the rounding remainder — see `addInstallmentGroup` in `AddTransaction.ts`.
- Percentages (card limit usage, AP MRV progress) may use `toFixed(1)` for display.

### Currency display

Use `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` for all displayed values. Never concatenate `'R$'` manually.

---

## ID Generation

Follow the established patterns — never use sequential integers or UUIDs (to avoid `crypto.randomUUID` compatibility issues):

```typescript
// Transaction
id = 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

// Installment group
installmentGroupId = 'ig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

// Custom category
id = 'custom_' + Date.now();

// Credit card / savings — same tx_ pattern, different prefix if needed
```

---

## Security

### Web Crypto API for all sensitive data handling

Backup encryption must use the Web Crypto API exclusively — no third-party crypto libraries.

Required parameters (must not be weakened):
- Key derivation: PBKDF2, SHA-256, **100,000 iterations minimum**
- Encryption: AES-GCM, **256-bit key**, random 12-byte IV per export
- Salt: random 16 bytes per export

```typescript
// Correct — derives key from password
const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);
```

### No `innerHTML` with user-controlled strings

When inserting user-provided text (transaction descriptions, category labels), use `textContent` or `createTextNode`. Reserve `innerHTML` for static template strings that contain no user data.

```typescript
// Correct
span.textContent = transaction.description;

// Forbidden — XSS risk
container.innerHTML = `<span>${transaction.description}</span>`;
```

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Files | PascalCase | `AddTransaction.ts` |
| Functions / variables | camelCase | `computeMonthlySummary` |
| Interfaces | PascalCase, no `I` prefix in domain | `Transaction`, `CreditCard` |
| Repository interfaces | `I` prefix | `ITransactionRepository` |
| Constants | SCREAMING_SNAKE | `INCOME_CATEGORIES`, `DB_VERSION` |
| CSS classes | kebab-case (Tailwind utilities) | `bg-card`, `text-income` |

---

## Module Boundaries

- No circular imports. If two modules need each other, extract shared types to `domain/`.
- `main.ts` is the only file that instantiates repositories and calls `getDB()`.
- Views import from `application/use-cases/` and `domain/services/` — never from `infrastructure/` directly.
- Never import a full module to use one function — use named imports.

```typescript
// Correct
import { computeMonthlySummary } from '../../domain/services/SummaryService';

// Avoid
import * as SummaryService from '../../domain/services/SummaryService';
```

---

## What Not to Add

- No error handling for impossible states — trust repository contracts.
- No fallback values for required parameters — fail loudly.
- No helper utilities for one-off operations.
- No comments explaining what code does — only comment *why* when non-obvious.
- No docstrings on functions that weren't changed.
- No feature flags or backwards-compatibility shims.
