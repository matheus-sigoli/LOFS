-- LOFS · instalação completa para colar no SQL Editor do Supabase (schema + segurança + dados fictícios).
-- Gerado a partir de supabase/migrations/*.sql e supabase/seed.sql. Rode UMA vez, em um projeto novo.


-- ==================== supabase/migrations/20261031000100_schema.sql
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

-- ==================== supabase/migrations/20261031000200_funcoes_triggers.sql
-- =============================================================================
-- Funções auxiliares, triggers de integridade e RPCs controladas.
-- Toda função SECURITY DEFINER fixa search_path = '' e qualifica nomes.
-- =============================================================================

-- ---------------------------------------------------------------- papéis
create function private.tem_papel(p public.papel_usuario) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.papel
    where user_id = (select auth.uid()) and papel = p
  )
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.tem_papel('admin')
$$;

-- Admin com 2FA: exige sessão AAL2 (TOTP verificado) para escrever (ADR 0006)
create function private.is_admin_aal2() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
$$;

-- Mesário pode lançar súmula só da partida atribuída a ele e enquanto estiver ao vivo
create function private.pode_lancar_sumula(p_partida uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_aal2() or exists (
    select 1 from public.partida p
    where p.id = p_partida
      and p.mesario_id = (select auth.uid())
      and p.status = 'ao_vivo'
      and private.tem_papel('mesario')
  )
$$;

-- ---------------------------------------------------------------- novo usuário → perfil
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfil (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- integridade da súmula
create function private.validar_evento() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_partida public.partida;
begin
  select * into v_partida from public.partida where id = new.partida_id;

  if new.inscricao_id not in (v_partida.mandante_id, v_partida.visitante_id) then
    raise exception 'A equipe do evento não joga esta partida' using errcode = '23514';
  end if;

  if v_partida.status not in ('ao_vivo', 'encerrada') then
    raise exception 'Súmula só pode ser lançada com a partida ao vivo ou encerrada' using errcode = '23514';
  end if;

  if new.atleta_id is not null and not exists (
    select 1 from public.inscricao_atleta ia
    where ia.inscricao_id = new.inscricao_id and ia.atleta_id = new.atleta_id
  ) then
    raise exception 'Atleta não inscrito por esta equipe' using errcode = '23514';
  end if;

  if new.tipo in ('gol', 'gol_contra', 'penalti_convertido', 'penalti_perdido')
     and new.atleta_id is null and new.tipo <> 'gol_contra' then
    -- gol sem autor identificado é permitido apenas como gol contra
    raise exception 'Informe o atleta autor' using errcode = '23514';
  end if;

  new.created_by := coalesce(new.created_by, (select auth.uid()));
  return new;
end $$;

create trigger evento_validar before insert or update on public.evento_partida
  for each row execute function private.validar_evento();

-- Placar sempre derivado dos eventos (ADR 0005)
create function private.recalcular_placar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(new.partida_id, old.partida_id);
begin
  update public.partida p set
    gols_mandante = (
      select count(*) from public.evento_partida e
      where e.partida_id = p.id and e.periodo < 4
        and ((e.tipo = 'gol' and e.inscricao_id = p.mandante_id)
          or (e.tipo = 'gol_contra' and e.inscricao_id = p.visitante_id))),
    gols_visitante = (
      select count(*) from public.evento_partida e
      where e.partida_id = p.id and e.periodo < 4
        and ((e.tipo = 'gol' and e.inscricao_id = p.visitante_id)
          or (e.tipo = 'gol_contra' and e.inscricao_id = p.mandante_id))),
    penaltis_mandante = (
      select case when count(*) = 0 then null
             else count(*) filter (where e.tipo = 'penalti_convertido' and e.inscricao_id = p.mandante_id) end
      from public.evento_partida e where e.partida_id = p.id and e.periodo = 4),
    penaltis_visitante = (
      select case when count(*) = 0 then null
             else count(*) filter (where e.tipo = 'penalti_convertido' and e.inscricao_id = p.visitante_id) end
      from public.evento_partida e where e.partida_id = p.id and e.periodo = 4)
  where p.id = v_id;
  return null;
end $$;

create trigger evento_placar after insert or update or delete on public.evento_partida
  for each row execute function private.recalcular_placar();

-- Placar não pode ser editado diretamente por ninguém além do trigger acima
create function private.proteger_placar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 and (
       new.gols_mandante      is distinct from old.gols_mandante
    or new.gols_visitante     is distinct from old.gols_visitante
    or new.penaltis_mandante  is distinct from old.penaltis_mandante
    or new.penaltis_visitante is distinct from old.penaltis_visitante) then
    raise exception 'O placar é calculado pela súmula' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger partida_proteger_placar before update on public.partida
  for each row execute function private.proteger_placar();

-- Grupo da partida e das equipes precisa bater
create function private.validar_partida() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.grupo_id is not null and exists (
    select 1 from public.inscricao i
    where i.id in (new.mandante_id, new.visitante_id)
      and i.grupo_id is distinct from new.grupo_id
  ) then
    raise exception 'As duas equipes precisam estar no grupo da partida' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.inscricao i join public.fase f on f.campeonato_id = i.campeonato_id
    where f.id = new.fase_id and i.id in (new.mandante_id, new.visitante_id)
    having count(*) <> 2
  ) then
    raise exception 'Equipes não inscritas neste campeonato' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger partida_validar before insert or update of mandante_id, visitante_id, grupo_id, fase_id
  on public.partida for each row execute function private.validar_partida();

-- ---------------------------------------------------------------- auditoria
create function private.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  -- nunca copiar dados pessoais sensíveis para o log
  if tg_table_name in ('atleta_privado', 'consentimento') then
    v_row := jsonb_build_object('atleta_id', v_row ->> 'atleta_id');
  end if;
  insert into public.auditoria (user_id, acao, tabela, registro_id, dados)
  values ((select auth.uid()), lower(tg_op), tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'atleta_id', v_row ->> 'user_id'), v_row);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['campeonato','fase','grupo','inscricao','equipe','atleta','atleta_privado',
                           'consentimento','partida','evento_partida','papel','importacao']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private.auditar()', t || '_auditoria', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RPCs
-- Mudança de status da partida (mesário/admin) — evita UPDATE livre na tabela
create function public.alterar_status_partida(p_partida uuid, p_status public.status_partida)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_atual public.status_partida;
  v_mesario uuid;
begin
  select status, mesario_id into v_atual, v_mesario from public.partida where id = p_partida for update;
  if not found then
    raise exception 'Partida não encontrada' using errcode = 'P0002';
  end if;

  if private.is_admin_aal2() then
    null; -- admin pode qualquer transição
  elsif private.tem_papel('mesario') and v_mesario = (select auth.uid()) then
    if not ((v_atual = 'agendada' and p_status = 'ao_vivo')
         or (v_atual = 'ao_vivo'  and p_status = 'encerrada')) then
      raise exception 'Transição não permitida para mesário' using errcode = '42501';
    end if;
  else
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.partida set status = p_status where id = p_partida;
end $$;

-- Gera jogos de turno (ou turno e returno) de um grupo pelo método do círculo
create function private.gerar_rodadas(p_grupo uuid, p_ida_volta boolean, p_inicio timestamptz,
                                      p_local uuid, p_intervalo interval default interval '7 days')
returns integer language plpgsql set search_path = '' as $$
declare
  v_fase uuid;
  v_times uuid[];
  n int; r int; k int; a uuid; b uuid; tmp uuid;
  v_total int := 0;
  v_turnos int := case when p_ida_volta then 2 else 1 end;
  t int;
begin
  select fase_id into v_fase from public.grupo where id = p_grupo;
  select array_agg(id order by id) into v_times from public.inscricao where grupo_id = p_grupo;
  n := coalesce(array_length(v_times, 1), 0);
  if n < 2 then return 0; end if;
  if n % 2 = 1 then v_times := v_times || null::uuid; n := n + 1; end if;

  for t in 1..v_turnos loop
    for r in 1..n-1 loop
      for k in 1..n/2 loop
        a := v_times[k]; b := v_times[n + 1 - k];
        if a is not null and b is not null then
          if (r + t) % 2 = 0 then tmp := a; a := b; b := tmp; end if;
          insert into public.partida (fase_id, grupo_id, rodada, mandante_id, visitante_id, local_id, data_hora)
          values (v_fase, p_grupo, (t - 1) * (n - 1) + r, a, b, p_local,
                  p_inicio + ((t - 1) * (n - 1) + r - 1) * p_intervalo);
          v_total := v_total + 1;
        end if;
      end loop;
      -- rotaciona mantendo o primeiro fixo
      v_times := array[v_times[1]] || v_times[n:n] || v_times[2:n-1];
    end loop;
  end loop;
  return v_total;
end $$;

create function public.gerar_tabela_grupo(p_grupo uuid, p_inicio timestamptz, p_local uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_ida boolean;
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if exists (select 1 from public.partida where grupo_id = p_grupo) then
    raise exception 'O grupo já tem jogos' using errcode = '23505';
  end if;
  select f.ida_volta into v_ida from public.grupo g join public.fase f on f.id = g.fase_id where g.id = p_grupo;
  return private.gerar_rodadas(p_grupo, v_ida, p_inicio, p_local);
end $$;

-- ---------------------------------------------------------------- privilégios de execução
revoke execute on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.tem_papel(public.papel_usuario), private.is_admin(),
  private.is_admin_aal2(), private.pode_lancar_sumula(uuid) to anon, authenticated;

revoke execute on function public.alterar_status_partida(uuid, public.status_partida) from public, anon;
revoke execute on function public.gerar_tabela_grupo(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.alterar_status_partida(uuid, public.status_partida) to authenticated;
grant execute on function public.gerar_tabela_grupo(uuid, timestamptz, uuid) to authenticated;

-- ==================== supabase/migrations/20261031000300_rls.sql
-- =============================================================================
-- Row Level Security — TODA tabela com RLS ativo.
-- Leitura pública só do que pertence a campeonatos publicados/encerrados;
-- a visibilidade se propaga por subconsultas que também passam pelo RLS.
-- Escrita administrativa exige papel admin com sessão 2FA (aal2).
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array['temporada','titulo','serie','categoria','local','equipe','campeonato','fase',
    'grupo','inscricao','atleta','atleta_privado','consentimento','inscricao_atleta','partida',
    'evento_partida','perfil','papel','favorito','importacao','auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- catálogo público
create policy "catálogo: leitura pública" on public.temporada for select to anon, authenticated using (true);
create policy "catálogo: leitura pública" on public.titulo    for select to anon, authenticated using (true);
create policy "catálogo: leitura pública" on public.serie     for select to anon, authenticated using (true);
create policy "catálogo: leitura pública" on public.categoria for select to anon, authenticated using (true);
create policy "catálogo: leitura pública" on public.local     for select to anon, authenticated using (true);
create policy "catálogo: leitura pública" on public.equipe    for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- campeonato e filhos
create policy "campeonato: públicos visíveis" on public.campeonato for select to anon, authenticated
  using (status <> 'rascunho' or (select private.is_admin()));

create policy "fase: segue o campeonato" on public.fase for select to anon, authenticated
  using (campeonato_id in (select id from public.campeonato));

create policy "grupo: segue a fase" on public.grupo for select to anon, authenticated
  using (fase_id in (select id from public.fase));

create policy "inscrição: segue o campeonato" on public.inscricao for select to anon, authenticated
  using (campeonato_id in (select id from public.campeonato));

create policy "inscrição atleta: segue a inscrição" on public.inscricao_atleta for select to anon, authenticated
  using (inscricao_id in (select id from public.inscricao));

create policy "partida: segue a fase" on public.partida for select to anon, authenticated
  using (fase_id in (select id from public.fase) or mesario_id = (select auth.uid()));

create policy "evento: segue a partida" on public.evento_partida for select to anon, authenticated
  using (partida_id in (select id from public.partida));

-- Mesário: lança e remove eventos apenas da sua partida ao vivo
create policy "evento: mesário lança" on public.evento_partida for insert to authenticated
  with check ((select private.pode_lancar_sumula(partida_id)));
create policy "evento: mesário corrige" on public.evento_partida for delete to authenticated
  using ((select private.pode_lancar_sumula(partida_id)));

-- ---------------------------------------------------------------- atletas (ADR 0004)
-- Tabela base só para admin; o público usa a view atleta_publico.
create policy "atleta: admin lê" on public.atleta for select to authenticated using ((select private.is_admin()));
create policy "atleta privado: admin lê" on public.atleta_privado for select to authenticated using ((select private.is_admin_aal2()));
create policy "consentimento: admin lê" on public.consentimento for select to authenticated using ((select private.is_admin_aal2()));

-- ---------------------------------------------------------------- escrita administrativa (todas as tabelas de domínio)
do $$
declare t text;
begin
  foreach t in array array['temporada','titulo','serie','categoria','local','equipe','campeonato','fase',
    'grupo','inscricao','atleta','atleta_privado','consentimento','inscricao_atleta','partida','evento_partida']
  loop
    execute format($f$create policy "admin: insere" on public.%I for insert to authenticated
                     with check ((select private.is_admin_aal2()))$f$, t);
    execute format($f$create policy "admin: altera" on public.%I for update to authenticated
                     using ((select private.is_admin_aal2())) with check ((select private.is_admin_aal2()))$f$, t);
    if t <> 'evento_partida' then
      execute format($f$create policy "admin: remove" on public.%I for delete to authenticated
                       using ((select private.is_admin_aal2()))$f$, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- usuários
create policy "perfil: próprio" on public.perfil for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy "perfil: edita o próprio" on public.perfil for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "papel: vê os próprios" on public.papel for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "papel: admin concede" on public.papel for insert to authenticated
  with check ((select private.is_admin_aal2()));
create policy "papel: admin revoga" on public.papel for delete to authenticated
  using ((select private.is_admin_aal2()) and user_id <> (select auth.uid())); -- não remove o próprio acesso

create policy "favorito: só os próprios" on public.favorito for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorito: adiciona o próprio" on public.favorito for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "favorito: remove o próprio" on public.favorito for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- importação e auditoria
create policy "importação: admin" on public.importacao for all to authenticated
  using ((select private.is_admin_aal2())) with check ((select private.is_admin_aal2()));
create policy "auditoria: admin lê" on public.auditoria for select to authenticated
  using ((select private.is_admin_aal2()));

-- ---------------------------------------------------------------- defesa em profundidade: privilégios
revoke all on public.atleta_privado, public.consentimento, public.importacao, public.auditoria from anon;
revoke all on public.atleta, public.papel, public.perfil, public.favorito from anon;
revoke insert, update, delete on all tables in schema public from anon;
revoke update, delete, insert on public.auditoria from authenticated;  -- só triggers escrevem
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- ==================== supabase/migrations/20261031000400_views.sql
-- =============================================================================
-- Views de leitura. Estatísticas usam security_invoker (respeitam o RLS de quem consulta).
-- atleta_publico é a ÚNICA view com privilégio do dono: ela existe justamente para
-- expor um subconjunto filtrado de public.atleta (ADR 0004) e não tem filtro do chamador.
-- =============================================================================

-- ---------------------------------------------------------------- atleta público
create view public.atleta_publico with (security_barrier = true) as
select
  a.id,
  a.slug,
  a.nome_esportivo,
  a.posicao,
  (c.atleta_id is not null)                                     as consentido,
  case when c.atleta_id is not null then a.nome_completo end    as nome_completo,
  case when c.atleta_id is not null then a.ano_nascimento end   as ano_nascimento,
  case when c.atleta_id is not null then a.foto_path end        as foto_path
from public.atleta a
left join lateral (
  select atleta_id from public.consentimento
  where atleta_id = a.id and revogado_em is null
  limit 1
) c on true
-- só atletas inscritos em pelo menos um campeonato visível
where exists (
  select 1
  from public.inscricao_atleta ia
  join public.inscricao i  on i.id = ia.inscricao_id
  join public.campeonato k on k.id = i.campeonato_id
  where ia.atleta_id = a.id and k.status <> 'rascunho'
);
comment on view public.atleta_publico is
  'Perfil público de atleta: nome completo, ano e foto só com consentimento ativo (ADR 0004).';
revoke all on public.atleta_publico from anon, authenticated;
grant select on public.atleta_publico to anon, authenticated;

-- ---------------------------------------------------------------- classificação por grupo
create view public.classificacao with (security_invoker = true) as
with jogos as (
  select p.grupo_id, p.mandante_id as inscricao_id, p.gols_mandante as gp, p.gols_visitante as gc
  from public.partida p where p.status = 'encerrada' and p.grupo_id is not null
  union all
  select p.grupo_id, p.visitante_id, p.gols_visitante, p.gols_mandante
  from public.partida p where p.status = 'encerrada' and p.grupo_id is not null
),
cartoes as (
  select e.inscricao_id,
         count(*) filter (where e.tipo = 'amarelo')  as amarelos,
         count(*) filter (where e.tipo = 'vermelho') as vermelhos
  from public.evento_partida e
  join public.partida p on p.id = e.partida_id
  where p.status = 'encerrada' and p.grupo_id is not null
  group by e.inscricao_id
),
agregado as (
  select i.id as inscricao_id,
         count(j.inscricao_id)                       as jogos,
         count(*) filter (where j.gp > j.gc)         as vitorias,
         count(*) filter (where j.gp = j.gc)         as empates,
         count(*) filter (where j.gp < j.gc)         as derrotas,
         coalesce(sum(j.gp), 0)                      as gols_pro,
         coalesce(sum(j.gc), 0)                      as gols_contra
  from public.inscricao i
  left join jogos j on j.inscricao_id = i.id and j.grupo_id = i.grupo_id
  where i.grupo_id is not null
  group by i.id
)
select
  i.id            as inscricao_id,
  i.grupo_id,
  g.nome          as grupo_nome,
  f.id            as fase_id,
  i.campeonato_id,
  i.equipe_id,
  a.jogos::int, a.vitorias::int, a.empates::int, a.derrotas::int,
  a.gols_pro::int, a.gols_contra::int,
  (a.gols_pro - a.gols_contra)::int as saldo,
  (a.vitorias * c.pontos_vitoria + a.empates * c.pontos_empate + a.derrotas * c.pontos_derrota)::int as pontos,
  coalesce(ct.amarelos, 0)::int  as amarelos,
  coalesce(ct.vermelhos, 0)::int as vermelhos
from public.inscricao i
join agregado a           on a.inscricao_id = i.id
join public.grupo g       on g.id = i.grupo_id
join public.fase f        on f.id = g.fase_id
join public.campeonato c  on c.id = i.campeonato_id
left join cartoes ct      on ct.inscricao_id = i.id;
-- A ordenação final (inclui confronto direto e a ordem configurável dos critérios)
-- é feita em src/lib/classificacao.ts, coberta por testes.

-- ---------------------------------------------------------------- artilharia e disciplina
create view public.artilharia with (security_invoker = true) as
select
  i.campeonato_id,
  e.atleta_id,
  e.inscricao_id,
  i.equipe_id,
  count(*)::int as gols
from public.evento_partida e
join public.partida p   on p.id = e.partida_id
join public.inscricao i on i.id = e.inscricao_id
where e.tipo = 'gol' and e.periodo < 4 and e.atleta_id is not null
  and p.status in ('ao_vivo', 'encerrada')
group by i.campeonato_id, e.atleta_id, e.inscricao_id, i.equipe_id;

create view public.disciplina with (security_invoker = true) as
select
  i.campeonato_id,
  e.atleta_id,
  e.inscricao_id,
  i.equipe_id,
  count(*) filter (where e.tipo = 'amarelo')::int  as amarelos,
  count(*) filter (where e.tipo = 'vermelho')::int as vermelhos
from public.evento_partida e
join public.partida p   on p.id = e.partida_id
join public.inscricao i on i.id = e.inscricao_id
where e.tipo in ('amarelo', 'vermelho') and e.atleta_id is not null
  and p.status in ('ao_vivo', 'encerrada')
group by i.campeonato_id, e.atleta_id, e.inscricao_id, i.equipe_id;

-- ---------------------------------------------------------------- ranking da temporada (ADR 0009)
create view public.ranking with (security_invoker = true) as
with pontos as (
  select
    c.temporada_id,
    cat.grupo as grupo_categoria,
    i.equipe_id,
    i.colocacao_final,
    s.multiplicador_ranking *
      case
        when i.colocacao_final = 1 then 10
        when i.colocacao_final = 2 then 8
        when i.colocacao_final = 3 then 6
        when i.colocacao_final = 4 then 5
        when i.colocacao_final between 5 and 8 then 3
        else 1
      end as pontos
  from public.inscricao i
  join public.campeonato c  on c.id = i.campeonato_id
  join public.serie s       on s.id = c.serie_id
  join public.categoria cat on cat.id = c.categoria_id
  where c.status = 'encerrado'
)
select
  temporada_id,
  grupo_categoria,
  equipe_id,
  sum(pontos)::numeric(8,1)                          as pontos,
  count(*) filter (where colocacao_final = 1)::int   as titulos,
  count(*) filter (where colocacao_final = 2)::int   as vices,
  count(*)::int                                      as participacoes
from pontos
group by temporada_id, grupo_categoria, equipe_id;

grant select on public.classificacao, public.artilharia, public.disciplina, public.ranking to anon, authenticated;

-- ==================== supabase/migrations/20261031000500_limite_taxa.sql
-- =============================================================================
-- Limitador de taxa (login por link, favoritos, importação).
-- Só a service_role executa; a chave é montada no servidor (ex.: "login:ip:1.2.3.4").
-- =============================================================================
create table private.limite_taxa (
  chave      text primary key check (length(chave) <= 200),
  contagem   integer not null default 0,
  janela_ate timestamptz not null
);

create function public.consumir_limite(p_chave text, p_max integer, p_janela_segundos integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_contagem integer;
begin
  insert into private.limite_taxa as l (chave, contagem, janela_ate)
  values (p_chave, 1, now() + make_interval(secs => p_janela_segundos))
  on conflict (chave) do update set
    contagem   = case when l.janela_ate < now() then 1 else l.contagem + 1 end,
    janela_ate = case when l.janela_ate < now() then now() + make_interval(secs => p_janela_segundos) else l.janela_ate end
  returning contagem into v_contagem;
  return v_contagem <= p_max;
end $$;

revoke execute on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;

-- limpeza das janelas vencidas (rodar via pg_cron no Supabase: select cron.schedule(...))
create function private.limpar_limites() returns void language sql security definer set search_path = '' as $$
  delete from private.limite_taxa where janela_ate < now() - interval '1 day';
$$;

-- ==================== supabase/migrations/20261031000600_storage_fotos.sql
-- Bucket PRIVADO para fotos de atletas (ADR 0004). Leitura só via URL assinada gerada
-- no servidor para atletas com consentimento ativo. Upload só por admin com 2FA.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'schema storage ausente (ambiente fora do Supabase) — pulando';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', false, 2097152, array['image/webp','image/jpeg','image/png'])
  on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

  execute $p$create policy "fotos: admin envia" on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos' and (select private.is_admin_aal2()) and name ~ '^atletas/[0-9a-f-]{36}\.(webp|jpg|png)$')$p$;
  execute $p$create policy "fotos: admin substitui" on storage.objects for update to authenticated
    using (bucket_id = 'fotos' and (select private.is_admin_aal2()))$p$;
  execute $p$create policy "fotos: admin remove" on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and (select private.is_admin_aal2()))$p$;
end $$;

-- ==================== supabase/migrations/20261031000700_usuarios_painel.sql
-- Gestão de papéis pelo e-mail (auth.users não é exposto à API).
create function public.usuarios_painel()
returns table (user_id uuid, email text, papeis public.papel_usuario[], criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, array_agg(p.papel order by p.papel), min(p.created_at)
    from public.papel p join auth.users u on u.id = p.user_id
    group by u.id, u.email
    order by u.email;
end $$;

create function public.conceder_papel(p_email text, p_papel public.papel_usuario)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    return false; -- a pessoa precisa entrar uma vez no site antes
  end if;
  insert into public.papel (user_id, papel) values (v_id, p_papel) on conflict do nothing;
  return true;
end $$;

-- Mesários disponíveis para atribuição em partidas
create function public.mesarios()
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query select u.id, u.email::text from public.papel p join auth.users u on u.id = p.user_id
    where p.papel = 'mesario' order by u.email;
end $$;

revoke execute on function public.usuarios_painel(), public.conceder_papel(text, public.papel_usuario), public.mesarios() from public, anon;
grant execute on function public.usuarios_painel(), public.conceder_papel(text, public.papel_usuario), public.mesarios() to authenticated;

-- ==================== supabase/migrations/20261031000800_atleta_publico_tabela.sql
-- =============================================================================
-- atleta_publico: de VIEW security definer para TABELA com RLS (linter 0010).
-- A tabela guarda só o que pode ser público; campos sensíveis ficam nulos sem
-- consentimento ativo (ADR 0004). Triggers a mantêm sincronizada.
-- A visibilidade (atleta inscrito em campeonato publicado) vem do RLS encadeado
-- de inscricao_atleta → inscricao → campeonato.
-- =============================================================================

drop view if exists public.atleta_publico;

create table public.atleta_publico (
  id             uuid primary key references public.atleta (id) on delete cascade,
  slug           text not null unique,
  nome_esportivo text not null,
  posicao        text,
  consentido     boolean not null default false,
  nome_completo  text,
  ano_nascimento smallint,
  foto_path      text,
  check (consentido or (nome_completo is null and ano_nascimento is null and foto_path is null))
);
comment on table public.atleta_publico is
  'Perfil público de atleta, mantido por trigger: nome completo, ano e foto só com consentimento ativo (ADR 0004).';

alter table public.atleta_publico enable row level security;

create policy "atleta público: inscritos em campeonatos visíveis" on public.atleta_publico
  for select to anon, authenticated
  using (exists (select 1 from public.inscricao_atleta ia where ia.atleta_id = atleta_publico.id));

-- Só os triggers escrevem (rodam como dono da função)
revoke all on public.atleta_publico from anon, authenticated;
grant select on public.atleta_publico to anon, authenticated;

create function private.sincronizar_atleta_publico(p_atleta uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from public.consentimento
    where atleta_id = p_atleta and revogado_em is null
  ) into v_ok;

  insert into public.atleta_publico as ap
    (id, slug, nome_esportivo, posicao, consentido, nome_completo, ano_nascimento, foto_path)
  select a.id, a.slug, a.nome_esportivo, a.posicao, v_ok,
         case when v_ok then a.nome_completo end,
         case when v_ok then a.ano_nascimento end,
         case when v_ok then a.foto_path end
  from public.atleta a where a.id = p_atleta
  on conflict (id) do update set
    slug = excluded.slug, nome_esportivo = excluded.nome_esportivo, posicao = excluded.posicao,
    consentido = excluded.consentido, nome_completo = excluded.nome_completo,
    ano_nascimento = excluded.ano_nascimento, foto_path = excluded.foto_path;
end $$;

create function private.trg_atleta_publico() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    return null; -- atleta: on delete cascade; consentimento: tratado abaixo
  end if;
  perform private.sincronizar_atleta_publico(case when tg_table_name = 'atleta' then new.id else new.atleta_id end);
  return null;
end $$;

create function private.trg_consentimento_removido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sincronizar_atleta_publico(old.atleta_id);
  return null;
end $$;

create trigger atleta_publico_sync after insert or update on public.atleta
  for each row execute function private.trg_atleta_publico();
create trigger consentimento_publico_sync after insert or update on public.consentimento
  for each row execute function private.trg_atleta_publico();
create trigger consentimento_publico_del after delete on public.consentimento
  for each row execute function private.trg_consentimento_removido();

revoke execute on function private.sincronizar_atleta_publico(uuid), private.trg_atleta_publico(),
  private.trg_consentimento_removido() from public, anon, authenticated;

-- carga inicial
select private.sincronizar_atleta_publico(id) from public.atleta;

-- gerar_tabela_grupo não precisa de privilégio elevado: o admin já pode inserir partidas pelo RLS
create or replace function public.gerar_tabela_grupo(p_grupo uuid, p_inicio timestamptz, p_local uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_ida boolean;
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if exists (select 1 from public.partida where grupo_id = p_grupo) then
    raise exception 'O grupo já tem jogos' using errcode = '23505';
  end if;
  select f.ida_volta into v_ida from public.grupo g join public.fase f on f.id = g.fase_id where g.id = p_grupo;
  return private.gerar_rodadas(p_grupo, v_ida, p_inicio, p_local);
end $$;
grant execute on function private.gerar_rodadas(uuid, boolean, timestamptz, uuid, interval) to authenticated;

-- ==================== supabase/seed.sql
-- =============================================================================
-- Seed 100% FICTÍCIO da LOFS (ADR 0007). Nenhuma pessoa, equipe ou placar real.
-- Datas relativas a now(): a temporada atual sempre aparece "em andamento".
-- Determinístico (setseed) para reproduzir os mesmos dados.
-- =============================================================================
begin;
select setseed(0.2026);

create schema seed;

-- ---------------------------------------------------------------- utilidades
create function seed.slugify(t text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(translate(t,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'))
$$;

create function seed.pick(arr text[]) returns text language sql volatile as $$
  select arr[1 + floor(random() * array_length(arr, 1))::int]
$$;

-- Poisson simples para gols
create function seed.poisson(lambda numeric) returns int language plpgsql volatile as $$
declare l numeric := exp(-lambda); k int := 0; p numeric := 1;
begin
  loop
    k := k + 1; p := p * random();
    exit when p <= l or k > 12;
  end loop;
  return k - 1;
end $$;

-- ---------------------------------------------------------------- catálogo
insert into public.temporada (ano, atual) values (2025, false), (2026, true);

insert into public.titulo (nome, slug) values
  ('Campeonato Osasquense', 'osasquense'),
  ('Copa LOFS', 'copa-lofs');

insert into public.serie (nome, slug, ordem, multiplicador_ranking) values
  ('Série Ouro', 'ouro', 1, 2.0),
  ('Série Prata', 'prata', 2, 1.0),
  ('Série Única', 'unica', 3, 1.0);

insert into public.categoria (nome, slug, grupo, ordem) values
  ('Sub-9', 'sub-9', 'base', 1), ('Sub-11', 'sub-11', 'base', 2), ('Sub-13', 'sub-13', 'base', 3),
  ('Sub-15', 'sub-15', 'base', 4), ('Sub-17', 'sub-17', 'base', 5),
  ('Adulto', 'adulto', 'principal', 6), ('Veteranos', 'veteranos', 'principal', 7),
  ('Feminino', 'feminino', 'principal', 8);

insert into public.local (nome, slug, endereco, bairro) values
  ('Ginásio Municipal do Rochdale', 'ginasio-rochdale', 'Rua das Acácias, 120', 'Rochdale'),
  ('Ginásio do Piratininga', 'ginasio-piratininga', 'Av. dos Ipês, 845', 'Jardim Piratininga'),
  ('Arena Presidente Altino', 'arena-presidente-altino', 'Rua da Estação, 300', 'Presidente Altino'),
  ('Poliesportivo Km 18', 'poliesportivo-km-18', 'Estrada do Bonança, 1.500', 'Km 18'),
  ('Ginásio Vila Yara', 'ginasio-vila-yara', 'Rua dos Coqueiros, 77', 'Vila Yara');

insert into public.equipe (nome, nome_curto, slug, bairro, cor_primaria, cor_secundaria, fundacao) values
  ('AE Rochdale',            'ROC', 'ae-rochdale',            'Rochdale',           '#1f9d55', '#ffffff', 1987),
  ('Piratininga Futsal',     'PIR', 'piratininga-futsal',     'Jardim Piratininga', '#c53030', '#ffffff', 1994),
  ('Grêmio Km 18',           'K18', 'gremio-km-18',           'Km 18',              '#111827', '#22c55e', 2001),
  ('Presidente Altino FC',   'PAL', 'presidente-altino-fc',   'Presidente Altino',  '#0f766e', '#facc15', 1979),
  ('Vila Yara Esporte',      'VYA', 'vila-yara-esporte',      'Vila Yara',          '#7f1d1d', '#f5f5f5', 1998),
  ('Bonança Futsal Clube',   'BON', 'bonanca-futsal-clube',   'Jardim Bonança',     '#15803d', '#111827', 2005),
  ('União Munhoz Júnior',    'UMJ', 'uniao-munhoz-junior',    'Munhoz Júnior',      '#b91c1c', '#111827', 1990),
  ('Quitaúna AC',            'QUI', 'quitauna-ac',            'Quitaúna',           '#14532d', '#e5e7eb', 1983),
  ('Santo Antônio Futsal',   'SAN', 'santo-antonio-futsal',   'Santo Antônio',      '#dc2626', '#16a34a', 2009),
  ('Helena Maria EC',        'HEM', 'helena-maria-ec',        'Helena Maria',       '#166534', '#fca5a5', 2012),
  ('Conceição Futsal',       'CON', 'conceicao-futsal',       'Conceição',          '#991b1b', '#fde68a', 1996),
  ('Jaguaribe Sport',        'JAG', 'jaguaribe-sport',        'Jaguaribe',          '#065f46', '#ffffff', 2003),
  ('Padroeira FC',           'PAD', 'padroeira-fc',           'Padroeira',          '#e11d48', '#ffffff', 2015),
  ('Novo Osasco Futsal',     'NOV', 'novo-osasco-futsal',     'Novo Osasco',        '#047857', '#1f2937', 2008),
  ('Ayrosa EC',              'AYR', 'ayrosa-ec',              'Ayrosa',             '#b45309', '#111827', 1992),
  ('Bela Vista Futsal',      'BVF', 'bela-vista-futsal',      'Bela Vista',         '#16a34a', '#dc2626', 2010);

-- ---------------------------------------------------------------- nomes fictícios
create table seed.nomes (tipo text, valor text);
insert into seed.nomes select 'm', unnest(array['Lucas','Gabriel','Matheus','Pedro','Rafael','Guilherme','Felipe','Bruno',
  'Thiago','Gustavo','Vinícius','Leonardo','Caio','Diego','Eduardo','Henrique','Igor','João','Kauã','Luan','Marcelo',
  'Nícolas','Otávio','Paulo','Renan','Samuel','Túlio','Vitor','Wesley','Yuri','André','Davi','Enzo','Fábio','Heitor',
  'Ícaro','Júlio','Murilo','Rodrigo','Sérgio']);
insert into seed.nomes select 'f', unnest(array['Ana','Beatriz','Camila','Daniela','Eduarda','Fernanda','Gabriela','Helena',
  'Isabela','Júlia','Larissa','Mariana','Natália','Olívia','Paula','Rafaela','Sofia','Tainá','Valentina','Yasmin',
  'Alice','Bianca','Carolina','Débora','Letícia','Manuela','Priscila','Renata','Thaís','Vitória']);
insert into seed.nomes select 's', unnest(array['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues',
  'Almeida','Nascimento','Carvalho','Araújo','Ribeiro','Gomes','Martins','Rocha','Barbosa','Moreira','Cardoso','Teixeira',
  'Mendes','Freitas','Campos','Pinto','Duarte','Moura','Nunes','Vieira','Fernandes','Cavalcanti','Ramos','Batista',
  'Monteiro','Correia','Machado','Lopes','Siqueira','Toledo','Prado','Queiroz']);

create function seed.nome(tipo text) returns text language sql volatile as $$
  select valor from seed.nomes where nomes.tipo = $1 order by random() limit 1
$$;

-- elenco reaproveitado entre temporadas: (equipe, categoria) → atletas
create table seed.elenco (equipe_id uuid, categoria_id uuid, atleta_id uuid, numero int, goleiro boolean);
create table seed.forca (equipe_id uuid, categoria_id uuid, forca numeric);

create function seed.garantir_elenco(p_equipe uuid, p_categoria uuid) returns void language plpgsql as $$
declare
  v_cat text; v_ano_min int; v_ano_max int; v_sexo text; v_nome text; v_sobrenome text; v_apelido text;
  v_id uuid; v_ano int; i int; v_menor boolean; v_numeros int[];
begin
  if exists (select 1 from seed.elenco where equipe_id = p_equipe and categoria_id = p_categoria) then return; end if;
  select slug into v_cat from public.categoria where id = p_categoria;
  v_sexo := case when v_cat = 'feminino' then 'f' else 'm' end;
  select lo, hi into v_ano_min, v_ano_max from (values
    ('sub-9', 2017, 2018), ('sub-11', 2015, 2016), ('sub-13', 2013, 2014), ('sub-15', 2011, 2012),
    ('sub-17', 2009, 2010), ('adulto', 1990, 2007), ('veteranos', 1972, 1989), ('feminino', 1994, 2008)
  ) as t(c, lo, hi) where c = v_cat;
  v_numeros := (select array_agg(n order by random()) from generate_series(2, 30) n where n <> 12);

  insert into seed.forca values (p_equipe, p_categoria, 0.6 + random() * 1.0);

  for i in 1..12 loop
    v_nome := seed.nome(v_sexo);
    v_sobrenome := seed.nome('s');
    v_apelido := case when random() < 0.55 then v_nome
                      when random() < 0.5 then v_nome || ' ' || left(v_sobrenome, 1) || '.'
                      else v_sobrenome end;
    v_ano := v_ano_min + floor(random() * (v_ano_max - v_ano_min + 1))::int;
    v_id := gen_random_uuid();
    insert into public.atleta (id, slug, nome_esportivo, nome_completo, ano_nascimento, posicao)
    values (v_id, seed.slugify(v_nome || ' ' || v_sobrenome) || '-' || left(v_id::text, 4),
            v_apelido, v_nome || ' ' || seed.nome('s') || ' ' || v_sobrenome, v_ano,
            case when i <= 2 then 'goleiro' when i <= 5 then 'fixo' when i <= 9 then 'ala' else 'pivo' end);

    v_menor := v_ano > 2008;
    insert into public.atleta_privado (atleta_id, data_nascimento, responsavel_nome, responsavel_contato)
    values (v_id, make_date(v_ano, 1 + floor(random() * 12)::int, 1 + floor(random() * 28)::int),
            case when v_menor then seed.nome(case when random() < 0.5 then 'f' else 'm' end) || ' ' || v_sobrenome end,
            case when v_menor then 'contato fictício' end);

    -- ~60% com consentimento ativo
    if random() < 0.6 then
      insert into public.consentimento (atleta_id, responsavel_nome, termo_versao, concedido_em)
      values (v_id, case when v_menor then 'Responsável fictício' else 'O próprio atleta' end, 'v1',
              now() - interval '200 days');
    end if;

    insert into seed.elenco values (p_equipe, p_categoria, v_id,
      case when i = 1 then 1 when i = 2 then 12 else v_numeros[i] end, i <= 2);
  end loop;
end $$;

-- ---------------------------------------------------------------- simulação de partidas
create function seed.autor(p_inscricao uuid, p_permite_goleiro boolean default false) returns uuid
language sql volatile as $$
  select ia.atleta_id from public.inscricao_atleta ia
  join public.atleta a on a.id = ia.atleta_id
  where ia.inscricao_id = p_inscricao and (p_permite_goleiro or a.posicao <> 'goleiro')
  order by case a.posicao when 'pivo' then random() * 0.5 when 'ala' then random() * 0.8 else random() end
  limit 1
$$;

create function seed.forca_de(p_inscricao uuid) returns numeric language sql stable as $$
  select f.forca from public.inscricao i join public.campeonato c on c.id = i.campeonato_id
  join seed.forca f on f.equipe_id = i.equipe_id and f.categoria_id = c.categoria_id
  where i.id = p_inscricao
$$;

-- Simula a partida até p_minuto_max (40 = jogo completo). Mata-mata empatado vai aos pênaltis.
create function seed.simular(p_partida uuid, p_minuto_max int, p_mata_mata boolean default false)
returns void language plpgsql as $$
declare
  p public.partida; lado uuid; adv uuid; g int; k int; m int; v_tipo public.tipo_evento;
  pm int; pv int; i int; cobr int;
begin
  select * into p from public.partida where id = p_partida;
  update public.partida set status = 'ao_vivo' where id = p_partida;

  foreach lado in array array[p.mandante_id, p.visitante_id] loop
    adv := case when lado = p.mandante_id then p.visitante_id else p.mandante_id end;
    g := seed.poisson(2.6 * seed.forca_de(lado) / seed.forca_de(adv) * (case when lado = p.mandante_id then 1.08 else 1 end));
    for k in 1..g loop
      m := floor(random() * 40)::int;
      continue when m > p_minuto_max;
      if random() < 0.05 then
        insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo, minuto)
        values (p_partida, 'gol_contra', adv, seed.autor(adv), case when m < 20 then 1 else 2 end, m % 20);
      else
        insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo, minuto)
        values (p_partida, 'gol', lado, seed.autor(lado), case when m < 20 then 1 else 2 end, m % 20);
      end if;
    end loop;
    -- cartões
    for k in 1..floor(random() * 4)::int loop
      m := floor(random() * 40)::int;
      continue when m > p_minuto_max;
      v_tipo := case when random() < 0.1 then 'vermelho' else 'amarelo' end;
      insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo, minuto)
      values (p_partida, v_tipo, lado, seed.autor(lado, true), case when m < 20 then 1 else 2 end, m % 20);
    end loop;
  end loop;

  if p_minuto_max >= 40 then
    select gols_mandante, gols_visitante into pm, pv from public.partida where id = p_partida;
    if p_mata_mata and pm = pv then
      cobr := 0;
      for i in 1..5 loop
        foreach lado in array array[p.mandante_id, p.visitante_id] loop
          insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo)
          values (p_partida, case when random() < 0.75 then 'penalti_convertido' else 'penalti_perdido' end::public.tipo_evento,
                  lado, seed.autor(lado), 4);
        end loop;
      end loop;
      select penaltis_mandante, penaltis_visitante into pm, pv from public.partida where id = p_partida;
      while pm = pv loop  -- alternadas até desempatar
        insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo)
        values (p_partida, 'penalti_convertido', p.mandante_id, seed.autor(p.mandante_id), 4),
               (p_partida, case when random() < 0.6 then 'penalti_convertido' else 'penalti_perdido' end::public.tipo_evento,
                p.visitante_id, seed.autor(p.visitante_id), 4);
        select penaltis_mandante, penaltis_visitante into pm, pv from public.partida where id = p_partida;
      end loop;
    end if;
    update public.partida set status = 'encerrada' where id = p_partida;
  end if;
end $$;

create function seed.vencedor(p_partida uuid) returns uuid language sql stable as $$
  select case when gols_mandante > gols_visitante then mandante_id
              when gols_visitante > gols_mandante then visitante_id
              when penaltis_mandante > penaltis_visitante then mandante_id
              else visitante_id end
  from public.partida where id = p_partida
$$;
create function seed.perdedor(p_partida uuid) returns uuid language sql stable as $$
  select case when seed.vencedor(p_partida) = mandante_id then visitante_id else mandante_id end
  from public.partida where id = p_partida
$$;

-- posição no grupo (critério simplificado para o seed: pontos, vitórias, saldo, gols pró)
create function seed.posicao(p_grupo uuid, p_pos int) returns uuid language sql stable as $$
  select inscricao_id from public.classificacao where grupo_id = p_grupo
  order by pontos desc, vitorias desc, saldo desc, gols_pro desc, inscricao_id
  offset p_pos - 1 limit 1
$$;

-- ---------------------------------------------------------------- campeonato completo
create function seed.campeonato(
  p_titulo text, p_ano int, p_serie text, p_categoria text, p_equipes text[],
  p_grupos int, p_ida_volta boolean, p_inicio timestamptz, p_hora time
) returns void language plpgsql as $$
declare
  v_camp uuid; v_fase uuid; v_mm uuid; v_cat uuid; v_insc uuid; v_eq uuid; v_grupos uuid[] := '{}';
  v_g uuid; i int; v_status public.status_campeonato; r record; v_local uuid;
  s1 uuid; s2 uuid; f1 uuid; t3 uuid; v_data timestamptz; v_ultima timestamptz; pos int; v_resto uuid[];
  v_n int;
begin
  select id into v_cat from public.categoria where slug = p_categoria;
  v_status := case when p_ano < 2026 then 'encerrado' else 'publicado' end;

  insert into public.campeonato (slug, titulo_id, temporada_id, serie_id, categoria_id, status)
  values (p_titulo || '-' || p_serie || '-' || p_categoria || '-' || p_ano,
          (select id from public.titulo where slug = p_titulo),
          (select id from public.temporada where ano = p_ano),
          (select id from public.serie where slug = p_serie), v_cat, 'publicado')
  returning id into v_camp;

  insert into public.fase (campeonato_id, nome, tipo, ida_volta, ordem)
  values (v_camp, 'Fase de grupos', 'grupos', p_ida_volta, 1) returning id into v_fase;
  insert into public.fase (campeonato_id, nome, tipo, ida_volta, ordem)
  values (v_camp, 'Finais', 'mata_mata', false, 2) returning id into v_mm;

  for i in 1..p_grupos loop
    insert into public.grupo (fase_id, nome) values (v_fase, 'Grupo ' || chr(64 + i)) returning id into v_g;
    v_grupos := v_grupos || v_g;
  end loop;

  i := 0;
  foreach v_eq in array (select array_agg(id) from public.equipe e join unnest(p_equipes) s(slug) using (slug)) loop
    perform seed.garantir_elenco(v_eq, v_cat);
    insert into public.inscricao (campeonato_id, equipe_id, grupo_id)
    values (v_camp, v_eq, v_grupos[1 + i % p_grupos]) returning id into v_insc;
    insert into public.inscricao_atleta (inscricao_id, atleta_id, numero)
    select v_insc, atleta_id, numero from seed.elenco where equipe_id = v_eq and categoria_id = v_cat;
    i := i + 1;
  end loop;

  -- tabela de jogos + local e horário variados
  foreach v_g in array v_grupos loop
    perform private.gerar_rodadas(v_g, p_ida_volta, date_trunc('day', p_inicio) + p_hora, null);
  end loop;
  update public.partida p set
    local_id = (select id from public.local order by md5(p.id::text) limit 1),
    data_hora = data_hora + (case when random() < 0.5 then interval '0' else interval '90 minutes' end)
  where p.fase_id = v_fase;

  -- simula o que já aconteceu
  for r in select id, data_hora from public.partida where fase_id = v_fase order by data_hora loop
    if r.data_hora < now() - interval '2 hours' then
      perform seed.simular(r.id, 40);
    elsif r.data_hora <= now() then
      perform seed.simular(r.id, greatest(1, (extract(epoch from now() - r.data_hora) / 60)::int));
    end if;
  end loop;

  if v_status = 'encerrado' then
    select max(data_hora) into v_ultima from public.partida where fase_id = v_fase;
    select id into v_local from public.local order by random() limit 1;
    -- semifinais: 1ºA x 2ºB e 1ºB x 2ºA (ou 1º x 4º e 2º x 3º em grupo único)
    if p_grupos >= 2 then
      insert into public.partida (fase_id, chave, mandante_id, visitante_id, local_id, data_hora)
      values (v_mm, 'Semifinal 1', seed.posicao(v_grupos[1], 1), seed.posicao(v_grupos[2], 2), v_local, v_ultima + interval '7 days')
      returning id into s1;
      insert into public.partida (fase_id, chave, mandante_id, visitante_id, local_id, data_hora)
      values (v_mm, 'Semifinal 2', seed.posicao(v_grupos[2], 1), seed.posicao(v_grupos[1], 2), v_local, v_ultima + interval '7 days 90 minutes')
      returning id into s2;
    else
      insert into public.partida (fase_id, chave, mandante_id, visitante_id, local_id, data_hora)
      values (v_mm, 'Semifinal 1', seed.posicao(v_grupos[1], 1), seed.posicao(v_grupos[1], 4), v_local, v_ultima + interval '7 days')
      returning id into s1;
      insert into public.partida (fase_id, chave, mandante_id, visitante_id, local_id, data_hora)
      values (v_mm, 'Semifinal 2', seed.posicao(v_grupos[1], 2), seed.posicao(v_grupos[1], 3), v_local, v_ultima + interval '7 days 90 minutes')
      returning id into s2;
    end if;
    perform seed.simular(s1, 40, true);
    perform seed.simular(s2, 40, true);

    insert into public.partida (fase_id, chave, mandante_id, visitante_id, local_id, data_hora)
    values (v_mm, 'Disputa de 3º lugar', seed.perdedor(s1), seed.perdedor(s2), v_local, v_ultima + interval '14 days')
    returning id into t3;
    insert into public.partida (fase_id, chave, mandante_id, visitante_id, local_id, data_hora)
    values (v_mm, 'Final', seed.vencedor(s1), seed.vencedor(s2), v_local, v_ultima + interval '14 days 2 hours')
    returning id into f1;
    perform seed.simular(t3, 40, true);
    perform seed.simular(f1, 40, true);

    update public.inscricao set colocacao_final = 1 where id = seed.vencedor(f1);
    update public.inscricao set colocacao_final = 2 where id = seed.perdedor(f1);
    update public.inscricao set colocacao_final = 3 where id = seed.vencedor(t3);
    update public.inscricao set colocacao_final = 4 where id = seed.perdedor(t3);
    -- demais pela campanha na fase de grupos
    pos := 5;
    for r in
      select c.inscricao_id from public.classificacao c
      join public.inscricao i on i.id = c.inscricao_id
      where c.campeonato_id = v_camp and i.colocacao_final is null
      order by c.pontos desc, c.saldo desc, c.gols_pro desc
    loop
      update public.inscricao set colocacao_final = pos where id = r.inscricao_id;
      pos := pos + 1;
    end loop;
    update public.campeonato set status = 'encerrado' where id = v_camp;
  end if;
end $$;

-- ---------------------------------------------------------------- temporada 2025 (encerrada)
select seed.campeonato('osasquense', 2025, 'ouro', 'adulto',
  array['ae-rochdale','piratininga-futsal','gremio-km-18','presidente-altino-fc','vila-yara-esporte','bonanca-futsal-clube','uniao-munhoz-junior','quitauna-ac'],
  2, true, '2025-03-08', '19:00');
select seed.campeonato('osasquense', 2025, 'prata', 'adulto',
  array['santo-antonio-futsal','helena-maria-ec','conceicao-futsal','jaguaribe-sport','padroeira-fc','novo-osasco-futsal','ayrosa-ec','bela-vista-futsal'],
  2, true, '2025-03-09', '18:00');
select seed.campeonato('osasquense', 2025, 'ouro', 'sub-15',
  array['ae-rochdale','piratininga-futsal','gremio-km-18','quitauna-ac','santo-antonio-futsal','conceicao-futsal','novo-osasco-futsal','bela-vista-futsal'],
  2, false, '2025-04-05', '09:00');
select seed.campeonato('osasquense', 2025, 'ouro', 'sub-17',
  array['presidente-altino-fc','vila-yara-esporte','bonanca-futsal-clube','uniao-munhoz-junior','helena-maria-ec','jaguaribe-sport','padroeira-fc','ayrosa-ec'],
  2, false, '2025-04-05', '11:00');
select seed.campeonato('osasquense', 2025, 'unica', 'feminino',
  array['ae-rochdale','piratininga-futsal','vila-yara-esporte','helena-maria-ec','padroeira-fc','bela-vista-futsal'],
  1, false, '2025-05-10', '15:00');

-- ---------------------------------------------------------------- temporada 2026 (em andamento)
-- O início é calculado para que ~2/3 da fase de grupos já tenham sido disputados
-- e uma rodada caia hoje (com jogo ao vivo).
select seed.campeonato('osasquense', 2026, 'ouro', 'adulto',
  array['ae-rochdale','piratininga-futsal','gremio-km-18','presidente-altino-fc','vila-yara-esporte','bonanca-futsal-clube','uniao-munhoz-junior','helena-maria-ec'],
  2, true, date_trunc('day', now()) - interval '28 days', (to_char(now() - interval '35 minutes', 'HH24:MI'))::time);
select seed.campeonato('osasquense', 2026, 'prata', 'adulto',
  array['quitauna-ac','santo-antonio-futsal','conceicao-futsal','jaguaribe-sport','padroeira-fc','novo-osasco-futsal','ayrosa-ec','bela-vista-futsal'],
  2, true, date_trunc('day', now()) - interval '27 days', '18:00');
select seed.campeonato('osasquense', 2026, 'ouro', 'sub-15',
  array['ae-rochdale','piratininga-futsal','gremio-km-18','quitauna-ac','santo-antonio-futsal','conceicao-futsal','novo-osasco-futsal','bela-vista-futsal'],
  2, false, date_trunc('day', now()) - interval '14 days', '09:00');
select seed.campeonato('osasquense', 2026, 'ouro', 'sub-17',
  array['presidente-altino-fc','vila-yara-esporte','bonanca-futsal-clube','uniao-munhoz-junior','helena-maria-ec','jaguaribe-sport','padroeira-fc','ayrosa-ec'],
  2, false, date_trunc('day', now()) - interval '13 days', '11:00');
select seed.campeonato('osasquense', 2026, 'unica', 'feminino',
  array['ae-rochdale','piratininga-futsal','vila-yara-esporte','helena-maria-ec','padroeira-fc','bela-vista-futsal'],
  1, false, date_trunc('day', now()) - interval '21 days', '15:00');
select seed.campeonato('copa-lofs', 2026, 'unica', 'veteranos',
  array['gremio-km-18','presidente-altino-fc','quitauna-ac','conceicao-futsal','jaguaribe-sport','ayrosa-ec'],
  1, false, date_trunc('day', now()) - interval '20 days', '20:00');

-- Um campeonato em rascunho (não deve aparecer no site público)
insert into public.campeonato (slug, titulo_id, temporada_id, serie_id, categoria_id, status)
select 'copa-lofs-unica-sub-13-2026', t.id, tp.id, s.id, c.id, 'rascunho'
from public.titulo t, public.temporada tp, public.serie s, public.categoria c
where t.slug = 'copa-lofs' and tp.ano = 2026 and s.slug = 'unica' and c.slug = 'sub-13';

drop schema seed cascade;
truncate public.auditoria;
commit;
