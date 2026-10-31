"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const ativo = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`relative flex h-11 items-center px-3 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors ${
        ativo ? "text-texto after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-verde" : "text-texto-2 hover:text-texto"
      }`}
    >
      {children}
    </Link>
  );
}
