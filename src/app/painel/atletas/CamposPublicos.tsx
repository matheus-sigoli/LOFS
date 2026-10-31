import { rotuloPosicao } from "@/lib/format";

export function CamposPublicos({ a }: { a?: { nome_esportivo: string; nome_completo: string; ano_nascimento: number | null; posicao: string | null } }) {
  return (
    <>
      <div><label htmlFor="nome_completo" className="rotulo">Nome completo</label><input autoComplete="off" id="nome_completo" name="nome_completo" required minLength={3} maxLength={120} defaultValue={a?.nome_completo} className="campo" /></div>
      <div><label htmlFor="nome_esportivo" className="rotulo">Nome esportivo</label><input autoComplete="off" id="nome_esportivo" name="nome_esportivo" required minLength={2} maxLength={40} defaultValue={a?.nome_esportivo} className="campo" /></div>
      <div><label htmlFor="ano_nascimento" className="rotulo">Ano de nascimento</label><input autoComplete="off" id="ano_nascimento" name="ano_nascimento" type="number" min={1940} max={2100} defaultValue={a?.ano_nascimento ?? ""} className="campo" /></div>
      <div>
        <label htmlFor="posicao" className="rotulo">Posição</label>
        <select id="posicao" name="posicao" defaultValue={a?.posicao ?? ""} className="campo">
          <option value="">Não informada</option>
          {Object.entries(rotuloPosicao).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
    </>
  );
}
