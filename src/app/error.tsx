"use client";

export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Não exibimos a mensagem técnica: detalhes ficam no log do servidor.
  return (
    <div className="py-16">
      <h1 className="titulo-pagina">Não deu para carregar</h1>
      <p className="mt-3 max-w-prose text-texto-2">
        Os dados da liga não responderam agora. Tente de novo em alguns segundos.
      </p>
      <button type="button" onClick={reset} className="botao botao-primario mt-6">Tentar de novo</button>
    </div>
  );
}
