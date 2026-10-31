const TZ = "America/Sao_Paulo";

const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const diaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" });
const dataLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const iso = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmt = {
  dataCurta: (d: string | Date) => dataCurta.format(new Date(d)),
  diaSemana: (d: string | Date) => diaSemana.format(new Date(d)).replace(".", ""),
  dataLonga: (d: string | Date) => dataLonga.format(new Date(d)),
  hora: (d: string | Date) => hora.format(new Date(d)),
  /** AAAA-MM-DD no fuso de Osasco */
  diaISO: (d: string | Date) => iso.format(new Date(d)),
};

/** Início e fim (UTC) de um dia no fuso de São Paulo (UTC-3, sem horário de verão). */
export function intervaloDoDia(diaISO: string) {
  const inicio = new Date(`${diaISO}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export function somarDias(diaISO: string, n: number) {
  const d = new Date(`${diaISO}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt.diaISO(d);
}

export const rotuloPosicao: Record<string, string> = {
  goleiro: "Goleiro",
  fixo: "Fixo",
  ala: "Ala",
  pivo: "Pivô",
};

export const rotuloStatus: Record<string, string> = {
  agendada: "Agendada",
  ao_vivo: "Ao vivo",
  encerrada: "Encerrada",
  adiada: "Adiada",
  cancelada: "Cancelada",
};
