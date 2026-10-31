# Testa fluxos do painel (admin, mesário, torcedor) contra o PostgREST local. Requer usuários de teste (ver README).
import json, re, hmac, hashlib, base64, time, urllib.request, urllib.parse, sys
BASE="http://127.0.0.1:3001"; SEG=b"segredo-de-teste-local-com-32-caracteres-no-minimo"
b64=lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
def jwt(sub, aal="aal1"):
    h=b64(json.dumps({"alg":"HS256","typ":"JWT"}).encode()); p=b64(json.dumps({"sub":sub,"role":"authenticated","aal":aal,"exp":int(time.time())+600}).encode())
    return (h+b"."+p+b"."+b64(hmac.new(SEG,h+b"."+p,hashlib.sha256).digest())).decode()
ADMIN=jwt("00000000-0000-0000-0000-0000000000a1","aal2"); ADMIN1=jwt("00000000-0000-0000-0000-0000000000a1")
MESA=jwt("00000000-0000-0000-0000-0000000000b1"); FA=jwt("00000000-0000-0000-0000-0000000000c1")
def req(met, path, tok, corpo=None, params=(), prefer=None):
    url=f"{BASE}/{path}"+("?"+urllib.parse.urlencode(list(params)) if params else "")
    h={"Authorization":f"Bearer {tok}","Content-Type":"application/json"}
    if prefer: h["Prefer"]=prefer
    r=urllib.request.Request(url,method=met,data=json.dumps(corpo).encode() if corpo is not None else None,headers=h)
    try:
        with urllib.request.urlopen(r) as x: t=x.read(); return x.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"null")
def ok(n,c,x=""):
    print(("OK  " if c else "FALHA ")+n, x if not c else "")
    if not c: sys.exit(1)
sel=lambda s: re.sub(r"\s+","",s)

s,d=req("POST","rpc/conceder_papel",ADMIN,{"p_email":"mesa@lofs.test","p_papel":"mesario"}); ok("admin concede mesário", s==200 and d is True, (s,d))
s,d=req("POST","rpc/conceder_papel",ADMIN,{"p_email":"naoexiste@x.com","p_papel":"mesario"}); ok("e-mail sem conta → false", s==200 and d is False, (s,d))
s,d=req("POST","rpc/conceder_papel",ADMIN1,{"p_email":"fa@lofs.test","p_papel":"admin"}); ok("admin sem 2FA não concede", s in (401,403), (s,d))
s,d=req("POST","rpc/usuarios_painel",ADMIN,{}); ok("lista usuários do painel", s==200 and len(d)==2, (s,d))
s,d=req("POST","rpc/mesarios",ADMIN,{}); ok("lista mesários", s==200 and d[0]["email"]=="mesa@lofs.test", (s,d))
s,d=req("POST","rpc/usuarios_painel",FA,{}); ok("torcedor não lista usuários", s in (401,403), s)

s,d=req("GET","atleta",ADMIN,params=[("select","id,nome_completo"),("nome_completo","ilike.%Silva%"),("limit","5")]); ok("busca atleta admin", s==200 and len(d)>0, (s,d))
s,d=req("GET","atleta",ADMIN,params=[("select","id"),("nome_completo","ilike.%\\%%")]); ok("curinga escapado não casa tudo", s==200 and len(d)==0, (s,len(d) if isinstance(d,list) else d))
s,d=req("GET","inscricao",ADMIN,params=[("select",sel("id, equipe:equipe(nome), campeonato:campeonato!inner(status, categoria:categoria(nome), serie:serie(nome), temporada:temporada!inner(atual))")),("campeonato.temporada.atual","eq.true")])
ok("inscrições temporada atual", s==200 and len(d)==44 and all(i["campeonato"]["temporada"]["atual"] for i in d), (s, len(d) if isinstance(d,list) else d))

s,d=req("GET","partida",ADMIN,params=[("select","id,mandante_id,visitante_id,status"),("status","eq.agendada"),("order","data_hora"),("limit","1")]); p=d[0]
s,_=req("PATCH","partida",ADMIN,{"mesario_id":"00000000-0000-0000-0000-0000000000b1"},[("id",f"eq.{p['id']}")]); ok("admin atribui mesário", s in (200,204), s)
s,d=req("POST","rpc/alterar_status_partida",MESA,{"p_partida":p["id"],"p_status":"ao_vivo"}); ok("mesário inicia partida", s in (200,204), (s,d))
s,d=req("GET","inscricao_atleta",MESA,params=[("select","atleta_id,numero"),("inscricao_id",f"eq.{p['mandante_id']}")]); at=d[0]["atleta_id"]
s,d=req("GET","atleta_publico",MESA,params=[("select","id,nome_esportivo"),("id",f"in.({at})")]); ok("mesário vê nomes do elenco", s==200 and d and d[0]["nome_esportivo"], (s,d))
s,d=req("POST","evento_partida",MESA,{"partida_id":p["id"],"inscricao_id":p["mandante_id"],"tipo":"gol","atleta_id":at,"periodo":1,"minuto":3},prefer="return=minimal"); ok("mesário lança gol", s==201, (s,d))
s,d=req("POST","evento_partida",MESA,{"partida_id":p["id"],"inscricao_id":p["visitante_id"],"tipo":"gol","atleta_id":at,"periodo":1,"minuto":4},prefer="return=minimal"); ok("atleta de outra equipe é recusado", s>=400, (s,d))
s,d=req("GET","partida",MESA,params=[("select","gols_mandante,gols_visitante"),("id",f"eq.{p['id']}")]); ok("placar atualizado", d[0]["gols_mandante"]==1, d)
s,d=req("GET","evento_partida",MESA,params=[("select","id"),("partida_id",f"eq.{p['id']}")]); eid=d[0]["id"]
s,d=req("DELETE","evento_partida",MESA,None,[("id",f"eq.{eid}"),("partida_id",f"eq.{p['id']}")],prefer="count=exact"); ok("mesário remove lance", s in (200,204), (s,d))
s,d=req("POST","rpc/alterar_status_partida",MESA,{"p_partida":p["id"],"p_status":"encerrada"}); ok("mesário encerra", s in (200,204), (s,d))
s,d=req("POST","rpc/alterar_status_partida",MESA,{"p_partida":p["id"],"p_status":"ao_vivo"}); ok("mesário não reabre", s in (401,403), (s,d))

s,d=req("GET","campeonato",FA,params=[("select","id"),("limit","1")]); cid=d[0]["id"]
s,d=req("POST","favorito",FA,{"campeonato_id":cid},prefer="return=minimal"); ok("torcedor segue campeonato", s==201, (s,d))
s,d=req("GET","favorito",FA,params=[("select",sel("id, equipe:equipe(id, nome, nome_curto, slug, cor_primaria, cor_secundaria), campeonato:campeonato(slug, titulo:titulo(nome), serie:serie(nome), categoria:categoria(nome), temporada:temporada(ano))")),("order","created_at.desc")])
ok("minha-conta lista favoritos", s==200 and len(d)==1 and d[0]["campeonato"]["titulo"]["nome"], (s,d))
s,d=req("GET","favorito",MESA,params=[("select","id")]); ok("outro usuário não vê", s==200 and d==[], d)

s,d=req("POST","importacao",ADMIN,{"url":"https://exemplo.com/tabela","criado_por":"00000000-0000-0000-0000-0000000000a1"},prefer="return=representation"); ok("admin cria importação", s==201, (s,d))
s,d=req("POST","importacao",ADMIN,{"url":"http://exemplo.com","criado_por":"00000000-0000-0000-0000-0000000000a1"}); ok("banco recusa http://", s>=400, s)
s,d=req("GET","auditoria",ADMIN,params=[("select","id,acao,tabela"),("order","criado_em.desc"),("limit","5")]); ok("auditoria registra", s==200 and len(d)>0, d)
s,d=req("GET","auditoria",ADMIN1,params=[("select","id")]); ok("auditoria exige 2FA", s==200 and d==[], d)
print("PAINEL OK")
