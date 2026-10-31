import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Papel = "admin" | "mesario";

export interface Sessao {
  userId: string;
  email: string | null;
  papeis: Papel[];
  aal: "aal1" | "aal2";
}

/** Sessão validada no servidor (getUser consulta o Auth; não confia só no cookie). */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const [{ data: papeis }, { data: aal }] = await Promise.all([
    supabase.from("papel").select("papel").eq("user_id", data.user.id),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    papeis: (papeis ?? []).map((p) => p.papel as Papel),
    aal: aal?.currentLevel === "aal2" ? "aal2" : "aal1",
  };
});

export async function exigirLogin(proximo = "/minha-conta") {
  const sessao = await obterSessao();
  if (!sessao) redirect(`/entrar?proximo=${encodeURIComponent(proximo)}`);
  return sessao;
}

/** Painel: admin ou mesário. Admin sem 2FA vai para a tela de segurança. */
export async function exigirPainel() {
  const sessao = await exigirLogin("/painel");
  if (sessao.papeis.length === 0) redirect("/");
  return sessao;
}

export async function exigirAdmin() {
  const sessao = await exigirPainel();
  if (!sessao.papeis.includes("admin")) redirect("/painel");
  if (sessao.aal !== "aal2") redirect("/painel/seguranca");
  return sessao;
}

export { caminhoSeguro } from "@/lib/caminho";
