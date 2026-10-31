"use client";

import { useActionState } from "react";
import { iniciarMfa, verificarMfa, type EstadoMfa } from "./acoes";

async function acao(estado: EstadoMfa, form: FormData): Promise<EstadoMfa> {
  return form.get("passo") === "iniciar" ? iniciarMfa() : verificarMfa(estado, form);
}

export function FormMfa({ fatorVerificado }: { fatorVerificado?: string }) {
  const inicial: EstadoMfa = fatorVerificado ? { etapa: "verificar", fatorId: fatorVerificado } : { etapa: "inicio" };
  const [estado, enviar, pendente] = useActionState(acao, inicial);

  if (estado.etapa === "inicio") {
    return (
      <form action={enviar}>
        <input type="hidden" name="passo" value="iniciar" />
        {estado.erro ? <p role="alert" className="mb-3 text-sm font-semibold text-vermelho">{estado.erro}</p> : null}
        <button type="submit" disabled={pendente} className="botao botao-primario">{pendente ? "Preparando…" : "Ativar verificação em duas etapas"}</button>
      </form>
    );
  }

  return (
    <form action={enviar} className="max-w-sm space-y-4">
      <input type="hidden" name="passo" value="verificar" />
      {estado.qr ? (
        <div className="space-y-3">
          <p className="text-texto-2">1. Escaneie com um aplicativo autenticador (Google Authenticator, 1Password, Aegis…).</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL gerado pelo Supabase */}
          <img src={estado.qr} alt="QR code para o aplicativo autenticador" width={180} height={180} className="rounded-lg bg-white p-2" />
          <details className="text-sm text-texto-3">
            <summary className="cursor-pointer">Não consegue escanear?</summary>
            <p className="mt-1">Digite esta chave no aplicativo: <code className="break-all text-texto">{estado.segredo}</code></p>
          </details>
          <p className="text-texto-2">2. Digite o código de 6 números.</p>
        </div>
      ) : (
        <p className="text-texto-2">Digite o código de 6 números do seu aplicativo autenticador para liberar a edição.</p>
      )}
      <div>
        <label htmlFor="codigo" className="rotulo">Código</label>
        <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} pattern="\d{6}" maxLength={6} required
          aria-invalid={Boolean(estado.erro)} className="campo w-40 text-center font-display text-2xl tracking-[0.3em]" />
      </div>
      {estado.erro ? <p role="alert" className="text-sm font-semibold text-vermelho">{estado.erro}</p> : null}
      <button type="submit" disabled={pendente} className="botao botao-primario">{pendente ? "Verificando…" : "Confirmar código"}</button>
    </form>
  );
}
