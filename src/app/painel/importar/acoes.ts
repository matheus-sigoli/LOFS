"use server";

import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { voltar } from "@/lib/painel";
import { dentroDoLimite } from "@/lib/limite";
import { validarUrlImportacao } from "@/lib/url-segura";
import { extracaoSchema, extrairPagina, FirecrawlIndisponivel } from "@/lib/firecrawl";
import { slugificar } from "@/lib/slug";

const base = "/painel/importar";

export async function importarUrl(form: FormData) {
  const sessao = await exigirAdmin();
  const v = validarUrlImportacao(String(form.get("url") ?? ""));
  if (!v.ok) voltar(base, { erro: "url" });
  if (!(await dentroDoLimite(`importar:${sessao.userId}`, 5, 10 * 60))) voltar(base, { erro: "limite" });

  const sb = await supabaseServer();
  const { data: reg, error } = await sb.from("importacao").insert({ url: v.url, criado_por: sessao.userId }).select("id").single();
  if (error || !reg) voltar(base, { erro: "banco" });

  try {
    const dados = await extrairPagina(v.url);
    await sb.from("importacao").update({ status: "extraida", dados }).eq("id", reg.id);
  } catch (e) {
    const semChave = e instanceof FirecrawlIndisponivel;
    console.error("[importar]", e instanceof Error ? e.message : e);
    await sb.from("importacao").update({ status: "erro", erro: semChave ? "Chave do Firecrawl ausente" : "Falha na extração" }).eq("id", reg.id);
    voltar(`${base}?id=${reg.id}`, { erro: semChave ? "semchave" : "firecrawl" });
  }
  voltar(`${base}?id=${reg.id}`, { ok: "importado" });
}

/** Cria as equipes marcadas. Lê os dados do banco (staging), nunca do formulário. */
export async function aplicarEquipes(form: FormData) {
  const sessao = await exigirAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) voltar(base, { erro: "invalido" });
  const indices = form.getAll("equipe").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 100);
  const sb = await supabaseServer();
  const { data: imp } = await sb.from("importacao").select("dados, status").eq("id", id.data).single();
  if (!imp || imp.status !== "extraida") voltar(base, { erro: "invalido" });
  const dados = extracaoSchema.parse(imp.dados);

  const novas = indices.flatMap((i) => (dados.equipes[i] ? [dados.equipes[i]] : [])).map((e) => {
    const sigla = e.nome.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3).padEnd(2, "X");
    return { nome: e.nome, nome_curto: sigla, slug: slugificar(e.nome), bairro: e.bairro ?? null };
  }).filter((e) => e.slug.length > 0);

  if (novas.length) {
    const { error } = await sb.from("equipe").upsert(novas, { onConflict: "slug", ignoreDuplicates: true });
    if (error) voltar(`${base}?id=${id.data}`, { erro: "banco" });
  }
  await sb.from("importacao").update({ status: "aplicada", revisado_por: sessao.userId, revisado_em: new Date().toISOString() }).eq("id", id.data);
  voltar(`${base}?id=${id.data}`, { ok: "aplicado" });
}

export async function descartarImportacao(form: FormData) {
  const sessao = await exigirAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) voltar(base, { erro: "invalido" });
  const sb = await supabaseServer();
  await sb.from("importacao").update({ status: "descartada", revisado_por: sessao.userId, revisado_em: new Date().toISOString() }).eq("id", id.data);
  voltar(base, { ok: "removido" });
}
