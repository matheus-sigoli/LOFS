import Link from "next/link";
import { Animacao } from "@/components/Animacao";
import bolaFora from "@/animacoes/bola-fora.json";

export default function NaoEncontrado() {
  return (
    <div className="grid items-center gap-8 py-12 md:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold text-vermelho">Erro 404</p>
        <h1 className="titulo-pagina mt-2">Bola fora</h1>
        <p className="mt-3 max-w-prose text-texto-2">Essa página não existe ou ainda não foi publicada pela liga.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/jogos" className="botao botao-primario">Ver jogos de hoje</Link>
          <Link href="/campeonatos" className="botao botao-secundario">Campeonatos</Link>
        </div>
      </div>
      <Animacao dados={bolaFora} rotulo="Bola acertando a trave e saindo do gol" className="w-full max-w-md" />
    </div>
  );
}
