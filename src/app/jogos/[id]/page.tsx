import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Escudo } from "@/components/Escudo";
import { IconeBola, IconeCartao } from "@/components/Icones";
import { StatusPartida } from "@/components/Partidas";
import { partidaDetalhe } from "@/lib/consultas";
import { fmt } from "@/lib/format";
import { ehUuid } from "@/lib/validar";
import type { AtletaPublico, EventoPartida } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!ehUuid(id)) return {};
  const d = await partidaDetalhe(id);
  if (!d) return {};
  return { title: `${d.partida.mandante.equipe.nome} × ${d.partida.visitante.equipe.nome}` };
}

const PERIODOS: Record<number, string> = { 1: "1º tempo", 2: "2º tempo", 3: "Prorrogação" };

export default async function Jogo({ params }: Props) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const d = await partidaDetalhe(id);
  if (!d) notFound();
  const { partida: p, eventos, atletas } = d;
  const c = p.fase.campeonato;
  const jogou = p.status === "ao_vivo" || p.status === "encerrada";
  const doTempo = (n: number) => eventos.filter((e) => e.periodo === n);
  const penaltis = doTempo(4);

  return (
    <article>
      <nav aria-label="Trilha" className="text-sm text-texto-3">
        <Link href={`/campeonatos/${c.slug}`} className="underline hover:text-texto">{c.titulo.nome} · {c.categoria.nome} · {c.serie.nome}</Link>
        <span aria-hidden="true"> / </span>
        <span>{p.chave ?? (p.rodada ? `${p.grupo?.nome ?? p.fase.nome}, rodada ${p.rodada}` : p.fase.nome)}</span>
      </nav>

      <header className="mt-6 rounded-xl bg-superficie px-4 py-8 ring-1 ring-linha sm:px-8">
        <div className="flex justify-center"><StatusPartida p={p} /></div>
        <h1 className="sr-only">{p.mandante.equipe.nome} contra {p.visitante.equipe.nome}</h1>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
          {(["mandante", "visitante"] as const).map((lado, i) => (
            <Link key={lado} href={`/equipes/${p[lado].equipe.slug}`} className={`flex min-w-0 flex-col items-center gap-3 text-center hover:underline ${i === 1 ? "order-3" : ""}`}>
              <Escudo equipe={p[lado].equipe} tamanho={72} />
              <span className="line-clamp-2 font-semibold sm:text-lg">{p[lado].equipe.nome}</span>
            </Link>
          ))}
          <div className="order-2 text-center">
            {jogou ? (
              <p className="numero-placar text-7xl sm:text-9xl" aria-label={`Placar ${p.gols_mandante} a ${p.gols_visitante}`}>
                {p.gols_mandante}<span className="mx-1 text-texto-3 sm:mx-3">:</span>{p.gols_visitante}
              </p>
            ) : (
              <p className="numero-placar text-6xl text-texto-2">{p.data_hora ? fmt.hora(p.data_hora) : "—"}</p>
            )}
            {p.penaltis_mandante !== null && p.penaltis_visitante !== null ? (
              <p className="mt-2 text-sm text-texto-2">Pênaltis {p.penaltis_mandante}–{p.penaltis_visitante}</p>
            ) : null}
          </div>
        </div>
        <dl className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
          {p.data_hora ? (
            <div className="flex gap-2"><dt className="text-texto-3">Data</dt><dd className="first-letter:uppercase">{fmt.dataLonga(p.data_hora)}, {fmt.hora(p.data_hora)}</dd></div>
          ) : null}
          {p.local ? (
            <div className="flex gap-2"><dt className="text-texto-3">Local</dt><dd><Link href={`/locais/${p.local.slug}`} className="underline">{p.local.nome}</Link></dd></div>
          ) : null}
        </dl>
      </header>

      <section aria-labelledby="lances" className="mt-10">
        <h2 id="lances" className="titulo-secao">Lances</h2>
        {eventos.length === 0 ? (
          <p className="mt-3 text-texto-2">{jogou ? "Nenhum lance registrado ainda." : "A súmula aparece aqui quando o jogo começar."}</p>
        ) : (
          <div className="mt-4 space-y-8">
            {[1, 2, 3].map((n) =>
              doTempo(n).length ? (
                <div key={n}>
                  <h3 className="mb-2 text-sm font-semibold text-texto-3">{PERIODOS[n]}</h3>
                  <ol className="divide-y divide-linha border-y border-linha">
                    {doTempo(n).map((e) => (
                      <Lance key={e.id} e={e} atleta={e.atleta_id ? atletas.get(e.atleta_id) : undefined} mandante={e.inscricao_id === p.mandante.id} />
                    ))}
                  </ol>
                </div>
              ) : null,
            )}
            {penaltis.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-texto-3">Disputa de pênaltis</h3>
                <ol className="divide-y divide-linha border-y border-linha">
                  {penaltis.map((e) => (
                    <Lance key={e.id} e={e} atleta={e.atleta_id ? atletas.get(e.atleta_id) : undefined} mandante={e.inscricao_id === p.mandante.id} />
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </article>
  );
}

const DESCRICAO: Record<EventoPartida["tipo"], string> = {
  gol: "Gol",
  gol_contra: "Gol contra",
  amarelo: "Cartão amarelo",
  vermelho: "Cartão vermelho",
  penalti_convertido: "Pênalti convertido",
  penalti_perdido: "Pênalti perdido",
};

function Lance({ e, atleta, mandante }: { e: EventoPartida; atleta?: AtletaPublico; mandante: boolean }) {
  const icone =
    e.tipo === "amarelo" ? <IconeCartao cor="amarelo" /> :
    e.tipo === "vermelho" ? <IconeCartao cor="vermelho" /> :
    e.tipo === "penalti_perdido" ? <span aria-hidden="true" className="font-bold text-vermelho">✕</span> :
    <span className={e.tipo === "gol_contra" ? "text-vermelho" : "text-verde"}><IconeBola /></span>;
  const nome = atleta ? (
    <Link href={`/atletas/${atleta.slug}`} className="font-semibold hover:underline">{atleta.nome_esportivo}</Link>
  ) : (
    <span className="text-texto-2">Atleta não identificado</span>
  );
  return (
    <li className={`grid grid-cols-[1fr_3rem_1fr] items-center py-2.5`}>
      <div className={`flex items-center justify-end gap-2.5 text-right ${mandante ? "" : "invisible"}`} aria-hidden={!mandante}>
        {mandante ? <>{nome}<span className="sr-only text-xs text-texto-3 sm:not-sr-only">{DESCRICAO[e.tipo]}</span>{icone}</> : null}
      </div>
      <span className="text-center text-sm text-texto-3">{e.minuto !== null ? `${e.minuto}'` : ""}</span>
      <div className={`flex items-center gap-2.5 ${mandante ? "invisible" : ""}`} aria-hidden={mandante}>
        {!mandante ? <>{icone}<span className="sr-only text-xs text-texto-3 sm:not-sr-only">{DESCRICAO[e.tipo]}</span>{nome}</> : null}
      </div>
    </li>
  );
}
