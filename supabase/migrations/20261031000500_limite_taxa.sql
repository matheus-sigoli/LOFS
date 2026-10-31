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
