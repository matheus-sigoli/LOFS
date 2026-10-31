import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { caminhoSeguro } from "@/lib/caminho";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ proximo?: string; erro?: string }> }) {
  const b = await searchParams;
  const proximo = caminhoSeguro(b.proximo, "/minha-conta");
  if (await obterSessao()) redirect(proximo);
  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="titulo-pagina">Entrar</h1>
      <p className="mt-3 text-texto-2">Sem senha: mandamos um link para o seu e-mail. Com a conta você segue equipes e campeonatos.</p>
      {b.erro ? (
        <p role="alert" className="mt-6 rounded-lg bg-vermelho-suave px-4 py-3 text-sm font-semibold text-vermelho">
          Esse link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      ) : null}
      <div className="mt-8"><FormEntrar proximo={proximo} /></div>
    </div>
  );
}
