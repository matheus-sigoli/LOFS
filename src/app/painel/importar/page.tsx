import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { extracaoSchema } from "@/lib/firecrawl";
import { fmt } from "@/lib/format";
import { slugificar } from "@/lib/slug";
import { aplicarEquipes, descartarImportacao, importarUrl } from "./acoes";

export const metadata = { title: "Importar" };

const STATUS: Record<string, string> = { pendente: "Em andamento", extraida: "Aguardando revisão", erro: "Falhou", aplicada: "Aplicada", descartada: "Descartada" };

export default async function Importar({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; id?: string }> }) {
  await exigirAdmin();
  const b = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb.from("importacao").select("id, url, status, criado_em, dados").order("criado_em", { ascending: false }).limit(15);
  const lista = (data ?? []) as { id: string; url: string; status: string; criado_em: string; dados: unknown }[];
  const atual = lista.find((i) => i.id === b.id);
  const extraido = atual?.dados ? extracaoSchema.safeParse(atual.dados) : null;
  const { data: eqs } = await sb.from("equipe").select("slug");
  const existentes = new Set(((eqs ?? []) as { slug: string }[]).map((e) => e.slug));

  return (
    <div className="max-w-4xl">
      <Aviso ok={b.ok} erro={b.erro} />
      <h1 className="titulo-pagina">Importar de uma página</h1>
      <p className="mt-3 max-w-prose text-texto-2">
        Cole o endereço de uma página pública com tabela de jogos ou classificação. O Firecrawl extrai equipes e partidas;
        nada entra no site antes da sua revisão.
      </p>
      <form action={importarUrl} className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="url" className="sr-only">Endereço da página</label>
        <input id="url" name="url" type="url" required maxLength={2048} placeholder="https://site.com.br/tabela…" autoComplete="off" spellCheck={false} pattern="https://.*" className="campo min-w-72 flex-1" />
        <button type="submit" className="botao botao-primario">Extrair</button>
      </form>
      <p className="mt-2 text-sm text-texto-3">Respeite os termos de uso do site de origem. Até 5 extrações a cada 10 minutos.</p>

      {atual && extraido?.success ? (
        <section aria-labelledby="revisao" className="mt-10">
          <h2 id="revisao" className="titulo-secao">Revisão</h2>
          <p className="mt-1 break-all text-sm text-texto-3">{atual.url}</p>
          {atual.status === "extraida" ? (
            <form action={aplicarEquipes} className="mt-4">
              <input type="hidden" name="id" value={atual.id} />
              <fieldset>
                <legend className="font-semibold">Equipes encontradas ({extraido.data.equipes.length})</legend>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {extraido.data.equipes.map((e, i) => {
                    const ja = existentes.has(slugificar(e.nome));
                    return (
                      <li key={i}>
                        <label className={`flex items-center gap-2 ${ja ? "text-texto-3" : ""}`}>
                          <input type="checkbox" name="equipe" value={i} disabled={ja} defaultChecked={!ja} className="h-4 w-4 accent-[var(--verde)]" />
                          {e.nome}{e.bairro ? ` (${e.bairro})` : ""}{ja ? " — já cadastrada" : ""}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="botao botao-primario">Criar equipes marcadas</button>
              </div>
            </form>
          ) : <p className="mt-3 text-texto-2">Situação: {STATUS[atual.status]}.</p>}
          {atual.status === "extraida" ? (
            <form action={descartarImportacao} className="mt-2"><input type="hidden" name="id" value={atual.id} /><button type="submit" className="botao botao-secundario">Descartar</button></form>
          ) : null}

          {extraido.data.partidas.length ? (
            <div className="mt-8 overflow-x-auto">
              <h3 className="font-semibold">Partidas encontradas ({extraido.data.partidas.length}) — referência para cadastro manual</h3>
              <table className="tabela mt-2">
                <thead><tr><th className="esq" scope="col">Data</th><th className="esq" scope="col">Jogo</th><th scope="col">Placar</th><th className="esq" scope="col">Local</th></tr></thead>
                <tbody>
                  {extraido.data.partidas.map((p, i) => (
                    <tr key={i}>
                      <td className="esq text-texto-2">{p.data ?? "—"}</td>
                      <td className="esq">{p.mandante} × {p.visitante}</td>
                      <td>{p.gols_mandante ?? "–"} : {p.gols_visitante ?? "–"}</td>
                      <td className="esq text-texto-2">{p.local ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="hist" className="mt-12">
        <h2 id="hist" className="titulo-secao">Últimas extrações</h2>
        {lista.length === 0 ? <p className="mt-3 text-texto-2">Nenhuma ainda.</p> : (
          <table className="tabela mt-3">
            <thead><tr><th className="esq" scope="col">Endereço</th><th className="esq" scope="col">Quando</th><th scope="col">Situação</th></tr></thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id}>
                  <td className="esq max-w-xs truncate"><a href={`/painel/importar?id=${i.id}`} className="underline">{new URL(i.url).hostname}{new URL(i.url).pathname}</a></td>
                  <td className="esq text-texto-2">{fmt.dataCurta(i.criado_em)} {fmt.hora(i.criado_em)}</td>
                  <td className="text-texto-2">{STATUS[i.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
