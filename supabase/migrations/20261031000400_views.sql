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
