import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

// Extração estruturada de uma página pública (POST /v2/scrape com formato JSON).
// O conteúdo vindo de fora é tratado como NÃO CONFIÁVEL: validado e truncado aqui,
// salvo em staging (tabela importacao) e só vira dado da liga após revisão do admin.

const texto = (max: number) => z.string().trim().max(500).transform((s) => s.slice(0, max));

export const extracaoSchema = z.object({
  equipes: z.array(z.object({ nome: texto(80), bairro: texto(80).optional().nullable() })).max(100).default([]),
  partidas: z.array(z.object({
    data: texto(40).optional().nullable(),
    mandante: texto(80),
    visitante: texto(80),
    gols_mandante: z.number().int().min(0).max(99).optional().nullable(),
    gols_visitante: z.number().int().min(0).max(99).optional().nullable(),
    local: texto(120).optional().nullable(),
  })).max(200).default([]),
});
export type Extracao = z.infer<typeof extracaoSchema>;

const jsonSchema = {
  type: "object",
  properties: {
    equipes: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, bairro: { type: "string" } }, required: ["nome"] } },
    partidas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          data: { type: "string" }, mandante: { type: "string" }, visitante: { type: "string" },
          gols_mandante: { type: "integer" }, gols_visitante: { type: "integer" }, local: { type: "string" },
        },
        required: ["mandante", "visitante"],
      },
    },
  },
};

export class FirecrawlIndisponivel extends Error {}

export async function extrairPagina(url: string): Promise<Extracao> {
  const chave = serverEnv().FIRECRAWL_API_KEY;
  if (!chave) throw new FirecrawlIndisponivel("sem chave");

  const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      timeout: 45_000,
      formats: [{
        type: "json",
        prompt: "Extraia as equipes e as partidas de futsal listadas na página (tabelas de jogos ou classificação). Não invente dados ausentes.",
        schema: jsonSchema,
      }],
    }),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Firecrawl HTTP ${resp.status}`);
  const corpo = (await resp.json()) as { success?: boolean; data?: { json?: unknown } };
  if (!corpo.success) throw new Error("Firecrawl sem sucesso");
  return extracaoSchema.parse(corpo.data?.json ?? {});
}
