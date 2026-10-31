import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="py-16">
      <p className="numero-placar text-8xl text-texto-3">404</p>
      <h1 className="titulo-pagina mt-4">Bola fora</h1>
      <p className="mt-3 max-w-prose text-texto-2">Essa página não existe ou ainda não foi publicada pela liga.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/jogos" className="botao botao-primario">Ver jogos de hoje</Link>
        <Link href="/campeonatos" className="botao botao-secundario">Campeonatos</Link>
      </div>
    </div>
  );
}
