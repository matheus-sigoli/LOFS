import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";

export const metadata = { title: "Auditoria" };

const ACAO: Record<string, string> = { insert: "criou", update: "alterou", delete: "removeu" };

export default async function Auditoria() {
  await exigirAdmin();
  const sb = await supabaseServer();
  const [{ data }, { data: usuarios }] = await Promise.all([
    sb.from("auditoria").select("id, user_id, acao, tabela, registro_id, criado_em").order("criado_em", { ascending: false }).limit(100),
    sb.rpc("usuarios_painel"),
  ]);
  const emails = new Map(((usuarios ?? []) as { user_id: string; email: string }[]).map((u) => [u.user_id, u.email]));
  const linhas = (data ?? []) as { id: number; user_id: string | null; acao: string; tabela: string; registro_id: string | null; criado_em: string }[];
  return (
    <div>
      <h1 className="titulo-pagina">Auditoria</h1>
      <p className="mt-3 text-texto-2">As 100 alterações mais recentes. Dados pessoais restritos não são copiados para este registro.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="tabela">
          <caption className="sr-only">Registro de alterações</caption>
          <thead><tr><th className="esq" scope="col">Quando</th><th className="esq" scope="col">Quem</th><th className="esq" scope="col">O quê</th><th className="esq" scope="col">Registro</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="esq text-texto-2">{fmt.dataCurta(l.criado_em)} {fmt.hora(l.criado_em)}</td>
                <td className="esq">{l.user_id ? emails.get(l.user_id) ?? "Usuário sem acesso atual" : "Sistema"}</td>
                <td className="esq">{ACAO[l.acao] ?? l.acao} {l.tabela.replace("_", " ")}</td>
                <td className="esq font-mono text-xs text-texto-3">{l.registro_id?.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
