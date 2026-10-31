import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Escudo } from "@/components/Escudo";
import { exigirAdmin } from "@/lib/auth";
import { listarEquipes, listarLocais } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { CRITERIOS_PADRAO, rotuloCriterio } from "@/lib/classificacao";
import { ehUuid } from "@/lib/validar";
import type { EquipeResumo } from "@/lib/tipos";
import { atualizarCampeonato, atualizarInscricao, criarFase, criarPartidaMataMata, gerarTabela, inscreverEquipe } from "../acoes";

export const metadata = { title: "Campeonato" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> };

export default async function PainelCampeonato({ params, searchParams }: Props) {
  await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const b = await searchParams;
  const sb = await supabaseServer();

  const { data: camp } = await sb.from("campeonato")
    .select("id, slug, status, pontos_vitoria, pontos_empate, pontos_derrota, criterios_desempate, titulo:titulo(nome), serie:serie(nome), categoria:categoria(nome), temporada:temporada(ano)")
    .eq("id", id).maybeSingle();
  if (!camp) notFound();
  const c = camp as unknown as {
    id: string; slug: string; status: string; pontos_vitoria: number; pontos_empate: number; pontos_derrota: number;
    criterios_desempate: string[]; titulo: { nome: string }; serie: { nome: string }; categoria: { nome: string }; temporada: { ano: number };
  };

  const [fasesR, inscR, equipes, locais, jogosR] = await Promise.all([
    sb.from("fase").select("id, nome, tipo, ida_volta, ordem, grupos:grupo(id, nome)").eq("campeonato_id", id).order("ordem"),
    sb.from("inscricao").select("id, grupo_id, colocacao_final, equipe:equipe(id, nome, nome_curto, slug, cor_primaria, cor_secundaria)").eq("campeonato_id", id),
    listarEquipes(),
    listarLocais(),
    sb.from("partida").select("grupo_id, fase:fase!inner(campeonato_id)").eq("fase.campeonato_id", id),
  ]);
  type Fase = { id: string; nome: string; tipo: "grupos" | "mata_mata"; ida_volta: boolean; ordem: number; grupos: { id: string; nome: string }[] };
  type Insc = { id: string; grupo_id: string | null; colocacao_final: number | null; equipe: EquipeResumo & { id: string } };
  const fases = (fasesR.data ?? []) as Fase[];
  const inscricoes = ((inscR.data ?? []) as unknown as Insc[]).sort((a, b) => a.equipe.nome.localeCompare(b.equipe.nome));
  const grupos = fases.flatMap((f) => f.grupos.map((g) => ({ ...g, fase: f.nome })));
  const gruposComJogos = new Set(((jogosR.data ?? []) as { grupo_id: string | null }[]).map((j) => j.grupo_id));
  const inscritas = new Set(inscricoes.map((i) => i.equipe.id));
  const mataMata = fases.filter((f) => f.tipo === "mata_mata");

  return (
    <div>
      <Aviso ok={b.ok} erro={b.erro} />
      <p className="text-sm text-texto-3"><Link href="/painel/campeonatos" className="underline">Campeonatos</Link></p>
      <h1 className="titulo-pagina mt-2">{c.categoria.nome} · {c.serie.nome}</h1>
      <p className="mt-2 text-texto-2">
        {c.titulo.nome} {c.temporada.ano} · <Link href={`/campeonatos/${c.slug}`} className="underline">ver no site</Link>
      </p>

      {/* ------------------------------------------------ regras */}
      <section aria-labelledby="regras" className="mt-10">
        <h2 id="regras" className="titulo-secao">Situação e regras</h2>
        <form action={atualizarCampeonato} className="mt-4 grid max-w-3xl gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-4">
          <input type="hidden" name="id" value={id} />
          <div className="sm:col-span-1">
            <label htmlFor="status" className="rotulo">Situação</label>
            <select id="status" name="status" defaultValue={c.status} className="campo">
              <option value="rascunho">Rascunho (oculto)</option>
              <option value="publicado">Publicado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
          {(["vitoria", "empate", "derrota"] as const).map((k) => (
            <div key={k}>
              <label htmlFor={`p-${k}`} className="rotulo">Pontos por {k === "vitoria" ? "vitória" : k}</label>
              <input autoComplete="off" id={`p-${k}`} name={`pontos_${k}`} type="number" min={0} max={10} required defaultValue={c[`pontos_${k}`]} className="campo" />
            </div>
          ))}
          <fieldset className="sm:col-span-4">
            <legend className="rotulo">Critérios de desempate (na ordem da lista; desmarque para ignorar)</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {CRITERIOS_PADRAO.filter((k) => k !== "pontos").map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="criterios" value={k} defaultChecked={c.criterios_desempate.includes(k)} className="h-4 w-4 accent-[var(--verde)]" />
                  {rotuloCriterio[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-4"><button type="submit" className="botao botao-primario">Salvar</button></div>
        </form>
        <p className="mt-2 max-w-prose text-sm text-texto-3">Ao encerrar, preencha a colocação final de cada equipe: ela alimenta o ranking da temporada.</p>
      </section>

      {/* ------------------------------------------------ fases */}
      <section aria-labelledby="fases" className="mt-12">
        <h2 id="fases" className="titulo-secao">Fases</h2>
        {fases.length ? (
          <ul className="mt-3 space-y-1 text-texto-2">
            {fases.map((f) => (
              <li key={f.id}>
                <strong className="text-texto">{f.ordem}. {f.nome}</strong> — {f.tipo === "grupos" ? `grupos${f.ida_volta ? ", turno e returno" : ", turno único"}: ${f.grupos.map((g) => g.nome).join(", ") || "nenhum grupo"}` : "mata-mata"}
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-texto-2">Nenhuma fase ainda. Comece pela fase de grupos.</p>}
        <form action={criarFase} className="mt-4 grid max-w-3xl gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-[2fr_1.3fr_1fr_auto] sm:items-end">
          <input type="hidden" name="campeonato_id" value={id} />
          <div><label htmlFor="f-nome" className="rotulo">Nome da fase</label><input id="f-nome" name="nome" required maxLength={60} placeholder="Ex.: Fase de grupos…" autoComplete="off" className="campo" /></div>
          <div>
            <label htmlFor="f-tipo" className="rotulo">Formato</label>
            <select id="f-tipo" name="tipo" className="campo"><option value="grupos">Grupos</option><option value="mata_mata">Mata-mata</option></select>
          </div>
          <div><label htmlFor="f-grupos" className="rotulo">Nº de grupos</label><input autoComplete="off" id="f-grupos" name="grupos" type="number" min={0} max={8} defaultValue={2} className="campo" /></div>
          <button type="submit" className="botao botao-primario">Adicionar fase</button>
          <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="ida_volta" className="h-4 w-4 accent-[var(--verde)]" /> Turno e returno</label>
        </form>
      </section>

      {/* ------------------------------------------------ inscrições */}
      <section aria-labelledby="inscricoes" className="mt-12">
        <h2 id="inscricoes" className="titulo-secao">Equipes inscritas ({inscricoes.length})</h2>
        <form action={inscreverEquipe} className="mt-4 flex max-w-3xl flex-wrap items-end gap-3">
          <input type="hidden" name="campeonato_id" value={id} />
          <div className="min-w-56 flex-1">
            <label htmlFor="i-equipe" className="rotulo">Equipe</label>
            <select id="i-equipe" name="equipe_id" required className="campo">
              {equipes.filter((e) => !inscritas.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="min-w-40">
            <label htmlFor="i-grupo" className="rotulo">Grupo</label>
            <select id="i-grupo" name="grupo_id" className="campo">
              <option value="">Sem grupo</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <button type="submit" className="botao botao-primario">Inscrever</button>
        </form>

        {inscricoes.length ? (
          <table className="tabela mt-6 max-w-3xl">
            <caption className="sr-only">Inscrições</caption>
            <thead><tr><th className="esq" scope="col">Equipe</th><th className="esq" scope="col">Grupo</th><th className="esq" scope="col">Colocação final</th><th scope="col"><span className="sr-only">Salvar</span></th></tr></thead>
            <tbody>
              {inscricoes.map((i) => (
                <tr key={i.id}>
                  <td className="esq"><span className="inline-flex items-center gap-2"><Escudo equipe={i.equipe} tamanho={22} />{i.equipe.nome}</span></td>
                  <td className="esq" colSpan={3}>
                    <form action={atualizarInscricao} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="campeonato_id" value={id} />
                      <select name="grupo_id" defaultValue={i.grupo_id ?? ""} aria-label={`Grupo de ${i.equipe.nome}`} className="campo min-h-9 w-36 py-1">
                        <option value="">Sem grupo</option>
                        {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                      </select>
                      <input autoComplete="off" name="colocacao_final" type="number" min={1} max={64} defaultValue={i.colocacao_final ?? ""} aria-label={`Colocação final de ${i.equipe.nome}`} className="campo min-h-9 w-24 py-1" />
                      <button type="submit" className="botao botao-secundario min-h-9 px-3 text-sm">Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {/* ------------------------------------------------ tabela de jogos */}
      {grupos.length ? (
        <section aria-labelledby="gerar" className="mt-12">
          <h2 id="gerar" className="titulo-secao">Gerar tabela de jogos</h2>
          <p className="mt-2 max-w-prose text-sm text-texto-3">Cria todas as rodadas do grupo (todos contra todos), uma rodada por semana a partir da data escolhida.</p>
          <ul className="mt-4 space-y-3">
            {grupos.map((g) => (
              <li key={g.id}>
                {gruposComJogos.has(g.id) ? (
                  <p className="text-texto-2"><strong className="text-texto">{g.nome}</strong>: tabela já gerada.</p>
                ) : (
                  <form action={gerarTabela} className="flex max-w-3xl flex-wrap items-end gap-3">
                    <input type="hidden" name="campeonato_id" value={id} />
                    <input type="hidden" name="grupo_id" value={g.id} />
                    <p className="w-28 font-semibold">{g.nome}</p>
                    <div><label htmlFor={`ini-${g.id}`} className="rotulo">Primeira rodada</label><input autoComplete="off" id={`ini-${g.id}`} name="inicio" type="datetime-local" required className="campo" /></div>
                    <div>
                      <label htmlFor={`loc-${g.id}`} className="rotulo">Local</label>
                      <select id={`loc-${g.id}`} name="local_id" className="campo"><option value="">A definir</option>{locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
                    </div>
                    <button type="submit" className="botao botao-primario">Gerar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------ mata-mata */}
      {mataMata.length ? (
        <section aria-labelledby="mm" className="mt-12">
          <h2 id="mm" className="titulo-secao">Confronto de mata-mata</h2>
          <form action={criarPartidaMataMata} className="mt-4 grid max-w-3xl gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-2">
            <input type="hidden" name="campeonato_id" value={id} />
            <div>
              <label htmlFor="mm-fase" className="rotulo">Fase</label>
              <select id="mm-fase" name="fase_id" className="campo">{mataMata.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
            </div>
            <div>
              <label htmlFor="mm-chave" className="rotulo">Confronto</label>
              <select id="mm-chave" name="chave" className="campo">
                {["Quartas 1", "Quartas 2", "Quartas 3", "Quartas 4", "Semifinal 1", "Semifinal 2", "Disputa de 3º lugar", "Final"].map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            {(["mandante_id", "visitante_id"] as const).map((campo) => (
              <div key={campo}>
                <label htmlFor={`mm-${campo}`} className="rotulo">{campo === "mandante_id" ? "Mandante" : "Visitante"}</label>
                <select id={`mm-${campo}`} name={campo} required className="campo">{inscricoes.map((i) => <option key={i.id} value={i.id}>{i.equipe.nome}</option>)}</select>
              </div>
            ))}
            <div><label htmlFor="mm-data" className="rotulo">Data e hora</label><input autoComplete="off" id="mm-data" name="data_hora" type="datetime-local" className="campo" /></div>
            <div>
              <label htmlFor="mm-local" className="rotulo">Local</label>
              <select id="mm-local" name="local_id" className="campo"><option value="">A definir</option>{locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
            </div>
            <div className="sm:col-span-2"><button type="submit" className="botao botao-primario">Criar confronto</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
