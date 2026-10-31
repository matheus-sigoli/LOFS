"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { codigoDoBanco, voltar } from "@/lib/painel";
import { slugificar } from "@/lib/slug";

const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const schema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(80),
  nome_curto: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,4}$/),
  bairro: z.string().trim().max(80).optional(),
  fundacao: z.coerce.number().int().min(1900).max(2100).optional(),
  cor_primaria: cor,
  cor_secundaria: cor,
});

export async function salvarEquipe(form: FormData) {
  await exigirAdmin();
  const bruto = Object.fromEntries([...form.entries()].filter(([, v]) => v !== ""));
  const d = schema.safeParse(bruto);
  if (!d.success) voltar("/painel/equipes", { erro: "invalido" });
  const { id, ...campos } = d.data;
  const sb = await supabaseServer();
  const { error } = id
    ? await sb.from("equipe").update(campos).eq("id", id)
    : await sb.from("equipe").insert({ ...campos, slug: slugificar(campos.nome) });
  if (error) voltar("/painel/equipes", { erro: codigoDoBanco(error) });
  revalidatePath("/equipes");
  voltar("/painel/equipes", { ok: id ? "salvo" : "criado" });
}
