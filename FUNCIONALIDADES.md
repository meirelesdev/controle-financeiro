# Funcionalidades e Cálculos — Controle Financeiro Pessoal

Documento de referência completo: descreve cada tela, o que ela faz, quais dados utiliza e como todos os cálculos são realizados.

---

## Índice

1. [Modelo de dados](#1-modelo-de-dados)
2. [Dashboard](#2-dashboard)
3. [Extrato de Transações](#3-extrato-de-transações)
4. [Cartões de Crédito](#4-cartões-de-crédito)
5. [Cofrinhos / Poupança](#5-cofrinhos--poupança)
6. [Importar Excel](#6-importar-excel)
7. [Configurações / Backup](#7-configurações--backup)
8. [Armazenamento e persistência](#8-armazenamento-e-persistência)

---

## 1. Modelo de Dados

### Transaction (transação)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único: `tx_<timestamp>_<random>` |
| `type` | `'income'` \| `'expense'` \| `'transfer'` | Entrada, saída ou transferência entre cofrinhos |
| `status` | `'pendente'` \| `'confirmado'` | Determina se entra no saldo real ou apenas no projetado |
| `amount` | number | Valor sempre positivo (em reais) |
| `description` | string | Texto livre |
| `category` | string | ID de categoria (ver tabela abaixo) |
| `date` | string | Data no formato `YYYY-MM-DD` |
| `paymentMethod` | `'cash'` \| `'card'` | Meio de pagamento |
| `cardId` | string? | Preenchido apenas quando `paymentMethod === 'card'` |

### CreditCard (cartão de crédito)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `limit` | number | Limite total do cartão |
| `closingDay` | number | Dia do mês em que a fatura fecha (1–28) |
| `dueDay` | number | Dia do mês em que a fatura vence (1–28) |
| `currentBalance` | number | Campo reservado (não usado nos cálculos atuais) |

### Savings (cofrinho)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `balance` | number | Saldo atual acumulado |
| `type` | `'bank'` \| `'digital'` \| `'piggybank'` | Tipo visual |

### Categorias disponíveis

**Entradas:**

| ID | Label |
|----|-------|
| `clt` | Salário CLT |
| `freelancer` | Freelancer |
| `thirteenth` | 13º Salário |
| `vacation` | Férias |
| `investment` | Rendimento |
| `other_income` | Outras Entradas |

**Saídas:**

| ID | Label |
|----|-------|
| `housing` | Moradia |
| `food` | Alimentação |
| `transport` | Transporte |
| `health` | Saúde |
| `education` | Educação |
| `leisure` | Lazer |
| `clothing` | Vestuário |
| `subscriptions` | Assinaturas |
| `installments` | Parcelas |
| `credit_card` | Fatura Cartão |
| `other_expense` | Outras Saídas |

---

## 2. Dashboard

**Arquivo:** `src/presentation/views/DashboardView.ts`  
**Cálculos:** `src/domain/services/SummaryService.ts`

### 2.1 Fonte de dados

O dashboard filtra transações **pelo mês/ano selecionado** no MonthPicker. O usuário pode navegar para meses anteriores. O mês padrão é o mês atual.

```
txRepo.getByMonth(year, month)  →  transações do mês selecionado
txRepo.getAll()                 →  todas as transações (para histórico e faturas)
cardRepo.getAll()               →  todos os cartões
savingsRepo.getAll()            →  todos os cofrinhos
```

### 2.2 Resumo mensal — `computeMonthlySummary(transactions)`

Percorre todas as transações do mês. Transações do tipo `'transfer'` são **completamente ignoradas** (não afetam nenhum saldo).

```
Para cada transação t:
  sign = (t.type === 'income') ? +1 : -1
  value = t.amount × sign

  saldoProjetado += value           ← SEMPRE (pendente + confirmado)

  SE t.status === 'confirmado':
    saldoReal += value              ← apenas confirmadas
    SE t.type === 'income':  totalIncome  += t.amount
    SE t.type === 'expense': totalExpense += t.amount

  SE t.status === 'pendente':
    pendingCount++

  SE t.type === 'expense':
    byCategory[t.category] += t.amount   ← acumula para o gráfico pizza
```

**Resultados exibidos:**

| Card | Fórmula |
|------|---------|
| **Saldo Real** | `Σ(income confirmado) − Σ(expense confirmado)` |
| **Saldo Projetado** | `Σ(income) − Σ(expense)` — inclui pendentes |
| **Total Entradas** | `Σ(amount)` onde `type=income AND status=confirmado` |
| **Total Saídas** | `Σ(amount)` onde `type=expense AND status=confirmado` |
| **Pendentes** | Contagem de transações com `status=pendente` |

> **Regra importante:** Uma transação `pendente` conta no `saldoProjetado` mas **não** no `saldoReal`, `totalIncome` nem `totalExpense`. Isso permite lançar previsões (ex: salário que ainda não caiu) sem distorcer os números reais.

### 2.3 Gráfico pizza — gastos por categoria

Usa o campo `byCategory` do `computeMonthlySummary`. Cada fatia é uma categoria de despesa com seu total acumulado no mês. Só aparece se houver ao menos uma despesa no mês.

```
byCategory = {
  'food':      450.00,
  'housing':  1200.00,
  'transport': 180.00,
  ...
}
```

Apenas despesas entram neste gráfico. Entradas e transferências são excluídas.

### 2.4 Gráfico de barras — histórico 6 meses (`computeMonthlyHistory`)

Calcula os 6 meses anteriores (incluindo o atual) em ordem cronológica:

```
Para cada um dos últimos 6 meses:
  Filtra transações onde:
    - date.year === y  AND  date.month === m
    - status === 'confirmado'          ← pendentes não entram no histórico

  totalIncome[mês]  = Σ(amount) onde type='income'
  totalExpense[mês] = Σ(amount) onde type='expense'
```

O gráfico exibe barras duplas (verde = entradas, vermelho = saídas) para visualizar a evolução ao longo dos meses.

### 2.5 Resumo de cartões no dashboard

Para cada cartão, calcula a **fatura do mês selecionado** (ver seção 4.2 para a fórmula completa). Exibe:
- Valor da fatura atual
- Barra de progresso: `(fatura / limite) × 100%`
- A barra fica vermelha quando ultrapassa 80% do limite

### 2.6 Resumo de cofrinhos no dashboard

```
totalSavings = Σ(savings[i].balance)   para todos os cofrinhos
```

Exibe o total consolidado e o saldo individual de cada cofrinho.

---

## 3. Extrato de Transações

**Arquivo:** `src/presentation/views/TransactionsView.ts`

### 3.1 Filtros

As transações são filtradas por:
- **Mês/ano** — via `txRepo.getByMonth(year, month)` (índice IndexedDB `by-date`)
- **Tipo** — `income`, `expense`, ou todos
- **Categoria** — aplicado depois de buscar do banco

### 3.2 Ordenação

Transações são ordenadas por data decrescente (`b.date.localeCompare(a.date)`) e depois agrupadas por data para exibição.

### 3.3 Badge visual de status

- `confirmado` → sem badge
- `pendente` → badge laranja "pendente" ao lado da descrição

### 3.4 Criação de transação

Ao salvar:
```
id = 'tx_' + Date.now() + '_' + random(5 chars)
createdAt = updatedAt = new Date().toISOString()
```

O `amount` é sempre armazenado como número positivo, independentemente de ser entrada ou saída.

---

## 4. Cartões de Crédito

**Arquivo:** `src/presentation/views/CreditCardsView.ts`  
**Cálculos:** `src/domain/services/SummaryService.ts`

### 4.1 Lógica de faturamento — `getTransactionBillingMonth(date, card)`

Cada compra no cartão pertence a uma fatura específica, determinada pelo dia de fechamento:

```
dia = day(date)

SE dia <= card.closingDay:
  fatura = mês atual da compra

SE dia > card.closingDay:
  fatura = mês seguinte ao da compra
```

**Exemplo:** Cartão com fechamento dia 15.
- Compra em 10/abr → fatura de **abril**
- Compra em 20/abr → fatura de **maio**

### 4.2 Cálculo da fatura — `computeCardBill(card, allTransactions, year, month)`

```
fatura = Σ(t.amount) para todas as transações onde:
  t.type === 'expense'
  t.paymentMethod === 'card'
  t.cardId === card.id
  getTransactionBillingMonth(t.date, card) === { year, month }
```

A fatura não se baseia no mês da compra, mas no **mês de faturamento** calculado pela regra acima. Uma compra feita em abril pode aparecer na fatura de maio.

### 4.3 Percentual de limite utilizado

```
pct = (fatura / card.limit) × 100

Cor da barra:
  pct <= 80% → cor do cartão (personalizada)
  pct >  80% → vermelho (#E53935)
```

### 4.4 Melhor dia para comprar — `getBestPurchaseDay(card)`

```
melhorDia = (card.closingDay % 28) + 1
```

Comprar a partir deste dia garante que a compra caia na **próxima** fatura, dando máximo prazo para pagamento.

**Exemplo:** Fechamento dia 15 → melhor dia = `(15 % 28) + 1 = 16`. A partir do dia 16, a compra vai para a fatura do mês seguinte.

---

## 5. Cofrinhos / Poupança

**Arquivo:** `src/presentation/views/SavingsView.ts`  
**Use Case:** `src/application/use-cases/savings/ManageSavings.ts`

### 5.1 Operações de saldo

**Depositar:**
```
savings.balance = savings.balance + amount
```

**Retirar:**
```
Validação: amount <= savings.balance  (não permite saldo negativo)
savings.balance = savings.balance - amount
```

### 5.2 Transferência entre cofrinhos — `transferBetweenSavings`

```
Validações:
  - cofrinho de origem existe
  - cofrinho de destino existe
  - from.balance >= amount  (saldo suficiente)

Execução atômica:
  1. Cria transação interna tipo='transfer' status='confirmado' (saída)
  2. Cria transação interna tipo='transfer' status='confirmado' (entrada)
  3. from.balance -= amount
  4. to.balance   += amount
```

As transações internas de transferência são registradas no histórico mas **ignoradas em todos os cálculos de saldo** do dashboard (o `computeMonthlySummary` pula `type === 'transfer'`).

### 5.3 Total consolidado

```
totalSavings = Σ(savings[i].balance)
```

---

## 6. Importar Excel

**Arquivo:** `src/application/use-cases/data/ImportFromExcel.ts`  
**View:** `src/presentation/views/ImportView.ts`

### 6.1 Detecção automática do cabeçalho — `detectHeaderRow`

Planilhas com linhas de título antes do cabeçalho real são tratadas automaticamente:

```
Para cada linha i (máx 15 linhas):
  stringCols = células onde:
    - typeof cell === 'string'
    - cell.trim() !== ''
    - isNaN(Number(cell))   ← exclui células numéricas

  SE stringCols.length >= 3:
    retorna i  ← esta é a linha do cabeçalho
```

O usuário pode ajustar manualmente informando a linha correta na interface.

### 6.2 Parsing de valores BRL

Aceita múltiplos formatos de moeda:

```
'R$ 1.234,56'  →  1234.56    (remove R$, espaços e pontos; troca vírgula por ponto)
'1234.56'      →  1234.56
1234.56        →  1234.56    (número já é passado diretamente)
```

### 6.3 Parsing de datas

```
Formatos aceitos:
  Date object  →  .toISOString().slice(0, 10)
  'DD/MM/YYYY' →  'YYYY-MM-DD'
  'YYYY-MM-DD' →  passado direto

Fallback: data atual
```

### 6.4 Classificação automática do tipo

Se a coluna "Tipo" for mapeada:
```
SE valor contém 'entrada' OU 'receita' (case-insensitive) → type = 'income'
SENÃO                                                      → type = 'expense'
```

Se a coluna "Tipo" não for mapeada, todas as linhas são importadas como `expense`.

### 6.5 Linhas ignoradas (skipped)

Uma linha é pulada quando:
- O valor parseado é 0 ou negativo
- A célula de valor está vazia

### 6.6 Parser dedicado AP MRV — `parseApMrvSheet`

Detecta automaticamente as colunas por palavras-chave (case-insensitive):

| Coluna procurada | Termos detectados |
|-----------------|-------------------|
| Amortização | `amort`, `principal` |
| Juros | `juros`, `juro`, `interest` |
| Saldo Devedor | `saldo`, `restante`, `balance` |
| Número da Parcela | `parcela`, `numero`, `n°`, `parc` |

Linhas onde amortização e juros são ambos zero são descartadas. Resultado ordenado por número de parcela.

### 6.7 Cálculos exibidos para AP MRV

```
totalAmort  = Σ(row.amortizacao)
totalJuros  = Σ(row.juros)
totalPago   = totalAmort + totalJuros

saldoInicial  = rows[0].saldoDevedor + rows[0].amortizacao
saldoAtual    = rows[last].saldoDevedor

pctQuitado  = ((saldoInicial - saldoAtual) / saldoInicial) × 100
```

O gráfico de linha exibe duas séries:
- **Saldo Devedor** — decrescente ao longo das parcelas (vermelho)
- **Amortização acumulada** — crescente (verde)

---

## 7. Configurações / Backup

**Arquivo:** `src/presentation/views/SettingsView.ts`  
**Crypto:** `src/infrastructure/crypto/BackupCrypto.ts`

### 7.1 Exportar backup JSON (sem senha)

Lê diretamente do IndexedDB e gera um JSON:

```json
{
  "version": 1,
  "exportedAt": "2026-04-12T10:00:00.000Z",
  "transactions": [...],
  "creditCards":  [...],
  "savings":      [...]
}
```

### 7.2 Exportar backup cifrado (.cfp)

Usa Web Crypto API nativa (sem biblioteca externa):

```
1. Gerar salt aleatório: 16 bytes (crypto.getRandomValues)
2. Gerar IV aleatório:   12 bytes
3. Derivar chave AES-256:
     PBKDF2(password, salt, iterations=100.000, hash='SHA-256')
4. Cifrar JSON:
     AES-GCM(key, iv, json_como_bytes)
5. Formato do arquivo .cfp:
     [salt: 16 bytes] [iv: 12 bytes] [ciphertext: N bytes]
```

### 7.3 Restaurar backup

**JSON simples:** Lê como texto, faz parse, limpa as stores e reinsere.

**Arquivo .cfp:**
```
1. Lê salt (bytes 0–15)
2. Lê IV (bytes 16–27)
3. Lê ciphertext (bytes 28–fim)
4. Deriva chave com a senha informada
5. AES-GCM decrypt
6. Lança erro se a senha for incorreta (autenticação implícita do AES-GCM)
```

A restauração substitui completamente os dados existentes (sem merge).

### 7.4 Apagar todos os dados

```
db.clear('transactions')
db.clear('creditCards')
db.clear('savings')
```

---

## 8. Armazenamento e Persistência

**Arquivo:** `src/infrastructure/database/DatabaseHelper.ts`

### Banco de dados: IndexedDB

Nome do banco: `controle-financeiro` (versão 1)

| Store | Chave primária | Índices |
|-------|---------------|---------|
| `transactions` | `id` | `by-date` (date), `by-type` (type), `by-status` (status) |
| `creditCards` | `id` | — |
| `savings` | `id` | — |
| `settings` | `key` | — |

### Consulta por mês (`getByMonth`)

```
from  = 'YYYY-MM-01'
to    = 'YYYY-MM-31'
range = IDBKeyRange.bound(from, to)
db.getAllFromIndex('transactions', 'by-date', range)
```

Usa o índice `by-date` para eficiência — não percorre todas as transações.

### Singleton de conexão

`getDB()` retorna sempre a mesma instância de `IDBPDatabase`. A conexão é aberta uma vez no bootstrap (`main.ts`) e injetada em todos os repositórios. Fechamento e reabertura são tratados nos callbacks `blocked`/`blocking` do `openDB`.

### Migrações

Controladas pelo `DB_VERSION`. Cada versão nova adiciona um bloco `if (oldVersion < N)` na função `upgrade`. A versão atual (1) cria todas as stores e índices.
