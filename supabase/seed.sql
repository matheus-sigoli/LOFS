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
