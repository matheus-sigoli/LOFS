// Ordenação da classificação (ADR 0005): critérios configuráveis por campeonato,
// incluindo confronto direto calculado só entre as equipes empatadas.

export type Criterio =
  | "pontos" | "vitorias" | "saldo" | "gols_pro"
  | "confronto_direto" | "menos_vermelhos" | "menos_amarelos";

export const CRITERIOS_PADRAO: Criterio[] = [
  "pontos", "vitorias", "saldo", "gols_pro", "confronto_direto", "menos_vermelhos", "menos_amarelos",
];

export const rotuloCriterio: Record<Criterio, string> = {
  pontos: "Pontos",
  vitorias: "Vitórias",
  saldo: "Saldo de gols",
  gols_pro: "Gols marcados",
  confronto_direto: "Confronto direto",
  menos_vermelhos: "Menos cartões vermelhos",
  menos_amarelos: "Menos cartões amarelos",
};

export interface LinhaTabela {
  inscricao_id: string;
  pontos: number;
  vitorias: number;
  saldo: number;
  gols_pro: number;
  amarelos: number;
  vermelhos: number;
}

export interface JogoEncerrado {
  mandante_id: string;
  visitante_id: string;
  gols_mandante: number;
  gols_visitante: number;
}

export interface Pontuacao { vitoria: number; empate: number; derrota: number }

function pontosConfronto(ids: Set<string>, jogos: JogoEncerrado[], p: Pontuacao) {
  const pts = new Map<string, { pontos: number; saldo: number; gols: number }>();
  for (const id of ids) pts.set(id, { pontos: 0, saldo: 0, gols: 0 });
  for (const j of jogos) {
    if (!ids.has(j.mandante_id) || !ids.has(j.visitante_id)) continue;
    const m = pts.get(j.mandante_id)!;
    const v = pts.get(j.visitante_id)!;
    m.gols += j.gols_mandante; v.gols += j.gols_visitante;
    m.saldo += j.gols_mandante - j.gols_visitante; v.saldo += j.gols_visitante - j.gols_mandante;
    if (j.gols_mandante > j.gols_visitante) { m.pontos += p.vitoria; v.pontos += p.derrota; }
    else if (j.gols_mandante < j.gols_visitante) { v.pontos += p.vitoria; m.pontos += p.derrota; }
    else { m.pontos += p.empate; v.pontos += p.empate; }
  }
  return pts;
}

function valor(l: LinhaTabela, c: Exclude<Criterio, "confronto_direto">): number {
  switch (c) {
    case "pontos": return l.pontos;
    case "vitorias": return l.vitorias;
    case "saldo": return l.saldo;
    case "gols_pro": return l.gols_pro;
    case "menos_vermelhos": return -l.vermelhos;
    case "menos_amarelos": return -l.amarelos;
  }
}

/**
 * Ordena aplicando os critérios em sequência. Em cada etapa, separa as equipes
 * ainda empatadas em blocos e desempata o bloco com o critério seguinte.
 * Persistindo o empate, mantém ordem estável por id (o regulamento prevê sorteio).
 */
export function ordenarClassificacao<T extends LinhaTabela>(
  linhas: T[],
  jogos: JogoEncerrado[],
  criterios: Criterio[] = CRITERIOS_PADRAO,
  pontuacao: Pontuacao = { vitoria: 3, empate: 1, derrota: 0 },
): T[] {
  const resolver = (bloco: T[], i: number): T[] => {
    if (bloco.length <= 1 || i >= criterios.length) {
      return [...bloco].sort((a, b) => a.inscricao_id.localeCompare(b.inscricao_id));
    }
    const c = criterios[i]!;
    let chave: (l: T) => number[];
    if (c === "confronto_direto") {
      const cd = pontosConfronto(new Set(bloco.map((l) => l.inscricao_id)), jogos, pontuacao);
      chave = (l) => {
        const x = cd.get(l.inscricao_id)!;
        return [x.pontos, x.saldo, x.gols];
      };
    } else {
      chave = (l) => [valor(l, c)];
    }
    const comparar = (a: number[], b: number[]) => {
      for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return b[k]! - a[k]!;
      return 0;
    };
    const ordenado = [...bloco].sort((a, b) => comparar(chave(a), chave(b)));
    const saida: T[] = [];
    let inicio = 0;
    for (let k = 1; k <= ordenado.length; k++) {
      if (k === ordenado.length || comparar(chave(ordenado[inicio]!), chave(ordenado[k]!)) !== 0) {
        saida.push(...resolver(ordenado.slice(inicio, k), i + 1));
        inicio = k;
      }
    }
    return saida;
  };
  return resolver(linhas, 0);
}
