import { exigirPainel } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { FormMfa } from "./FormMfa";

export const metadata = { title: "Segurança" };

export default async function Seguranca() {
  const sessao = await exigirPainel();
  const sb = await supabaseServer();
  const { data } = await sb.auth.mfa.listFactors();
  const verificado = data?.totp.find((f) => f.status === "verified");

  return (
    <div className="max-w-prose">
      <h1 className="titulo-pagina">Segurança</h1>
      {sessao.aal === "aal2" ? (
        <p className="mt-6 rounded-lg bg-verde-suave px-4 py-3 font-semibold text-verde">Verificação em duas etapas ativa nesta sessão.</p>
      ) : (
        <>
          <p className="mt-4 text-texto-2">
            {sessao.papeis.includes("admin")
              ? "Administradores precisam confirmar um código do aplicativo autenticador antes de editar qualquer dado da liga."
              : "Recomendado: proteja sua conta com um código do aplicativo autenticador."}
          </p>
          <div className="mt-8"><FormMfa fatorVerificado={verificado?.id} /></div>
        </>
      )}
    </div>
  );
}
