/** Valida um caminho de retorno: só caminhos internos (evita open redirect). */
export function caminhoSeguro(valor: unknown, padrao = "/"): string {
  if (typeof valor !== "string") return padrao;
  if (!/^\/(?!\/|\\)[A-Za-z0-9\-._~/?=&%]*$/.test(valor)) return padrao;
  return valor;
}
