"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { codigoDoBanco, voltar } from "@/lib/painel";
import { slugificar } from "@/lib/slug";
import { prepararFoto } from "@/lib/imagem";

const uuid = z.string().uuid();
const vazio = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : v);
const pagina = (id: string) => `/painel/atletas/${id}`;

const dadosPublicos = z.object({
  nome_esportivo: z.string().trim().min(2).max(40),
  nome_completo: z.string().trim().min(3).max(120),
  ano_nascimento: z.coerce.number().int().min(1940).max(new Date().getFullYear()).optional(),
  posicao: z.enum(["goleiro", "fixo", "ala", "pivo"]).optional(),
});

function lerPublicos(form: FormData) {
  return dadosPublicos.safeParse({
    nome_esportivo: form.get("nome_esportivo"), nome_completo: form.get("nome_completo"),
    ano_nascimento: vazio(form.get("ano_nascimento")), posicao: vazio(form.get("posicao")),
  });
}

export async function criarAtleta(form: FormData) {
  await exigirAdmin();
  const d = lerPublicos(form);
  if (!d.success) voltar("/painel/atletas", { erro: "invalido" });
  const id = crypto.randomUUID();
  const sb = await supabaseServer();
  const { error } = await sb.from("atleta").insert({ id, ...d.data, slug: `${slugificar(d.data.nome_completo)}-${id.slice(0, 4)}` });
  if (error) voltar("/painel/atletas", { erro: codigoDoBanco(error) });
  voltar(pagina(id), { ok: "criado" });
}

export async function salvarAtleta(form: FormData) {
  await exigirAdmin();
  const id = uuid.safeParse(form.get("id"));
  const d = lerPublicos(form);
  if (!id.success || !d.success) voltar("/painel/atletas", { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.from("atleta").update({ ano_nascimento: null, posicao: null, ...d.data }).eq("id", id.data);
  if (error) voltar(pagina(id.data), { erro: codigoDoBanco(error) });
  voltar(pagina(id.data), { ok: "salvo" });
}

export async function salvarPrivado(form: FormData) {
  await exigirAdmin();
  const d = z.object({
    atleta_id: uuid,
    data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    documento: z.string().trim().max(30).optional(),
    responsavel_nome: z.string().trim().max(120).optional(),
    responsavel_contato: z.string().trim().max(120).optional(),
  }).safeParse({
    atleta_id: form.get("atleta_id"), data_nascimento: vazio(form.get("data_nascimento")), documento: vazio(form.get("documento")),
    responsavel_nome: vazio(form.get("responsavel_nome")), responsavel_contato: vazio(form.get("responsavel_contato")),
  });
  if (!d.success) voltar("/painel/atletas", { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.from("atleta_privado").upsert({
    data_nascimento: null, documento: null, responsavel_nome: null, responsavel_contato: null, ...d.data,
  });
  if (error) voltar(pagina(d.data.atleta_id), { erro: codigoDoBanco(error) });
  voltar(pagina(d.data.atleta_id), { ok: "salvo" });
}

export async function registrarConsentimento(form: FormData) {
  const sessao = await exigirAdmin();
  const d = z.object({
    atleta_id: uuid,
    responsavel_nome: z.string().trim().min(3).max(120),
    termo_versao: z.string().trim().min(1).max(20),
    confirmo: z.literal("on"),
  }).safeParse({
    atleta_id: form.get("atleta_id"), responsavel_nome: form.get("responsavel_nome"),
    termo_versao: form.get("termo_versao"), confirmo: form.get("confirmo"),
  });
  if (!d.success) {
    const aid = uuid.safeParse(form.get("atleta_id"));
    voltar(aid.success ? pagina(aid.data) : "/painel/atletas", { erro: "invalido" });
  }
  const sb = await supabaseServer();
  const { error } = await sb.from("consentimento").insert({
    atleta_id: d.data.atleta_id, responsavel_nome: d.data.responsavel_nome,
    termo_versao: d.data.termo_versao, registrado_por: sessao.userId,
  });
  if (error) voltar(pagina(d.data.atleta_id), { erro: codigoDoBanco(error) });
  revalidatePath("/atletas", "layout");
  voltar(pagina(d.data.atleta_id), { ok: "salvo" });
}

export async function revogarConsentimento(form: FormData) {
  await exigirAdmin();
  const d = z.object({ id: uuid, atleta_id: uuid }).safeParse({ id: form.get("id"), atleta_id: form.get("atleta_id") });
  if (!d.success) voltar("/painel/atletas", { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.from("consentimento").update({ revogado_em: new Date().toISOString() }).eq("id", d.data.id).eq("atleta_id", d.data.atleta_id);
  if (error) voltar(pagina(d.data.atleta_id), { erro: codigoDoBanco(error) });
  // Revogado: remove a foto do armazenamento também
  const { data: a } = await sb.from("atleta").select("foto_path").eq("id", d.data.atleta_id).single();
  if (a?.foto_path) {
    await sb.storage.from("fotos").remove([a.foto_path]);
    await sb.from("atleta").update({ foto_path: null }).eq("id", d.data.atleta_id);
  }
  revalidatePath("/atletas", "layout");
  voltar(pagina(d.data.atleta_id), { ok: "salvo" });
}

export async function enviarFoto(form: FormData) {
  await exigirAdmin();
  const id = uuid.safeParse(form.get("atleta_id"));
  const arquivo = form.get("foto");
  if (!id.success || !(arquivo instanceof File)) voltar("/painel/atletas", { erro: "invalido" });
  const sb = await supabaseServer();
  const { data: c } = await sb.from("consentimento").select("id").eq("atleta_id", id.data).is("revogado_em", null).limit(1);
  if (!c?.length) voltar(pagina(id.data), { erro: "permissao" }); // sem consentimento, sem foto

  const r = prepararFoto(new Uint8Array(await arquivo.arrayBuffer()));
  if (!r.ok) voltar(pagina(id.data), { erro: "invalido" });
  const caminho = `atletas/${id.data}.${r.formato.ext}`; // nome gerado: nada do nome original
  const { data: atual } = await sb.from("atleta").select("foto_path").eq("id", id.data).single();
  if (atual?.foto_path && atual.foto_path !== caminho) await sb.storage.from("fotos").remove([atual.foto_path]);
  const { error } = await sb.storage.from("fotos").upload(caminho, r.bytes, { contentType: r.formato.mime, upsert: true });
  if (error) voltar(pagina(id.data), { erro: "banco" });
  await sb.from("atleta").update({ foto_path: caminho }).eq("id", id.data);
  revalidatePath("/atletas", "layout");
  voltar(pagina(id.data), { ok: "salvo" });
}

export async function inscreverAtleta(form: FormData) {
  await exigirAdmin();
  const d = z.object({ atleta_id: uuid, inscricao_id: uuid, numero: z.coerce.number().int().min(1).max(99) })
    .safeParse({ atleta_id: form.get("atleta_id"), inscricao_id: form.get("inscricao_id"), numero: form.get("numero") });
  if (!d.success) voltar("/painel/atletas", { erro: "invalido" });
  const sb = await supabaseServer();
  const { error } = await sb.from("inscricao_atleta").insert(d.data);
  if (error) voltar(pagina(d.data.atleta_id), { erro: codigoDoBanco(error) });
  voltar(pagina(d.data.atleta_id), { ok: "criado" });
}
