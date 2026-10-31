import Link from "next/link";
import { ListaPartidas } from "@/components/Partidas";
import { obterSessao } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { partidasAoVivo } from "@/lib/consultas";

export default async function PainelInicio() {
  const sessao = (await obterSessao())!;
  const sb = await supabaseServer();
  const admin = sessao.papeis.includes("admin");
  const [aoVivo, minhas] = await Promise.all([
    partidasAoVivo(),
    sb.from("partida").select("id", { count: "exact", head: true }).eq("mesario_id", sessao.userId).in("status", ["agendada", "ao_vivo"]),
  ]);
  return (
    <div>
      <h1 className="titulo-pagina">Painel</h1>
      <p className="mt-2 text-texto-2">{sessao.email}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/painel/partidas" className="rounded-xl bg-superficie p-5 ring-1 ring-linha hover:ring-linha-forte">
          <p className="numero-placar text-5xl">{minhas.count ?? 0}</p>
          <p className="mt-1 text-texto-2">súmulas atribuídas a você</p>
        </Link>
        <div className="rounded-xl bg-superficie p-5 ring-1 ring-linha">
          <p className="numero-placar text-5xl text-vermelho">{aoVivo.length}</p>
          <p className="mt-1 text-texto-2">jogos ao vivo agora</p>
        </div>
      </div>
      {aoVivo.length ? (
        <section className="mt-10">
          <h2 className="titulo-secao mb-2">Ao vivo</h2>
          <ListaPartidas partidas={aoVivo} />
          {admin ? <p className="mt-2 text-sm text-texto-3">Para lançar lances, abra a partida em <Link className="underline" href="/painel/partidas">Partidas e súmulas</Link>.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
