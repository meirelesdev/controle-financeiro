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
| `status` | `'pendente'` \| `'confirmado'` \| `'pago'` | Ver tabela de semântica abaixo |
| `amount` | number | Valor sempre positivo (em reais) |
| `description` | string | Texto livre |
| `category` | string | ID de categoria (fixas ou personalizadas — ver seção 1.5) |
| `date` | string | Data de competência no formato `YYYY-MM-DD` |
| `paymentMethod` | `'cash'` \| `'card'` | Meio de pagamento (campo oculto para entradas) |
| `cardId` | string? | Preenchido apenas quando `paymentMethod === 'card'` |
| `accountId` | string? | Conta bancária vinculada (event sourcing) |
| `paymentDate` | string? | `YYYY-MM-DD` — data efetiva de pagamento; preenchido quando `status === 'pago'` |
| `installmentGroupId` | string? | Vincula parcelas de uma mesma compra parcelada (formato `ig_<timestamp>_<random>`) |

**Semântica do campo `status`:**

| Status | Despesa | Receita | Afeta saldoReal? | Afeta saldo da conta? |
|--------|---------|---------|------------------|-----------------------|
| `pendente` | Prevista / futura | Prevista / futura | ❌ | ❌ |
| `confirmado` | Comprometida, mas não paga ao banco | Recebida | ✅ | ✅ receitas; ❌ despesas |
| `pago` | Quitada — saiu do banco | — | ✅ | ✅ |

> A distinção entre `confirmado` e `pago` em despesas permite separar "despesa comprometida" (aparece no extrato e saldoReal mensal) de "despesa quitada" (abate o saldo da conta bancária via event sourcing).

### Account (conta bancária)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único: `acc_<timestamp>_<random>` |
| `name` | string | Nome do banco (ex: Nubank, Itaú) |
| `color` | string | Cor hexadecimal para identificação visual |
| `initialBalance` | number | Saldo da conta no momento do cadastro — base do event sourcing |
| `cardIds` | string[]? | IDs de cartões de crédito vinculados a esta conta |
| `createdAt` | string | ISO timestamp |

> O saldo atual da conta **não é armazenado** — é sempre calculado em tempo real pelo selector `selectAccountBalance` (ver seção 2.4).

### CreditCard (cartão de crédito)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único |
| `name` | string | Nome do cartão |
| `limit` | number | Limite total do cartão |
| `closingDay` | number | Dia do mês em que a fatura fecha (1–28) |
| `dueDay` | number | Dia do mês em que a fatura vence (1–28) |
| `color` | string | Cor hexadecimal |
| `accountId` | string? | Conta bancária que paga este cartão |

### Savings (cofrinho)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único: `sav_<timestamp>` |
| `name` | string | Nome do cofrinho |
| `balance` | number | Saldo atual (atualizado a cada depósito/retirada) |
| `type` | `'bank'` \| `'digital'` \| `'piggybank'` | Tipo visual |
| `color` | string | Cor hexadecimal |
| `accountId` | string? | Conta bancária a que este cofrinho pertence |

### 1.5 Categorias

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
txRepo.getAll()        →  todas as transações (event sourcing, histórico, faturas)
txRepo.getByMonth(y,m) →  transações do mês selecionado (resumo mensal)
cardRepo.getAll()      →  todos os cartões
savingsRepo.getAll()   →  todos os cofrinhos
accountRepo.getAll()   →  todas as contas bancárias
```

O usuário navega entre meses com o MonthPicker — **sem limite de meses futuros**.

### 2.2 Lançamento rápido

Dois botões no topo do dashboard permitem criar transações sem navegar até o Extrato:

- **+ Receita** (borda verde) — abre o modal com tipo `income` pré-selecionado
- **+ Despesa** (borda vermelha) — abre o modal com tipo `expense` pré-selecionado

Ambos utilizam o componente `TransactionModal` compartilhado (ver seção 3.3), passando `accountRepo` para exibir o seletor de conta bancária.

### 2.3 Seção "Minhas Contas"

Exibe todas as contas bancárias cadastradas com seus saldos calculados por **event sourcing** (selector `selectAccountBalance`). A seção inclui:

- Nome e cor de cada banco
- Saldo calculado em tempo real (verde se positivo, vermelho se negativo)
- Subtotal de cofrinhos vinculados à conta (via `accountId`)
- **Total consolidado** no rodapé
- Botões de editar e excluir inline por banco
- Botão **"+ Novo banco"** — abre modal inline para cadastrar nome, saldo inicial e cor

Quando nenhuma conta está cadastrada, exibe mensagem orientativa e usa o saldo histórico de transações como fallback para o cálculo de patrimônio.

### 2.4 Selectors de saldo — `SummaryService`

Os selectors são funções puras que derivam o estado a partir da lista de transações, sem depender de campos calculados armazenados.

#### `isSettled(t)`

```
Retorna true se t.status === 'confirmado' || t.status === 'pago'
Usado em todos os cálculos de saldo real para incluir ambos os estados efetivados.
```

#### `selectAccountBalance(account, transactions, savings?)`

```
balance = account.initialBalance
  + Σ(t.amount) onde t.accountId === account.id AND t.type === 'income'  AND isSettled(t)
  − Σ(t.amount) onde t.accountId === account.id AND t.type === 'expense' AND t.status === 'pago'
  + Σ(s.balance) onde s.accountId === account.id   ← cofrinhos vinculados
```

> Distinção chave: receitas confirmadas já somam; despesas só abatam quando `status === 'pago'`.

#### `selectOpeningBalance(transactions, year, month)`

```
cutoff = 'YYYY-MM-01' (primeiro dia do mês selecionado)

openingBalance = Σ(t.amount × sign) onde:
  t.date    < cutoff
  t.type   !== 'transfer'
  isSettled(t)
  sign = +1 se income, −1 se expense
```

Base do carryover: representa todo o saldo efetivado acumulado **antes** do mês selecionado.

### 2.5 Cards mensais — `computeMonthlySummary(monthTx, allTransactions, year, month)`

Calculado sobre as transações **do mês selecionado**. Transações `'transfer'` são ignoradas.

```
Para cada transação t do mês:
  sign = (t.type === 'income') ? +1 : -1
  value = t.amount × sign

  saldoProjetado += value            ← SEMPRE (pendente + confirmado + pago)

  SE isSettled(t):
    saldoReal += value
    SE t.type === 'income':  totalIncome  += t.amount
    SE t.type === 'expense': totalExpense += t.amount

  SE t.status === 'pendente':
    pendingCount++

  SE t.type === 'expense':
    byCategory[t.category] += t.amount

openingBalance = selectOpeningBalance(allTransactions, year, month)
saldoAcumulado = openingBalance + saldoProjetado
```

| Campo retornado | Descrição |
|-----------------|-----------|
| `totalIncome` | Σ receitas efetivadas no mês |
| `totalExpense` | Σ despesas efetivadas no mês |
| `saldoReal` | Fluxo efetivado do mês |
| `saldoProjetado` | Fluxo total do mês (inclui pendentes) |
| `openingBalance` | Saldo acumulado até o fim do mês anterior (carryover) |
| `saldoAcumulado` | `openingBalance + saldoProjetado` — projeção acumulada |
| `pendingCount` | Número de transações pendentes no mês |

**Carryover no dashboard:** quando `openingBalance !== 0`, o card mensal exibe:

```
Carryover: R$ X → Acumulado: R$ Y
```

Isso permite ver, por exemplo, que mesmo com saídas em maio o saldo acumulado continua positivo por conta do histórico anterior.

### 2.6 Gráfico pizza — gastos por categoria

Usa o campo `byCategory` de `computeMonthlySummary`. Só aparece se houver ao menos uma despesa no mês.

### 2.7 Gráfico de barras — histórico 6 meses (`computeMonthlyHistory`)

```
Para cada um dos últimos 6 meses:
  Filtra transações:  date.year===y AND date.month===m AND isSettled(t)
  totalIncome[mês]  = Σ(amount) onde type='income'
  totalExpense[mês] = Σ(amount) onde type='expense'
```

### 2.8 Resumo de cartões no dashboard

Para cada cartão, calcula a fatura do mês selecionado (ver seção 4.2). Exibe valor da fatura, barra de progresso `(fatura / limite) × 100%` e cor vermelha acima de 80%.

### 2.9 Cofrinhos sem conta vinculada

Quando há contas bancárias cadastradas, exibe separadamente os cofrinhos **sem `accountId`** (não vinculados). Quando não há contas, exibe todos os cofrinhos normalmente.

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

**Campos e comportamento dinâmico:**

| Campo | Condição de exibição |
|-------|----------------------|
| Tipo | Sempre |
| Status (`pendente` / `confirmado` / `pago`) | Sempre |
| Valor | Sempre |
| Descrição | Sempre |
| Categoria | Sempre (atualiza ao trocar o tipo) |
| Data | Sempre |
| Pagamento | Oculto para `income` |
| Cartão | Visível quando `paymentMethod === 'card'` e tipo é `expense` |
| Número de Parcelas | Apenas em novos lançamentos no cartão (não na edição) |
| Conta Bancária | Visível quando há contas cadastradas (`accountRepo`) |
| **Marcar como Pago** | Apenas para `expense` — checkbox + data de pagamento |

**Checkbox "Marcar como Pago":**
- Disponível apenas para despesas
- Ao marcar: define `status = 'pago'` e exibe campo **Data de Pagamento** (padrão: hoje)
- Sincronização bidirecional com o select de status: alterar o select para `pago` marca o checkbox automaticamente e vice-versa
- A `paymentDate` é gravada na transação e registra quando a despesa saiu do banco

**Validação:** erros exibem toast e mantêm o modal aberto (sem fechar).

### 3.4 Criação de transação simples

```
id          = 'tx_' + Date.now() + '_' + random(5 chars)
createdAt   = updatedAt = new Date().toISOString()
amount      → sempre positivo
accountId   → opcional, vínculo com conta bancária
paymentDate → preenchido apenas quando status === 'pago'
```

### 3.5 Criação de transação parcelada — `addInstallmentGroup`

Acionado quando o usuário seleciona Cartão de Crédito e define **Número de Parcelas > 1**.

```
n            = número de parcelas
groupId      = 'ig_' + Date.now() + '_' + random(5 chars)
baseAmount   = round(totalAmount / n, 2 casas)
lastAmount   = round(totalAmount − baseAmount × (n − 1), 2 casas)

Para i = 0..n−1:
  date[i]    = i === 0 ? dataOriginal : addMonths(dataOriginal, i)
  status[i]  = i === 0 ? statusSelecionado : 'pendente'
  amount[i]  = i === n−1 ? lastAmount : baseAmount
  desc[i]    = '<descrição> (PP/NN)'
  installmentGroupId = groupId
```

**`addMonths`** clamba ao último dia do mês destino (ex: 31/jan + 1 mês → 28/fev).

**Preview no modal:** *"Serão criadas N parcelas de R$ X cada"*.

**Impacto nos saldos:**
- Parcela 1: entra no saldoReal se efetivada, no projetado se pendente
- Parcelas 2…N: sempre `pendente` → aparecem no Saldo Projetado dos meses futuros
- Cada parcela tem sua `date` própria → cai no mês correto do extrato e na fatura correta do cartão

### 3.6 Edição e exclusão

**Edição:** edita apenas a parcela selecionada; `installmentGroupId` é preservado.

**Exclusão de transação parcelada:** ao clicar 🗑️ em transação com `installmentGroupId`, o sistema pergunta:

> *"Deseja excluir apenas esta parcela ou esta e todas as próximas?"*

| Opção | Comportamento |
|-------|---------------|
| **Só esta parcela** | Remove apenas o registro selecionado |
| **Esta e as próximas** | Remove todas as parcelas do grupo com `date >= date da parcela` |

**Badge visual:** transações com `installmentGroupId` exibem badge cinza "parcelado". Transações com `status === 'pendente'` exibem badge amarelo "pendente".

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

**Compras parceladas:** cada parcela tem sua própria `date` (+1 mês), portanto `getTransactionBillingMonth` é aplicado individualmente — cada parcela cai na fatura do seu mês.

### 4.2 Cálculo da fatura — `computeCardBill(card, allTransactions, year, month)`

```
fatura = Σ(t.amount) onde:
  t.type === 'expense'
  t.paymentMethod === 'card'
  t.cardId === card.id
  getTransactionBillingMonth(t.date, card) === { year, month }
```

> A fatura agrupa por **mês de vencimento**, não pelo mês da compra.

### 4.3 Percentual de limite utilizado

```
pct = (fatura / card.limit) × 100
Cor: pct > 80% → vermelho; senão → cor personalizada do cartão
```

### 4.4 Melhor dia para comprar — `getBestPurchaseDay(card)`

```
melhorDia = (card.closingDay % 28) + 1
```

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

Transações de transferência são ignoradas em todos os cálculos de saldo (`computeMonthlySummary` e selectors pulam `type === 'transfer'`).

### 5.3 Vínculo com conta bancária

O campo `accountId` em Savings permite vincular um cofrinho a uma conta bancária. Quando vinculado:
- O saldo do cofrinho é somado ao saldo da conta em `selectAccountBalance`
- O cofrinho aparece agrupado sob o banco correspondente no Dashboard
- Cofrinhos sem `accountId` são exibidos na seção "Cofrinhos sem conta" (quando há bancos cadastrados)

---

## 6. Importar Excel

**Arquivo:** `src/application/use-cases/data/ImportFromExcel.ts`  
**View:** `src/presentation/views/ImportView.ts`

### 6.1 Seleção de aba

```
SE 'Contas' está entre as abas disponíveis:
  seleciona 'Contas' automaticamente (CONTAS_SHEET = 'Contas')
SENÃO:
  seleciona a primeira aba
```

Quando a aba `'Contas'` é selecionada, um banner informativo é exibido.

### 6.2 Importação de previsões — aba "Contas"

Modo previsão ativo quando `sheetName === CONTAS_SHEET`:

```
Filtro: importa apenas linhas com date >= hoje
Status: todas as transações criadas com status = 'pendente'
```

**Confirmação antes de salvar:** `countFutureRows` conta linhas futuras e exibe:

> *"Encontradas X transações futuras na aba Contas. Deseja importar como pendentes?"*

### 6.3 Detecção automática do cabeçalho — `detectHeaderRow`

```
Para cada linha i (máx 15):
  stringCols = células onde typeof === 'string' AND !isNaN() === false AND trim() !== ''
  SE stringCols.length >= 3: retorna i
```

### 6.4 Parsing de valores BRL

```
'R$ 1.234,56'  →  1234.56
'1234.56'      →  1234.56
```

### 6.5 Parsing de datas

```
Date object  →  .toISOString().slice(0, 10)
'DD/MM/YYYY' →  'YYYY-MM-DD'
'YYYY-MM-DD' →  passado direto
Fallback:       data atual
```

### 6.6 Classificação automática do tipo

```
SE coluna tipo contém 'entrada' OU 'receita' OU 'salário' OU 'salario' OU 'salary' → income
SENÃO                                                                                → expense
```

### 6.7 Linhas ignoradas

Linha pulada (`skipped`) quando valor parseado é 0/negativo/vazio, ou quando modo previsão ativo e `date < hoje`.

### 6.8 Parser dedicado AP MRV — `parseApMrvSheet`

Ativado quando o nome da aba corresponde a `/ap.?mrv|pagamento.*ap|financiam/i`.

| Coluna | Termos detectados |
|--------|-------------------|
| Amortização | `amort`, `principal` |
| Juros | `juros`, `juro`, `interest` |
| Saldo Devedor | `saldo`, `restante`, `balance` |
| Parcela | `parcela`, `numero`, `n°`, `parc` |

### 6.9 Cálculos AP MRV

```
totalAmort   = Σ(row.amortizacao)
totalJuros   = Σ(row.juros)
totalPago    = totalAmort + totalJuros
saldoInicial = rows[0].saldoDevedor + rows[0].amortizacao
saldoAtual   = rows[last].saldoDevedor
pctQuitado   = ((saldoInicial − saldoAtual) / saldoInicial) × 100
```

---

## 7. Configurações / Backup

**Arquivo:** `src/presentation/views/SettingsView.ts`  
**Crypto:** `src/infrastructure/crypto/BackupCrypto.ts`

### 7.1 Categorias personalizadas

```
id    = 'custom_' + Date.now()
emoji = informado pelo usuário (padrão: 📌)
label = nome informado
type  = 'income' | 'expense'
```

Armazenadas em `settings['custom_categories']` como `{ income: CategoryDef[], expense: CategoryDef[] }`.

### 7.2 Exportar backup JSON (sem senha)

```json
{
  "version": 1,
  "exportedAt": "...",
  "transactions": [...],
  "creditCards":  [...],
  "savings":      [...]
}
```

> Nota: a store `accounts` não é incluída no backup atual.

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
**CFP:** extrai salt/iv/ciphertext → deriva chave → AES-GCM decrypt → reinsere.

### 7.5 Apagar todos os dados

```
db.clear('transactions')
db.clear('creditCards')
db.clear('savings')
```

> Categorias personalizadas (store `settings`) e contas bancárias (store `accounts`) **não** são apagadas por esta operação.

---

## 8. Armazenamento e Persistência

**Arquivo:** `src/infrastructure/database/DatabaseHelper.ts`

### Banco de dados: IndexedDB

Nome: `controle-financeiro` — versão atual: **2**

| Store | Chave | Índices | Uso |
|-------|-------|---------|-----|
| `transactions` | `id` | `by-date`, `by-type`, `by-status`, `by-account` | Transações financeiras |
| `creditCards` | `id` | — | Cartões de crédito |
| `savings` | `id` | — | Cofrinhos |
| `accounts` | `id` | — | Contas bancárias |
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

### Consulta por grupo de parcelas (`getByInstallmentGroup`)

```
getAll().filter(t => t.installmentGroupId === groupId)
```

### Consulta por conta (`by-account`)

O índice `by-account` permite consultas eficientes por `accountId`. Atualmente `selectAccountBalance` usa `getAll()` com filter em memória (simples e suficiente para o volume esperado).

### Migrações

Controladas por `DB_VERSION`. Cada versão adiciona um bloco `if (oldVersion === N)` na função `upgrade`.

| Versão | Mudança |
|--------|---------|
| 1 | Cria stores `transactions`, `creditCards`, `savings`, `settings` com índices iniciais |
| 2 | Adiciona store `accounts`; adiciona índice `by-account` em `transactions` |

### Singleton de conexão

`getDB()` retorna sempre a mesma instância de `IDBPDatabase`. Aberta uma vez no bootstrap (`main.ts`) e injetada nos repositórios via DI. Callbacks `blocked`/`blocking` tratam conflitos de versão entre abas.
