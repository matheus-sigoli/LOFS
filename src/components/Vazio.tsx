export function Vazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-linha-forte px-6 py-10 text-center">
      <p className="font-display text-2xl font-bold">{titulo}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-texto-2">{children}</div> : null}
    </div>
  );
}
