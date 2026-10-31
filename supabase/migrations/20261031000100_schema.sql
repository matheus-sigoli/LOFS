-- =============================================================================
-- LOFS · Liga Osasquense de Futsal — schema principal
-- Convenções: UUID como PK (não enumerável), timestamptz, text + check,
-- índice em toda FK, slugs para URLs públicas.
-- =============================================================================

create schema if not exists private;  -- funções auxiliares; não exposto pela API
revoke all on schema private from public;

-- ---------------------------------------------------------------- tipos
create type public.status_campeonato as enum ('rascunho', 'publicado', 'encerrado');
create type public.tipo_fase         as enum ('grupos', 'mata_mata');
create type public.status_partida    as enum ('agendada', 'ao_vivo', 'encerrada', 'adiada', 'cancelada');
create type public.tipo_evento       as enum ('gol', 'gol_contra', 'amarelo', 'vermelho', 'penalti_convertido', 'penalti_perdido');
create type public.papel_usuario     as enum ('admin', 'mesario');
create type public.grupo_categoria   as enum ('base', 'principal');
create type public.status_importacao as enum ('pendente', 'extraida', 'erro', 'aplicada', 'descartada');

-- ---------------------------------------------------------------- utilidades
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- catálogo
create table public.temporada (
  id         uuid primary key default gen_random_uuid(),
  ano        smallint not null unique check (ano between 2000 and 2100),
  atual      boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index temporada_uma_atual on public.temporada (atual) where atual;

create table public.titulo (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(nome) between 2 and 80),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.serie (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null check (length(nome) between 2 and 40),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ordem                 smallint not null default 0,
  multiplicador_ranking numeric(4,2) not null default 1 check (multiplicador_ranking > 0)
);

create table public.categoria (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null check (length(nome) between 2 and 40),
  slug  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  grupo public.grupo_categoria not null,
  ordem smallint not null default 0
);

create table public.local (
  id       uuid primary key default gen_random_uuid(),
  nome     text not null check (length(nome) between 2 and 120),
  slug     text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  endereco text check (length(endereco) <= 200),
  bairro   text check (length(bairro) <= 80)
);

create table public.equipe (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(nome) between 2 and 80),
  nome_curto     text not null check (length(nome_curto) between 2 and 4),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bairro         text check (length(bairro) <= 80),
  cor_primaria   text not null default '#1f9d55' check (cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  cor_secundaria text not null default '#ffffff' check (cor_secundaria ~ '^#[0-9a-fA-F]{6}$'),
  fundacao       smallint check (fundacao between 1900 and 2100),
  escudo_path    text check (escudo_path ~ '^[a-z0-9/_-]+\.(png|webp|jpg)$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger equipe_updated before update on public.equipe
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- campeonatos
create table public.campeonato (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo_id           uuid not null references public.titulo (id),
  temporada_id        uuid not null references public.temporada (id),
  serie_id            uuid not null references public.serie (id),
  categoria_id        uuid not null references public.categoria (id),
  status              public.status_campeonato not null default 'rascunho',
  pontos_vitoria      smallint not null default 3 check (pontos_vitoria between 0 and 10),
  pontos_empate       smallint not null default 1 check (pontos_empate between 0 and 10),
  pontos_derrota      smallint not null default 0 check (pontos_derrota between 0 and 10),
  -- ordem dos critérios de desempate (ADR 0005); validado pela lista permitida
  criterios_desempate text[] not null default
    array['pontos','vitorias','saldo','gols_pro','confronto_direto','menos_vermelhos','menos_amarelos'],
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (titulo_id, temporada_id, serie_id, categoria_id),
  constraint criterios_validos check (
    criterios_desempate <@ array['pontos','vitorias','saldo','gols_pro','confronto_direto','menos_vermelhos','menos_amarelos']::text[]
  )
);
create index campeonato_temporada_idx on public.campeonato (temporada_id);
create index campeonato_serie_idx     on public.campeonato (serie_id);
create index campeonato_categoria_idx on public.campeonato (categoria_id);
create index campeonato_status_idx    on public.campeonato (status) where status <> 'rascunho';
create trigger campeonato_updated before update on public.campeonato
  for each row execute function private.set_updated_at();

create table public.fase (
  id            uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonato (id) on delete cascade,
  nome          text not null check (length(nome) between 2 and 60),
  tipo          public.tipo_fase not null,
  ida_volta     boolean not null default false,
  ordem         smallint not null,
  unique (campeonato_id, ordem)
);

create table public.grupo (
  id      uuid primary key default gen_random_uuid(),
  fase_id uuid not null references public.fase (id) on delete cascade,
  nome    text not null check (length(nome) between 1 and 30),
  unique (fase_id, nome)
);

create table public.inscricao (
  id              uuid primary key default gen_random_uuid(),
  campeonato_id   uuid not null references public.campeonato (id) on delete cascade,
  equipe_id       uuid not null references public.equipe (id),
  grupo_id        uuid references public.grupo (id) on delete set null,
  colocacao_final smallint check (colocacao_final between 1 and 64),
  unique (campeonato_id, equipe_id)
);
create index inscricao_equipe_idx on public.inscricao (equipe_id);
create index inscricao_grupo_idx  on public.inscricao (grupo_id);

-- ---------------------------------------------------------------- atletas (ADR 0004)
create table public.atleta (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome_esportivo text not null check (length(nome_esportivo) between 2 and 40),
  nome_completo  text not null check (length(nome_completo) between 3 and 120),
  ano_nascimento smallint check (ano_nascimento between 1940 and 2100),
  posicao        text check (posicao in ('goleiro','fixo','ala','pivo')),
  foto_path      text check (foto_path ~ '^atletas/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger atleta_updated before update on public.atleta
  for each row execute function private.set_updated_at();

-- Dados que NUNCA são públicos
create table public.atleta_privado (
  atleta_id           uuid primary key references public.atleta (id) on delete cascade,
  data_nascimento     date,
  documento           text check (length(documento) <= 30),
  responsavel_nome    text check (length(responsavel_nome) <= 120),
  responsavel_contato text check (length(responsavel_contato) <= 120)
);

create table public.consentimento (
  id               uuid primary key default gen_random_uuid(),
  atleta_id        uuid not null references public.atleta (id) on delete cascade,
  responsavel_nome text not null check (length(responsavel_nome) between 3 and 120),
  termo_versao     text not null check (length(termo_versao) between 1 and 20),
  concedido_em     timestamptz not null default now(),
  revogado_em      timestamptz,
  registrado_por   uuid references auth.users (id) on delete set null,
  check (revogado_em is null or revogado_em >= concedido_em)
);
create index consentimento_atleta_idx on public.consentimento (atleta_id) where revogado_em is null;
create index consentimento_registrado_por_idx on public.consentimento (registrado_por);

create table public.inscricao_atleta (
  id           uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricao (id) on delete cascade,
  atleta_id    uuid not null references public.atleta (id),
  numero       smallint not null check (numero between 1 and 99),
  unique (inscricao_id, atleta_id),
  unique (inscricao_id, numero)
);
create index inscricao_atleta_atleta_idx on public.inscricao_atleta (atleta_id);

-- ---------------------------------------------------------------- partidas
create table public.partida (
  id                 uuid primary key default gen_random_uuid(),
  fase_id            uuid not null references public.fase (id) on delete cascade,
  grupo_id           uuid references public.grupo (id) on delete cascade,
  rodada             smallint check (rodada between 1 and 99),
  chave              text check (length(chave) <= 30),       -- ex.: "Semifinal 1", "Final"
  mandante_id        uuid not null references public.inscricao (id),
  visitante_id       uuid not null references public.inscricao (id),
  local_id           uuid references public.local (id),
  data_hora          timestamptz,
  status             public.status_partida not null default 'agendada',
  -- placar é DERIVADO dos eventos por trigger; não editar à mão
  gols_mandante      smallint not null default 0,
  gols_visitante     smallint not null default 0,
  penaltis_mandante  smallint,
  penaltis_visitante smallint,
  mesario_id         uuid references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now(),
  check (mandante_id <> visitante_id)
);
create index partida_fase_idx      on public.partida (fase_id);
create index partida_grupo_idx     on public.partida (grupo_id);
create index partida_mandante_idx  on public.partida (mandante_id);
create index partida_visitante_idx on public.partida (visitante_id);
create index partida_local_idx     on public.partida (local_id);
create index partida_mesario_idx   on public.partida (mesario_id);
create index partida_data_idx      on public.partida (data_hora);
create trigger partida_updated before update on public.partida
  for each row execute function private.set_updated_at();

create table public.evento_partida (
  id           uuid primary key default gen_random_uuid(),
  partida_id   uuid not null references public.partida (id) on delete cascade,
  tipo         public.tipo_evento not null,
  inscricao_id uuid not null references public.inscricao (id),   -- equipe do autor
  atleta_id    uuid references public.atleta (id),
  periodo      smallint not null check (periodo between 1 and 4), -- 1º, 2º, prorrogação, pênaltis
  minuto       smallint check (minuto between 0 and 60),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  check ((tipo in ('penalti_convertido','penalti_perdido')) = (periodo = 4))
);
create index evento_partida_partida_idx   on public.evento_partida (partida_id);
create index evento_partida_inscricao_idx on public.evento_partida (inscricao_id);
create index evento_partida_atleta_idx    on public.evento_partida (atleta_id);
create index evento_partida_created_idx   on public.evento_partida (created_by);

-- ---------------------------------------------------------------- usuários
create table public.perfil (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text check (length(nome) <= 80),
  created_at timestamptz not null default now()
);

create table public.papel (
  user_id    uuid not null references auth.users (id) on delete cascade,
  papel      public.papel_usuario not null,
  created_at timestamptz not null default now(),
  primary key (user_id, papel)
);

create table public.favorito (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  campeonato_id uuid references public.campeonato (id) on delete cascade,
  equipe_id     uuid references public.equipe (id) on delete cascade,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(campeonato_id, equipe_id) = 1)
);
create unique index favorito_unico_camp   on public.favorito (user_id, campeonato_id) where campeonato_id is not null;
create unique index favorito_unico_equipe on public.favorito (user_id, equipe_id) where equipe_id is not null;
create index favorito_campeonato_idx on public.favorito (campeonato_id);
create index favorito_equipe_idx     on public.favorito (equipe_id);

-- ---------------------------------------------------------------- importação e auditoria
create table public.importacao (
  id           uuid primary key default gen_random_uuid(),
  url          text not null check (url ~ '^https://' and length(url) <= 2048),
  status       public.status_importacao not null default 'pendente',
  dados        jsonb,
  erro         text check (length(erro) <= 500),
  criado_por   uuid not null references auth.users (id),
  criado_em    timestamptz not null default now(),
  revisado_por uuid references auth.users (id),
  revisado_em  timestamptz
);
create index importacao_criado_por_idx   on public.importacao (criado_por);
create index importacao_revisado_por_idx on public.importacao (revisado_por);

create table public.auditoria (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  acao        text not null,
  tabela      text not null,
  registro_id text,
  dados       jsonb,
  criado_em   timestamptz not null default now()
);
create index auditoria_criado_em_idx on public.auditoria using brin (criado_em);
