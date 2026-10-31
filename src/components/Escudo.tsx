import type { EquipeResumo } from "@/lib/tipos";

/** Distintivo gerado com as cores da equipe (sem escudos reais). */
export function Escudo({ equipe, tamanho = 32 }: { equipe: Pick<EquipeResumo, "nome_curto" | "cor_primaria" | "cor_secundaria">; tamanho?: number }) {
  return (
    <span
      aria-hidden="true"
      translate="no"
      className="inline-grid shrink-0 place-items-center rounded-md font-display font-extrabold leading-none"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: tamanho * 0.38,
        background: `linear-gradient(135deg, ${equipe.cor_primaria} 0 62%, ${equipe.cor_secundaria} 62% 100%)`,
        color: legivelSobre(equipe.cor_primaria),
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
      }}
    >
      {equipe.nome_curto}
    </span>
  );
}

function legivelSobre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.35 ? "#0d2419" : "#ffffff";
}
