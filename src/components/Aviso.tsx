import { MENSAGENS } from "@/lib/painel";

export function Aviso({ ok, erro }: { ok?: string; erro?: string }) {
  const msgOk = ok && ok in MENSAGENS.ok ? MENSAGENS.ok[ok as keyof typeof MENSAGENS.ok] : null;
  const msgErro = erro && erro in MENSAGENS.erro ? MENSAGENS.erro[erro as keyof typeof MENSAGENS.erro] : null;
  if (msgErro) return <p role="alert" className="mb-6 rounded-lg bg-vermelho-suave px-4 py-3 text-sm font-semibold text-vermelho">{msgErro}</p>;
  if (msgOk) return <p role="status" className="mb-6 rounded-lg bg-verde-suave px-4 py-3 text-sm font-semibold text-verde">{msgOk}</p>;
  return null;
}
