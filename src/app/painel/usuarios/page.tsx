import { Aviso } from "@/components/Aviso";
import { Confirmar } from "@/components/Confirmar";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { concederPapel, revogarPapel } from "./acoes";

export const metadata = { title: "Usuários" };

const ROTULO = { admin: "Administrador", mesario: "Mesário" } as const;

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sessao = await exigirAdmin();
  const b = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("usuarios_painel");
  const usuarios = (data ?? []) as { user_id: string; email: string; papeis: ("admin" | "mesario")[] }[];

  return (
    <div className="max-w-3xl">
      <Aviso ok={b.ok} erro={b.erro} />
      <h1 className="titulo-pagina">Usuários do painel</h1>
      <p className="mt-3 text-texto-2">Mesários lançam súmulas só das partidas atribuídas a eles. Administradores gerenciam tudo e precisam de verificação em duas etapas.</p>

      <form action={concederPapel} className="mt-6 grid gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div><label htmlFor="email" className="rotulo">E-mail da pessoa</label><input id="email" name="email" type="email" required autoComplete="off" spellCheck={false} className="campo" /></div>
        <div>
          <label htmlFor="papel" className="rotulo">Acesso</label>
          <select id="papel" name="papel" className="campo"><option value="mesario">Mesário</option><option value="admin">Administrador</option></select>
        </div>
        <button type="submit" className="botao botao-primario">Conceder</button>
      </form>
      <p className="mt-2 text-sm text-texto-3">A pessoa precisa ter entrado no site pelo menos uma vez.</p>

      <table className="tabela mt-8">
        <caption className="sr-only">Usuários com acesso ao painel</caption>
        <thead><tr><th className="esq" scope="col">E-mail</th><th className="esq" scope="col">Acessos</th></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.user_id}>
              <td className="esq">{u.email}{u.user_id === sessao.userId ? <span className="text-texto-3"> (você)</span> : null}</td>
              <td className="esq">
                <div className="flex flex-wrap gap-2">
                  {u.papeis.map((p) => (
                    <span key={p} className="inline-flex items-center gap-3 rounded-full bg-superficie-2 px-3 py-1 text-sm">
                      {ROTULO[p]}
                      {u.user_id !== sessao.userId ? (
                        <Confirmar acao={revogarPapel} compacto rotulo="Remover" pergunta={`Remover o acesso de ${ROTULO[p]} de ${u.email}?`} confirmar="Remover acesso" campos={{ user_id: u.user_id, papel: p }} />
                      ) : null}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
