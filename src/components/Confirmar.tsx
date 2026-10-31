/**
 * Ação destrutiva em dois passos, sem JavaScript: o primeiro clique abre a
 * confirmação; só o segundo envia o formulário.
 */
export function Confirmar({ acao, rotulo, pergunta, confirmar, campos, compacto }: {
  acao: (form: FormData) => Promise<void>;
  rotulo: string;
  pergunta: string;
  confirmar: string;
  campos: Record<string, string>;
  compacto?: boolean;
}) {
  return (
    <details className="group relative inline-block">
      <summary className={`list-none [&::-webkit-details-marker]:hidden ${compacto ? "cursor-pointer text-sm font-semibold text-vermelho underline" : "botao botao-perigo cursor-pointer"}`}>
        {rotulo}
      </summary>
      <form action={acao} className="absolute right-0 z-10 mt-2 w-64 rounded-lg bg-superficie-2 p-3 text-left shadow-lg ring-1 ring-linha-forte">
        {Object.entries(campos).map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />)}
        <p className="text-sm text-texto">{pergunta}</p>
        <button type="submit" className="botao botao-perigo mt-3 min-h-9 w-full text-sm">{confirmar}</button>
      </form>
    </details>
  );
}
