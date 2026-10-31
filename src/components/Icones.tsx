export function IconeCartao({ cor, rotulo }: { cor: "amarelo" | "vermelho"; rotulo?: string }) {
  return (
    <svg width="11" height="15" viewBox="0 0 11 15" role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      <rect x="0.5" y="0.5" width="10" height="14" rx="1.5" fill={cor === "amarelo" ? "var(--amarelo)" : "var(--vermelho)"} />
    </svg>
  );
}

export function IconeBola({ rotulo }: { rotulo?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6 11 6.8 9.9 10.4H6.1L5 6.8Z" fill="currentColor" />
      <path d="M8 1v3.6M11 6.8l3.4-1.2M9.9 10.4l2 2.9M6.1 10.4l-2 2.9M5 6.8 1.6 5.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
