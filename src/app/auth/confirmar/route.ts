import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { caminhoSeguro } from "@/lib/caminho";

const TIPOS: EmailOtpType[] = ["magiclink", "email", "signup"];

/** Retorno do link mágico: troca o código/token por sessão e redireciona só para caminhos internos. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const proximo = caminhoSeguro(url.searchParams.get("proximo"), "/minha-conta");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const sb = await supabaseServer();
  let ok = false;
  if (code && code.length < 200) {
    ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && tokenHash.length < 200 && tipo && TIPOS.includes(tipo)) {
    ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type: tipo })).error;
  }

  const destino = new URL(ok ? proximo : "/entrar?erro=link", url.origin);
  return NextResponse.redirect(destino);
}
