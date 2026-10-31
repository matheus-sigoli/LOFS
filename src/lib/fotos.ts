import "server-only";
import { supabaseServico } from "@/lib/supabase/server";

/**
 * URL assinada (10 min) da foto de um atleta. Só é chamada com um foto_path vindo de
 * atleta_publico — a view só devolve o caminho quando há consentimento ativo (ADR 0004).
 */
export async function urlFotoAtleta(fotoPath: string | null) {
  if (!fotoPath || !/^atletas\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(fotoPath)) return null;
  const { data } = await supabaseServico().storage.from("fotos").createSignedUrl(fotoPath, 600);
  return data?.signedUrl ?? null;
}
