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
