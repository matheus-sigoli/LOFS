import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { catalogo } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { criarCampeonato } from "./acoes";

export const metadata = { title: "Campeonatos" };

const STATUS = { rascunho: "Rascunho", publicado: "Publicado", encerrado: "Encerrado" } as const;

export default async function PainelCampeonatos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await exigirAdmin();
  const b = await searchParams;
  const cat = await catalogo();
  const sb = await supabaseServer();
  const { data } = await sb.from("campeonato")
    .select("id, slug, status, titulo:titulo(nome), serie:serie(nome, ordem), categoria:categoria(nome, ordem), temporada:temporada(ano)");
  type C = { id: string; slug: string; status: keyof typeof STATUS; titulo: { nome: string }; serie: { nome: string; ordem: number }; categoria: { nome: string; ordem: number }; temporada: { ano: number } };
  const camps = ((data ?? []) as unknown as C[]).sort((a, b) => b.temporada.ano - a.temporada.ano || a.titulo.nome.localeCompare(b.titulo.nome) || a.serie.ordem - b.serie.ordem || a.categoria.ordem - b.categoria.ordem);

  return (
    <div>
      <Aviso ok={b.ok} erro={b.erro} />
      <h1 className="titulo-pagina">Campeonatos</h1>

      <form action={criarCampeonato} className="mt-6 grid gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-[repeat(4,1fr)_auto] sm:items-end">
        <Sel nome="titulo_id" rotulo="Competição" opcoes={cat.titulos.map((t) => [t.id, t.nome])} />
        <Sel nome="temporada_id" rotulo="Temporada" opcoes={cat.temporadas.map((t) => [t.id, String(t.ano)])} />
        <Sel nome="serie_id" rotulo="Série" opcoes={cat.series.map((s) => [s.id, s.nome])} />
        <Sel nome="categoria_id" rotulo="Categoria" opcoes={cat.categorias.map((c) => [c.id, c.nome])} />
        <button type="submit" className="botao botao-primario">Criar rascunho</button>
      </form>

      <table className="tabela mt-8">
        <caption className="sr-only">Campeonatos cadastrados</caption>
        <thead><tr><th className="esq" scope="col">Campeonato</th><th className="esq" scope="col">Temporada</th><th scope="col">Situação</th></tr></thead>
        <tbody>
          {camps.map((c) => (
            <tr key={c.id}>
              <td className="esq"><Link href={`/painel/campeonatos/${c.id}`} className="font-semibold hover:underline">{c.titulo.nome} · {c.categoria.nome} · {c.serie.nome}</Link></td>
              <td className="esq text-texto-2">{c.temporada.ano}</td>
              <td className={c.status === "rascunho" ? "text-amarelo" : "text-texto-2"}>{STATUS[c.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sel({ nome, rotulo, opcoes }: { nome: string; rotulo: string; opcoes: [string, string][] }) {
  return (
    <div>
      <label htmlFor={nome} className="rotulo">{rotulo}</label>
      <select id={nome} name={nome} required className="campo">{opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
    </div>
  );
}
