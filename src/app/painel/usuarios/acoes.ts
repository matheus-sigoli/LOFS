"use server";

import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { codigoDoBanco, voltar } from "@/lib/painel";

const base = "/painel/usuarios";

export async function concederPapel(form: FormData) {
  await exigirAdmin();
  const d = z.object({ email: z.string().trim().toLowerCase().email().max(254), papel: z.enum(["admin", "mesario"]) })
    .safeParse({ email: form.get("email"), papel: form.get("papel") });
  if (!d.success) voltar(base, { erro: "invalido" });
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("conceder_papel", { p_email: d.data.email, p_papel: d.data.papel });
  if (error) voltar(base, { erro: codigoDoBanco(error) });
  if (!data) voltar(base, { erro: "usuario" });
  voltar(base, { ok: "papel" });
}

export async function revogarPapel(form: FormData) {
  const sessao = await exigirAdmin();
  const d = z.object({ user_id: z.string().uuid(), papel: z.enum(["admin", "mesario"]) })
    .safeParse({ user_id: form.get("user_id"), papel: form.get("papel") });
  if (!d.success || d.data.user_id === sessao.userId) voltar(base, { erro: "permissao" });
  const sb = await supabaseServer();
  const { error } = await sb.from("papel").delete().eq("user_id", d.data.user_id).eq("papel", d.data.papel);
  if (error) voltar(base, { erro: codigoDoBanco(error) });
  voltar(base, { ok: "removido" });
}
