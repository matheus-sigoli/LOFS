# Testa as consultas públicas do site contra o PostgREST local (ver README, "Testes").
import json, re, urllib.request, urllib.parse, sys
BASE="http://127.0.0.1:3001"
def sel(s): return re.sub(r"\s+","",s)
EQUIPE="id, nome, nome_curto, slug, cor_primaria, cor_secundaria"
CAMP="""id, slug, status,
  titulo:titulo(nome, slug), serie:serie(nome, slug, ordem),
  categoria:categoria(nome, slug, grupo, ordem), temporada:temporada(ano)"""
PARTIDA=f"""id, data_hora, status, gols_mandante, gols_visitante, penaltis_mandante, penaltis_visitante,
  rodada, chave, grupo:grupo(nome), local:local(nome, slug),
  fase:fase!inner(nome, tipo, campeonato_id, campeonato:campeonato(slug, titulo:titulo(nome), serie:serie(nome), categoria:categoria(nome))),
  mandante:inscricao!partida_mandante_id_fkey(id, equipe:equipe({EQUIPE})),
  visitante:inscricao!partida_visitante_id_fkey(id, equipe:equipe({EQUIPE}))"""
def get(tabela, select, params=()):
    q=[("select",sel(select))]+list(params)
    url=f"{BASE}/{tabela}?"+urllib.parse.urlencode(q)
    try:
        with urllib.request.urlopen(url) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        print("ERRO", tabela, e.read().decode()[:400]); sys.exit(1)
def ok(nome, cond, extra=""):
    print(("OK  " if cond else "FALHA ")+nome, extra)
    if not cond: sys.exit(1)

camps=get("campeonato", """id, slug, status, titulo:titulo!inner(nome, slug), serie:serie!inner(nome, slug, ordem),
     categoria:categoria!inner(nome, slug, grupo, ordem), temporada:temporada!inner(ano)""", [("temporada.ano","eq.2026")])
ok("listarCampeonatos 2026", len(camps)==6, len(camps))
f=get("campeonato", """id, titulo:titulo!inner(nome, slug), serie:serie!inner(slug), categoria:categoria!inner(slug), temporada:temporada!inner(ano)""",
      [("temporada.ano","eq.2026"),("serie.slug","eq.ouro"),("categoria.slug","eq.adulto")])
ok("filtro série+categoria", len(f)==1)
c=get("campeonato", CAMP+", pontos_vitoria, pontos_empate, pontos_derrota, criterios_desempate", [("slug","eq.osasquense-ouro-adulto-2026")])
ok("campeonatoPorSlug", len(c)==1 and c[0]["titulo"]["nome"]=="Campeonato Osasquense")
cid=c[0]["id"]
ps=get("partida", PARTIDA, [("fase.campeonato_id",f"eq.{cid}"),("order","data_hora.asc.nullslast")])
ok("partidasDoCampeonato", len(ps)==24, len(ps))
ok("embed mandante/visitante", ps[0]["mandante"]["equipe"]["nome"] and ps[0]["fase"]["campeonato"]["serie"]["nome"])
cl=get("classificacao","*",[("campeonato_id",f"eq.{cid}")])
ok("classificacao", len(cl)==8 and all(r["grupo_nome"] for r in cl))
art=get("artilharia","atleta_id, inscricao_id, gols",[("campeonato_id",f"eq.{cid}"),("order","gols.desc"),("limit","30")])
ok("artilharia", len(art)>0, art[0])
ids=",".join({a["atleta_id"] for a in art})
ap=get("atleta_publico","*",[("id",f"in.({ids})")])
ok("atleta_publico por ids", len(ap)==len({a['atleta_id'] for a in art}))
sem=[a for a in ap if not a["consentido"]]
ok("sem consentimento oculta nome", all(a["nome_completo"] is None for a in sem), f"{len(sem)} sem consentimento")
# partidas do dia e ao vivo
vivo=get("partida",PARTIDA,[("status","eq.ao_vivo"),("order","data_hora")])
ok("ao vivo", len(vivo)>=1, len(vivo))
insc=[ps[0]["mandante"]["id"]]
prox=get("partida",PARTIDA,[("status","eq.agendada"),("data_hora","gte.2026-01-01T00:00:00Z"),("or",f"(mandante_id.in.({insc[0]}),visitante_id.in.({insc[0]}))"),("order","data_hora"),("limit","5")])
ok("proximas por equipe (or)", all(insc[0] in (p["mandante"]["id"],p["visitante"]["id"]) for p in prox), len(prox))
pid=ps[0]["id"]
ev=get("evento_partida","id, tipo, inscricao_id, atleta_id, periodo, minuto",[("partida_id",f"eq.{pid}"),("order","periodo,minuto.nullslast,created_at")])
ok("eventos da partida", isinstance(ev,list), len(ev))
eq=get("equipe",EQUIPE+", bairro, fundacao",[("slug","eq.ae-rochdale")])[0]
ie=get("inscricao","id, colocacao_final, campeonato:campeonato!inner("+CAMP+")",[("equipe_id",f"eq.{eq['id']}")])
ok("inscrições da equipe", len(ie)>=4, len(ie))
el=get("inscricao_atleta","atleta_id, numero",[("inscricao_id",f"eq.{ie[0]['id']}"),("order","numero")])
ok("elenco", len(el)==12)
a=ap[0]
hist=get("inscricao_atleta",f"numero, inscricao:inscricao!inner(id, equipe:equipe({EQUIPE}), campeonato:campeonato!inner({CAMP}))",[("atleta_id",f"eq.{a['id']}")])
ok("histórico do atleta", len(hist)>=1 and hist[0]["inscricao"]["campeonato"]["temporada"]["ano"])
t25=get("temporada","id",[("ano","eq.2025")])[0]["id"]
rk=get("ranking","equipe_id, pontos, titulos, vices, participacoes",[("temporada_id",f"eq.{t25}"),("grupo_categoria","eq.principal")])
ok("ranking 2025 principal", len(rk)>=10, len(rk))
fin=get("partida",PARTIDA,[("fase.campeonato_id",f"eq.{get('campeonato','id',[('slug','eq.osasquense-ouro-adulto-2025')])[0]['id']}"),("fase.tipo","eq.mata_mata")])
ok("finais 2025 (4 jogos)", len(fin)==4, [p["chave"] for p in fin])
rasc=get("campeonato","id",[("status","eq.rascunho")])
ok("anon não vê rascunho via API", len(rasc)==0)
# anon não lê tabelas restritas
for t in ["atleta","atleta_privado","consentimento","auditoria","importacao"]:
    try:
        urllib.request.urlopen(f"{BASE}/{t}?select=*&limit=1"); ok(f"anon bloqueado em {t}", False)
    except urllib.error.HTTPError as e:
        ok(f"anon bloqueado em {t}", e.code in (401,403), e.code)
try:
    req=urllib.request.Request(f"{BASE}/rpc/consumir_limite",data=b'{"p_chave":"x","p_max":1,"p_janela_segundos":1}',headers={"Content-Type":"application/json"})
    urllib.request.urlopen(req); ok("anon não usa limitador", False)
except urllib.error.HTTPError as e: ok("anon não usa limitador", e.code in (401,403,404), e.code)
print("TODAS AS CONSULTAS OK")
