import type { Metadata } from "next";
import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { Vazio } from "@/components/Vazio";
import { exigirLogin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { EquipeResumo } from "@/lib/tipos";
import { sair } from "../entrar/acoes";

export const metadata: Metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

export default async function MinhaConta() {
  const sessao = await exigirLogin("/minha-conta");
  const sb = await supabaseServer();
  const { data } = await sb
    .from("favorito")
    .select(`id, equipe:equipe(id, nome, nome_curto, slug, cor_primaria, cor_secundaria),
             campeonato:campeonato(slug, titulo:titulo(nome), serie:serie(nome), categoria:categoria(nome), temporada:temporada(ano))`)
    .order("created_at", { ascending: false });
  type Fav = {
    id: string;
    equipe: EquipeResumo | null;
    campeonato: { slug: string; titulo: { nome: string }; serie: { nome: string }; categoria: { nome: string }; temporada: { ano: number } } | null;
  };
  const favs = (data ?? []) as unknown as Fav[];
  const equipes = favs.flatMap((f) => (f.equipe ? [f.equipe] : []));
  const campeonatos = favs.flatMap((f) => (f.campeonato ? [f.campeonato] : []));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">Minha conta</h1>
          <p className="mt-2 text-texto-2">{sessao.email}</p>
        </div>
        <form action={sair}><button type="submit" className="botao botao-secundario">Sair</button></form>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="f-equipes">
          <h2 id="f-equipes" className="titulo-secao">Equipes que você segue</h2>
          <div className="mt-4">
            {equipes.length === 0 ? (
              <Vazio titulo="Nenhuma equipe ainda">Abra a página de uma equipe e toque em Seguir. <Link href="/equipes" className="underline">Ver equipes</Link></Vazio>
            ) : (
              <ul className="divide-y divide-linha border-y border-linha">
                {equipes.map((e) => (
                  <li key={e.slug}><Link href={`/equipes/${e.slug}`} className="flex items-center gap-3 py-3 font-semibold hover:text-verde"><Escudo equipe={e} tamanho={30} />{e.nome}</Link></li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section aria-labelledby="f-camps">
          <h2 id="f-camps" className="titulo-secao">Campeonatos que você segue</h2>
          <div className="mt-4">
            {campeonatos.length === 0 ? (
              <Vazio titulo="Nenhum campeonato ainda"><Link href="/campeonatos" className="underline">Ver campeonatos</Link></Vazio>
            ) : (
              <ul className="divide-y divide-linha border-y border-linha">
                {campeonatos.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/campeonatos/${c.slug}`} className="block py-3 hover:text-verde">
                      <span className="block font-semibold">{c.categoria.nome} · {c.serie.nome}</span>
                      <span className="text-sm text-texto-3">{c.titulo.nome} {c.temporada.ano}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
