import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { StatusPartida } from "@/components/Partidas";
import { Vazio } from "@/components/Vazio";
import { exigirPainel } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";
import type { PartidaResumo } from "@/lib/tipos";

export const metadata = { title: "Partidas" };

const SEL = `id, data_hora, status, gols_mandante, gols_visitante, penaltis_mandante, penaltis_visitante, rodada, chave,
  grupo:grupo(nome), local:local(nome, slug),
  fase:fase!inner(nome, tipo, campeonato:campeonato(slug, titulo:titulo(nome), serie:serie(nome), categoria:categoria(nome))),
  mandante:inscricao!partida_mandante_id_fkey(id, equipe:equipe(nome, nome_curto, slug, cor_primaria, cor_secundaria)),
  visitante:inscricao!partida_visitante_id_fkey(id, equipe:equipe(nome, nome_curto, slug, cor_primaria, cor_secundaria))`;

export default async function PainelPartidas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sessao = await exigirPainel();
  const b = await searchParams;
  const admin = sessao.papeis.includes("admin");
  const sb = await supabaseServer();
  let q = sb.from("partida").select(SEL).in("status", ["agendada", "ao_vivo", "adiada"]);
  if (admin) {
    const ate = new Date(Date.now() + 8 * 864e5).toISOString();
    const desde = new Date(Date.now() - 864e5).toISOString();
    q = q.gte("data_hora", desde).lte("data_hora", ate);
  } else {
    q = q.eq("mesario_id", sessao.userId);
  }
  const { data } = await q.order("data_hora").limit(80);
  const partidas = (data ?? []) as unknown as PartidaResumo[];

  return (
    <div>
      <Aviso ok={b.ok} erro={b.erro} />
      <h1 className="titulo-pagina">{admin ? "Partidas" : "Minhas súmulas"}</h1>
      <p className="mt-2 text-texto-2">{admin ? "Jogos de ontem até os próximos 7 dias." : "Jogos atribuídos a você que ainda não terminaram."}</p>
      <div className="mt-6">
        {partidas.length === 0 ? (
          <Vazio titulo="Nada por aqui">{admin ? "Nenhum jogo nesse período." : "Quando um administrador atribuir uma partida a você, ela aparece aqui."}</Vazio>
        ) : (
          <table className="tabela">
            <caption className="sr-only">Partidas</caption>
            <thead>
              <tr>
                <th scope="col" className="esq">Quando</th>
                <th scope="col" className="esq">Jogo</th>
                <th scope="col" className="esq hidden md:table-cell">Campeonato</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p) => (
                <tr key={p.id}>
                  <td className="esq text-texto-2">{p.data_hora ? `${fmt.dataCurta(p.data_hora)} ${fmt.hora(p.data_hora)}` : "—"}</td>
                  <td className="esq">
                    <Link href={`/painel/partidas/${p.id}`} className="font-semibold underline-offset-4 hover:underline">
                      {p.mandante.equipe.nome_curto} {p.status === "agendada" ? "×" : `${p.gols_mandante}–${p.gols_visitante}`} {p.visitante.equipe.nome_curto}
                    </Link>
                  </td>
                  <td className="esq hidden text-texto-3 md:table-cell">{p.fase.campeonato.categoria.nome} · {p.fase.campeonato.serie.nome}</td>
                  <td><StatusPartida p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
