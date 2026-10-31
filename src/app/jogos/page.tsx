import type { Metadata } from "next";
import Link from "next/link";
import { ListaPartidas } from "@/components/Partidas";
import { Vazio } from "@/components/Vazio";
import { partidasEntre } from "@/lib/consultas";
import { fmt, intervaloDoDia, somarDias } from "@/lib/format";
import type { PartidaResumo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Jogos" };
export const dynamic = "force-dynamic";

export default async function Jogos({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const hoje = fmt.diaISO(new Date());
  const pedido = (await searchParams).data;
  const dia = pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) && !Number.isNaN(Date.parse(pedido)) ? pedido : hoje;
  const { inicio, fim } = intervaloDoDia(dia);
  const partidas = await partidasEntre(inicio, fim);

  const grupos = new Map<string, { nome: string; slug: string; partidas: PartidaResumo[] }>();
  for (const p of partidas) {
    const c = p.fase.campeonato;
    const g = grupos.get(c.slug) ?? { nome: `${c.categoria.nome} · ${c.serie.nome} — ${c.titulo.nome}`, slug: c.slug, partidas: [] };
    g.partidas.push(p);
    grupos.set(c.slug, g);
  }

  const dias = Array.from({ length: 7 }, (_, i) => somarDias(dia, i - 3));
  const meioDia = (d: string) => new Date(`${d}T12:00:00-03:00`);

  return (
    <div>
      <h1 className="titulo-pagina">Jogos</h1>
      <nav aria-label="Escolher dia" className="mt-6 flex items-center gap-2">
        <Link href={`/jogos?data=${somarDias(dia, -7)}`} className="botao botao-secundario min-h-11 w-11 shrink-0 px-0" aria-label="Semana anterior">‹</Link>
        <ol className="grid flex-1 grid-cols-7 gap-1">
          {dias.map((d) => {
            const ativo = d === dia;
            return (
              <li key={d}>
                <Link
                  href={`/jogos?data=${d}`}
                  aria-current={ativo ? "date" : undefined}
                  className={`flex flex-col items-center rounded-lg py-2 text-center transition-colors ${ativo ? "bg-verde text-sobre-verde" : "hover:bg-superficie-2"}`}
                >
                  <span className={`text-xs ${ativo ? "" : "text-texto-3"}`}>{d === hoje ? "Hoje" : fmt.diaSemana(meioDia(d))}</span>
                  <span className="numero-placar text-2xl">{fmt.dataCurta(meioDia(d)).slice(0, 2)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <Link href={`/jogos?data=${somarDias(dia, 7)}`} className="botao botao-secundario min-h-11 w-11 shrink-0 px-0" aria-label="Próxima semana">›</Link>
      </nav>

      <p className="mt-6 text-texto-2 first-letter:uppercase">{fmt.dataLonga(meioDia(dia))}</p>

      <div className="mt-4 space-y-10">
        {grupos.size === 0 ? (
          <Vazio titulo="Nenhum jogo neste dia">Use as setas para ver outras semanas.</Vazio>
        ) : (
          [...grupos.values()].map((g) => (
            <section key={g.slug} aria-label={g.nome}>
              <h2 className="mb-2 flex items-baseline justify-between gap-4 border-b border-linha-forte pb-2">
                <Link href={`/campeonatos/${g.slug}`} className="font-semibold hover:text-verde">{g.nome}</Link>
              </h2>
              <ListaPartidas partidas={g.partidas} mostrarCampeonato={false} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
