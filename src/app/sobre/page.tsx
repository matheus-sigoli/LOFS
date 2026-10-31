import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sobre" };

export default function Sobre() {
  return (
    <article className="max-w-prose">
      <h1 className="titulo-pagina">Sobre a LOFS</h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-texto-2">
        <p>
          A Liga Osasquense de Futsal é a liga deste projeto acadêmico: um site de campeonatos com tabelas,
          jogos, súmulas, artilharia e ranking, construído com Next.js e Supabase.
        </p>
        <p>
          <strong className="text-texto">Tudo aqui é fictício.</strong> Equipes, atletas, placares e ginásios foram gerados
          para demonstração. A organização das competições (temporada, série e categoria) se inspira em sites reais de
          federações, mas nenhum dado é copiado deles.
        </p>
      </div>

      <h2 id="privacidade" className="titulo-secao mt-12 scroll-mt-6">Privacidade dos atletas</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-texto-2">
        <p>
          Boa parte dos atletas joga nas categorias de base e é menor de idade. Por isso, seguindo a LGPD, o site público só mostra:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>nome esportivo, número da camisa, posição e estatísticas, para todos;</li>
          <li>nome completo, idade e foto, apenas com autorização registrada do atleta ou do responsável.</li>
        </ul>
        <p>
          Data de nascimento, documentos e contatos nunca são publicados. O responsável pode pedir a remoção da autorização
          a qualquer momento; o perfil volta a ser resumido na hora.
        </p>
      </div>
    </article>
  );
}
