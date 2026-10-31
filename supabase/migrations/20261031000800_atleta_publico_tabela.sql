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
