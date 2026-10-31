import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { ordenarClassificacao, type Criterio } from "@/lib/classificacao";
import type {
  AtletaPublico, Campeonato, CampeonatoResumo, EquipeResumo, EventoPartida, LinhaClassificacao, PartidaResumo,
} from "@/lib/tipos";

// Todas as consultas usam a sessão do visitante: o RLS decide o que é visível.

const EQUIPE = "id, nome, nome_curto, slug, cor_primaria, cor_secundaria";
const CAMP = `id, slug, status,
  titulo:titulo(nome, slug), serie:serie(nome, slug, ordem),
  categoria:categoria(nome, slug, grupo, ordem), temporada:temporada(ano)`;
const PARTIDA = `id, data_hora, status, gols_mandante, gols_visitante, penaltis_mandante, penaltis_visitante,
  rodada, chave, grupo:grupo(nome), local:local(nome, slug),
  fase:fase!inner(nome, tipo, campeonato_id, campeonato:campeonato(slug, titulo:titulo(nome), serie:serie(nome), categoria:categoria(nome))),
  mandante:inscricao!partida_mandante_id_fkey(id, equipe:equipe(${EQUIPE})),
  visitante:inscricao!partida_visitante_id_fkey(id, equipe:equipe(${EQUIPE}))`;

function falhar(contexto: string, error: { message: string } | null): never {
  // Detalhes vão para o log do servidor; a página mostra uma mensagem genérica (error.tsx).
  console.error(`[consulta:${contexto}]`, error?.message);
  throw new Error("Não foi possível carregar os dados agora.");
}

// ---------------------------------------------------------------- catálogo
export const catalogo = cache(async () => {
  const sb = await supabaseServer();
  const [t, ti, s, c] = await Promise.all([
    sb.from("temporada").select("id, ano, atual").order("ano", { ascending: false }),
    sb.from("titulo").select("id, nome, slug").order("nome"),
    sb.from("serie").select("id, nome, slug, ordem").order("ordem"),
    sb.from("categoria").select("id, nome, slug, grupo, ordem").order("ordem"),
  ]);
  if (t.error || ti.error || s.error || c.error) falhar("catalogo", t.error ?? ti.error ?? s.error ?? c.error);
  return {
    temporadas: t.data as { id: string; ano: number; atual: boolean }[],
    titulos: ti.data as { id: string; nome: string; slug: string }[],
    series: s.data as { id: string; nome: string; slug: string; ordem: number }[],
    categorias: c.data as { id: string; nome: string; slug: string; grupo: "base" | "principal"; ordem: number }[],
  };
});

// ---------------------------------------------------------------- campeonatos
export async function listarCampeonatos(filtro: { ano?: number; titulo?: string; serie?: string; categoria?: string } = {}) {
  const sb = await supabaseServer();
  let q = sb.from("campeonato").select(
    `id, slug, status,
     titulo:titulo!inner(nome, slug), serie:serie!inner(nome, slug, ordem),
     categoria:categoria!inner(nome, slug, grupo, ordem), temporada:temporada!inner(ano)`,
  );
  if (filtro.ano) q = q.eq("temporada.ano", filtro.ano);
  if (filtro.titulo) q = q.eq("titulo.slug", filtro.titulo);
  if (filtro.serie) q = q.eq("serie.slug", filtro.serie);
  if (filtro.categoria) q = q.eq("categoria.slug", filtro.categoria);
  const { data, error } = await q;
  if (error) falhar("listarCampeonatos", error);
  return (data as unknown as CampeonatoResumo[]).sort(
    (a, b) =>
      b.temporada.ano - a.temporada.ano ||
      a.titulo.nome.localeCompare(b.titulo.nome) ||
      a.serie.ordem - b.serie.ordem ||
      b.categoria.ordem - a.categoria.ordem,
  );
}

export const campeonatoPorSlug = cache(async (slug: string) => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("campeonato")
    .select(`${CAMP}, pontos_vitoria, pontos_empate, pontos_derrota, criterios_desempate`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) falhar("campeonatoPorSlug", error);
  return data as unknown as Campeonato | null;
});

export async function partidasDoCampeonato(campeonatoId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("partida")
    .select(PARTIDA)
    .eq("fase.campeonato_id", campeonatoId)
    .order("data_hora", { ascending: true, nullsFirst: false });
  if (error) falhar("partidasDoCampeonato", error);
  return data as unknown as PartidaResumo[];
}

export interface GrupoTabela {
  id: string;
  nome: string;
  linhas: (LinhaClassificacao & { equipe: EquipeResumo; forma: ("V" | "E" | "D")[] })[];
}

/** Classificação por grupo, já ordenada pelos critérios do campeonato. */
export async function classificacao(camp: Campeonato, partidas: PartidaResumo[]): Promise<GrupoTabela[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("classificacao").select("*").eq("campeonato_id", camp.id);
  if (error) falhar("classificacao", error);
  const linhas = data as LinhaClassificacao[];

  const equipes = new Map<string, EquipeResumo>();
  for (const p of partidas) {
    equipes.set(p.mandante.id, p.mandante.equipe);
    equipes.set(p.visitante.id, p.visitante.equipe);
  }
  const encerradas = partidas
    .filter((p) => p.status === "encerrada" && p.fase.tipo === "grupos")
    .map((p) => ({
      mandante_id: p.mandante.id, visitante_id: p.visitante.id,
      gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante, data: p.data_hora ?? "",
    }));

  const forma = (id: string) =>
    encerradas
      .filter((j) => j.mandante_id === id || j.visitante_id === id)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 5)
      .map((j) => {
        const [meus, deles] = j.mandante_id === id ? [j.gols_mandante, j.gols_visitante] : [j.gols_visitante, j.gols_mandante];
        return meus > deles ? "V" : meus < deles ? "D" : "E";
      }) as ("V" | "E" | "D")[];

  const grupos = new Map<string, GrupoTabela>();
  for (const l of linhas) {
    const g = grupos.get(l.grupo_id) ?? { id: l.grupo_id, nome: l.grupo_nome, linhas: [] };
    const equipe = equipes.get(l.inscricao_id);
    if (equipe) g.linhas.push({ ...l, equipe, forma: forma(l.inscricao_id) });
    grupos.set(l.grupo_id, g);
  }
  return [...grupos.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((g) => ({
      ...g,
      linhas: ordenarClassificacao(g.linhas, encerradas, camp.criterios_desempate as Criterio[], {
        vitoria: camp.pontos_vitoria, empate: camp.pontos_empate, derrota: camp.pontos_derrota,
      }),
    }));
}

async function atletasPorId(ids: string[]) {
  if (ids.length === 0) return new Map<string, AtletaPublico>();
  const sb = await supabaseServer();
  const { data, error } = await sb.from("atleta_publico").select("*").in("id", [...new Set(ids)]);
  if (error) falhar("atletasPorId", error);
  return new Map((data as AtletaPublico[]).map((a) => [a.id, a]));
}

export async function artilhariaEDisciplina(campeonatoId: string, partidas: PartidaResumo[]) {
  const sb = await supabaseServer();
  const [art, dis] = await Promise.all([
    sb.from("artilharia").select("atleta_id, inscricao_id, gols").eq("campeonato_id", campeonatoId)
      .order("gols", { ascending: false }).limit(30),
    sb.from("disciplina").select("atleta_id, inscricao_id, amarelos, vermelhos").eq("campeonato_id", campeonatoId),
  ]);
  if (art.error || dis.error) falhar("artilharia", art.error ?? dis.error);
  type A = { atleta_id: string; inscricao_id: string; gols: number };
  type D = { atleta_id: string; inscricao_id: string; amarelos: number; vermelhos: number };
  const artil = art.data as A[];
  const disc = (dis.data as D[]).sort((a, b) => b.vermelhos - a.vermelhos || b.amarelos - a.amarelos);
  const atletas = await atletasPorId([...artil, ...disc].map((x) => x.atleta_id));
  const equipes = new Map<string, EquipeResumo>();
  for (const p of partidas) {
    equipes.set(p.mandante.id, p.mandante.equipe);
    equipes.set(p.visitante.id, p.visitante.equipe);
  }
  return {
    artilharia: artil.map((a) => ({ ...a, atleta: atletas.get(a.atleta_id), equipe: equipes.get(a.inscricao_id) })),
    disciplina: disc.map((d) => ({ ...d, atleta: atletas.get(d.atleta_id), equipe: equipes.get(d.inscricao_id) })),
  };
}

// ---------------------------------------------------------------- partidas
export async function partidasEntre(inicioISO: string, fimISO: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("partida")
    .select(PARTIDA)
    .gte("data_hora", inicioISO)
    .lt("data_hora", fimISO)
    .order("data_hora");
  if (error) falhar("partidasEntre", error);
  return data as unknown as PartidaResumo[];
}

export async function partidasAoVivo() {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("partida").select(PARTIDA).eq("status", "ao_vivo").order("data_hora");
  if (error) falhar("partidasAoVivo", error);
  return data as unknown as PartidaResumo[];
}

export async function proximasPartidas(limite = 8, filtro?: { equipeInscricoes?: string[]; localId?: string }) {
  const sb = await supabaseServer();
  let q = sb.from("partida").select(PARTIDA).eq("status", "agendada").gte("data_hora", new Date().toISOString());
  if (filtro?.equipeInscricoes?.length) {
    const ids = filtro.equipeInscricoes.join(",");
    q = q.or(`mandante_id.in.(${ids}),visitante_id.in.(${ids})`);
  }
  if (filtro?.localId) q = q.eq("local_id", filtro.localId);
  const { data, error } = await q.order("data_hora").limit(limite);
  if (error) falhar("proximasPartidas", error);
  return data as unknown as PartidaResumo[];
}

export async function ultimasPartidas(limite: number, filtro: { equipeInscricoes?: string[] }) {
  const sb = await supabaseServer();
  let q = sb.from("partida").select(PARTIDA).eq("status", "encerrada");
  if (filtro.equipeInscricoes?.length) {
    const ids = filtro.equipeInscricoes.join(",");
    q = q.or(`mandante_id.in.(${ids}),visitante_id.in.(${ids})`);
  }
  const { data, error } = await q.order("data_hora", { ascending: false }).limit(limite);
  if (error) falhar("ultimasPartidas", error);
  return data as unknown as PartidaResumo[];
}

export async function partidaDetalhe(id: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("partida").select(PARTIDA).eq("id", id).maybeSingle();
  if (error) falhar("partidaDetalhe", error);
  if (!data) return null;
  const partida = data as unknown as PartidaResumo;
  const ev = await sb
    .from("evento_partida")
    .select("id, tipo, inscricao_id, atleta_id, periodo, minuto")
    .eq("partida_id", id)
    .order("periodo")
    .order("minuto", { nullsFirst: false })
    .order("created_at");
  if (ev.error) falhar("eventos", ev.error);
  const eventos = ev.data as EventoPartida[];
  const atletas = await atletasPorId(eventos.flatMap((e) => (e.atleta_id ? [e.atleta_id] : [])));
  return { partida, eventos, atletas };
}

// ---------------------------------------------------------------- equipes e atletas
export async function listarEquipes() {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("equipe").select(`${EQUIPE}, bairro, fundacao`).order("nome");
  if (error) falhar("listarEquipes", error);
  return data as (EquipeResumo & { id: string; bairro: string | null; fundacao: number | null })[];
}

export async function equipePorSlug(slug: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("equipe").select(`${EQUIPE}, bairro, fundacao`).eq("slug", slug).maybeSingle();
  if (error) falhar("equipePorSlug", error);
  if (!data) return null;
  const equipe = data as EquipeResumo & { id: string; bairro: string | null; fundacao: number | null };
  const insc = await sb
    .from("inscricao")
    .select(`id, colocacao_final, campeonato:campeonato!inner(${CAMP})`)
    .eq("equipe_id", equipe.id);
  if (insc.error) falhar("inscricoesEquipe", insc.error);
  const inscricoes = (insc.data as unknown as { id: string; colocacao_final: number | null; campeonato: CampeonatoResumo }[])
    .sort((a, b) => b.campeonato.temporada.ano - a.campeonato.temporada.ano || b.campeonato.categoria.ordem - a.campeonato.categoria.ordem);
  return { equipe, inscricoes };
}

export async function elenco(inscricaoId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("inscricao_atleta").select("atleta_id, numero").eq("inscricao_id", inscricaoId).order("numero");
  if (error) falhar("elenco", error);
  const linhas = data as { atleta_id: string; numero: number }[];
  const atletas = await atletasPorId(linhas.map((l) => l.atleta_id));
  return linhas.flatMap((l) => {
    const a = atletas.get(l.atleta_id);
    return a ? [{ ...a, numero: l.numero }] : [];
  });
}

export async function atletaPorSlug(slug: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("atleta_publico").select("*").eq("slug", slug).maybeSingle();
  if (error) falhar("atletaPorSlug", error);
  if (!data) return null;
  const atleta = data as AtletaPublico;
  const [insc, gols, cart] = await Promise.all([
    sb.from("inscricao_atleta")
      .select(`numero, inscricao:inscricao!inner(id, equipe:equipe(${EQUIPE}), campeonato:campeonato!inner(${CAMP}))`)
      .eq("atleta_id", atleta.id),
    sb.from("artilharia").select("campeonato_id, gols").eq("atleta_id", atleta.id),
    sb.from("disciplina").select("campeonato_id, amarelos, vermelhos").eq("atleta_id", atleta.id),
  ]);
  if (insc.error || gols.error || cart.error) falhar("atletaHistorico", insc.error ?? gols.error ?? cart.error);
  const golsPor = new Map((gols.data as { campeonato_id: string; gols: number }[]).map((g) => [g.campeonato_id, g.gols]));
  const cartPor = new Map(
    (cart.data as { campeonato_id: string; amarelos: number; vermelhos: number }[]).map((c) => [c.campeonato_id, c]),
  );
  const historico = (insc.data as unknown as {
    numero: number;
    inscricao: { id: string; equipe: EquipeResumo; campeonato: CampeonatoResumo };
  }[])
    .map((h) => ({
      numero: h.numero,
      equipe: h.inscricao.equipe,
      campeonato: h.inscricao.campeonato,
      gols: golsPor.get(h.inscricao.campeonato.id) ?? 0,
      amarelos: cartPor.get(h.inscricao.campeonato.id)?.amarelos ?? 0,
      vermelhos: cartPor.get(h.inscricao.campeonato.id)?.vermelhos ?? 0,
    }))
    .sort((a, b) => b.campeonato.temporada.ano - a.campeonato.temporada.ano);
  return { atleta, historico };
}

// ---------------------------------------------------------------- ranking e locais
export async function ranking(temporadaId: string, grupo: "base" | "principal") {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("ranking")
    .select("equipe_id, pontos, titulos, vices, participacoes")
    .eq("temporada_id", temporadaId)
    .eq("grupo_categoria", grupo);
  if (error) falhar("ranking", error);
  const equipes = new Map((await listarEquipes()).map((e) => [e.id, e]));
  type R = { equipe_id: string; pontos: number; titulos: number; vices: number; participacoes: number };
  return (data as R[])
    .map((r) => ({ ...r, pontos: Number(r.pontos), equipe: equipes.get(r.equipe_id)! }))
    .filter((r) => r.equipe)
    .sort((a, b) => b.pontos - a.pontos || b.titulos - a.titulos || b.vices - a.vices || a.equipe.nome.localeCompare(b.equipe.nome));
}

export async function localPorSlug(slug: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("local").select("id, nome, slug, endereco, bairro").eq("slug", slug).maybeSingle();
  if (error) falhar("localPorSlug", error);
  return data as { id: string; nome: string; slug: string; endereco: string | null; bairro: string | null } | null;
}

export async function listarLocais() {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("local").select("id, nome, slug, bairro").order("nome");
  if (error) falhar("listarLocais", error);
  return data as { id: string; nome: string; slug: string; bairro: string | null }[];
}

// ---------------------------------------------------------------- favoritos
export async function meusFavoritos() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return { campeonatos: new Set<string>(), equipes: new Set<string>(), logado: false };
  const { data, error } = await sb.from("favorito").select("campeonato_id, equipe_id");
  if (error) falhar("favoritos", error);
  const lista = data as { campeonato_id: string | null; equipe_id: string | null }[];
  return {
    campeonatos: new Set(lista.flatMap((f) => (f.campeonato_id ? [f.campeonato_id] : []))),
    equipes: new Set(lista.flatMap((f) => (f.equipe_id ? [f.equipe_id] : []))),
    logado: true,
  };
}
