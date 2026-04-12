import { exportBackupJSON, exportBackupEncrypted, downloadFile } from '../../application/use-cases/data/ExportData'
import { restoreBackupJSON } from '../../application/use-cases/data/ImportFromExcel'
import {
  getCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
} from '../../application/use-cases/categories/ManageCategories'
import { getCategoriesForType } from '../../domain/constants/Categories'
import { decryptBackup } from '../../infrastructure/crypto/BackupCrypto'
import { showToast } from '../components/Toast'
import { openModal, getModalBody } from '../components/Modal'

export async function renderSettings(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <h1 class="text-lg font-bold text-muted mb-4">Configurações</h1>

    <!-- Aviso dados locais -->
    <div class="card mb-4 border border-warning/30">
      <div class="flex items-start gap-3">
        <span class="text-2xl">⚠️</span>
        <div>
          <div class="text-sm font-semibold text-warning">Dados armazenados localmente</div>
          <div class="text-xs text-subtle mt-1">
            Seus dados ficam apenas neste navegador / dispositivo.
            Faça backup regularmente para não perder informações caso limpe o cache.
          </div>
        </div>
      </div>
    </div>

    <!-- Categorias customizadas -->
    <div class="card mb-4">
      <div class="section-title">Categorias personalizadas</div>
      <div id="custom-cats-wrap" class="space-y-4">
        <div class="text-xs text-subtle">Carregando...</div>
      </div>
    </div>

    <!-- Backup -->
    <div class="card mb-4">
      <div class="section-title">Backup de dados</div>

      <div class="space-y-3">
        <button id="btn-export-json" class="btn-outline w-full">
          📥 Exportar backup (.json)
        </button>

        <button id="btn-export-encrypted" class="btn-outline w-full">
          🔐 Exportar backup cifrado (.cfp)
        </button>

        <div class="divider"></div>

        <label class="block cursor-pointer">
          <div class="btn-ghost w-full text-center py-2.5 rounded-xl text-sm font-semibold">
            📤 Restaurar backup
          </div>
          <input id="restore-input" type="file" accept=".json,.cfp" class="hidden">
        </label>
      </div>

      <p class="text-xs text-subtle mt-3">
        Arquivos <strong>.json</strong> são legíveis. Arquivos <strong>.cfp</strong> são cifrados com sua senha (AES-256).
      </p>
    </div>

    <!-- Sobre -->
    <div class="card mb-4">
      <div class="section-title">Sobre o app</div>
      <div class="space-y-2 text-sm text-subtle">
        <div class="flex justify-between"><span>Versão</span><span class="text-muted font-medium">1.1.0</span></div>
        <div class="flex justify-between"><span>Armazenamento</span><span class="text-muted font-medium">IndexedDB</span></div>
        <div class="flex justify-between"><span>Criptografia</span><span class="text-muted font-medium">AES-GCM 256-bit</span></div>
        <div class="flex justify-between"><span>Deploy</span><span class="text-primary font-medium">GitHub Pages</span></div>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="card border border-danger/30">
      <div class="section-title text-danger">Zona de perigo</div>
      <button id="btn-clear-data" class="btn-danger w-full text-sm">
        🗑️ Apagar todos os dados
      </button>
      <p class="text-xs text-subtle mt-2 text-center">Esta ação é irreversível. Faça backup antes.</p>
    </div>
  `

  // ── Categorias personalizadas ──────────────────────────────
  async function renderCustomCats() {
    const wrap   = document.getElementById('custom-cats-wrap')!
    const custom = await getCustomCategories()

    function catList(type: 'income' | 'expense') {
      const base  = getCategoriesForType(type)
      const extra = custom[type]
      const label = type === 'income' ? 'Entradas' : 'Saídas'
      const color = type === 'income' ? 'text-income' : 'text-expense'
      const btnBorder = type === 'income' ? 'border-primary text-income' : 'border-danger text-expense'

      return `
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold ${color} uppercase tracking-wider">${label}</span>
            <button class="btn-add-cat text-xs px-3 py-1 rounded-lg border ${btnBorder} font-semibold"
              data-type="${type}">+ Adicionar</button>
          </div>
          <!-- categorias fixas (read-only) -->
          ${base.map(c => `
            <div class="flex items-center gap-2 py-1.5 border-b border-slate-800/50">
              <span class="text-base">${c.emoji}</span>
              <span class="text-sm text-subtle flex-1">${c.label}</span>
              <span class="text-[10px] text-slate-600 uppercase">padrão</span>
            </div>
          `).join('')}
          <!-- categorias customizadas (deletáveis) -->
          ${extra.map(c => `
            <div class="flex items-center gap-2 py-1.5 border-b border-slate-800/50">
              <span class="text-base">${c.emoji}</span>
              <span class="text-sm text-muted flex-1">${c.label}</span>
              <button class="btn-del-cat text-danger text-xs px-2 py-0.5 rounded hover:bg-danger/10"
                data-id="${c.id}">✕</button>
            </div>
          `).join('')}
        </div>
      `
    }

    wrap.innerHTML = catList('income') + `<div class="divider"></div>` + catList('expense')

    // Adicionar categoria
    wrap.querySelectorAll<HTMLButtonElement>('.btn-add-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type as 'income' | 'expense'
        const typeLabel = type === 'income' ? 'Entrada' : 'Saída'
        openModal({
          title: `Nova categoria de ${typeLabel}`,
          content: `
            <div class="space-y-3">
              <div>
                <label class="form-label">Emoji</label>
                <input id="cat-emoji" type="text" maxlength="4" class="input text-center text-2xl" placeholder="📌" value="📌">
              </div>
              <div>
                <label class="form-label">Nome da categoria</label>
                <input id="cat-label" type="text" class="input" placeholder="Ex: AP MRV Parcela">
              </div>
            </div>
          `,
          confirmLabel: 'Criar categoria',
          onConfirm: async () => {
            const body  = getModalBody()!
            const emoji = (body.querySelector('#cat-emoji') as HTMLInputElement).value.trim() || '📌'
            const label = (body.querySelector('#cat-label') as HTMLInputElement).value.trim()
            if (!label) { showToast('Informe o nome da categoria', 'error'); return false }
            await addCustomCategory(label, emoji, type)
            showToast(`Categoria "${label}" criada`, 'success')
            await renderCustomCats()
          },
        })
      })
    })

    // Remover categoria
    wrap.querySelectorAll<HTMLButtonElement>('.btn-del-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id!
        await deleteCustomCategory(id)
        showToast('Categoria removida', 'success')
        await renderCustomCats()
      })
    })
  }

  await renderCustomCats()

  // ── Exportar JSON simples ─────────────────────────────────
  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    try {
      const json = await exportBackupJSON()
      const date = new Date().toISOString().slice(0, 10)
      downloadFile(json, `cfp-backup-${date}.json`)
      showToast('Backup exportado com sucesso', 'success')
    } catch (e) {
      showToast('Erro ao exportar backup', 'error')
      console.error(e)
    }
  })

  // ── Exportar cifrado ──────────────────────────────────────
  document.getElementById('btn-export-encrypted')?.addEventListener('click', () => {
    openModal({
      title: 'Definir senha do backup',
      content: `
        <p class="text-xs text-subtle mb-3">A senha será necessária para restaurar o backup. Não há como recuperá-la.</p>
        <div class="space-y-3">
          <div>
            <label class="form-label">Senha</label>
            <input id="enc-pwd" type="password" class="input" placeholder="Mínimo 6 caracteres">
          </div>
          <div>
            <label class="form-label">Confirmar senha</label>
            <input id="enc-pwd2" type="password" class="input" placeholder="Repita a senha">
          </div>
        </div>
      `,
      confirmLabel: 'Exportar cifrado',
      onConfirm: async () => {
        const body = getModalBody()!
        const pwd  = (body.querySelector('#enc-pwd')  as HTMLInputElement).value
        const pwd2 = (body.querySelector('#enc-pwd2') as HTMLInputElement).value

        if (pwd.length < 6)  { showToast('Senha muito curta (mín. 6 caracteres)', 'error'); return false }
        if (pwd !== pwd2)    { showToast('Senhas não conferem', 'error'); return false }

        try {
          const buf  = await exportBackupEncrypted(pwd)
          const date = new Date().toISOString().slice(0, 10)
          downloadFile(buf, `cfp-backup-${date}.cfp`)
          showToast('Backup cifrado exportado', 'success')
        } catch (e) {
          showToast('Erro ao cifrar backup', 'error')
          console.error(e)
        }
      },
    })
  })

  // ── Restaurar backup ──────────────────────────────────────
  const restoreInput = document.getElementById('restore-input') as HTMLInputElement
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files?.[0]
    if (!file) return

    if (file.name.endsWith('.cfp')) {
      openModal({
        title: 'Senha do backup',
        content: `
          <label class="form-label">Senha</label>
          <input id="dec-pwd" type="password" class="input mt-1" placeholder="Senha do arquivo cifrado">
        `,
        confirmLabel: 'Restaurar',
        onConfirm: async () => {
          const pwd = (getModalBody()?.querySelector('#dec-pwd') as HTMLInputElement)?.value
          if (!pwd) { showToast('Informe a senha', 'error'); return false }

          try {
            const buf  = await file.arrayBuffer()
            const json = await decryptBackup(buf, pwd)
            await restoreFromJson(json)
          } catch {
            showToast('Senha incorreta ou arquivo corrompido', 'error')
            return false
          }
        },
      })
    } else {
      const text = await file.text()
      await restoreFromJson(text)
    }
    restoreInput.value = ''
  })

  async function restoreFromJson(json: string) {
    try {
      const result = await restoreBackupJSON(json)
      showToast(`Restaurado: ${result.transactions} transações, ${result.creditCards} cartões, ${result.savings} cofrinhos`, 'success', 5000)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao restaurar backup', 'error')
    }
  }

  // ── Apagar tudo ───────────────────────────────────────────
  document.getElementById('btn-clear-data')?.addEventListener('click', () => {
    openModal({
      title: 'Apagar todos os dados?',
      content: `<p class="text-sm text-subtle">Todos os dados do app serão removidos permanentemente. Faça um backup antes de continuar.</p>`,
      danger: true,
      confirmLabel: 'Apagar tudo',
      onConfirm: async () => {
        const { getDB } = await import(/* @vite-ignore */ '../../infrastructure/database/DatabaseHelper')
        const db = await getDB()
        await db.clear('transactions')
        await db.clear('creditCards')
        await db.clear('savings')
        showToast('Todos os dados foram apagados', 'warning')
      },
    })
  })
}
