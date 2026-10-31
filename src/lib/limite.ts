import "server-only";
import { headers } from "next/headers";
import { supabaseServico } from "@/lib/supabase/server";

/** IP do visitante (na Vercel, x-forwarded-for é definido pela plataforma). */
export async function ipDoVisitante() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/** Retorna true se ainda está dentro do limite. Falha fechada (nega) se o banco não responder. */
export async function dentroDoLimite(chave: string, max: number, janelaSegundos: number) {
  try {
    const { data, error } = await supabaseServico().rpc("consumir_limite", {
      p_chave: chave.slice(0, 200),
      p_max: max,
      p_janela_segundos: janelaSegundos,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
