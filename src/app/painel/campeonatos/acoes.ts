"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { codigoDoBanco, voltar } from "@/lib/painel";
import { slugificar } from "@/lib/slug";
import { CRITERIOS_PADRAO } from "@/lib/classificacao";

const uuid = z.string().uuid();
const vazio = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : v);
const lista = "/painel/campeonatos";
const pagina = (id: string) => `/painel/campeonatos/${id}`;

export async function criarCampeonato(form: FormData) {
  await exigirAdmin();
  const d = z.object({ titulo_id: uuid, temporada_id: uuid, serie_id: uuid, categoria_id: uuid }).safeParse(Object.fromEntries(form));
  if (!d.success) voltar(lista, { erro: "invalido" });
  const sb = await supabaseServer();
  const [t, tp, s, c] = await Promise.all([
    sb.from("titulo").select("slug").eq("id", d.data.titulo_id).single(),
    sb.from("temporada").select("ano").eq("id", d.data.temporada_id).single(),
    sb.from("serie").select("slug").eq("id", d.data.serie_id).single(),
    sb.from("categoria").select("slug").eq("id", d.data.categoria_id).single(),
  ]);
  if (!t.data || !tp.data || !s.data || !c.data) voltar(lista, { erro: "invalido" });
  const slug = slugificar(`${t.data.slug}-${s.data.slug}-${c.data.slug}-${tp.data.ano}`);
  const { data, error } = await sb.from("campeonato").insert({ ...d.data, slug, status: "rascunho" }).select("id").single();
  if (error || !data) voltar(lista, { erro: codigoDoBanco(error) });
  voltar(pagina(data.id), { ok: "criado" });
}

export async function atualizarCampeonato(form: FormData) {
  await exigirAdmin();
  const d = z.object({
    id: uuid,
    status: z.enum(["rascunho", "publicado", "encerrado"]),
    pontos_vitoria: z.coerce.number().int().min(0).max(10),
    pontos_empate: z.coerce.number().int().min(0).max(10),
    pontos_derrota: z.coerce.number().int().min(0).max(10),
  }).safeParse(Object.fromEntries(form));
  if (!d.success) voltar(lista, { erro: "invalido" });
  const criterios = form.getAll("criterios").map(String).filter((c) => (CRITERIOS_PADRAO as string[]).includes(c));
  const sb = await supabaseServer();
  const { id, ...resto } = d.data;
  const { error } = await sb.from("campeonato").update({
    ...resto,
    criterios_desempate: criterios.length ? ["pontos", ...criterios.filter((c) => c !== "pontos")] : CRITERIOS_PADRAO,
  }).eq("id", id);
  if (error) voltar(pagina(id), { erro: codigoDoBanco(error) });
  revalidatePath("/", "layout");
  voltar(pagina(id), { ok: "salvo" });
}

export async function criarFase(form: FormData) {
  await exigirAdmin();
  const d = z.object({
    campeonato_id: uuid,
    nome: z.string().trim().min(2).max(60),
    tipo: z.enum(["grupos", "mata_mata"]),
    ida_volta: z.literal("on").optional(),
    grupos: z.coerce.number().int().min(0).max(8).optional(),
  }).safeParse({ ...Object.fromEntries(form), ida_volta: form.get("ida_volta") ?? undefined });
  if (!d.success) voltar(lista, { erro: "invalido" });
  const sb = await supabaseServer();
  const { data: ultima } = await sb.from("fase").select("ordem").eq("campeonato_id", d.data.campeonato_id).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb.from("fase").insert({
    campeonato_id: d.data.campeonato_id, nome: d.data.nome, tipo: d.data.tipo,
    ida_volta: d.data.ida_volta === "on", ordem: (ultima?.ordem ?? 0) + 1,
  }).select("id").single();
  if (error || !data) voltar(pagina(d.data.campeonato_id), { erro: codigoDoBanco(error) });
  if (d.data.tipo === "grupos" && d.data.grupos) {
    const { error: e2 } = await sb.from("grupo").insert(
      Array.from({ length: d.data.grupos }, (_, i) => ({ fase_id: data.id, nome: `Grupo ${String.fromCharCode(65 + i)}` })),
    );
    if (e2) voltar(pagina(d.data.campeonato_id), { erro: codigoDoBanco(e2) });
  }
  voltar(pagina(d.data.campeonato_id), { ok: "criado" });
}

export async function inscreverEquipe(form: FormData) {
  await exigirAdmin();
  const d = z.object({ campeonato_id: uuid, equipe_id: uuid, grupo_id: uuid.nullable() })
    .safeParse({ campeonato_id: form.get("campeonato_id"), equipe_id: form.get("equipe_id"), grupo_id: vazio(form.get("grupo_id")) });
  if (!d.success) voltar(lista, { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.from("inscricao").insert(d.data);
  if (error) voltar(pagina(d.data.campeonato_id), { erro: codigoDoBanco(error) });
  voltar(pagina(d.data.campeonato_id), { ok: "criado" });
}

export async function atualizarInscricao(form: FormData) {
  await exigirAdmin();
  const d = z.object({
    id: uuid, campeonato_id: uuid, grupo_id: uuid.nullable(),
    colocacao_final: z.coerce.number().int().min(1).max(64).nullable(),
  }).safeParse({
    id: form.get("id"), campeonato_id: form.get("campeonato_id"),
    grupo_id: vazio(form.get("grupo_id")), colocacao_final: vazio(form.get("colocacao_final")),
  });
  if (!d.success) voltar(lista, { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.from("inscricao").update({ grupo_id: d.data.grupo_id, colocacao_final: d.data.colocacao_final })
    .eq("id", d.data.id).eq("campeonato_id", d.data.campeonato_id);
  if (error) voltar(pagina(d.data.campeonato_id), { erro: codigoDoBanco(error) });
  revalidatePath("/ranking");
  voltar(pagina(d.data.campeonato_id), { ok: "salvo" });
}

export async function gerarTabela(form: FormData) {
  await exigirAdmin();
  const d = z.object({
    campeonato_id: uuid, grupo_id: uuid,
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    local_id: uuid.nullable(),
  }).safeParse({ campeonato_id: form.get("campeonato_id"), grupo_id: form.get("grupo_id"), inicio: form.get("inicio"), local_id: vazio(form.get("local_id")) });
  if (!d.success) voltar(lista, { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.rpc("gerar_tabela_grupo", {
    p_grupo: d.data.grupo_id, p_inicio: new Date(`${d.data.inicio}:00-03:00`).toISOString(), p_local: d.data.local_id,
  });
  if (error) voltar(pagina(d.data.campeonato_id), { erro: codigoDoBanco(error) });
  voltar(pagina(d.data.campeonato_id), { ok: "tabela" });
}

export async function criarPartidaMataMata(form: FormData) {
  await exigirAdmin();
  const d = z.object({
    campeonato_id: uuid, fase_id: uuid, chave: z.string().trim().min(2).max(30),
    mandante_id: uuid, visitante_id: uuid,
    data_hora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(), local_id: uuid.nullable(),
  }).safeParse({
    campeonato_id: form.get("campeonato_id"), fase_id: form.get("fase_id"), chave: form.get("chave"),
    mandante_id: form.get("mandante_id"), visitante_id: form.get("visitante_id"),
    data_hora: vazio(form.get("data_hora")), local_id: vazio(form.get("local_id")),
  });
  if (!d.success || d.data.mandante_id === d.data.visitante_id) voltar(lista, { erro: "invalido" });
  const sb = await supabaseServer();
  const { campeonato_id, data_hora, ...resto } = d.data;
  const { error } = await sb.from("partida").insert({
    ...resto, data_hora: data_hora ? new Date(`${data_hora}:00-03:00`).toISOString() : null,
  });
  if (error) voltar(pagina(campeonato_id), { erro: codigoDoBanco(error) });
  voltar(pagina(campeonato_id), { ok: "criado" });
}
