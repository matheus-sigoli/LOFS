import type { Metadata } from "next";
import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { listarEquipes } from "@/lib/consultas";

export const metadata: Metadata = { title: "Equipes" };
export const dynamic = "force-dynamic";

export default async function Equipes() {
  const equipes = await listarEquipes();
  return (
    <div>
      <h1 className="titulo-pagina">Equipes</h1>
      <p className="mt-3 max-w-prose text-texto-2">{equipes.length} clubes filiados, um por bairro de Osasco.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {equipes.map((e) => (
          <li key={e.id}>
            <Link href={`/equipes/${e.slug}`} className="flex items-center gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha transition hover:ring-linha-forte">
              <Escudo equipe={e} tamanho={48} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{e.nome}</span>
                <span className="text-sm text-texto-3">{e.bairro}{e.fundacao ? `, desde ${e.fundacao}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
