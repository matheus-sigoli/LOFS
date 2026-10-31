import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Barlow, Big_Shoulders_Display } from "next/font/google";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import "./globals.css";

const display = Big_Shoulders_Display({ subsets: ["latin"], weight: ["700", "800"], variable: "--fonte-display", display: "swap" });
const texto = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--fonte-texto", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "LOFS — Liga Osasquense de Futsal", template: "%s · LOFS" },
  description: "Jogos, classificação, artilharia e equipes dos campeonatos da Liga Osasquense de Futsal.",
  robots: { index: false, follow: false }, // projeto acadêmico
};

export const viewport: Viewport = {
  themeColor: "#0d2419",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = (await cookies()).get("tema")?.value === "claro" ? "claro" : "escuro";
  return (
    <html lang="pt-BR" data-tema={tema} className={`${display.variable} ${texto.variable}`}>
      <body className="antialiased">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-verde focus:px-4 focus:py-2 focus:text-sobre-verde">
          Pular para o conteúdo
        </a>
        <Cabecalho />
        <main id="conteudo" className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
          {children}
        </main>
        <Rodape />
      </body>
    </html>
  );
}
