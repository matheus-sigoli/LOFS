"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { dentroDoLimite } from "@/lib/limite";

export type EstadoMfa =
  | { etapa: "inicio"; erro?: string }
  | { etapa: "verificar"; fatorId: string; qr?: string; segredo?: string; erro?: string };

export async function iniciarMfa(): Promise<EstadoMfa> {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/entrar?proximo=/painel/seguranca");

  // Remove tentativas anteriores não concluídas
  const { data: fatores } = await sb.auth.mfa.listFactors();
  for (const f of fatores?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `LOFS ${Date.now()}` });
  if (error || !data) return { etapa: "inicio", erro: "Não foi possível iniciar a ativação. Tente de novo." };
  return { etapa: "verificar", fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

const schema = z.object({ fatorId: z.string().uuid(), codigo: z.string().regex(/^\d{6}$/) });

export async function verificarMfa(estado: EstadoMfa, form: FormData): Promise<EstadoMfa> {
  if (estado.etapa !== "verificar") return estado;
  const dados = schema.safeParse({ fatorId: estado.fatorId, codigo: String(form.get("codigo") ?? "").replace(/\s/g, "") });
  if (!dados.success) return { ...estado, erro: "Digite os 6 números que aparecem no aplicativo." };

  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/entrar?proximo=/painel/seguranca");
  if (!(await dentroDoLimite(`mfa:${u.user.id}`, 5, 5 * 60))) {
    return { ...estado, erro: "Muitas tentativas. Espere 5 minutos." };
  }
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: dados.data.fatorId, code: dados.data.codigo });
  if (error) return { ...estado, erro: "Código incorreto ou expirado. Use o código atual do aplicativo." };
  redirect("/painel?ok=mfa");
}
