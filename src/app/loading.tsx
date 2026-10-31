export default function Carregando() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4 py-4">
      <span className="sr-only">Carregando…</span>
      <div className="h-14 w-2/3 animate-pulse rounded bg-superficie" />
      <div className="h-40 animate-pulse rounded-xl bg-superficie" />
      <div className="h-64 animate-pulse rounded-xl bg-superficie" />
    </div>
  );
}
