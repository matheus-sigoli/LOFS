import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { fmt } from "@/lib/format";
import type { PartidaResumo } from "@/lib/tipos";

function nomeCampeonato(p: PartidaResumo) {
  const c = p.fase.campeonato;
  return `${c.categoria.nome} · ${c.serie.nome}`;
}

export function StatusPartida({ p }: { p: PartidaResumo }) {
  if (p.status === "ao_vivo")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-vermelho">
        <span className="ao-vivo-ponto" aria-hidden="true" /> Ao vivo
      </span>
    );
  if (p.status === "encerrada") return <span className="text-xs text-texto-3">Encerrado</span>;
  if (p.status === "adiada") return <span className="text-xs font-semibold text-amarelo">Adiado</span>;
  if (p.status === "cancelada") return <span className="text-xs text-texto-3 line-through">Cancelado</span>;
  return <span className="text-xs text-texto-2">{p.data_hora ? fmt.hora(p.data_hora) : "A definir"}</span>;
}

function Lado({ p, lado }: { p: PartidaResumo; lado: "mandante" | "visitante" }) {
  const e = p[lado].equipe;
  const venceu =
    p.status === "encerrada" &&
    (lado === "mandante"
      ? p.gols_mandante > p.gols_visitante || (p.penaltis_mandante ?? 0) > (p.penaltis_visitante ?? 0)
      : p.gols_visitante > p.gols_mandante || (p.penaltis_visitante ?? 0) > (p.penaltis_mandante ?? 0));
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${lado === "mandante" ? "flex-row-reverse text-right" : ""}`}>
      <Escudo equipe={e} tamanho={28} />
      <span className={`truncate ${venceu ? "font-bold text-texto" : "text-texto-2"}`}>{e.nome}</span>
    </div>
  );
}

function Placar({ p }: { p: PartidaResumo }) {
  const jogou = p.status === "ao_vivo" || p.status === "encerrada";
  return (
    <div className="flex flex-col items-center">
      <span
        className={`numero-placar text-2xl ${p.status === "ao_vivo" ? "text-vermelho" : ""}`}
        aria-label={jogou ? `${p.gols_mandante} a ${p.gols_visitante}` : "ainda não começou"}
      >
        {jogou ? `${p.gols_mandante}–${p.gols_visitante}` : "×"}
      </span>
      {p.penaltis_mandante !== null && p.penaltis_visitante !== null ? (
        <span className="text-[0.6875rem] text-texto-3">pên. {p.penaltis_mandante}–{p.penaltis_visitante}</span>
      ) : null}
    </div>
  );
}

/** Linha de partida para listas: mandante · placar · visitante. A linha inteira é o link. */
export function LinhaPartida({ p, mostrarCampeonato = true, mostrarData = false }: { p: PartidaResumo; mostrarCampeonato?: boolean; mostrarData?: boolean }) {
  return (
    <li>
      <Link
        href={`/jogos/${p.id}`}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg px-3 py-3 transition-colors hover:bg-superficie-2 sm:grid-cols-[7rem_1fr_4.5rem_1fr_9rem] sm:gap-x-4"
      >
        <div className="col-span-3 flex items-center justify-between gap-2 sm:col-span-1 sm:block">
          <StatusPartida p={p} />
          {mostrarData && p.data_hora ? (
            <span className="text-xs text-texto-3 sm:block">{fmt.diaSemana(p.data_hora)} {fmt.dataCurta(p.data_hora)}</span>
          ) : null}
        </div>
        <Lado p={p} lado="mandante" />
        <Placar p={p} />
        <Lado p={p} lado="visitante" />
        <div className="col-span-3 text-xs text-texto-3 sm:col-span-1 sm:text-right">
          {mostrarCampeonato ? nomeCampeonato(p) : p.chave ?? (p.rodada ? `Rodada ${p.rodada}` : p.fase.nome)}
          {p.local ? <span className="block truncate">{p.local.nome}</span> : null}
        </div>
      </Link>
    </li>
  );
}

export function ListaPartidas({ partidas, ...props }: { partidas: PartidaResumo[]; mostrarCampeonato?: boolean; mostrarData?: boolean }) {
  return (
    <ul className="-mx-3 divide-y divide-linha">
      {partidas.map((p) => (
        <LinhaPartida key={p.id} p={p} {...props} />
      ))}
    </ul>
  );
}

/** Placar grande sobre o traçado da quadra — o elemento de destaque da home. */
export function PlacarQuadra({ p }: { p: PartidaResumo }) {
  const jogou = p.status === "ao_vivo" || p.status === "encerrada";
  return (
    <Link
      href={`/jogos/${p.id}`}
      className="group relative block overflow-hidden rounded-xl bg-superficie p-5 ring-1 ring-linha transition hover:ring-linha-forte sm:p-7"
    >
      <svg aria-hidden="true" viewBox="0 0 400 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-linha-forte opacity-60">
        <rect x="6" y="6" width="388" height="188" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1="200" y1="6" x2="200" y2="194" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <circle cx="200" cy="100" r="34" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d="M6 58h28a42 42 0 0 1 0 84H6M394 58h-28a42 42 0 0 0 0 84h28" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative">
        <div className="flex items-center justify-between gap-3 text-sm">
          <StatusPartida p={p} />
          <span className="truncate text-texto-3">{nomeCampeonato(p)}</span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          {(["mandante", "visitante"] as const).map((lado, i) => (
            <div key={lado} className={`flex min-w-0 flex-col items-center gap-2 text-center ${i === 1 ? "order-3" : ""}`}>
              <span className="sm:hidden"><Escudo equipe={p[lado].equipe} tamanho={48} /></span>
              <span className="hidden sm:inline"><Escudo equipe={p[lado].equipe} tamanho={64} /></span>
              <span className="line-clamp-2 text-sm font-semibold sm:text-base">{p[lado].equipe.nome}</span>
            </div>
          ))}
          <div className="order-2 text-center">
            <div className={`numero-placar text-6xl sm:text-8xl ${p.status === "ao_vivo" ? "text-texto" : ""}`}>
              {jogou ? (
                <>
                  {p.gols_mandante}
                  <span className="mx-1 text-texto-3 sm:mx-2">:</span>
                  {p.gols_visitante}
                </>
              ) : (
                <span className="text-5xl sm:text-6xl">{p.data_hora ? fmt.hora(p.data_hora) : "—"}</span>
              )}
            </div>
          </div>
        </div>
        {p.local ? <p className="mt-4 text-center text-xs text-texto-3">{p.local.nome}</p> : null}
      </div>
    </Link>
  );
}
