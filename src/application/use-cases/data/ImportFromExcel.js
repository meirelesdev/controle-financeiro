import * as XLSX from 'xlsx';
import { addTransaction } from '../transactions/AddTransaction';
/** Lê um ArrayBuffer de .xlsx e retorna as abas disponíveis. */
export function getSheetNames(buffer) {
    const wb = XLSX.read(buffer, { type: 'array' });
    return wb.SheetNames;
}
/** Detecta automaticamente qual linha (0-based) contém o cabeçalho real.
 *  Procura a primeira linha com ≥ 3 células que sejam strings não-vazias e não-numéricas.
 *  Isso ignora linhas de título, linhas mescladas e linhas em branco antes do header real.
 */
export function detectHeaderRow(buffer, sheetName) {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[sheetName];
    if (!sheet)
        return 0;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const row = rows[i];
        if (!Array.isArray(row))
            continue;
        const stringCols = row.filter((cell) => typeof cell === 'string' && cell.trim() !== '' && isNaN(Number(cell)));
        if (stringCols.length >= 3)
            return i;
    }
    return 0; // fallback: usa linha 1
}
/** Lê uma aba e retorna as linhas como objetos.
 *  Se `headerRow` não for informado, detecta automaticamente a linha de cabeçalho.
 */
export function readSheet(buffer, sheetName, headerRow) {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[sheetName];
    if (!sheet)
        throw new Error(`Aba "${sheetName}" não encontrada`);
    const detectedRow = headerRow ?? detectHeaderRow(buffer, sheetName);
    // Lê tudo como array de arrays para poder fatiar a partir da linha correta
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (allRows.length <= detectedRow)
        return [];
    const headerCells = allRows[detectedRow].map((v) => v != null && String(v).trim() !== '' ? String(v).trim() : `COL_${allRows[detectedRow].indexOf(v)}`);
    const result = [];
    for (let i = detectedRow + 1; i < allRows.length; i++) {
        const row = allRows[i];
        const obj = {};
        let hasData = false;
        headerCells.forEach((col, idx) => {
            obj[col] = row[idx] ?? '';
            if (row[idx] != null && row[idx] !== '')
                hasData = true;
        });
        if (hasData)
            result.push(obj);
    }
    return result;
}
/** Converte valor de célula para número BRL (ex: "R$ 1.234,56" → 1234.56). */
function parseBRL(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
        const n = parseFloat(clean);
        return isNaN(n) ? 0 : n;
    }
    return 0;
}
/** Formata data de vários formatos para YYYY-MM-DD. */
function parseDate(value) {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'string' && value.trim()) {
        // DD/MM/YYYY
        const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m)
            return `${m[3]}-${m[2]}-${m[1]}`;
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(value))
            return value;
    }
    return new Date().toISOString().slice(0, 10);
}
/** Importação genérica com mapeamento de colunas. */
export async function importGeneric(repo, buffer, sheetName, mapping, headerRow) {
    const rows = readSheet(buffer, sheetName, headerRow);
    let success = 0, skipped = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            const amount = parseBRL(row[mapping.amount]);
            if (!amount || amount <= 0) {
                skipped++;
                continue;
            }
            const rawType = mapping.type ? String(row[mapping.type] ?? '').toLowerCase() : '';
            const type = rawType.includes('entrada') || rawType.includes('receita') ? 'income' : 'expense';
            await addTransaction(repo, {
                type,
                status: 'confirmado',
                amount: Math.abs(amount),
                description: String(row[mapping.description] ?? `Importado linha ${i + 2}`),
                category: mapping.category ? String(row[mapping.category] ?? 'other_expense') : (type === 'income' ? 'other_income' : 'other_expense'),
                date: parseDate(row[mapping.date]),
                paymentMethod: 'cash',
            });
            success++;
        }
        catch (e) {
            errors.push(`Linha ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return { success, skipped, errors };
}
/** Parser dedicado para a aba "Pagamento AP MRV" ou similar.
 *  Extrai: parcela, amortização, juros, saldo devedor.
 *  Retorna os dados estruturados para o gráfico de quitação.
 */
export function parseApMrvSheet(buffer, sheetName) {
    const rows = readSheet(buffer, sheetName);
    const result = [];
    for (const row of rows) {
        // Tenta detectar as colunas automaticamente (case-insensitive)
        const keys = Object.keys(row).map(k => k.toLowerCase());
        const findCol = (...terms) => Object.keys(row).find(k => terms.some(t => k.toLowerCase().includes(t)));
        const colAmort = findCol('amort', 'principal');
        const colJuros = findCol('juros', 'juro', 'interest');
        const colSaldo = findCol('saldo', 'restante', 'balance');
        const colParc = findCol('parcela', 'numero', 'n°', 'parc');
        if (!colAmort && !colJuros)
            continue;
        const amortizacao = parseBRL(colAmort ? row[colAmort] : 0);
        const juros = parseBRL(colJuros ? row[colJuros] : 0);
        const saldoDevedor = parseBRL(colSaldo ? row[colSaldo] : 0);
        const parcela = colParc ? Number(row[colParc]) || (result.length + 1) : result.length + 1;
        if (amortizacao <= 0 && juros <= 0)
            continue;
        result.push({ parcela, amortizacao, juros, saldoDevedor });
    }
    return result.sort((a, b) => a.parcela - b.parcela);
}
/** Importa o backup JSON (exportado pelo app) de volta para o IndexedDB. */
export async function restoreBackupJSON(jsonStr) {
    const { getDB } = await import(/* @vite-ignore */ '../../../infrastructure/database/DatabaseHelper');
    const db = await getDB();
    const data = JSON.parse(jsonStr);
    if (!data.version || !data.transactions)
        throw new Error('Formato de backup inválido');
    const txs = data.transactions;
    const cards = data.creditCards ?? [];
    const savs = data.savings ?? [];
    // Limpa e reinsere
    const txStore = db.transaction('transactions', 'readwrite').objectStore('transactions');
    await txStore.clear();
    for (const t of txs)
        await db.put('transactions', t);
    const cardStore = db.transaction('creditCards', 'readwrite').objectStore('creditCards');
    await cardStore.clear();
    for (const c of cards)
        await db.put('creditCards', c);
    const savStore = db.transaction('savings', 'readwrite').objectStore('savings');
    await savStore.clear();
    for (const s of savs)
        await db.put('savings', s);
    return { transactions: txs.length, creditCards: cards.length, savings: savs.length };
}
