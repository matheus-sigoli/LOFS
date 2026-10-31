# LOFS — Liga Osasquense de Futsal

Site de campeonatos de futsal com banco de dados: jogos ao vivo, classificação, súmulas, artilharia,
cartões, equipes, atletas, ranking e painel administrativo. **Projeto acadêmico — todos os dados são fictícios.**

Stack: **Next.js 15 (App Router)** · **Supabase** (Postgres + Auth + Storage) · Tailwind CSS 4 · Vercel.

## O que tem

**Site público**
- Início com o placar dos jogos de hoje (ao vivo em destaque) e próximos jogos
- Campeonatos filtrados por temporada, competição, série e categoria
- Página do campeonato: classificação por grupo (com desempate e últimos jogos), rodadas, finais, artilharia, cartões e equipes
- Súmula do jogo com lances por tempo e disputa de pênaltis
- Equipes (campanhas, elenco, próximos jogos), atletas, ranking da temporada e ginásios
- Conta do torcedor por link no e-mail (sem senha) para seguir equipes e campeonatos
- Tema escuro (padrão) e claro

**Painel** (`/painel`)
- **Mesário:** lança gols, cartões e pênaltis só na partida atribuída a ele e só enquanto está ao vivo
- **Administrador:** campeonatos (fases, grupos, inscrições, geração automática da tabela, mata-mata, colocação final), equipes, atletas (consentimento LGPD, foto, dados restritos), importação via Firecrawl, usuários e auditoria

## Segurança (resumo)

| Camada | Como |
|---|---|
| Banco | RLS em **todas** as tabelas; dados pessoais de atletas em tabela separada; `atleta_publico` (tabela com RLS, mantida por trigger) só recebe nome completo/idade/foto com consentimento ativo |
| Placar | Calculado por trigger a partir dos lances — ninguém edita placar à mão |
| Papéis | Tabela `papel` (nunca metadados do usuário); admin precisa de **2FA (TOTP)** para qualquer escrita — conferido no banco (`aal2`) |
| Servidor | Validação com Zod em toda Server Action; respostas de erro por código (sem refletir texto); redirecionamentos só para caminhos internos |
| HTTP | CSP com nonce, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `no-store` em páginas autenticadas |
| Abuso | Limite de taxa no login, 2FA, favoritos e importação (falha fechada) |
| Uploads | Foto validada pela assinatura binária, renomeada por UUID, metadados (EXIF/GPS) removidos, bucket privado com URL assinada |
| Importação | Só admin, URL validada (https, sem IP/host interno), dados externos validados e mantidos em *staging* até revisão |
| Segredos | `service_role` e `FIRECRAWL_API_KEY` só no servidor (`server-only`); service role usada apenas no limitador e na assinatura de fotos já liberadas |
| Auditoria | Trigger registra alterações (sem copiar dados restritos) |

Avisos restantes do *Security Advisor* do Supabase (`alterar_status_partida`, `conceder_papel`, `mesarios`, `usuarios_painel` executáveis por usuários logados) são intencionais: cada função confere o papel (admin com 2FA ou mesário da partida) antes de agir e precisa de privilégio elevado para ler `auth.users` ou fazer a transição controlada de status.

Decisões detalhadas em [`docs/adr`](docs/adr) e glossário em [`CONTEXT.md`](CONTEXT.md).

## Rodando localmente

Pré-requisitos: Node 20.18+ (ou 22), Docker (para o Supabase local).

```bash
npm install
npx supabase start            # sobe Postgres, Auth, Storage e aplica migrations + seed
npx supabase status           # copie API URL, anon key e service_role key
cp .env.example .env.local    # e preencha com os valores acima
npm run dev                   # http://localhost:3000
```

Os e-mails de login local aparecem no Inbucket: http://localhost:54324

### Primeiro administrador

1. Entre no site com seu e-mail (link mágico).
2. No SQL Editor do Studio (http://localhost:54323) rode:
   ```sql
   insert into public.papel (user_id, papel)
   select id, 'admin' from auth.users where email = 'seu@email.com';
   ```
3. Abra `/painel/seguranca` e ative a verificação em duas etapas. Depois disso, novos admins e mesários são concedidos pelo painel em **Usuários**.

### Importação com Firecrawl (opcional)

Coloque `FIRECRAWL_API_KEY` no `.env.local`. Sem a chave, a tela de importação avisa que está desativada.
Respeite os termos de uso dos sites de origem.

## Testes

```bash
npm test                      # unidade: classificação/desempate, validação de URL, redirecionamento, limpeza de fotos
npm run typecheck && npm run lint && npm run build
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql   # 32 testes de RLS e regras do banco
```

`supabase/tests/api_publica.py` e `api_painel.py` exercitam as consultas reais do site contra um PostgREST local
(usam um JWT de teste assinado com o segredo configurado no script — ajuste para o seu ambiente).

## Deploy (Vercel + Supabase)

1. Crie um projeto no Supabase e rode `npx supabase link` + `npx supabase db push` (não rode o seed em produção se quiser começar vazio).
2. Em **Authentication → URL Configuration**, defina o Site URL e adicione `https://SEU-DOMINIO/auth/confirmar` às Redirect URLs. Ative **MFA → TOTP**.
3. Na Vercel, configure as variáveis do `.env.example` (as duas últimas **sem** `NEXT_PUBLIC_`).
4. Agende `select private.limpar_limites();` diariamente com pg_cron.

## Estrutura

```
supabase/migrations   schema, funções/triggers, RLS, views, limitador, storage, papéis
supabase/seed.sql     dados fictícios (16 equipes de bairros de Osasco, temporadas 2025 e 2026)
src/app               páginas públicas, /entrar, /minha-conta, /painel
src/lib               consultas, auth, classificação, segurança (URL, caminho, imagem, limite)
docs/                 ADRs e modelo de dados
```
