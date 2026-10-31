import Image from "next/image";
import escudo from "../../public/marca/lofs.png";

/** Marca da LOFS: escudo oficial + nome. */
export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image src={escudo} alt="" width={36} height={39} priority className="h-[39px] w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span translate="no" className="font-display text-[1.7rem] font-extrabold tracking-tight">LOFS</span>
        {!compacto && (
          <span className="mt-0.5 hidden text-[0.6875rem] font-medium text-texto-3 sm:block">Liga Osasquense de Futsal</span>
        )}
      </span>
    </span>
  );
}
