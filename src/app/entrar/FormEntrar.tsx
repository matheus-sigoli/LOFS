"use client";

import { useActionState } from "react";
import { enviarLink, type EstadoEntrar } from "./acoes";

export function FormEntrar({ proximo }: { proximo: string }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(enviarLink, { status: "inicio" });

  if (estado.status === "enviado") {
    return (
      <div role="status" className="rounded-xl bg-superficie p-6 ring-1 ring-verde">
        <p className="font-display text-3xl font-extrabold">Confira seu e-mail</p>
        <p className="mt-2 text-texto-2">
          Enviamos um link de acesso para <strong className="text-texto">{estado.email}</strong>. Ele vale por uma hora e só pode ser usado uma vez.
        </p>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-4" noValidate>
      <input type="hidden" name="proximo" value={proximo} />
      <div>
        <label htmlFor="email" className="rotulo">E-mail</label>
        <input
          id="email" name="email" type="email" autoComplete="email" inputMode="email" spellCheck={false} placeholder="nome@exemplo.com…" required
          defaultValue={estado.email} aria-invalid={estado.status === "erro"} aria-describedby={estado.status === "erro" ? "erro-email" : undefined}
          className="campo text-lg"
        />
      </div>
      {estado.status === "erro" ? <p id="erro-email" role="alert" className="text-sm font-semibold text-vermelho">{estado.mensagem}</p> : null}
      <button type="submit" disabled={enviando} className="botao botao-primario w-full">
        {enviando ? "Enviando…" : "Receber link de acesso"}
      </button>
    </form>
  );
}
