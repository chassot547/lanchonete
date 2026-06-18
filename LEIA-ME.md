# Sistema de Gestão — Lanchonete

Monorepo com PDV, KDS, Painel Gerencial, API e serviço fiscal.

## Estrutura

```
lanchonete/
├── apps/
│   ├── pdv/        # Frente de caixa (React PWA) · porta 5173
│   ├── kds/        # Tela da cozinha (React) · porta 5175
│   ├── painel/     # Painel gerencial (React) · porta 5174
│   ├── api/        # Backend (Node.js + Fastify) · porta 3000
│   └── fiscal/     # Serviço NFC-e / NF-e
├── packages/
│   ├── types/      # Tipos TypeScript compartilhados
│   ├── ui/         # Componentes de UI compartilhados
│   ├── utils/      # Utilitários compartilhados
│   └── db/         # Schema SQL, triggers, views, seeds
└── infra/
    └── docker/     # docker-compose para dev e produção
```

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Conta Supabase (banco + auth + realtime)
- Conta FocusNFe (NFC-e / NF-e)
- Conta Asaas (pagamentos PIX + cartão)

## Como rodar

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env com suas credenciais

# 3. Rodar o schema no Supabase
# Execute os arquivos em ordem no SQL Editor do Supabase:
# packages/db/src/schema/pedidos.sql
# packages/db/src/schema/triggers.sql
# packages/db/src/schema/views.sql

# 4. Iniciar todos os apps em modo dev
pnpm dev

# Ou individualmente:
pnpm --filter @lanchonete/api dev
pnpm --filter @lanchonete/pdv dev
pnpm --filter @lanchonete/kds dev
```

## Fases de desenvolvimento

| Fase | Módulos | Prazo |
|------|---------|-------|
| MVP  | PDV, KDS, Estoque, Fiscal, Financeiro | Mês 1–3 |
| v1.1 | Delivery, CRM, Fidelidade, QR Mesa | Mês 4–5 |
| v2.0 | Assinaturas, App Cliente, Multi-unidade | Mês 6–7 |

## Stack

- **Frontend:** React + Vite + TailwindCSS + Zustand + React Query
- **Backend:** Node.js + Fastify + TypeScript
- **Banco:** PostgreSQL via Supabase (RLS + Realtime)
- **Cache/Filas:** Redis + BullMQ
- **Fiscal:** FocusNFe API
- **Pagamentos:** Asaas (PIX, cartão, recorrência)
- **WhatsApp:** Evolution API
