# Deploy — Controle Financeiro PWA

## URL final
**https://meireles-dev.github.io/controle-financeiro/**

---

## 1. Primeiro deploy

### Pré-requisitos
- Node.js 20+
- Conta no GitHub com username `meireles-dev`

### Passos

```bash
# 1. Testar localmente
npm run dev
# Acesse: http://localhost:5173/controle-financeiro/

# 2. Gerar ícones
# Abra criar-icones.html no navegador e baixe os dois ícones para a pasta /public

# 3. Verificar build
npm run type-check
npm run build
npm run preview
# Acesse: http://localhost:4173/controle-financeiro/

# 4. Criar repositório no GitHub
# Nome: controle-financeiro
# Visibilidade: Public

# 5. Subir código
git init
git add .
git commit -m "feat: initial PWA setup"
git remote add origin https://github.com/meireles-dev/controle-financeiro.git
git branch -M main
git push -u origin main
```

### 6. Ativar GitHub Pages
1. Acesse o repositório no GitHub
2. Settings → Pages
3. Source: **GitHub Actions** (não "Deploy from branch")
4. Aguarde ~1-2 minutos
5. Acesse: https://meireles-dev.github.io/controle-financeiro/

---

## Deploy automático (após configurado)

A cada `git push` na branch `main`, o GitHub Actions irá:
1. Instalar dependências (`npm ci`)
2. Verificar TypeScript (`tsc --noEmit`)
3. Buildar com Vite (`npm run build`)
4. Publicar a pasta `/dist` no GitHub Pages

---

## Instalar como PWA no celular

### Android (Chrome)
1. Acesse a URL no Chrome
2. Toque no ícone de menu (três pontos)
3. "Adicionar à tela inicial"
4. Confirmar

### iOS (Safari)
1. Acesse a URL no Safari
2. Toque no ícone de compartilhamento
3. "Adicionar à Tela de Início"

---

## Estrutura do projeto

```
src/
├── domain/          # Entidades, interfaces, regras de negócio (sem deps externas)
├── application/     # Casos de uso (orquestra domain + infra)
├── infrastructure/  # IndexedDB, criptografia
└── presentation/    # Views Tailwind CSS, componentes, router
```

## Stack
- Vite + TypeScript
- Tailwind CSS (mobile-first)
- IndexedDB via `idb`
- Chart.js (gráficos)
- SheetJS/xlsx (importação Excel)
- vite-plugin-pwa / Workbox (PWA + offline)
- Web Crypto API (backup cifrado AES-GCM)
