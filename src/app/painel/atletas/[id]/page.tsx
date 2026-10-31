import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Confirmar } from "@/components/Confirmar";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";
import { ehUuid } from "@/lib/validar";
import { CamposPublicos } from "../CamposPublicos";
import { enviarFoto, inscreverAtleta, registrarConsentimento, revogarConsentimento, salvarAtleta, salvarPrivado } from "../acoes";

export const metadata = { title: "Atleta" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> };

export default async function PainelAtleta({ params, searchParams }: Props) {
  await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const b = await searchParams;
  const sb = await supabaseServer();

  const [aR, pR, cR, iR, insR] = await Promise.all([
    sb.from("atleta").select("id, slug, nome_esportivo, nome_completo, ano_nascimento, posicao, foto_path").eq("id", id).maybeSingle(),
    sb.from("atleta_privado").select("*").eq("atleta_id", id).maybeSingle(),
    sb.from("consentimento").select("id, responsavel_nome, termo_versao, concedido_em, revogado_em").eq("atleta_id", id).order("concedido_em", { ascending: false }),
    sb.from("inscricao_atleta").select("id, numero, inscricao:inscricao(equipe:equipe(nome), campeonato:campeonato(slug, categoria:categoria(nome), serie:serie(nome), temporada:temporada(ano)))").eq("atleta_id", id),
    sb.from("inscricao").select("id, equipe:equipe(nome), campeonato:campeonato!inner(status, categoria:categoria(nome), serie:serie(nome), temporada:temporada!inner(atual))").eq("campeonato.temporada.atual", true),
  ]);
  if (!aR.data) notFound();
  const a = aR.data as { id: string; slug: string; nome_esportivo: string; nome_completo: string; ano_nascimento: number | null; posicao: string | null; foto_path: string | null };
  const priv = pR.data as { data_nascimento: string | null; documento: string | null; responsavel_nome: string | null; responsavel_contato: string | null } | null;
  const consentimentos = (cR.data ?? []) as { id: string; responsavel_nome: string; termo_versao: string; concedido_em: string; revogado_em: string | null }[];
  const ativo = consentimentos.find((c) => !c.revogado_em);
  type I = { id: string; numero: number; inscricao: { equipe: { nome: string }; campeonato: { slug: string; categoria: { nome: string }; serie: { nome: string }; temporada: { ano: number } } } };
  const inscricoes = (iR.data ?? []) as unknown as I[];
  type Op = { id: string; equipe: { nome: string }; campeonato: { categoria: { nome: string }; serie: { nome: string } } };
  const opcoes = ((insR.data ?? []) as unknown as Op[]).sort((x, y) => x.equipe.nome.localeCompare(y.equipe.nome));
  const menor = a.ano_nascimento ? new Date().getFullYear() - a.ano_nascimento < 18 : false;

  return (
    <div className="max-w-3xl">
      <Aviso ok={b.ok} erro={b.erro} />
      <p className="text-sm text-texto-3"><Link href="/painel/atletas" className="underline">Atletas</Link></p>
      <h1 className="titulo-pagina mt-2">{a.nome_esportivo}</h1>
      <p className="mt-2 text-texto-2">
        {ativo ? "Perfil completo publicado (consentimento ativo)." : "Perfil resumido: sem consentimento, o site mostra só nome esportivo, número e estatísticas."}
      </p>

      <section className="mt-10" aria-labelledby="publicos">
        <h2 id="publicos" className="titulo-secao">Dados do perfil</h2>
        <form action={salvarAtleta} className="mt-4 grid gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-2">
          <input type="hidden" name="id" value={a.id} />
          <CamposPublicos a={a} />
          <div className="sm:col-span-2"><button type="submit" className="botao botao-primario">Salvar perfil</button></div>
        </form>
      </section>

      <section className="mt-10" aria-labelledby="consent">
        <h2 id="consent" className="titulo-secao">Autorização de imagem e dados</h2>
        {ativo ? (
          <div className="mt-4 rounded-xl bg-verde-suave p-4">
            <p className="font-semibold text-verde">Autorizado por {ativo.responsavel_nome} em {fmt.dataCurta(ativo.concedido_em)} (termo {ativo.termo_versao}).</p>
            <div className="mt-3">
              <Confirmar acao={revogarConsentimento} rotulo="Revogar autorização" pergunta="O perfil volta a ser resumido e a foto é apagada definitivamente." confirmar="Revogar e apagar foto" campos={{ id: ativo.id, atleta_id: a.id }} />
            </div>
          </div>
        ) : (
          <form action={registrarConsentimento} className="mt-4 grid gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-2">
            <input type="hidden" name="atleta_id" value={a.id} />
            <div><label htmlFor="resp" className="rotulo">{menor ? "Responsável legal que assinou" : "Quem assinou"}</label><input autoComplete="off" id="resp" name="responsavel_nome" required minLength={3} maxLength={120} className="campo" /></div>
            <div><label htmlFor="termo" className="rotulo">Versão do termo</label><input autoComplete="off" id="termo" name="termo_versao" required maxLength={20} defaultValue="v1" className="campo" /></div>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="confirmo" required className="mt-1 h-4 w-4 accent-[var(--verde)]" />
              Confirmo que o termo assinado está arquivado pela liga{menor ? " e foi assinado por um dos pais ou responsável legal" : ""}.
            </label>
            <div className="sm:col-span-2"><button type="submit" className="botao botao-primario">Registrar autorização</button></div>
          </form>
        )}
        {ativo ? (
          <form action={enviarFoto} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="atleta_id" value={a.id} />
            <div>
              <label htmlFor="foto" className="rotulo">{a.foto_path ? "Trocar foto" : "Foto do perfil"} (JPG, PNG ou WebP, até 2 MB)</label>
              <input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" required className="campo py-2" />
            </div>
            <button type="submit" className="botao botao-secundario">Enviar foto</button>
          </form>
        ) : null}
        <p className="mt-2 text-sm text-texto-3">Metadados da foto (como localização) são removidos no envio.</p>
      </section>

      <section className="mt-10" aria-labelledby="privados">
        <h2 id="privados" className="titulo-secao">Dados restritos</h2>
        <p className="mt-1 text-sm text-texto-3">Nunca aparecem no site. Só administradores com verificação em duas etapas veem.</p>
        <form action={salvarPrivado} className="mt-4 grid gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-2">
          <input type="hidden" name="atleta_id" value={a.id} />
          <div><label htmlFor="nasc" className="rotulo">Data de nascimento</label><input autoComplete="off" id="nasc" name="data_nascimento" type="date" defaultValue={priv?.data_nascimento ?? ""} className="campo" /></div>
          <div><label htmlFor="doc" className="rotulo">Documento</label><input id="doc" name="documento" maxLength={30} defaultValue={priv?.documento ?? ""} autoComplete="off" className="campo" /></div>
          <div><label htmlFor="rnome" className="rotulo">Responsável</label><input autoComplete="off" id="rnome" name="responsavel_nome" maxLength={120} defaultValue={priv?.responsavel_nome ?? ""} className="campo" /></div>
          <div><label htmlFor="rcont" className="rotulo">Contato do responsável</label><input id="rcont" name="responsavel_contato" maxLength={120} defaultValue={priv?.responsavel_contato ?? ""} autoComplete="off" className="campo" /></div>
          <div className="sm:col-span-2"><button type="submit" className="botao botao-primario">Salvar dados restritos</button></div>
        </form>
      </section>

      <section className="mt-10" aria-labelledby="insc">
        <h2 id="insc" className="titulo-secao">Inscrições</h2>
        {inscricoes.length ? (
          <ul className="mt-3 divide-y divide-linha border-y border-linha">
            {inscricoes.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span>{i.inscricao.equipe.nome} — {i.inscricao.campeonato.categoria.nome} {i.inscricao.campeonato.serie.nome} {i.inscricao.campeonato.temporada.ano}</span>
                <span className="numero-placar text-xl">{i.numero}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-texto-2">Ainda não inscrito em nenhum campeonato.</p>}
        <form action={inscreverAtleta} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="atleta_id" value={a.id} />
          <div className="min-w-64 flex-1">
            <label htmlFor="ins" className="rotulo">Equipe e campeonato (temporada atual)</label>
            <select id="ins" name="inscricao_id" required className="campo">
              {opcoes.map((o) => <option key={o.id} value={o.id}>{o.equipe.nome} — {o.campeonato.categoria.nome} {o.campeonato.serie.nome}</option>)}
            </select>
          </div>
          <div><label htmlFor="num" className="rotulo">Camisa</label><input autoComplete="off" id="num" name="numero" type="number" min={1} max={99} required className="campo w-24" /></div>
          <button type="submit" className="botao botao-primario">Inscrever</button>
        </form>
      </section>
    </div>
  );
}
