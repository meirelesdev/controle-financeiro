export interface ModalOptions {
  title: string
  content: string  // HTML
  onConfirm?: () => void | Promise<void>
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

let activeModal: HTMLElement | null = null

export function openModal(options: ModalOptions): void {
  closeModal()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  const sheet = document.createElement('div')
  sheet.className = 'modal-sheet'
  sheet.innerHTML = `
    <div class="modal-handle"></div>
    <div class="px-5 pb-6">
      <h2 class="text-lg font-bold text-muted mb-4">${options.title}</h2>
      <div id="modal-body">${options.content}</div>
      <div class="flex gap-3 mt-5">
        ${options.onConfirm ? `
          <button id="modal-cancel" class="btn-ghost flex-1">${options.cancelLabel ?? 'Cancelar'}</button>
          <button id="modal-confirm" class="${options.danger ? 'btn-danger' : 'btn-primary'} flex-1">${options.confirmLabel ?? 'Confirmar'}</button>
        ` : `
          <button id="modal-cancel" class="btn-primary flex-1">${options.cancelLabel ?? 'Fechar'}</button>
        `}
      </div>
    </div>
  `

  overlay.appendChild(sheet)
  document.body.appendChild(overlay)
  activeModal = overlay

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal()
  })

  sheet.querySelector('#modal-cancel')?.addEventListener('click', closeModal)

  if (options.onConfirm) {
    sheet.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await options.onConfirm!()
      closeModal()
    })
  }
}

export function closeModal(): void {
  if (activeModal) {
    activeModal.remove()
    activeModal = null
  }
}

export function getModalBody(): HTMLElement | null {
  return activeModal?.querySelector('#modal-body') ?? null
}
