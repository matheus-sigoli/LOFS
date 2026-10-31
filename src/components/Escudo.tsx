import type { EquipeResumo } from "@/lib/tipos";

const FORMA = "polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)";

/**
 * Distintivo gerado no mesmo desenho do escudo da LOFS: contorno grafite,
 * faixa superior com a sigla e faixas verticais nas cores da equipe.
 * Abaixo de 30px a sigla some (ficaria ilegível) e só as cores identificam.
 */
export function Escudo({ equipe, tamanho = 32 }: { equipe: Pick<EquipeResumo, "nome_curto" | "cor_primaria" | "cor_secundaria">; tamanho?: number }) {
  const altura = Math.round(tamanho * 1.1);
  const borda = Math.max(1.5, tamanho * 0.06);
  const comSigla = tamanho >= 30;
  const p = equipe.cor_primaria;
  const s = equipe.cor_secundaria;
  return (
    <span
      aria-hidden="true"
      translate="no"
      className="relative inline-block shrink-0"
      style={{ width: tamanho, height: altura, clipPath: FORMA, background: "#2b2f2c" }}
    >
      <span
        className="absolute flex flex-col overflow-hidden"
        style={{ inset: borda, clipPath: FORMA, background: `linear-gradient(90deg, ${p} 0 33%, ${s} 33% 67%, ${p} 67%)` }}
      >
        {comSigla ? (
          <span
            className="flex items-center justify-center font-display font-extrabold leading-none text-white"
            style={{ height: "36%", background: "#2b2f2c", fontSize: tamanho * 0.3, letterSpacing: "0.02em" }}
          >
            {equipe.nome_curto}
          </span>
        ) : null}
      </span>
    </span>
  );
}
