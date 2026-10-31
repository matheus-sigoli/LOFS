import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { rotuloPosicao } from "@/lib/format";
import { CamposPublicos } from "./CamposPublicos";
import { criarAtleta } from "./acoes";

export const metadata = { title: "Atletas" };

export default async function PainelAtletas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; q?: string }> }) {
  await exigirAdmin();
  const b = await searchParams;
  // Busca: só letras, números, espaço, hífen e ponto; curingas do LIKE escapados.
  const q = (b.q ?? "").normalize("NFC").replace(/[^\p{L}\p{N} .-]/gu, "").trim().slice(0, 60);
  const sb = await supabaseServer();
  let consulta = sb.from("atleta").select("id, nome_esportivo, nome_completo, ano_nascimento, posicao").order("nome_completo").limit(50);
  if (q) consulta = consulta.ilike("nome_completo", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data } = await consulta;
  const atletas = (data ?? []) as { id: string; nome_esportivo: string; nome_completo: string; ano_nascimento: number | null; posicao: string | null }[];

  return (
    <div>
      <Aviso ok={b.ok} erro={b.erro} />
      <h1 className="titulo-pagina">Atletas</h1>

      <form method="get" role="search" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">Buscar por nome</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Ex.: Lucas Silva…" autoComplete="off" className="campo" />
        <button type="submit" className="botao botao-secundario">Buscar</button>
      </form>

      <table className="tabela mt-6 max-w-3xl">
        <caption className="sr-only">Atletas</caption>
        <thead><tr><th className="esq" scope="col">Nome</th><th className="esq" scope="col">Apelido</th><th className="esq" scope="col">Posição</th><th scope="col">Nascimento</th></tr></thead>
        <tbody>
          {atletas.map((a) => (
            <tr key={a.id}>
              <td className="esq"><Link href={`/painel/atletas/${a.id}`} className="font-semibold hover:underline">{a.nome_completo}</Link></td>
              <td className="esq text-texto-2">{a.nome_esportivo}</td>
              <td className="esq text-texto-2">{a.posicao ? rotuloPosicao[a.posicao] : "—"}</td>
              <td>{a.ano_nascimento ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {atletas.length === 50 ? <p className="mt-2 text-sm text-texto-3">Mostrando os 50 primeiros. Refine a busca.</p> : null}

      <section className="mt-12 max-w-3xl">
        <h2 className="titulo-secao">Novo atleta</h2>
        <form action={criarAtleta} className="mt-4 grid gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-2">
          <CamposPublicos />
          <div className="sm:col-span-2"><button type="submit" className="botao botao-primario">Cadastrar</button></div>
        </form>
      </section>
    </div>
  );
}
