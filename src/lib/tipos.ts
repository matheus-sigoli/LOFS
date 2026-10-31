export type StatusPartida = "agendada" | "ao_vivo" | "encerrada" | "adiada" | "cancelada";
export type StatusCampeonato = "rascunho" | "publicado" | "encerrado";
export type TipoEvento = "gol" | "gol_contra" | "amarelo" | "vermelho" | "penalti_convertido" | "penalti_perdido";

export interface EquipeResumo {
  id?: string;
  nome: string;
  nome_curto: string;
  slug: string;
  cor_primaria: string;
  cor_secundaria: string;
}

export interface CampeonatoResumo {
  id: string;
  slug: string;
  status: StatusCampeonato;
  titulo: { nome: string; slug: string };
  serie: { nome: string; slug: string; ordem: number };
  categoria: { nome: string; slug: string; grupo: "base" | "principal"; ordem: number };
  temporada: { ano: number };
}

export interface Campeonato extends CampeonatoResumo {
  pontos_vitoria: number;
  pontos_empate: number;
  pontos_derrota: number;
  criterios_desempate: string[];
}

export interface PartidaResumo {
  id: string;
  data_hora: string | null;
  status: StatusPartida;
  gols_mandante: number;
  gols_visitante: number;
  penaltis_mandante: number | null;
  penaltis_visitante: number | null;
  rodada: number | null;
  chave: string | null;
  grupo: { nome: string } | null;
  fase: {
    nome: string;
    tipo: "grupos" | "mata_mata";
    campeonato: { slug: string; titulo: { nome: string }; serie: { nome: string }; categoria: { nome: string } };
  };
  local: { nome: string; slug: string } | null;
  mandante: { id: string; equipe: EquipeResumo };
  visitante: { id: string; equipe: EquipeResumo };
}

export interface LinhaClassificacao {
  inscricao_id: string;
  grupo_id: string;
  grupo_nome: string;
  equipe_id: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo: number;
  pontos: number;
  amarelos: number;
  vermelhos: number;
}

export interface AtletaPublico {
  id: string;
  slug: string;
  nome_esportivo: string;
  posicao: string | null;
  consentido: boolean;
  nome_completo: string | null;
  ano_nascimento: number | null;
  foto_path: string | null;
}

export interface EventoPartida {
  id: string;
  tipo: TipoEvento;
  inscricao_id: string;
  atleta_id: string | null;
  periodo: number;
  minuto: number | null;
}
