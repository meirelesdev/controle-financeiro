import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import {
  getSheetNames,
  readSheet,
  detectHeaderRow,
  importGeneric,
  parseApMrvSheet,
  type ColumnMapping,
  type ApMrvRow,
} from '../../application/use-cases/data/ImportFromExcel'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import Chart from 'chart.js/auto'

let chartMrv: Chart | null = null

export async function renderImport(
  container: HTMLElement,
  txRepo: ITransactionRepository
): Promise<void> {
  container.innerHTML = `
    <h1 class="text-lg font-bold text-muted mb-4">Importar / Dados</h1>

    <!-- Upload area -->
    <div class="card mb-4">
      <div class="section-title">Importar planilha Excel</div>
      <label class="block cursor-pointer">
        <div class="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-primary transition-colors">
          <div class="text-4xl mb-2">📊</div>
          <p class="text-sm text-muted font-medium">Toque para selecionar arquivo</p>
          <p class="text-xs text-subtle mt-1">.xlsx ou .xls</p>
        </div>
        <input id="file-input" type="file" accept=".xlsx,.xls" class="hidden">
      </label>
    </div>

    <div id="import-steps" class="hidden">
      <!-- Sheet selector -->
      <div class="card mb-4" id="sheet-selector-wrap">
        <div class="section-title">Selecionar aba</div>
        <select id="sheet-select" class="select mb-3"></select>
        <button id="btn-load-sheet" class="btn-primary w-full">Carregar aba</button>
      </div>

      <!-- Generic mapping -->
      <div id="generic-mapping" class="hidden card mb-4">
        <div class="section-title">Mapear colunas</div>
        <div id="mapping-fields" class="space-y-3"></div>
        <button id="btn-import-generic" class="btn-primary w-full mt-4">Importar</button>
      </div>

      <!-- AP MRV specific -->
      <div id="apmrv-section" class="hidden card mb-4">
        <div class="section-title">📈 Progresso de Quitação — AP MRV</div>
        <div id="apmrv-stats" class="grid grid-cols-2 gap-3 mb-4"></div>
        <div class="relative h-56"><canvas id="chart-mrv"></canvas></div>
        <p class="text-xs text-subtle mt-2 text-center">Evolução do saldo devedor ao longo das parcelas</p>
      </div>
    </div>
  `

  let fileBuffer: ArrayBuffer | null = null
  let sheetNames: string[] = []

  const fileInput = document.getElementById('file-input') as HTMLInputElement

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return

    fileBuffer = await file.arrayBuffer()
    sheetNames = getSheetNames(fileBuffer)

    const sheetSelect = document.getElementById('sheet-select') as HTMLSelectElement
    sheetSelect.innerHTML = sheetNames.map(n => `<option value="${n}">${n}</option>`).join('')

    document.getElementById('import-steps')!.classList.remove('hidden')
    showToast(`Arquivo carregado: ${sheetNames.length} aba(s)`, 'success')
  })

  document.getElementById('btn-load-sheet')?.addEventListener('click', () => {
    if (!fileBuffer) return
    const sheetName = (document.getElementById('sheet-select') as HTMLSelectElement).value
    loadSheet(fileBuffer, sheetName)
  })

  function loadSheet(buffer: ArrayBuffer, sheetName: string) {
    const genericWrap = document.getElementById('generic-mapping')!
    const apMrvWrap   = document.getElementById('apmrv-section')!
    genericWrap.classList.add('hidden')
    apMrvWrap.classList.add('hidden')

    // Detecta se é aba AP MRV
    const isApMrv = /ap.?mrv|pagamento.*ap|financiam/i.test(sheetName)

    if (isApMrv) {
      renderApMrv(buffer, sheetName)
    } else {
      renderGenericMapping(buffer, sheetName)
    }
  }

  function renderGenericMapping(buffer: ArrayBuffer, sheetName: string, overrideHeaderRow?: number) {
    const detectedRow = overrideHeaderRow ?? detectHeaderRow(buffer, sheetName)
    const rows        = readSheet(buffer, sheetName, detectedRow)
    if (rows.length === 0) { showToast('Aba vazia ou cabeçalho não detectado', 'warning'); return }

    const columns = Object.keys(rows[0])
    const wrap    = document.getElementById('generic-mapping')!
    const fields  = document.getElementById('mapping-fields')!

    const FIELD_LABELS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
      { key: 'date',        label: 'Data',        required: true  },
      { key: 'description', label: 'Descrição',   required: true  },
      { key: 'amount',      label: 'Valor',       required: true  },
      { key: 'type',        label: 'Tipo (entrada/saída)', required: false },
      { key: 'category',    label: 'Categoria',   required: false },
    ]

    // Auto-select best match columns
    function bestMatch(terms: string[]): string {
      return columns.find(c => terms.some(t => c.toLowerCase().includes(t))) ?? columns[0] ?? ''
    }
    const autoDate   = bestMatch(['data', 'date', 'vencimento'])
    const autoDesc   = bestMatch(['descriç', 'descri', 'desc', 'historico', 'hist', 'item'])
    const autoAmount = bestMatch(['valor', 'value', 'amount', 'montante', 'preço'])
    const autoType   = bestMatch(['tipo', 'type', 'entrada', 'saida'])

    fields.innerHTML = `
      <!-- Linha de cabeçalho detectada -->
      <div class="card-sm mb-1 flex items-center justify-between gap-3">
        <div class="text-xs text-subtle flex items-center gap-1">
          <span>📍</span>
          <span>Cabeçalho detectado na linha <strong class="text-primary">${detectedRow + 1}</strong></span>
        </div>
        <div class="flex items-center gap-2">
          <input id="header-row-input" type="number" min="1" max="20"
            value="${detectedRow + 1}"
            class="input w-16 text-center text-xs py-1 px-2">
          <button id="btn-reload-header" class="btn-ghost text-xs py-1 px-2">Recarregar</button>
        </div>
      </div>
      <div class="divider"></div>
    ` + FIELD_LABELS.map(f => {
      const auto = f.key === 'date' ? autoDate : f.key === 'description' ? autoDesc : f.key === 'amount' ? autoAmount : f.key === 'type' ? autoType : ''
      return `
        <div>
          <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
          <select id="map-${f.key}" class="select">
            ${!f.required ? '<option value="">— não mapear —</option>' : ''}
            ${columns.map(c => `<option value="${c}" ${c === auto && f.required ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      `
    }).join('')

    // Preview
    fields.innerHTML += `
      <div class="divider"></div>
      <div class="section-title">Preview (primeiras 3 linhas)</div>
      <div class="overflow-x-auto text-xs">
        <table class="w-full text-left">
          <thead><tr class="border-b border-slate-700">${columns.map(c => `<th class="p-1.5 text-subtle whitespace-nowrap">${c}</th>`).join('')}</tr></thead>
          <tbody>${rows.slice(0, 3).map(row => `<tr class="border-b border-slate-800">${columns.map(c => `<td class="p-1.5 text-muted whitespace-nowrap">${String(row[c] ?? '').slice(0, 18)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `

    wrap.classList.remove('hidden')

    // Recarregar com linha de cabeçalho manual
    document.getElementById('btn-reload-header')?.addEventListener('click', () => {
      const val = parseInt((document.getElementById('header-row-input') as HTMLInputElement).value)
      if (!isNaN(val) && val >= 1) {
        document.getElementById('generic-mapping')!.classList.add('hidden')
        renderGenericMapping(buffer, sheetName, val - 1)
      }
    })

    document.getElementById('btn-import-generic')?.addEventListener('click', async () => {
      const mapping: ColumnMapping = {
        date:        (document.getElementById('map-date')        as HTMLSelectElement).value,
        description: (document.getElementById('map-description') as HTMLSelectElement).value,
        amount:      (document.getElementById('map-amount')      as HTMLSelectElement).value,
        type:        (document.getElementById('map-type')        as HTMLSelectElement).value || undefined,
        category:    (document.getElementById('map-category')    as HTMLSelectElement).value || undefined,
      }

      if (!mapping.date || !mapping.description || !mapping.amount) {
        showToast('Mapeie as colunas obrigatórias', 'error'); return
      }

      showToast('Importando...', 'info', 1500)
      const result = await importGeneric(txRepo, buffer, sheetName, mapping, detectedRow)
      showToast(`✅ ${result.success} importadas · ⏭ ${result.skipped} ignoradas`, 'success', 5000)
      if (result.errors.length > 0) {
        console.warn('Erros de importação:', result.errors)
      }
    })
  }

  function renderApMrv(buffer: ArrayBuffer, sheetName: string) {
    const rows = parseApMrvSheet(buffer, sheetName)
    const wrap = document.getElementById('apmrv-section')!

    if (rows.length === 0) {
      showToast('Não foi possível detectar colunas AP MRV. Use o mapeamento genérico.', 'warning')
      renderGenericMapping(buffer, sheetName)
      return
    }

    wrap.classList.remove('hidden')

    const totalAmort = rows.reduce((s, r) => s + r.amortizacao, 0)
    const totalJuros = rows.reduce((s, r) => s + r.juros, 0)
    const totalPago  = totalAmort + totalJuros
    const saldoInicial = rows[0]?.saldoDevedor + rows[0]?.amortizacao || 0
    const saldoAtual   = rows[rows.length - 1]?.saldoDevedor ?? 0
    const pctQuitado   = saldoInicial > 0 ? ((saldoInicial - saldoAtual) / saldoInicial) * 100 : 0
    const parcsRestantes = rows.filter(r => r.saldoDevedor > 0).length

    document.getElementById('apmrv-stats')!.innerHTML = `
      <div class="card-sm">
        <div class="text-xs text-subtle">Total pago</div>
        <div class="text-base font-bold text-muted">${formatCurrency(totalPago)}</div>
      </div>
      <div class="card-sm">
        <div class="text-xs text-subtle">Total juros</div>
        <div class="text-base font-bold text-expense">${formatCurrency(totalJuros)}</div>
      </div>
      <div class="card-sm">
        <div class="text-xs text-subtle">Amortizado</div>
        <div class="text-base font-bold text-income">${formatCurrency(totalAmort)}</div>
      </div>
      <div class="card-sm">
        <div class="text-xs text-subtle">% Quitado</div>
        <div class="text-base font-bold text-primary">${pctQuitado.toFixed(1)}%</div>
      </div>
      <div class="card-sm col-span-2">
        <div class="text-xs text-subtle mb-1">Progresso de quitação</div>
        <div class="progress-bar"><div class="progress-fill bg-primary" style="width:${Math.min(pctQuitado,100)}%"></div></div>
        <div class="text-xs text-subtle mt-1">Saldo devedor atual: <strong class="text-muted">${formatCurrency(saldoAtual)}</strong></div>
      </div>
    `

    // Gráfico de linha
    renderApMrvChart(rows)
  }

  async function renderApMrvChart(rows: ApMrvRow[]) {
    await new Promise(r => setTimeout(r, 0))
    const ctx = (document.getElementById('chart-mrv') as HTMLCanvasElement)?.getContext('2d')
    if (!ctx) return

    chartMrv?.destroy()
    chartMrv = new Chart(ctx, {
      type: 'line',
      data: {
        labels: rows.map(r => `P${r.parcela}`),
        datasets: [
          {
            label: 'Saldo Devedor',
            data:  rows.map(r => r.saldoDevedor),
            borderColor:     '#E53935',
            backgroundColor: '#E5393520',
            fill:            true,
            tension:         0.3,
            pointRadius:     rows.length > 50 ? 0 : 3,
          },
          {
            label: 'Amortização acumulada',
            data:  rows.reduce((acc: number[], r) => {
              acc.push((acc[acc.length - 1] ?? 0) + r.amortizacao)
              return acc
            }, []),
            borderColor:     '#00C853',
            backgroundColor: 'transparent',
            tension:         0.3,
            pointRadius:     rows.length > 50 ? 0 : 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#F5F5F5', font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { ticks: { color: '#94A3B8', maxTicksLimit: 12 }, grid: { color: '#1F2B47' } },
          y: { ticks: { color: '#94A3B8', callback: (v) => `R$${(Number(v)/1000).toFixed(0)}k` }, grid: { color: '#1F2B47' } },
        },
      },
    })
  }
}
