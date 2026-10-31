# ADR 0002 — Next.js (App Router) + Supabase (Postgres) na Vercel

- **Status:** Aceito · 2026-10-31

## Decisão
- Front e back em **Next.js (App Router, TypeScript)**, Server Components para páginas públicas, Server Actions/Route Handlers para escrita.
- **Supabase**: Postgres, Auth e Storage. Toda tabela com **RLS ativo**; leitura pública só em dados publicados, escrita só para papéis do painel.
- Deploy na **Vercel**.

## Consequências
- Segurança concentrada no banco (RLS) + validação no servidor (Zod).
- Chave `service_role` só no servidor (importador e jobs), nunca no cliente.
