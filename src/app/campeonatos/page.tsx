import type { Metadata } from "next";
import Link from "next/link";
import { Vazio } from "@/components/Vazio";
import { catalogo, listarCampeonatos } from "@/lib/consultas";
import { ehSlug } from "@/lib/validar";
import type { CampeonatoResumo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Campeonatos" };
export const dynamic = "force-dynamic";

type Busca = { temporada?: string; titulo?: string; serie?: string; categoria?: string };

export default async function Campeonatos({ searchParams }: { searchParams: Promise<Busca> }) {
  const b = await searchParams;
  const cat = await catalogo();
  const atual = cat.temporadas.find((t) => t.atual) ?? cat.temporadas[0];
  const ano = cat.temporadas.some((t) => String(t.ano) === b.temporada) ? Number(b.temporada) : atual?.ano;
  const slug = (v?: string) => (v && ehSlug(v) ? v : undefined);
  const filtro = { ano, titulo: slug(b.titulo), serie: slug(b.serie), categoria: slug(b.categoria) };
  const lista = await listarCampeonatos(filtro);

  const porTitulo = new Map<string, CampeonatoResumo[]>();
  for (const c of lista) porTitulo.set(c.titulo.nome, [...(porTitulo.get(c.titulo.nome) ?? []), c]);

  return (
    <div>
      <h1 className="titulo-pagina">Campeonatos</h1>

      <form method="get" className="mt-6 grid gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-[repeat(4,1fr)_auto] sm:items-end">
        <Filtro nome="temporada" rotulo="Temporada" valor={String(ano ?? "")} opcoes={cat.temporadas.map((t) => [String(t.ano), String(t.ano)])} />
        <Filtro nome="titulo" rotulo="Competição" valor={filtro.titulo ?? ""} opcoes={cat.titulos.map((t) => [t.slug, t.nome])} todos />
        <Filtro nome="serie" rotulo="Série" valor={filtro.serie ?? ""} opcoes={cat.series.map((s) => [s.slug, s.nome])} todos />
        <Filtro nome="categoria" rotulo="Categoria" valor={filtro.categoria ?? ""} opcoes={cat.categorias.map((c) => [c.slug, c.nome])} todos />
        <button type="submit" className="botao botao-primario">Filtrar</button>
      </form>

      <div className="mt-10 space-y-12">
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum campeonato com esses filtros">
            <Link href="/campeonatos" className="underline">Limpar filtros</Link>
          </Vazio>
        ) : (
          [...porTitulo.entries()].map(([titulo, camps]) => (
            <section key={titulo} aria-labelledby={`t-${camps[0]!.titulo.slug}`}>
              <h2 id={`t-${camps[0]!.titulo.slug}`} className="titulo-secao">{titulo} {ano}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {camps.map((c) => (
                  <li key={c.id}>
                    <Link href={`/campeonatos/${c.slug}`} className="group flex h-full flex-col justify-between gap-6 rounded-xl bg-superficie p-5 ring-1 ring-linha transition hover:ring-verde">
                      <div>
                        <p className="font-display text-3xl font-extrabold leading-none">{c.categoria.nome}</p>
                        <p className="mt-1 text-texto-2">{c.serie.nome}</p>
                      </div>
                      <p className="flex items-center justify-between text-sm">
                        <span className={c.status === "encerrado" ? "text-texto-3" : "font-semibold text-verde"}>
                          {c.status === "encerrado" ? "Encerrado" : "Em andamento"}
                        </span>
                        <span className="text-texto-3 group-hover:text-texto">Ver tabela</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Filtro({ nome, rotulo, valor, opcoes, todos }: { nome: string; rotulo: string; valor: string; opcoes: [string, string][]; todos?: boolean }) {
  return (
    <div>
      <label htmlFor={`f-${nome}`} className="rotulo">{rotulo}</label>
      <select id={`f-${nome}`} name={nome} defaultValue={valor} className="campo">
        {todos ? <option value="">Todas</option> : null}
        {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
    </div>
  );
}
