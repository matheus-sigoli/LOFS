"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { caminhoSeguro } from "@/lib/caminho";
import { dentroDoLimite, ipDoVisitante } from "@/lib/limite";

export type EstadoEntrar = { status: "inicio" | "enviado" | "erro"; mensagem?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  proximo: z.string().max(300).optional(),
});

export async function enviarLink(_: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const dados = schema.safeParse({ email: form.get("email"), proximo: form.get("proximo") ?? undefined });
  if (!dados.success) return { status: "erro", mensagem: "Digite um e-mail válido, como nome@exemplo.com." };

  const ip = await ipDoVisitante();
  const [porIp, porEmail] = await Promise.all([
    dentroDoLimite(`login:ip:${ip}`, 10, 15 * 60),
    dentroDoLimite(`login:email:${dados.data.email}`, 3, 15 * 60),
  ]);
  if (!porIp || !porEmail) {
    return { status: "erro", mensagem: "Muitas tentativas. Espere 15 minutos e tente de novo." };
  }

  const proximo = caminhoSeguro(dados.data.proximo, "/minha-conta");
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email: dados.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirmar?proximo=${encodeURIComponent(proximo)}`,
    },
  });
  if (error) {
    console.error("[entrar]", error.message);
    return { status: "erro", mensagem: "Não conseguimos enviar o link agora. Tente de novo em alguns minutos." };
  }
  // Mesma resposta exista ou não a conta (não revela quem está cadastrado).
  return { status: "enviado", email: dados.data.email };
}

export async function sair() {
  const sb = await supabaseServer();
  await sb.auth.signOut({ scope: "local" });
  redirect("/");
}
