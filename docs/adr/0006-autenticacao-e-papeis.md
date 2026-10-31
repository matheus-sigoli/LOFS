# ADR 0006 — Login por link mágico e papéis no painel

- **Status:** Aceito · 2026-10-31

## Decisão
- Torcedor: login por link no e-mail (Supabase Auth), favoritos ligados ao `user_id` com RLS (`user_id = auth.uid()`).
- Painel: papéis **admin** (tudo) e **mesário** (lança súmulas dos jogos atribuídos). Papéis em tabela própria, nunca em metadados editáveis pelo usuário.
- **2FA (TOTP) obrigatório** para admin.
- Rate limit no envio de link e em rotas de escrita.

## Consequências
- Corrige a falha do site de referência (favoritos consultáveis só pelo e-mail de terceiros).
