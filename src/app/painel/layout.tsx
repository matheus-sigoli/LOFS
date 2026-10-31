import type { Metadata } from "next";
import Link from "next/link";
import { exigirPainel } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel LOFS" } };
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirPainel();
  const admin = sessao.papeis.includes("admin");
  const itens: [string, string][] = [
    ["/painel", "Visão geral"],
    ["/painel/partidas", admin ? "Partidas e súmulas" : "Minhas súmulas"],
    ...(admin
      ? ([
          ["/painel/campeonatos", "Campeonatos"],
          ["/painel/equipes", "Equipes"],
          ["/painel/atletas", "Atletas"],
          ["/painel/importar", "Importar"],
          ["/painel/usuarios", "Usuários"],
          ["/painel/auditoria", "Auditoria"],
        ] as [string, string][])
      : []),
    ["/painel/seguranca", "Segurança"],
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
      <aside>
        <p className="text-sm text-texto-3">{admin ? "Administrador" : "Mesário"}</p>
        <nav aria-label="Painel" className="mt-3">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {itens.map(([href, rotulo]) => (
              <li key={href}>
                <Link href={href} className="block rounded-md px-3 py-2 text-[0.9375rem] font-semibold whitespace-nowrap text-texto-2 hover:bg-superficie-2 hover:text-texto">
                  {rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {admin && sessao.aal !== "aal2" ? (
          <p className="mt-4 rounded-lg bg-vermelho-suave p-3 text-sm text-vermelho">
            Ative a verificação em duas etapas para editar dados. <Link href="/painel/seguranca" className="font-semibold underline">Ativar</Link>
          </p>
        ) : null}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
