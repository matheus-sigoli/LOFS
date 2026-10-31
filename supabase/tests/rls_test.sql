-- =============================================================================
-- Testes de segurança (RLS e regras de integridade).
-- Rodar após migrations + seed:  psql "$DATABASE_URL" -f supabase/tests/rls_test.sql
-- Tudo roda em uma transação desfeita no final (não suja o banco).
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

create temp table _ok (teste text);
grant all on _ok to anon, authenticated;

-- usuários de teste
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'mesario@teste.local'),
  ('00000000-0000-0000-0000-00000000000c', 'torcedor@teste.local'),
  ('00000000-0000-0000-0000-00000000000d', 'outro@teste.local');
insert into public.papel values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'mesario');

-- partida ao vivo atribuída ao mesário e outra que não é dele
create temp table _alvo as
  select (select id from public.partida where status = 'ao_vivo' order by id limit 1) as minha,
         (select id from public.partida where status = 'ao_vivo' order by id offset 1 limit 1) as alheia;
grant select on _alvo to anon, authenticated;
update public.partida set mesario_id = '00000000-0000-0000-0000-00000000000b' where id = (select minha from _alvo);

create function pg_temp.como(p_role text, p_sub text, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_sub is null then '{"role":"anon"}'
         else json_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  execute format('set local role %I', p_role);
end $$;

create function pg_temp.espera_erro(p_sql text, p_nome text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    insert into _ok values (p_nome);
    return;
  end;
  raise exception 'FALHOU (deveria negar): %', p_nome;
end $$;

create function pg_temp.espera(p_cond boolean, p_nome text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FALHOU: %', p_nome; end if;
  insert into _ok values (p_nome);
end $$;

-- ---------------------------------------------------------------- anônimo
select pg_temp.como('anon', null);
select pg_temp.espera((select count(*) = 0 from public.campeonato where status = 'rascunho'), 'anon não vê campeonato em rascunho');
select pg_temp.espera((select count(*) > 0 from public.campeonato), 'anon vê campeonatos publicados');
select pg_temp.espera((select count(*) > 0 from public.classificacao), 'anon vê classificação');
select pg_temp.espera_erro('select * from public.atleta', 'anon não lê tabela atleta');
select pg_temp.espera_erro('select * from public.atleta_privado', 'anon não lê dados privados');
select pg_temp.espera_erro('select * from public.consentimento', 'anon não lê consentimentos');
select pg_temp.espera((select count(*) = 0 from public.atleta_publico where not consentido and (nome_completo is not null or ano_nascimento is not null)),
  'sem consentimento: nome completo e ano ocultos');
select pg_temp.espera((select count(*) > 0 from public.atleta_publico where consentido and nome_completo is not null),
  'com consentimento: perfil completo');
select pg_temp.espera_erro($$insert into public.equipe (nome, nome_curto, slug) values ('X', 'XX', 'x')$$, 'anon não cria equipe');
select pg_temp.espera_erro($$select public.alterar_status_partida((select minha from _alvo), 'encerrada')$$, 'anon não muda status');
reset role;

-- ---------------------------------------------------------------- torcedor
select pg_temp.como('authenticated', '00000000-0000-0000-0000-00000000000c');
insert into public.favorito (campeonato_id) select id from public.campeonato where status <> 'rascunho' limit 1;
select pg_temp.espera((select count(*) = 1 from public.favorito), 'torcedor adiciona favorito');
select pg_temp.espera_erro($$insert into public.favorito (user_id, equipe_id)
  values ('00000000-0000-0000-0000-00000000000d', (select id from public.equipe limit 1))$$, 'torcedor não cria favorito de outro');
select pg_temp.espera_erro($$insert into public.papel values ('00000000-0000-0000-0000-00000000000c', 'admin')$$,
  'torcedor não se promove a admin');
select pg_temp.espera_erro($$insert into public.evento_partida (partida_id, tipo, inscricao_id, periodo)
  select id, 'gol_contra', mandante_id, 1 from public.partida where id = (select minha from _alvo)$$, 'torcedor não lança súmula');
select pg_temp.espera((select count(*) = 0 from public.atleta), 'torcedor não lê tabela atleta (RLS)');
reset role;

select pg_temp.como('authenticated', '00000000-0000-0000-0000-00000000000d');
select pg_temp.espera((select count(*) = 0 from public.favorito), 'outro usuário não vê favoritos alheios');
reset role;

-- ---------------------------------------------------------------- mesário
select pg_temp.como('authenticated', '00000000-0000-0000-0000-00000000000b');
insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo, minuto)
select p.id, 'gol', p.mandante_id, ia.atleta_id, 2, 10
from public.partida p join public.inscricao_atleta ia on ia.inscricao_id = p.mandante_id
where p.id = (select minha from _alvo) limit 1;
insert into _ok values ('mesário lança gol na sua partida');
select pg_temp.espera_erro($$insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo)
  select p.id, 'gol', p.mandante_id, ia.atleta_id, 1 from public.partida p
  join public.inscricao_atleta ia on ia.inscricao_id = p.mandante_id
  where p.id = (select alheia from _alvo) limit 1$$, 'mesário não lança em partida alheia');
update public.partida set gols_mandante = 99, status = 'cancelada' where id = (select minha from _alvo);
select pg_temp.espera((select gols_mandante <> 99 and status = 'ao_vivo' from public.partida where id = (select minha from _alvo)),
  'mesário não edita partida direto (RLS ignora o UPDATE)');
select pg_temp.espera_erro($$select public.alterar_status_partida((select minha from _alvo), 'agendada')$$,
  'mesário não volta status');
select public.alterar_status_partida((select minha from _alvo), 'encerrada');
insert into _ok values ('mesário encerra a sua partida');
select pg_temp.espera_erro($$insert into public.evento_partida (partida_id, tipo, inscricao_id, atleta_id, periodo)
  select p.id, 'amarelo', p.mandante_id, ia.atleta_id, 2 from public.partida p
  join public.inscricao_atleta ia on ia.inscricao_id = p.mandante_id
  where p.id = (select minha from _alvo) limit 1$$, 'mesário não lança após encerrar');
reset role;

-- ---------------------------------------------------------------- admin
select pg_temp.como('authenticated', '00000000-0000-0000-0000-00000000000a', 'aal1');
select pg_temp.espera_erro($$insert into public.equipe (nome, nome_curto, slug) values ('Teste', 'TST', 'teste')$$,
  'admin sem 2FA não escreve');
select pg_temp.espera((select count(*) = 0 from public.atleta_privado), 'admin sem 2FA não lê dados privados');
reset role;

select pg_temp.como('authenticated', '00000000-0000-0000-0000-00000000000a', 'aal2');
insert into public.equipe (nome, nome_curto, slug) values ('Teste', 'TST', 'teste');
insert into _ok values ('admin com 2FA cria equipe');
select pg_temp.espera((select count(*) > 0 from public.atleta_privado), 'admin com 2FA lê dados privados');
select pg_temp.espera((select count(*) = 1 from public.campeonato where status = 'rascunho'), 'admin vê rascunho');
select pg_temp.espera_erro($$update public.partida set gols_visitante = 7 where id = (select alheia from _alvo)$$,
  'nem admin edita placar direto');
delete from public.papel where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.espera((select count(*) = 1 from public.papel where user_id = '00000000-0000-0000-0000-00000000000a'),
  'admin não remove o próprio acesso');
reset role;

select pg_temp.espera((select count(*) > 0 from public.auditoria where tabela = 'equipe'), 'auditoria registrou a criação');
select pg_temp.espera((select count(*) = 0 from public.auditoria where tabela = 'atleta_privado' and dados ? 'documento'),
  'auditoria não copia dados privados');

-- placar derivado: confere que o gol do mesário entrou
select pg_temp.espera((select gols_mandante + gols_visitante > 0 from public.partida where id = (select minha from _alvo)),
  'placar recalculado pela súmula');

select count(*) as testes_aprovados from _ok;
rollback;
