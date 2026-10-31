import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { obterSessao } from "@/lib/auth";

export async function Cabecalho() {
  const sessao = await obterSessao();
  return (
    <header className="border-b border-linha bg-fundo/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
        <Link href="/" aria-label="LOFS — página inicial" className="py-1">
          <Logo />
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {sessao?.papeis.length ? (
            <Link href="/painel" className="botao botao-secundario min-h-9 px-3">Painel</Link>
          ) : null}
          {sessao ? (
            <Link href="/minha-conta" className="botao botao-secundario min-h-9 px-3">Minha conta</Link>
          ) : (
            <Link href="/entrar" className="botao botao-primario min-h-9 px-3">Entrar</Link>
          )}
        </div>
      </div>
      <nav aria-label="Principal" className="mx-auto max-w-6xl overflow-x-auto px-1 sm:px-3">
        <ul className="flex">
          <li><NavLink href="/">Início</NavLink></li>
          <li><NavLink href="/jogos">Jogos</NavLink></li>
          <li><NavLink href="/campeonatos">Campeonatos</NavLink></li>
          <li><NavLink href="/equipes">Equipes</NavLink></li>
          <li><NavLink href="/ranking">Ranking</NavLink></li>
          <li><NavLink href="/sobre">Sobre</NavLink></li>
        </ul>
      </nav>
    </header>
  );
}
