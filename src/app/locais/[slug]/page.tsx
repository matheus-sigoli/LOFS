import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListaPartidas } from "@/components/Partidas";
import { localPorSlug, proximasPartidas } from "@/lib/consultas";
import { ehSlug } from "@/lib/validar";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ehSlug(slug)) return {};
  const l = await localPorSlug(slug);
  return l ? { title: l.nome } : {};
}

export default async function Local({ params }: Props) {
  const { slug } = await params;
  if (!ehSlug(slug)) notFound();
  const local = await localPorSlug(slug);
  if (!local) notFound();
  const jogos = await proximasPartidas(15, { localId: local.id });
  return (
    <div>
      <h1 className="titulo-pagina">{local.nome}</h1>
      <p className="mt-3 text-texto-2">{[local.endereco, local.bairro, "Osasco"].filter(Boolean).join(", ")}</p>
      <section aria-labelledby="agenda" className="mt-10">
        <h2 id="agenda" className="titulo-secao mb-2">Próximos jogos aqui</h2>
        {jogos.length ? <ListaPartidas partidas={jogos} mostrarData /> : <p className="text-texto-2">Nenhum jogo marcado neste ginásio.</p>}
      </section>
    </div>
  );
}
