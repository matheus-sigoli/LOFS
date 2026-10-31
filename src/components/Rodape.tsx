import Image from "next/image";
import Link from "next/link";
import escudo from "../../public/marca/lofs.png";
import { cookies } from "next/headers";
import { definirTema } from "@/app/acoes";

export async function Rodape() {
  const tema = (await cookies()).get("tema")?.value === "claro" ? "claro" : "escuro";
  return (
    <footer className="mt-20 border-t border-linha">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-texto-3 sm:grid-cols-[1fr_auto] sm:px-6">
        <div className="flex max-w-prose gap-4">
          <Image src={escudo} alt="" width={44} height={48} className="h-12 w-11 shrink-0" />
          <div className="space-y-2">
          <p className="text-texto-2">
            LOFS — Liga Osasquense de Futsal. Projeto acadêmico; equipes, atletas e resultados são fictícios.
          </p>
          <p>
            <Link href="/sobre" className="underline hover:text-texto">Sobre o projeto</Link>
            {" "}e{" "}
            <Link href="/sobre#privacidade" className="underline hover:text-texto">privacidade dos atletas</Link>
          </p>
          </div>
        </div>
        <form action={definirTema}>
          <input type="hidden" name="tema" value={tema === "claro" ? "escuro" : "claro"} />
          <button type="submit" className="botao botao-secundario min-h-9 px-3 text-sm">
            {tema === "claro" ? "Usar tema escuro" : "Usar tema claro"}
          </button>
        </form>
      </div>
    </footer>
  );
}
