/** Marca própria da LOFS: meia quadra com círculo central + nome em letreiro. */
export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="32" height="20" rx="2.5" fill="var(--verde)" />
        <path d="M17 1v20" stroke="var(--sobre-verde)" strokeWidth="1.5" />
        <circle cx="17" cy="11" r="4.5" fill="none" stroke="var(--sobre-verde)" strokeWidth="1.5" />
        <path d="M1 6.5h3.5a4.5 4.5 0 0 1 0 9H1M33 6.5h-3.5a4.5 4.5 0 0 0 0 9H33" fill="none" stroke="var(--sobre-verde)" strokeWidth="1.5" />
      </svg>
      <span translate="no" className="font-display text-[1.65rem] font-extrabold leading-none tracking-tight">LOFS</span>
      {!compacto && (
        <span className="hidden text-xs leading-tight text-texto-3 sm:block">
          Liga Osasquense
          <br />
          de Futsal
        </span>
      )}
    </span>
  );
}
