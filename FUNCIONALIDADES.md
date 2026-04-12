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
| `category` | string | ID de categoria (fixas ou personalizadas — ver seção 1.4) |
| `date` | string | Data no formato `YYYY-MM-DD` |
| `paymentMethod` | `'cash'` \| `'card'` | Meio de pagamento (campo oculto para entradas) |
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

### 1.4 Categorias

As categorias são divididas em **fixas** (embutidas no código) e **personalizadas** (criadas pelo usuário e salvas no IndexedDB).

**Entradas fixas:**

| ID | Label |
|----|-------|
| `clt` | Salário CLT |
| `freelancer` | Freelancer |
| `thirteenth` | 13º Salário |
| `vacation` | Férias |
| `investment` | Rendimento |
| `other_income` | Outras Entradas |

**Saídas fixas:**

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

**Personalizadas:**

Criadas pelo usuário em Configurações → Categorias personalizadas. Armazenadas no IndexedDB (store `settings`, chave `custom_categories`). O ID gerado segue o padrão `custom_<timestamp>`.

Todos os selects de categoria nos formulários de transação exibem **fixas + personalizadas** mescladas, via `getEffectiveCategories(type)` em `ManageCategories.ts`.

---

## 2. Dashboard

**Arquivo:** `src/presentation/views/DashboardView.ts`  
**Cálculos:** `src/domain/services/SummaryService.ts`

### 2.1 Fonte de dados

```
txRepo.getAll()        →  todas as transações (patrimônio, histórico e faturas)
txRepo.getByMonth(y,m) →  transações do mês selecionado (resumo mensal)
cardRepo.getAll()      →  todos os cartões
savingsRepo.getAll()   →  todos os cofrinhos
```

O usuário navega entre meses com o MonthPicker. O padrão é o mês atual.

### 2.2 Lançamento rápido

Dois botões no topo do dashboard permitem criar transações sem navegar até o Extrato:

- **+ Receita** (borda verde) — abre o modal com tipo `income` pré-selecionado
- **+ Despesa** (borda vermelha) — abre o modal com tipo `expense` pré-selecionado

Ambos utilizam o componente `TransactionModal` compartilhado (ver seção 3.3). Após salvar, o dashboard é recarregado automaticamente.

### 2.3 Card de Patrimônio Total

O card principal exibe o **patrimônio consolidado**, não apenas o saldo do mês:

```
allTimeBalance = Σ(t.amount × sign) para todas as transações onde:
  t.status === 'confirmado'
  t.type   !== 'transfer'
  sign = +1 se income, −1 se expense

totalSavings = Σ(savings[i].balance)

patrimonio = allTimeBalance + totalSavings
```

**Detalhamento exibido no card:**

| Label | Valor |
|-------|-------|
| Patrimônio Total | `allTimeBalance + totalSavings` |
| Disponível | `allTimeBalance` — saldo acumulado de todas as transações confirmadas |
| Cofrinhos | `totalSavings` — dinheiro reservado nos cofrinhos |

> O patrimônio mostra o valor real que o usuário possui: o dinheiro em conta (calculado pelo histórico completo de transações) somado ao que está guardado nos cofrinhos.

### 2.4 Cards mensais — `computeMonthlySummary(transactions)`

Calculado sobre as transações **do mês selecionado**. Transações `'transfer'` são ignoradas.

```
Para cada transação t do mês:
  sign = (t.type === 'income') ? +1 : -1
  value = t.amount × sign

  saldoProjetado += value            ← SEMPRE (pendente + confirmado)

  SE t.status === 'confirmado':
    saldoReal += value
    SE t.type === 'income':  totalIncome  += t.amount
    SE t.type === 'expense': totalExpense += t.amount

  SE t.status === 'pendente':
    pendingCount++

  SE t.type === 'expense':
    byCategory[t.category] += t.amount
```

| Card | Fórmula |
|------|---------|
| **Entradas (mês)** | `Σ(amount)` onde `type=income AND status=confirmado` |
| **Saídas (mês)** | `Σ(amount)` onde `type=expense AND status=confirmado` |
| **Saldo do mês** | `saldoReal` — exibido apenas quando há transações pendentes |
| **Projetado** | `saldoProjetado` — inclui pendentes |

> **Regra:** transação `pendente` entra no projetado mas **não** no saldoReal, totalIncome nem totalExpense.

### 2.5 Gráfico pizza — gastos por categoria

Usa o campo `byCategory` de `computeMonthlySummary`. Só aparece se houver ao menos uma despesa no mês. Inclui categorias personalizadas (o emoji é exibido; se não encontrado nas categorias fixas, usa 📌 como fallback).

### 2.6 Gráfico de barras — histórico 6 meses (`computeMonthlyHistory`)

```
Para cada um dos últimos 6 meses:
  Filtra transações:  date.year===y AND date.month===m AND status==='confirmado'
  totalIncome[mês]  = Σ(amount) onde type='income'
  totalExpense[mês] = Σ(amount) onde type='expense'
```

### 2.7 Resumo de cartões no dashboard

Para cada cartão, calcula a fatura do mês selecionado (ver seção 4.2). Exibe valor da fatura, barra de progresso `(fatura / limite) × 100%` e cor vermelha acima de 80%.

### 2.8 Resumo de cofrinhos no dashboard

Exibe o total guardado e o saldo individual de cada cofrinho. Valor já incluído no Patrimônio Total (seção 2.3).

---

## 3. Extrato de Transações

**Arquivo:** `src/presentation/views/TransactionsView.ts`

### 3.1 Filtros

- **Mês/ano** — via `txRepo.getByMonth(year, month)` (índice `by-date`)
- **Tipo** — `income`, `expense`, ou todos

### 3.2 Ordenação e agrupamento

Transações ordenadas por data decrescente e agrupadas por data para exibição.

### 3.3 Modal de transação — componente compartilhado

**Arquivo:** `src/presentation/components/TransactionModal.ts`

O modal é compartilhado entre o Dashboard (lançamento rápido) e o Extrato (FAB e edição). Aceita as opções:

| Opção | Descrição |
|-------|-----------|
| `existing` | Transação a editar (preenche todos os campos) |
| `initialType` | `'income'` ou `'expense'` — pré-seleciona o tipo ao criar |

**Comportamento dinâmico:**

- **Categorias** carregadas via `getEffectiveCategories(type)` — fixas + personalizadas, atualiza ao trocar o tipo
- **Pagamento** — campo oculto quando o tipo é `income` (entradas não têm meio de pagamento)
- **Cartão** — aparece apenas quando `paymentMethod === 'card'` e tipo é `expense`
- **Validação** — erros exibem toast e mantêm o modal aberto (sem fechar)

### 3.4 Criação de transação

```
id        = 'tx_' + Date.now() + '_' + random(5 chars)
createdAt = updatedAt = new Date().toISOString()
amount    → sempre positivo
```

---

## 4. Cartões de Crédito

**Arquivo:** `src/presentation/views/CreditCardsView.ts`  
**Cálculos:** `src/domain/services/SummaryService.ts`

### 4.1 Lógica de faturamento — `getTransactionBillingMonth(date, card)`

```
dia = day(date)

SE dia <= card.closingDay:  fatura = mês atual da compra
SE dia >  card.closingDay:  fatura = mês seguinte
```

**Exemplo:** Fechamento dia 15. Compra em 10/abr → fatura abril. Compra em 20/abr → fatura maio.

### 4.2 Cálculo da fatura — `computeCardBill(card, allTransactions, year, month)`

```
fatura = Σ(t.amount) onde:
  t.type === 'expense'
  t.paymentMethod === 'card'
  t.cardId === card.id
  getTransactionBillingMonth(t.date, card) === { year, month }
```

> A fatura agrupa por **mês de vencimento**, não pelo mês da compra. O saldo mensal do dashboard (seção 2.4) conta a despesa no **mês em que ocorreu**, garantindo fluxo de caixa correto.

### 4.3 Percentual de limite utilizado

```
pct = (fatura / card.limit) × 100
Cor: pct > 80% → vermelho; senão → cor personalizada do cartão
```

### 4.4 Melhor dia para comprar — `getBestPurchaseDay(card)`

```
melhorDia = (card.closingDay % 28) + 1
```

A partir deste dia, a compra cai na fatura do mês seguinte, maximizando o prazo.

---

## 5. Cofrinhos / Poupança

**Arquivo:** `src/presentation/views/SavingsView.ts`  
**Use Case:** `src/application/use-cases/savings/ManageSavings.ts`

### 5.1 Depositar / Retirar

```
Depositar: savings.balance += amount
Retirar:   validação: amount <= savings.balance
           savings.balance -= amount
```

### 5.2 Transferência entre cofrinhos — `transferBetweenSavings`

```
Validações: origem existe, destino existe, from.balance >= amount

Execução atômica:
  1. Cria transação interna type='transfer', status='confirmado'
  2. from.balance -= amount
  3. to.balance   += amount
```

Transações de transferência são ignoradas em todos os cálculos de saldo (`computeMonthlySummary` pula `type === 'transfer'`).

### 5.3 Integração com o Patrimônio

O saldo total dos cofrinhos (`Σ savings[i].balance`) é somado ao `allTimeBalance` de transações para compor o **Patrimônio Total** exibido no Dashboard (seção 2.3).

---

## 6. Importar Excel

**Arquivo:** `src/application/use-cases/data/ImportFromExcel.ts`  
**View:** `src/presentation/views/ImportView.ts`

### 6.1 Detecção automática do cabeçalho — `detectHeaderRow`

```
Para cada linha i (máx 15):
  stringCols = células onde typeof === 'string' AND !isNaN() === false AND trim() !== ''
  SE stringCols.length >= 3: retorna i
```

O usuário pode corrigir manualmente na interface.

### 6.2 Parsing de valores BRL

```
'R$ 1.234,56'  →  1234.56
'1234.56'      →  1234.56
1234.56        →  1234.56
```

### 6.3 Parsing de datas

```
Date object  →  .toISOString().slice(0, 10)
'DD/MM/YYYY' →  'YYYY-MM-DD'
'YYYY-MM-DD' →  passado direto
Fallback:       data atual
```

### 6.4 Classificação automática do tipo

```
SE coluna tipo contém 'entrada' OU 'receita' → income
SENÃO                                        → expense
```

Se a coluna tipo não for mapeada, todas as linhas são importadas como `expense`.

### 6.5 Linhas ignoradas

Linha pulada quando valor parseado é 0, negativo ou vazio.

### 6.6 Parser dedicado AP MRV — `parseApMrvSheet`

Detecta colunas por palavras-chave (case-insensitive):

| Coluna | Termos |
|--------|--------|
| Amortização | `amort`, `principal` |
| Juros | `juros`, `juro`, `interest` |
| Saldo Devedor | `saldo`, `restante`, `balance` |
| Parcela | `parcela`, `numero`, `n°`, `parc` |

### 6.7 Cálculos AP MRV

```
totalAmort  = Σ(row.amortizacao)
totalJuros  = Σ(row.juros)
totalPago   = totalAmort + totalJuros
saldoInicial = rows[0].saldoDevedor + rows[0].amortizacao
saldoAtual   = rows[last].saldoDevedor
pctQuitado   = ((saldoInicial − saldoAtual) / saldoInicial) × 100
```

Gráfico de linha: saldo devedor (vermelho, decrescente) e amortização acumulada (verde, crescente).

---

## 7. Configurações / Backup

**Arquivo:** `src/presentation/views/SettingsView.ts`  
**Crypto:** `src/infrastructure/crypto/BackupCrypto.ts`  
**Categories:** `src/application/use-cases/categories/ManageCategories.ts`

### 7.1 Categorias personalizadas

O usuário pode criar e remover categorias de Entrada e Saída. As categorias fixas são exibidas como somente-leitura.

**Criar:**
```
id    = 'custom_' + Date.now()
emoji = informado pelo usuário (padrão: 📌)
label = nome informado
type  = 'income' | 'expense'
```

**Armazenamento:**
```json
settings['custom_categories'] = {
  "income":  [{ "id": "custom_...", "label": "...", "emoji": "...", "type": "income"  }],
  "expense": [{ "id": "custom_...", "label": "...", "emoji": "...", "type": "expense" }]
}
```

**Remover:** remove pelo `id` de ambas as listas (por segurança) e persiste.

As categorias personalizadas aparecem automaticamente em todos os formulários de transação, mescladas após as fixas.

### 7.2 Exportar backup JSON (sem senha)

```json
{
  "version": 1,
  "exportedAt": "2026-04-12T10:00:00.000Z",
  "transactions": [...],
  "creditCards":  [...],
  "savings":      [...]
}
```

### 7.3 Exportar backup cifrado (.cfp)

```
1. salt aleatório: 16 bytes
2. IV aleatório:   12 bytes
3. PBKDF2(password, salt, 100.000 iterações, SHA-256) → chave AES-256
4. AES-GCM(key, iv, json_em_bytes) → ciphertext
5. Arquivo: [salt 16B][iv 12B][ciphertext NB]
```

### 7.4 Restaurar backup

**JSON:** parse → limpa stores → reinsere.  
**CFP:** extrai salt/iv/ciphertext → deriva chave → AES-GCM decrypt → reinsere. Senha errada gera erro (autenticação implícita do AES-GCM).

### 7.5 Apagar todos os dados

```
db.clear('transactions')
db.clear('creditCards')
db.clear('savings')
```

> Categorias personalizadas (store `settings`) **não** são apagadas por esta operação.

---

## 8. Armazenamento e Persistência

**Arquivo:** `src/infrastructure/database/DatabaseHelper.ts`

### Banco de dados: IndexedDB

Nome: `controle-financeiro` — versão atual: **1**

| Store | Chave | Índices | Uso |
|-------|-------|---------|-----|
| `transactions` | `id` | `by-date`, `by-type`, `by-status` | Transações financeiras |
| `creditCards` | `id` | — | Cartões de crédito |
| `savings` | `id` | — | Cofrinhos |
| `settings` | `key` | — | Configurações e categorias personalizadas |

**Chaves usadas na store `settings`:**

| Chave | Valor |
|-------|-------|
| `custom_categories` | `{ income: CategoryDef[], expense: CategoryDef[] }` |

### Consulta por mês (`getByMonth`)

```
range = IDBKeyRange.bound('YYYY-MM-01', 'YYYY-MM-31')
db.getAllFromIndex('transactions', 'by-date', range)
```

### Singleton de conexão

`getDB()` retorna sempre a mesma instância de `IDBPDatabase`. Aberta uma vez no bootstrap (`main.ts`) e injetada nos repositórios. Callbacks `blocked`/`blocking` tratam conflitos de versão entre abas.

### Migrações

Controladas por `DB_VERSION`. Cada versão nova adiciona um bloco `if (oldVersion < N)` na função `upgrade`. A versão 1 cria todas as stores e índices.
