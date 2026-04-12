# Controle Financeiro Pessoal

PWA de controle financeiro pessoal — entradas, saídas, cartões de crédito e cofrinhos.

🌐 **[Acessar o app](https://meireles-dev.github.io/controle-financeiro/)**

## Funcionalidades

- **Dashboard** — saldo real vs projetado, gráficos por categoria e histórico de 6 meses
- **Transações** — lançamentos com status `pendente` / `confirmado`, filtros por mês e categoria
- **Cartões de crédito** — controle de fatura, indicador "melhor dia de compra", limite utilizado
- **Cofrinhos** — saldo por banco/carteira digital, transferência entre contas
- **Importar Excel** — mapeamento de colunas + parser dedicado para financiamento imobiliário (AP MRV)
- **Backup cifrado** — exportar/importar JSON com criptografia AES-GCM 256-bit (Web Crypto API)
- **PWA offline** — instalável no celular, funciona sem internet (Workbox / Cache-First)

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Build | Vite + TypeScript |
| UI | Tailwind CSS (mobile-first) |
| Banco de dados | IndexedDB via `idb` |
| Gráficos | Chart.js |
| Import Excel | SheetJS / xlsx |
| PWA | vite-plugin-pwa (Workbox) |
| Deploy | GitHub Actions → GitHub Pages |

## Desenvolvimento local

```bash
npm install
npm run dev
# http://localhost:5173/controle-financeiro/
```

## Deploy

Push na branch `main` dispara o GitHub Actions automaticamente:
`npm ci` → `tsc` → `vite build` → GitHub Pages (`/dist`)
