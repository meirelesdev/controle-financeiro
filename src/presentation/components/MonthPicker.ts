import { formatMonthYear, getCurrentYearMonth } from '../utils/formatters'

export interface MonthPickerOptions {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}

export function renderMonthPicker(opts: MonthPickerOptions): HTMLElement {
  const el = document.createElement('div')
  el.className = 'flex items-center gap-2'

  function update() {
    el.innerHTML = `
      <button id="mp-prev" class="btn-ghost w-8 h-8 text-lg">‹</button>
      <span class="text-sm font-semibold text-muted min-w-[110px] text-center capitalize">
        ${formatMonthYear(opts.year, opts.month)}
      </span>
      <button id="mp-next" class="btn-ghost w-8 h-8 text-lg">›</button>
    `

    el.querySelector('#mp-prev')?.addEventListener('click', () => {
      if (opts.month === 1) { opts.year--; opts.month = 12 }
      else opts.month--
      opts.onChange(opts.year, opts.month)
      update()
    })

    el.querySelector('#mp-next')?.addEventListener('click', () => {
      const now = getCurrentYearMonth()
      if (opts.year === now.year && opts.month === now.month) return
      if (opts.month === 12) { opts.year++; opts.month = 1 }
      else opts.month++
      opts.onChange(opts.year, opts.month)
      update()
    })
  }

  update()
  return el
}
