import { Animacao } from "@/components/Animacao";
import bola from "@/animacoes/carregando.json";

export default function Carregando() {
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-texto-2">
      <Animacao dados={bola} loop className="w-20" />
      <p className="text-sm">Carregando…</p>
    </div>
  );
}
