"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin, exigirPainel } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { codigoDoBanco, voltar } from "@/lib/painel";

const uuid = z.string().uuid();

export async function alterarStatus(form: FormData) {
  await exigirPainel();
  const d = z.object({ id: uuid, status: z.enum(["agendada", "ao_vivo", "encerrada", "adiada", "cancelada"]) })
    .safeParse({ id: form.get("id"), status: form.get("status") });
  if (!d.success) voltar("/painel/partidas", { erro: "invalido" });
  const caminho = `/painel/partidas/${d.data.id}`;
  const sb = await supabaseServer();
  const { error } = await sb.rpc("alterar_status_partida", { p_partida: d.data.id, p_status: d.data.status });
  if (error) voltar(caminho, { erro: codigoDoBanco(error) });
  revalidatePath(`/jogos/${d.data.id}`);
  voltar(caminho, { ok: "status" });
}

const eventoSchema = z.object({
  partida_id: uuid,
  inscricao_id: uuid,
  tipo: z.enum(["gol", "gol_contra", "amarelo", "vermelho", "penalti_convertido", "penalti_perdido"]),
  atleta_id: uuid.nullable(),
  periodo: z.coerce.number().int().min(1).max(4),
  minuto: z.coerce.number().int().min(0).max(20).nullable(),
});

export async function lancarEvento(form: FormData) {
  await exigirPainel();
  const vazio = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : v);
  const d = eventoSchema.safeParse({
    partida_id: form.get("partida_id"), inscricao_id: form.get("inscricao_id"), tipo: form.get("tipo"),
    atleta_id: vazio(form.get("atleta_id")), periodo: form.get("periodo"), minuto: vazio(form.get("minuto")),
  });
  const pid = String(form.get("partida_id") ?? "");
  const caminho = uuid.safeParse(pid).success ? `/painel/partidas/${pid}` : "/painel/partidas";
  if (!d.success) voltar(caminho, { erro: "invalido" });
  const penalti = d.data.tipo.startsWith("penalti");
  // Pênaltis da disputa ficam no período 4 (regra do banco)
  const periodo = penalti ? 4 : d.data.periodo === 4 ? 2 : d.data.periodo;

  const sb = await supabaseServer();
  const { error } = await sb.from("evento_partida").insert({
    partida_id: d.data.partida_id, inscricao_id: d.data.inscricao_id, tipo: d.data.tipo,
    atleta_id: d.data.atleta_id, periodo, minuto: penalti ? null : d.data.minuto,
  });
  if (error) voltar(caminho, { erro: codigoDoBanco(error) });
  revalidatePath(`/jogos/${d.data.partida_id}`);
  voltar(caminho, { ok: "evento" });
}

export async function removerEvento(form: FormData) {
  await exigirPainel();
  const d = z.object({ id: uuid, partida_id: uuid }).safeParse({ id: form.get("id"), partida_id: form.get("partida_id") });
  if (!d.success) voltar("/painel/partidas", { erro: "invalido" });
  const caminho = `/painel/partidas/${d.data.partida_id}`;
  const sb = await supabaseServer();
  const { error, count } = await sb.from("evento_partida").delete({ count: "exact" }).eq("id", d.data.id).eq("partida_id", d.data.partida_id);
  if (error || count === 0) voltar(caminho, { erro: error ? codigoDoBanco(error) : "permissao" });
  revalidatePath(`/jogos/${d.data.partida_id}`);
  voltar(caminho, { ok: "removido" });
}

export async function atualizarPartida(form: FormData) {
  await exigirAdmin();
  const vazio = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : v);
  const d = z.object({
    id: uuid,
    data_hora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    local_id: uuid.nullable(),
    mesario_id: uuid.nullable(),
  }).safeParse({
    id: form.get("id"), data_hora: vazio(form.get("data_hora")),
    local_id: vazio(form.get("local_id")), mesario_id: vazio(form.get("mesario_id")),
  });
  if (!d.success) voltar("/painel/partidas", { erro: "invalido" });
  const caminho = `/painel/partidas/${d.data.id}`;
  const sb = await supabaseServer();
  const { error } = await sb.from("partida").update({
    // datetime-local vem no horário de Osasco
    data_hora: d.data.data_hora ? new Date(`${d.data.data_hora}:00-03:00`).toISOString() : null,
    local_id: d.data.local_id,
    mesario_id: d.data.mesario_id,
  }).eq("id", d.data.id);
  if (error) voltar(caminho, { erro: codigoDoBanco(error) });
  revalidatePath(`/jogos/${d.data.id}`);
  voltar(caminho, { ok: "salvo" });
}
