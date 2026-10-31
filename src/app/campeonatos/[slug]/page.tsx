import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoFavorito } from "@/components/BotaoFavorito";
import { Escudo } from "@/components/Escudo";
import { IconeCartao } from "@/components/Icones";
import { ListaPartidas, StatusPartida } from "@/components/Partidas";
import { TabelaClassificacao } from "@/components/TabelaClassificacao";
import { Vazio } from "@/components/Vazio";
import { artilhariaEDisciplina, campeonatoPorSlug, classificacao, meusFavoritos, partidasDoCampeonato } from "@/lib/consultas";
import { rotuloCriterio, type Criterio } from "@/lib/classificacao";
import { ehSlug } from "@/lib/validar";
import type { Campeonato, EquipeResumo, PartidaResumo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const ABAS = [
  ["classificacao", "Classificação"],
  ["jogos", "Jogos"],
  ["finais", "Finais"],
  ["artilharia", "Artilharia"],
  ["cartoes", "Cartões"],
  ["equipes", "Equipes"],
] as const;
type Aba = (typeof ABAS)[number][0];

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ehSlug(slug)) return {};
  const c = await campeonatoPorSlug(slug);
  return c ? { title: `${c.titulo.nome} ${c.categoria.nome} ${c.serie.nome} ${c.temporada.ano}` } : {};
}

export default async function CampeonatoPagina({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!ehSlug(slug)) notFound();
  const camp = await campeonatoPorSlug(slug);
  if (!camp) notFound();

  const pedida = (await searchParams).aba;
  const aba: Aba = ABAS.some(([a]) => a === pedida) ? (pedida as Aba) : "classificacao";
  const caminho = `/campeonatos/${slug}`;
  const [partidas, fav] = await Promise.all([partidasDoCampeonato(camp.id), meusFavoritos()]);

  const finais = partidas.filter((p) => p.fase.tipo === "mata_mata");
  const grupos = partidas.filter((p) => p.fase.tipo === "grupos");
  const disputados = grupos.filter((p) => p.status === "encerrada").length;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-texto-2">{camp.titulo.nome} {camp.temporada.ano}</p>
          <h1 className="titulo-pagina mt-1">{camp.categoria.nome} · {camp.serie.nome}</h1>
          <p className="mt-3 text-sm text-texto-3">
            {camp.status === "encerrado" ? "Campeonato encerrado" : camp.status === "rascunho" ? "Rascunho (só administradores veem)" : `${disputados} de ${grupos.length} jogos da fase de grupos disputados`}
          </p>
        </div>
        <BotaoFavorito tipo="campeonato" id={camp.id} seguindo={fav.campeonatos.has(camp.id)} logado={fav.logado} caminho={caminho} />
      </header>

      <nav aria-label="Seções do campeonato" className="mt-8 overflow-x-auto border-b border-linha">
        <ul className="flex">
          {ABAS.map(([a, rotulo]) => (
            <li key={a}>
              <Link
                href={a === "classificacao" ? caminho : `${caminho}?aba=${a}`}
                aria-current={a === aba ? "page" : undefined}
                className={`relative flex h-11 items-center px-3 text-[0.9375rem] font-semibold whitespace-nowrap first:pl-0 ${
                  a === aba ? "text-texto after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-verde" : "text-texto-2 hover:text-texto"
                }`}
              >
                {rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        {aba === "classificacao" && <AbaClassificacao camp={camp} partidas={partidas} />}
        {aba === "jogos" && <AbaJogos partidas={grupos} />}
        {aba === "finais" && <AbaFinais partidas={finais} />}
        {(aba === "artilharia" || aba === "cartoes") && <AbaEstatisticas id={camp.id} partidas={partidas} aba={aba} />}
        {aba === "equipes" && <AbaEquipes partidas={partidas} />}
      </div>
    </div>
  );
}

async function AbaClassificacao({ camp, partidas }: { camp: Campeonato; partidas: PartidaResumo[] }) {
  const tabela = await classificacao(camp, partidas);
  if (tabela.length === 0) return <Vazio titulo="Tabela ainda não definida">Os grupos aparecem aqui assim que a liga publicar a fase de grupos.</Vazio>;
  const unico = tabela.length === 1;
  return (
    <div className="space-y-10">
      <div className={`grid gap-10 ${unico ? "" : "xl:grid-cols-2"}`}>
        {tabela.map((g) => <TabelaClassificacao key={g.id} grupo={g} classificam={unico ? 4 : 2} mostrarNome={!unico} />)}
      </div>
      <details className="max-w-prose text-sm text-texto-2">
        <summary className="cursor-pointer font-semibold text-texto">Critérios de desempate</summary>
        <p className="mt-2">
          Vitória vale {camp.pontos_vitoria}, empate {camp.pontos_empate}, derrota {camp.pontos_derrota}. Em caso de empate:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {(camp.criterios_desempate as Criterio[]).filter((c) => c !== "pontos").map((c) => <li key={c}>{rotuloCriterio[c]}</li>)}
          <li>Sorteio</li>
        </ol>
      </details>
    </div>
  );
}

function AbaJogos({ partidas }: { partidas: PartidaResumo[] }) {
  if (partidas.length === 0) return <Vazio titulo="Nenhum jogo marcado" />;
  const rodadas = new Map<number, PartidaResumo[]>();
  for (const p of partidas) rodadas.set(p.rodada ?? 0, [...(rodadas.get(p.rodada ?? 0) ?? []), p]);
  return (
    <div className="space-y-10">
      {[...rodadas.entries()].sort(([a], [b]) => a - b).map(([r, lista]) => (
        <section key={r} aria-labelledby={`r-${r}`}>
          <h2 id={`r-${r}`} className="titulo-secao mb-2 border-b border-linha-forte pb-2">{r ? `Rodada ${r}` : "Sem rodada"}</h2>
          <ListaPartidas partidas={lista} mostrarCampeonato={false} mostrarData />
        </section>
      ))}
    </div>
  );
}

/** Chaveamento simples: semifinais → final (+ disputa de 3º). */
function AbaFinais({ partidas }: { partidas: PartidaResumo[] }) {
  if (partidas.length === 0)
    return <Vazio titulo="Finais ainda não definidas">Os confrontos aparecem aqui quando a fase de grupos terminar.</Vazio>;
  const semis = partidas.filter((p) => p.chave?.startsWith("Semifinal"));
  const final = partidas.find((p) => p.chave === "Final");
  const terceiro = partidas.find((p) => p.chave?.includes("3º"));
  const outros = partidas.filter((p) => !semis.includes(p) && p !== final && p !== terceiro);
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
      <div className="space-y-4">
        {semis.map((p) => <Confronto key={p.id} p={p} />)}
      </div>
      <svg aria-hidden="true" width="40" height="160" viewBox="0 0 40 160" className="hidden text-linha-forte md:block">
        <path d="M0 40h20v80H0M20 80h20" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="space-y-4">
        {final ? <Confronto p={final} destaque /> : null}
        {terceiro ? <Confronto p={terceiro} /> : null}
        {outros.map((p) => <Confronto key={p.id} p={p} />)}
      </div>
    </div>
  );
}

function Confronto({ p, destaque }: { p: PartidaResumo; destaque?: boolean }) {
  const vence = (l: "mandante" | "visitante") => {
    if (p.status !== "encerrada") return false;
    const [a, b, pa, pb] = l === "mandante"
      ? [p.gols_mandante, p.gols_visitante, p.penaltis_mandante, p.penaltis_visitante]
      : [p.gols_visitante, p.gols_mandante, p.penaltis_visitante, p.penaltis_mandante];
    return a > b || (a === b && (pa ?? 0) > (pb ?? 0));
  };
  return (
    <Link href={`/jogos/${p.id}`} className={`block rounded-xl bg-superficie p-4 ring-1 transition hover:ring-linha-forte ${destaque ? "ring-verde" : "ring-linha"}`}>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className={`font-semibold ${destaque ? "text-verde" : "text-texto-2"}`}>{p.chave}</span>
        <StatusPartida p={p} />
      </div>
      {(["mandante", "visitante"] as const).map((l) => (
        <div key={l} className="flex items-center justify-between gap-3 py-1">
          <span className={`flex min-w-0 items-center gap-2.5 ${vence(l) ? "font-bold" : "text-texto-2"}`}>
            <Escudo equipe={p[l].equipe} tamanho={26} />
            <span className="truncate">{p[l].equipe.nome}</span>
          </span>
          <span className="numero-placar text-2xl">
            {p.status === "encerrada" || p.status === "ao_vivo" ? (l === "mandante" ? p.gols_mandante : p.gols_visitante) : ""}
            {p.penaltis_mandante !== null ? (
              <sup className="ml-1 font-sans text-xs font-normal text-texto-3">({l === "mandante" ? p.penaltis_mandante : p.penaltis_visitante})</sup>
            ) : null}
          </span>
        </div>
      ))}
    </Link>
  );
}

async function AbaEstatisticas({ id, partidas, aba }: { id: string; partidas: PartidaResumo[]; aba: "artilharia" | "cartoes" }) {
  const { artilharia, disciplina } = await artilhariaEDisciplina(id, partidas);
  if (aba === "artilharia") {
    if (artilharia.length === 0) return <Vazio titulo="Nenhum gol ainda" />;
    return (
      <table className="tabela max-w-2xl">
        <caption className="sr-only">Artilharia</caption>
        <thead><tr><th scope="col" className="esq w-10">#</th><th scope="col" className="esq">Atleta</th><th scope="col" className="esq">Equipe</th><th scope="col">Gols</th></tr></thead>
        <tbody>
          {artilharia.map((a, i) => (
            <tr key={a.atleta_id}>
              <td className="esq text-texto-3">{i > 0 && artilharia[i - 1]!.gols === a.gols ? "" : i + 1}</td>
              <td className="esq">{a.atleta ? <Link href={`/atletas/${a.atleta.slug}`} className="font-semibold hover:underline">{a.atleta.nome_esportivo}</Link> : "—"}</td>
              <td className="esq"><EquipeMini equipe={a.equipe} /></td>
              <td className="numero-placar text-xl">{a.gols}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (disciplina.length === 0) return <Vazio titulo="Nenhum cartão ainda" />;
  return (
    <table className="tabela max-w-2xl">
      <caption className="sr-only">Cartões por atleta</caption>
      <thead>
        <tr>
          <th scope="col" className="esq">Atleta</th><th scope="col" className="esq">Equipe</th>
          <th scope="col"><span className="inline-flex items-center gap-1.5"><IconeCartao cor="amarelo" /> Amarelos</span></th>
          <th scope="col"><span className="inline-flex items-center gap-1.5"><IconeCartao cor="vermelho" /> Vermelhos</span></th>
        </tr>
      </thead>
      <tbody>
        {disciplina.map((d) => (
          <tr key={d.atleta_id}>
            <td className="esq">{d.atleta ? <Link href={`/atletas/${d.atleta.slug}`} className="font-semibold hover:underline">{d.atleta.nome_esportivo}</Link> : "—"}</td>
            <td className="esq"><EquipeMini equipe={d.equipe} /></td>
            <td>{d.amarelos}</td>
            <td className={d.vermelhos ? "font-bold text-vermelho" : ""}>{d.vermelhos}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EquipeMini({ equipe }: { equipe?: EquipeResumo }) {
  if (!equipe) return <span>—</span>;
  return (
    <Link href={`/equipes/${equipe.slug}`} className="inline-flex items-center gap-2 text-texto-2 hover:underline">
      <Escudo equipe={equipe} tamanho={20} /> {equipe.nome}
    </Link>
  );
}

function AbaEquipes({ partidas }: { partidas: PartidaResumo[] }) {
  const equipes = new Map<string, EquipeResumo>();
  for (const p of partidas) {
    equipes.set(p.mandante.equipe.slug, p.mandante.equipe);
    equipes.set(p.visitante.equipe.slug, p.visitante.equipe);
  }
  const lista = [...equipes.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  if (lista.length === 0) return <Vazio titulo="Nenhuma equipe inscrita" />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {lista.map((e) => (
        <li key={e.slug}>
          <Link href={`/equipes/${e.slug}`} className="flex items-center gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linha hover:ring-linha-forte">
            <Escudo equipe={e} tamanho={40} />
            <span className="font-semibold">{e.nome}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
