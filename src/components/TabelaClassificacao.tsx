import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import type { GrupoTabela } from "@/lib/consultas";

const FORMA = {
  V: { cls: "bg-verde text-sobre-verde", rotulo: "Vitória" },
  E: { cls: "bg-superficie-2 text-texto-2 ring-1 ring-linha-forte", rotulo: "Empate" },
  D: { cls: "bg-vermelho text-white", rotulo: "Derrota" },
} as const;

/** Tabela de um grupo. `classificam` destaca as primeiras posições com a linha verde da zona. */
export function TabelaClassificacao({ grupo, classificam = 2, mostrarNome = true }: { grupo: GrupoTabela; classificam?: number; mostrarNome?: boolean }) {
  return (
    <section aria-labelledby={`grupo-${grupo.id}`} className="min-w-0">
      {mostrarNome ? <h3 id={`grupo-${grupo.id}`} className="titulo-secao mb-3">{grupo.nome}</h3> : <h3 id={`grupo-${grupo.id}`} className="sr-only">{grupo.nome}</h3>}
      <div className="overflow-x-auto">
        <table className="tabela">
          <caption className="sr-only">Classificação do {grupo.nome}</caption>
          <thead>
            <tr>
              <th scope="col" className="esq w-8"><abbr title="Posição">#</abbr></th>
              <th scope="col" className="esq">Equipe</th>
              <th scope="col"><abbr title="Pontos">P</abbr></th>
              <th scope="col"><abbr title="Jogos">J</abbr></th>
              <th scope="col"><abbr title="Vitórias">V</abbr></th>
              <th scope="col" className="hidden sm:table-cell"><abbr title="Empates">E</abbr></th>
              <th scope="col" className="hidden sm:table-cell"><abbr title="Derrotas">D</abbr></th>
              <th scope="col" className="hidden sm:table-cell"><abbr title="Gols marcados">GP</abbr></th>
              <th scope="col" className="hidden sm:table-cell"><abbr title="Gols sofridos">GC</abbr></th>
              <th scope="col"><abbr title="Saldo de gols">SG</abbr></th>
              <th scope="col" className="hidden md:table-cell">Últimos jogos</th>
            </tr>
          </thead>
          <tbody>
            {grupo.linhas.map((l, i) => (
              <tr key={l.inscricao_id}>
                <td className="esq">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold ${i < classificam ? "bg-verde-suave text-verde" : "text-texto-3"}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="esq">
                  <Link href={`/equipes/${l.equipe.slug}`} className="inline-flex items-center gap-2.5 hover:underline">
                    <Escudo equipe={l.equipe} tamanho={24} />
                    <span className="font-semibold">{l.equipe.nome}</span>
                  </Link>
                </td>
                <td className="font-bold">{l.pontos}</td>
                <td>{l.jogos}</td>
                <td>{l.vitorias}</td>
                <td className="hidden sm:table-cell">{l.empates}</td>
                <td className="hidden sm:table-cell">{l.derrotas}</td>
                <td className="hidden sm:table-cell">{l.gols_pro}</td>
                <td className="hidden sm:table-cell">{l.gols_contra}</td>
                <td className={l.saldo > 0 ? "text-verde" : l.saldo < 0 ? "text-vermelho" : ""}>{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
                <td className="hidden md:table-cell">
                  <span className="inline-flex justify-end gap-1">
                    {l.forma.map((f, k) => (
                      <span key={k} title={FORMA[f].rotulo} className={`inline-grid h-5 w-5 place-items-center rounded text-[0.6875rem] font-bold ${FORMA[f].cls}`}>
                        <span aria-hidden="true">{f}</span>
                        <span className="sr-only">{FORMA[f].rotulo}</span>
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {classificam > 0 ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-texto-3">
          <span className="inline-block h-3 w-3 rounded-sm bg-verde-suave ring-1 ring-verde" aria-hidden="true" />
          Classificam para as finais
        </p>
      ) : null}
    </section>
  );
}
