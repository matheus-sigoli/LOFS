import { redirect } from "next/navigation";

// Mensagens do painel por código (a URL só carrega o código, nunca texto livre → sem XSS refletido).
export const MENSAGENS = {
  ok: {
    salvo: "Alterações salvas.",
    criado: "Criado com sucesso.",
    removido: "Removido.",
    evento: "Lance registrado.",
    status: "Status da partida atualizado.",
    tabela: "Tabela de jogos gerada.",
    papel: "Acesso concedido.",
    importado: "Página extraída. Revise os dados abaixo.",
    aplicado: "Equipes importadas.",
    mfa: "Verificação em duas etapas ativada.",
  },
  erro: {
    invalido: "Confira os campos destacados e tente de novo.",
    permissao: "Você não tem permissão para isso.",
    banco: "O banco recusou a operação. Verifique se os dados fazem sentido (equipe inscrita, partida ao vivo etc.).",
    duplicado: "Já existe um registro com esses dados.",
    limite: "Muitas tentativas seguidas. Espere um minuto.",
    usuario: "Esse e-mail ainda não tem conta. Peça para a pessoa entrar no site uma vez.",
    url: "Endereço não aceito.",
    firecrawl: "A extração falhou. Confira o endereço ou tente mais tarde.",
    semchave: "Importação desativada: configure FIRECRAWL_API_KEY no servidor.",
    codigo: "Código incorreto ou expirado. Use o código atual do aplicativo.",
  },
} as const;

export type CodigoOk = keyof typeof MENSAGENS.ok;
export type CodigoErro = keyof typeof MENSAGENS.erro;

export function voltar(caminho: string, r: { ok: CodigoOk } | { erro: CodigoErro }): never {
  const url = new URL(caminho, "http://interno");
  url.searchParams.delete("ok");
  url.searchParams.delete("erro");
  url.searchParams.set("ok" in r ? "ok" : "erro", "ok" in r ? r.ok : r.erro);
  redirect(`${url.pathname}${url.search}`);
}

/** Converte erro do Postgres em código de mensagem. */
export function codigoDoBanco(e: { code?: string } | null): CodigoErro {
  if (!e) return "banco";
  if (e.code === "42501") return "permissao";
  if (e.code === "23505") return "duplicado";
  return "banco";
}
