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
