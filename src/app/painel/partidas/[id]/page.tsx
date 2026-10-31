import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Confirmar } from "@/components/Confirmar";
import { Escudo } from "@/components/Escudo";
import { StatusPartida } from "@/components/Partidas";
import { exigirPainel } from "@/lib/auth";
import { partidaDetalhe, listarLocais } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";
import { ehUuid } from "@/lib/validar";
import type { AtletaPublico, PartidaResumo } from "@/lib/tipos";
import { alterarStatus, atualizarPartida, lancarEvento, removerEvento } from "../acoes";

export const metadata = { title: "Súmula" };

const TIPOS = [
  ["gol", "Gol"], ["amarelo", "Cartão amarelo"], ["vermelho", "Cartão vermelho"],
  ["gol_contra", "Gol contra"], ["penalti_convertido", "Pênalti convertido (disputa)"], ["penalti_perdido", "Pênalti perdido (disputa)"],
] as const;
const ROTULO_TIPO = Object.fromEntries(TIPOS) as Record<string, string>;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> };

export default async function Sumula({ params, searchParams }: Props) {
  const sessao = await exigirPainel();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const b = await searchParams;
  const d = await partidaDetalhe(id);
  if (!d) notFound();
  const { partida: p, eventos, atletas } = d;

  const sb = await supabaseServer();
  const { data: meta } = await sb.from("partida").select("mesario_id, local_id").eq("id", id).single();
  const admin = sessao.papeis.includes("admin") && sessao.aal === "aal2";
  const souMesario = meta?.mesario_id === sessao.userId;
  if (!admin && !souMesario) {
    if (sessao.papeis.includes("admin")) redirect("/painel/seguranca");
    notFound();
  }
  const podeLancar = admin ? p.status === "ao_vivo" || p.status === "encerrada" : p.status === "ao_vivo";

  const elencos = await Promise.all(
    (["mandante", "visitante"] as const).map(async (lado) => {
      const { data } = await sb.from("inscricao_atleta").select("atleta_id, numero").eq("inscricao_id", p[lado].id).order("numero");
      const linhas = (data ?? []) as { atleta_id: string; numero: number }[];
      const { data: pub } = linhas.length
        ? await sb.from("atleta_publico").select("id, nome_esportivo").in("id", linhas.map((l) => l.atleta_id))
        : { data: [] };
      const nomes = new Map(((pub ?? []) as Pick<AtletaPublico, "id" | "nome_esportivo">[]).map((a) => [a.id, a.nome_esportivo]));
      return linhas.map((l) => ({ id: l.atleta_id, numero: l.numero, nome: nomes.get(l.atleta_id) ?? "Atleta" }));
    }),
  );

  const [locais, mesarios] = admin
    ? await Promise.all([listarLocais(), sb.rpc("mesarios").then((r) => (r.data ?? []) as { user_id: string; email: string }[])])
    : [[], []];

  return (
    <div>
      <Aviso ok={b.ok} erro={b.erro} />
      <p className="text-sm text-texto-3">
        <Link href="/painel/partidas" className="underline">Partidas</Link> / {p.fase.campeonato.categoria.nome} · {p.fase.campeonato.serie.nome}
        {" "}· {p.chave ?? (p.rodada ? `Rodada ${p.rodada}` : p.fase.nome)}
      </p>

      <section aria-label="Placar" className="mt-4 rounded-xl bg-superficie p-5 ring-1 ring-linha">
        <div className="flex items-center justify-between text-sm">
          <StatusPartida p={p} />
          <span className="text-texto-3">{p.data_hora ? `${fmt.dataCurta(p.data_hora)} às ${fmt.hora(p.data_hora)}` : "Sem data"}{p.local ? ` · ${p.local.nome}` : ""}</span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <EquipeLado p={p} lado="mandante" />
          <p className="numero-placar text-center text-6xl">
            {p.gols_mandante}<span className="mx-2 text-texto-3">:</span>{p.gols_visitante}
            {p.penaltis_mandante !== null ? <span className="block text-base font-sans font-normal text-texto-3">pênaltis {p.penaltis_mandante}–{p.penaltis_visitante}</span> : null}
          </p>
          <EquipeLado p={p} lado="visitante" />
        </div>
        <p className="mt-3 text-center text-xs text-texto-3">O placar é calculado a partir dos lances lançados abaixo.</p>
      </section>

      <section aria-labelledby="status" className="mt-8">
        <h2 id="status" className="titulo-secao">Andamento</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.status === "agendada" ? <StatusBotao id={id} status="ao_vivo" rotulo="Iniciar partida" primario /> : null}
          {p.status === "ao_vivo" ? <StatusBotao id={id} status="encerrada" rotulo="Encerrar partida" primario /> : null}
          {admin && p.status !== "agendada" ? <StatusBotao id={id} status="agendada" rotulo="Voltar para agendada" /> : null}
          {admin && p.status === "encerrada" ? <StatusBotao id={id} status="ao_vivo" rotulo="Reabrir súmula" /> : null}
          {admin && p.status === "agendada" ? <StatusBotao id={id} status="adiada" rotulo="Adiar" /> : null}
          {admin && p.status !== "cancelada" ? (
            <Confirmar acao={alterarStatus} rotulo="Cancelar partida" pergunta="Cancelar esta partida? Ela sai da tabela de jogos." confirmar="Sim, cancelar" campos={{ id, status: "cancelada" }} />
          ) : null}
        </div>
        {!podeLancar ? <p className="mt-3 text-sm text-texto-3">Inicie a partida para lançar gols e cartões.</p> : null}
      </section>

      {podeLancar ? (
        <section aria-labelledby="lancar" className="mt-10">
          <h2 id="lancar" className="titulo-secao">Lançar lance</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(["mandante", "visitante"] as const).map((lado, i) => (
              <form key={lado} action={lancarEvento} className="space-y-3 rounded-xl bg-superficie p-4 ring-1 ring-linha">
                <p className="flex items-center gap-2 font-semibold"><Escudo equipe={p[lado].equipe} tamanho={24} /> {p[lado].equipe.nome}</p>
                <input type="hidden" name="partida_id" value={id} />
                <input type="hidden" name="inscricao_id" value={p[lado].id} />
                <div>
                  <label className="rotulo" htmlFor={`tipo-${lado}`}>Lance</label>
                  <select id={`tipo-${lado}`} name="tipo" className="campo" required>
                    {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rotulo" htmlFor={`atleta-${lado}`}>Atleta</label>
                  <select id={`atleta-${lado}`} name="atleta_id" className="campo">
                    <option value="">Não identificado (só gol contra)</option>
                    {elencos[i]!.map((a) => <option key={a.id} value={a.id}>{a.numero} · {a.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="rotulo" htmlFor={`periodo-${lado}`}>Tempo</label>
                    <select id={`periodo-${lado}`} name="periodo" className="campo" defaultValue="1">
                      <option value="1">1º tempo</option><option value="2">2º tempo</option><option value="3">Prorrogação</option>
                    </select>
                  </div>
                  <div>
                    <label className="rotulo" htmlFor={`minuto-${lado}`}>Minuto</label>
                    <input autoComplete="off" id={`minuto-${lado}`} name="minuto" type="number" min={0} max={20} inputMode="numeric" className="campo" />
                  </div>
                </div>
                <button type="submit" className="botao botao-primario w-full">Registrar</button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="lances" className="mt-10">
        <h2 id="lances" className="titulo-secao">Lances registrados</h2>
        {eventos.length === 0 ? (
          <p className="mt-3 text-texto-2">Nenhum lance ainda.</p>
        ) : (
          <table className="tabela mt-3">
            <caption className="sr-only">Lances da partida</caption>
            <thead><tr><th className="esq" scope="col">Tempo</th><th className="esq" scope="col">Lance</th><th className="esq" scope="col">Atleta</th><th className="esq" scope="col">Equipe</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className="esq text-texto-3">{e.periodo === 4 ? "Pênaltis" : `${e.periodo}º${e.minuto !== null ? ` · ${e.minuto}'` : ""}`}</td>
                  <td className="esq">{ROTULO_TIPO[e.tipo]}</td>
                  <td className="esq">{e.atleta_id ? atletas.get(e.atleta_id)?.nome_esportivo ?? "Atleta" : "—"}</td>
                  <td className="esq text-texto-2">{e.inscricao_id === p.mandante.id ? p.mandante.equipe.nome_curto : p.visitante.equipe.nome_curto}</td>
                  <td>
                    {podeLancar ? (
                      <Confirmar acao={removerEvento} compacto rotulo="Remover" pergunta={`Remover este lance (${ROTULO_TIPO[e.tipo]})? O placar será recalculado.`} confirmar="Remover lance" campos={{ id: e.id, partida_id: id }} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {admin ? (
        <section aria-labelledby="dados" className="mt-12 max-w-xl">
          <h2 id="dados" className="titulo-secao">Dados da partida</h2>
          <form action={atualizarPartida} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="rotulo" htmlFor="data_hora">Data e hora (Osasco)</label>
              <input autoComplete="off" id="data_hora" name="data_hora" type="datetime-local" className="campo"
                defaultValue={p.data_hora ? `${fmt.diaISO(p.data_hora)}T${fmt.hora(p.data_hora)}` : ""} />
            </div>
            <div>
              <label className="rotulo" htmlFor="local_id">Local</label>
              <select id="local_id" name="local_id" className="campo" defaultValue={meta?.local_id ?? ""}>
                <option value="">A definir</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="mesario_id">Mesário responsável</label>
              <select id="mesario_id" name="mesario_id" className="campo" defaultValue={meta?.mesario_id ?? ""}>
                <option value="">Nenhum</option>
                {mesarios.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
              </select>
            </div>
            <button type="submit" className="botao botao-primario">Salvar dados</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function EquipeLado({ p, lado }: { p: PartidaResumo; lado: "mandante" | "visitante" }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center`}>
      <Escudo equipe={p[lado].equipe} tamanho={48} />
      <span className="text-sm font-semibold">{p[lado].equipe.nome}</span>
    </div>
  );
}

function StatusBotao({ id, status, rotulo, primario }: { id: string; status: string; rotulo: string; primario?: boolean }) {
  return (
    <form action={alterarStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`botao ${primario ? "botao-primario" : "botao-secundario"}`}>{rotulo}</button>
    </form>
  );
}
