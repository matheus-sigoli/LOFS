"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { caminhoSeguro } from "@/lib/caminho";
import { dentroDoLimite } from "@/lib/limite";

export async function definirTema(form: FormData) {
  const tema = form.get("tema") === "claro" ? "claro" : "escuro";
  (await cookies()).set("tema", tema, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

const favoritoSchema = z.object({
  tipo: z.enum(["campeonato", "equipe"]),
  id: z.string().uuid(),
  caminho: z.string().max(300),
});

/** Segue/deixa de seguir. Dono do favorito = auth.uid() garantido pelo RLS. */
export async function alternarFavorito(form: FormData) {
  const dados = favoritoSchema.safeParse({
    tipo: form.get("tipo"), id: form.get("id"), caminho: form.get("caminho"),
  });
  if (!dados.success) return;
  const { tipo, id } = dados.data;
  const caminho = caminhoSeguro(dados.data.caminho);

  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return;
  if (!(await dentroDoLimite(`favorito:${u.user.id}`, 30, 60))) return;

  const coluna = tipo === "campeonato" ? "campeonato_id" : "equipe_id";
  const { data: existente } = await sb.from("favorito").select("id").eq(coluna, id).maybeSingle();
  if (existente) {
    await sb.from("favorito").delete().eq("id", existente.id);
  } else {
    await sb.from("favorito").insert(tipo === "campeonato" ? { campeonato_id: id } : { equipe_id: id });
  }
  revalidatePath(caminho);
  revalidatePath("/minha-conta");
}
