import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Escudo } from "@/components/Escudo";
import { IconeCartao } from "@/components/Icones";
import { atletaPorSlug } from "@/lib/consultas";
import { urlFotoAtleta } from "@/lib/fotos";
import { rotuloPosicao } from "@/lib/format";
import { ehSlug } from "@/lib/validar";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ehSlug(slug)) return {};
  const d = await atletaPorSlug(slug);
  return d ? { title: d.atleta.nome_esportivo } : {};
}

export default async function AtletaPagina({ params }: Props) {
  const { slug } = await params;
  if (!ehSlug(slug)) notFound();
  const d = await atletaPorSlug(slug);
  if (!d) notFound();
  const { atleta, historico } = d;
  const foto = atleta.consentido ? await urlFotoAtleta(atleta.foto_path) : null;
  const atual = historico[0];
  const totalGols = historico.reduce((s, h) => s + h.gols, 0);
  const idade = atleta.ano_nascimento ? new Date().getFullYear() - atleta.ano_nascimento : null;

  return (
    <div>
      <header className="grid items-end gap-6 sm:grid-cols-[auto_1fr]">
        <div className="grid h-40 w-32 place-items-center overflow-hidden rounded-xl bg-superficie ring-1 ring-linha">
          {foto ? (
            <Image src={foto} alt={`Foto de ${atleta.nome_esportivo}`} width={128} height={160} className="h-full w-full object-cover" />
          ) : (
            <span className="numero-placar text-6xl text-texto-3" aria-hidden="true">{atual?.numero ?? "—"}</span>
          )}
        </div>
        <div>
          {atual ? (
            <Link href={`/equipes/${atual.equipe.slug}`} className="inline-flex items-center gap-2 text-texto-2 hover:underline">
              <Escudo equipe={atual.equipe} tamanho={22} /> {atual.equipe.nome}
            </Link>
          ) : null}
          <h1 className="titulo-pagina mt-2">{atleta.nome_esportivo}</h1>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {atleta.nome_completo ? <Info rotulo="Nome">{atleta.nome_completo}</Info> : null}
            {atleta.posicao ? <Info rotulo="Posição">{rotuloPosicao[atleta.posicao]}</Info> : null}
            {atual ? <Info rotulo="Camisa">{atual.numero}</Info> : null}
            {idade ? <Info rotulo="Idade">{idade} anos</Info> : null}
            <Info rotulo="Gols na liga">{totalGols}</Info>
          </dl>
        </div>
      </header>

      {!atleta.consentido ? (
        <p className="mt-6 max-w-prose rounded-lg border border-linha px-4 py-3 text-sm text-texto-2">
          Perfil resumido: a liga só publica nome completo, idade e foto com autorização do atleta ou do responsável.{" "}
          <Link href="/sobre#privacidade" className="underline">Como funciona</Link>
        </p>
      ) : null}

      <section aria-labelledby="historico" className="mt-12">
        <h2 id="historico" className="titulo-secao">Histórico na LOFS</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="tabela max-w-3xl">
            <caption className="sr-only">Campeonatos disputados</caption>
            <thead>
              <tr>
                <th scope="col" className="esq">Campeonato</th>
                <th scope="col" className="esq">Equipe</th>
                <th scope="col">Gols</th>
                <th scope="col"><span className="inline-flex items-center gap-1"><IconeCartao cor="amarelo" rotulo="Cartões amarelos" /></span></th>
                <th scope="col"><span className="inline-flex items-center gap-1"><IconeCartao cor="vermelho" rotulo="Cartões vermelhos" /></span></th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.campeonato.id}>
                  <td className="esq">
                    <Link href={`/campeonatos/${h.campeonato.slug}`} className="font-semibold hover:underline">
                      {h.campeonato.categoria.nome} · {h.campeonato.serie.nome} {h.campeonato.temporada.ano}
                    </Link>
                  </td>
                  <td className="esq text-texto-2">{h.equipe.nome}</td>
                  <td className="font-bold">{h.gols}</td>
                  <td>{h.amarelos}</td>
                  <td>{h.vermelhos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-texto-3">{rotulo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
