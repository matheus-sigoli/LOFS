import Link from "next/link";
import { Animacao } from "@/components/Animacao";
import { ListaPartidas, PlacarQuadra } from "@/components/Partidas";
import escudoAnimado from "@/animacoes/escudo.json";
import { Vazio } from "@/components/Vazio";
import { catalogo, listarCampeonatos, partidasEntre, proximasPartidas } from "@/lib/consultas";
import { fmt, intervaloDoDia } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const hoje = fmt.diaISO(new Date());
  const { inicio, fim } = intervaloDoDia(hoje);
  const { temporadas } = await catalogo();
  const atual = temporadas.find((t) => t.atual) ?? temporadas[0];

  const [doDia, proximas, campeonatos] = await Promise.all([
    partidasEntre(inicio, fim),
    proximasPartidas(12),
    atual ? listarCampeonatos({ ano: atual.ano }) : Promise.resolve([]),
  ]);

  const aoVivo = doDia.filter((p) => p.status === "ao_vivo");
  const destaques = (aoVivo.length ? aoVivo : doDia.filter((p) => p.status === "agendada")).slice(0, 2);
  const restoDoDia = doDia.filter((p) => !destaques.includes(p));
  const futuras = proximas.filter((p) => p.data_hora && p.data_hora >= fim).slice(0, 6);

  return (
    <div className="space-y-16">
      <section aria-labelledby="hoje">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Animacao dados={escudoAnimado} rotulo="Escudo da LOFS" className="w-[72px] shrink-0 sm:w-[104px]" />
            <div>
              <p className="text-sm font-semibold text-verde">Temporada {atual?.ano}</p>
              <h1 id="hoje" className="titulo-pagina mt-1">Hoje na quadra</h1>
              <p className="mt-2 text-texto-2 first-letter:uppercase">{fmt.dataLonga(new Date())}</p>
            </div>
          </div>
          {aoVivo.length > 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-vermelho">
              <span className="ao-vivo-ponto" aria-hidden="true" />
              {aoVivo.length === 1 ? "1 jogo ao vivo" : `${aoVivo.length} jogos ao vivo`}
            </p>
          ) : null}
        </div>

        {doDia.length === 0 ? (
          <div className="mt-6">
            <Vazio titulo="Sem jogos hoje">
              A próxima rodada começa {futuras[0]?.data_hora ? `${fmt.dataLonga(futuras[0].data_hora)}` : "em breve"}.{" "}
              <Link href="/jogos" className="underline">Ver calendário</Link>
            </Vazio>
          </div>
        ) : (
          <>
            <div className={`mt-6 grid gap-4 ${destaques.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {destaques.map((p) => <PlacarQuadra key={p.id} p={p} />)}
            </div>
            {restoDoDia.length > 0 ? (
              <div className="mt-6">
                <h2 className="sr-only">Outros jogos de hoje</h2>
                <ListaPartidas partidas={restoDoDia} />
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="campeonatos" className="grid gap-10 lg:grid-cols-[1fr_1.35fr]">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="campeonatos" className="titulo-secao">Temporada {atual?.ano}</h2>
            <Link href="/campeonatos" className="text-sm text-texto-2 underline hover:text-texto">Todas as temporadas</Link>
          </div>
          <ul className="mt-4 divide-y divide-linha border-y border-linha">
            {campeonatos.map((c) => (
              <li key={c.id}>
                <Link href={`/campeonatos/${c.slug}`} className="flex items-center justify-between gap-4 py-3 hover:text-verde">
                  <span>
                    <span className="block font-semibold">{c.categoria.nome} · {c.serie.nome}</span>
                    <span className="text-sm text-texto-3">{c.titulo.nome}</span>
                  </span>
                  <span className="text-sm text-texto-3">{c.status === "encerrado" ? "Encerrado" : "Em andamento"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="titulo-secao">Próximos jogos</h2>
            <Link href="/jogos" className="text-sm text-texto-2 underline hover:text-texto">Calendário</Link>
          </div>
          <div className="mt-3">
            {futuras.length ? <ListaPartidas partidas={futuras} mostrarData /> : <p className="text-texto-2">Nenhum jogo marcado.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
