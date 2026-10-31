import type { Metadata } from "next";
import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { Vazio } from "@/components/Vazio";
import { catalogo, ranking } from "@/lib/consultas";

export const metadata: Metadata = { title: "Ranking" };
export const dynamic = "force-dynamic";

const GRUPOS = { principal: "Principal", base: "Base" } as const;

export default async function Ranking({ searchParams }: { searchParams: Promise<{ temporada?: string; grupo?: string }> }) {
  const b = await searchParams;
  const { temporadas } = await catalogo();
  const temporada = temporadas.find((t) => String(t.ano) === b.temporada) ?? temporadas.find((t) => !t.atual) ?? temporadas[0];
  const grupo = b.grupo === "base" ? "base" : "principal";
  const linhas = temporada ? await ranking(temporada.id, grupo) : [];

  return (
    <div>
      <h1 className="titulo-pagina">Ranking da temporada</h1>
      <p className="mt-3 max-w-prose text-texto-2">
        Soma a colocação final de cada equipe nos campeonatos encerrados: campeão 10, vice 8, 3º 6, 4º 5, 5º a 8º 3 e 1 ponto por participação. A Série Ouro vale o dobro.
      </p>

      <div className="mt-6 flex flex-wrap gap-6">
        <nav aria-label="Temporada" className="flex gap-1">
          {temporadas.map((t) => (
            <Link key={t.id} href={`/ranking?temporada=${t.ano}&grupo=${grupo}`} aria-current={t.id === temporada?.id ? "page" : undefined}
              className={`botao min-h-9 px-3 text-sm ${t.id === temporada?.id ? "botao-primario" : "botao-secundario"}`}>
              {t.ano}
            </Link>
          ))}
        </nav>
        <nav aria-label="Grupo de categorias" className="flex gap-1">
          {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map((g) => (
            <Link key={g} href={`/ranking?temporada=${temporada?.ano}&grupo=${g}`} aria-current={g === grupo ? "page" : undefined}
              className={`botao min-h-9 px-3 text-sm ${g === grupo ? "botao-primario" : "botao-secundario"}`}>
              {GRUPOS[g]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8">
        {linhas.length === 0 ? (
          <Vazio titulo="Ranking ainda vazio">Ele é calculado quando os campeonatos da temporada {temporada?.ano} forem encerrados.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela max-w-3xl">
              <caption className="sr-only">Ranking {GRUPOS[grupo]} {temporada?.ano}</caption>
              <thead>
                <tr>
                  <th scope="col" className="esq w-10">#</th>
                  <th scope="col" className="esq">Equipe</th>
                  <th scope="col">Pontos</th>
                  <th scope="col">Títulos</th>
                  <th scope="col">Vices</th>
                  <th scope="col">Campeonatos</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.equipe_id}>
                    <td className="esq numero-placar text-xl text-texto-3">{i + 1}</td>
                    <td className="esq">
                      <Link href={`/equipes/${l.equipe.slug}`} className="inline-flex items-center gap-2.5 font-semibold hover:underline">
                        <Escudo equipe={l.equipe} tamanho={26} /> {l.equipe.nome}
                      </Link>
                    </td>
                    <td className="numero-placar text-2xl">{l.pontos.toLocaleString("pt-BR")}</td>
                    <td>{l.titulos}</td>
                    <td>{l.vices}</td>
                    <td>{l.participacoes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
