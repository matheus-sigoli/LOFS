import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoFavorito } from "@/components/BotaoFavorito";
import { Escudo } from "@/components/Escudo";
import { ListaPartidas } from "@/components/Partidas";
import { Vazio } from "@/components/Vazio";
import { elenco, equipePorSlug, meusFavoritos, proximasPartidas, ultimasPartidas } from "@/lib/consultas";
import { rotuloPosicao } from "@/lib/format";
import { ehSlug } from "@/lib/validar";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ elenco?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ehSlug(slug)) return {};
  const d = await equipePorSlug(slug);
  return d ? { title: d.equipe.nome } : {};
}

function colocacao(n: number | null, status: string) {
  if (n === 1) return "Campeão";
  if (n === 2) return "Vice-campeão";
  if (n) return `${n}º lugar`;
  return status === "encerrado" ? "—" : "Em andamento";
}

export default async function EquipePagina({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!ehSlug(slug)) notFound();
  const d = await equipePorSlug(slug);
  if (!d) notFound();
  const { equipe, inscricoes } = d;
  const ids = inscricoes.map((i) => i.id);
  const pedido = (await searchParams).elenco;
  const escolhida = inscricoes.find((i) => i.id === pedido) ?? inscricoes[0];

  const [fav, proximas, ultimas, atletas] = await Promise.all([
    meusFavoritos(),
    ids.length ? proximasPartidas(5, { equipeInscricoes: ids }) : Promise.resolve([]),
    ids.length ? ultimasPartidas(5, { equipeInscricoes: ids }) : Promise.resolve([]),
    escolhida ? elenco(escolhida.id) : Promise.resolve([]),
  ]);
  const caminho = `/equipes/${slug}`;

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Escudo equipe={equipe} tamanho={88} />
          <div>
            <h1 className="titulo-pagina">{equipe.nome}</h1>
            <p className="mt-2 text-texto-2">{equipe.bairro}{equipe.fundacao ? ` · fundado em ${equipe.fundacao}` : ""}</p>
          </div>
        </div>
        <BotaoFavorito tipo="equipe" id={equipe.id} seguindo={fav.equipes.has(equipe.id)} logado={fav.logado} caminho={caminho} />
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-12">
          <section aria-labelledby="proximos">
            <h2 id="proximos" className="titulo-secao mb-2">Próximos jogos</h2>
            {proximas.length ? <ListaPartidas partidas={proximas} mostrarData /> : <p className="text-texto-2">Nenhum jogo marcado.</p>}
          </section>
          <section aria-labelledby="ultimos">
            <h2 id="ultimos" className="titulo-secao mb-2">Últimos resultados</h2>
            {ultimas.length ? <ListaPartidas partidas={ultimas} mostrarData /> : <p className="text-texto-2">Ainda sem jogos disputados.</p>}
          </section>
        </div>

        <section aria-labelledby="campanhas">
          <h2 id="campanhas" className="titulo-secao">Campanhas</h2>
          {inscricoes.length === 0 ? (
            <p className="mt-3 text-texto-2">Ainda sem campeonatos.</p>
          ) : (
            <ul className="mt-3 divide-y divide-linha border-y border-linha">
              {inscricoes.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-4 py-3">
                  <Link href={`/campeonatos/${i.campeonato.slug}`} className="hover:text-verde">
                    <span className="block font-semibold">{i.campeonato.categoria.nome} · {i.campeonato.serie.nome}</span>
                    <span className="text-sm text-texto-3">{i.campeonato.titulo.nome} {i.campeonato.temporada.ano}</span>
                  </Link>
                  <span className={`text-sm ${i.colocacao_final === 1 ? "font-bold text-verde" : "text-texto-2"}`}>
                    {colocacao(i.colocacao_final, i.campeonato.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {escolhida ? (
        <section aria-labelledby="elenco" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="elenco" className="titulo-secao">Elenco</h2>
            <form method="get" className="flex items-end gap-2">
              <div>
                <label htmlFor="sel-elenco" className="rotulo">Campeonato</label>
                <select id="sel-elenco" name="elenco" defaultValue={escolhida.id} className="campo">
                  {inscricoes.map((i) => (
                    <option key={i.id} value={i.id}>{i.campeonato.categoria.nome} {i.campeonato.serie.nome} {i.campeonato.temporada.ano}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="botao botao-secundario">Ver</button>
            </form>
          </div>
          {atletas.length === 0 ? (
            <div className="mt-4"><Vazio titulo="Elenco não divulgado" /></div>
          ) : (
            <ul className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {atletas.map((a) => (
                <li key={a.id} className="border-b border-linha">
                  <Link href={`/atletas/${a.slug}`} className="flex items-center gap-4 py-3 hover:text-verde">
                    <span className="numero-placar w-9 text-right text-3xl text-texto-3">{a.numero}</span>
                    <span>
                      <span className="block font-semibold">{a.nome_esportivo}</span>
                      <span className="text-sm text-texto-3">{a.posicao ? rotuloPosicao[a.posicao] : ""}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
