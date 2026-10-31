import Link from "next/link";
import { alternarFavorito } from "@/app/acoes";

export function BotaoFavorito({ tipo, id, seguindo, logado, caminho }: {
  tipo: "campeonato" | "equipe"; id: string; seguindo: boolean; logado: boolean; caminho: string;
}) {
  if (!logado) {
    return (
      <Link href={`/entrar?proximo=${encodeURIComponent(caminho)}`} className="botao botao-secundario min-h-10 text-sm">
        <Estrela cheia={false} /> Seguir
      </Link>
    );
  }
  return (
    <form action={alternarFavorito}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="caminho" value={caminho} />
      <button type="submit" aria-pressed={seguindo} className={`botao min-h-10 text-sm ${seguindo ? "botao-primario" : "botao-secundario"}`}>
        <Estrela cheia={seguindo} /> {seguindo ? "Seguindo" : "Seguir"}
      </button>
    </form>
  );
}

function Estrela({ cheia }: { cheia: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 1.5 2 4.1 4.5.6-3.3 3.1.8 4.5L8 11.7l-4 2.1.8-4.5L1.5 6.2 6 5.6Z" fill={cheia ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
