import { Aviso } from "@/components/Aviso";
import { Escudo } from "@/components/Escudo";
import { exigirAdmin } from "@/lib/auth";
import { listarEquipes } from "@/lib/consultas";
import { salvarEquipe } from "./acoes";

export const metadata = { title: "Equipes" };

type E = { id?: string; nome?: string; nome_curto?: string; bairro?: string | null; fundacao?: number | null; cor_primaria?: string; cor_secundaria?: string };

export default async function PainelEquipes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; editar?: string }> }) {
  await exigirAdmin();
  const b = await searchParams;
  const equipes = await listarEquipes();
  const editando = equipes.find((e) => e.id === b.editar);
  return (
    <div>
      <Aviso ok={b.ok} erro={b.erro} />
      <h1 className="titulo-pagina">Equipes</h1>
      <section className="mt-6 max-w-3xl">
        <h2 className="titulo-secao">{editando ? `Editar ${editando.nome}` : "Nova equipe"}</h2>
        <FormEquipe e={editando ?? {}} />
      </section>
      <table className="tabela mt-10 max-w-3xl">
        <caption className="sr-only">Equipes cadastradas</caption>
        <thead><tr><th className="esq" scope="col">Equipe</th><th className="esq" scope="col">Bairro</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {equipes.map((e) => (
            <tr key={e.id}>
              <td className="esq"><span className="inline-flex items-center gap-2"><Escudo equipe={e} tamanho={24} />{e.nome}</span></td>
              <td className="esq text-texto-2">{e.bairro}</td>
              <td><a href={`/painel/equipes?editar=${e.id}`} className="text-sm font-semibold underline">Editar</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormEquipe({ e }: { e: E }) {
  return (
    <form action={salvarEquipe} className="mt-4 grid gap-4 rounded-xl bg-superficie p-4 ring-1 ring-linha sm:grid-cols-6">
      {e.id ? <input type="hidden" name="id" value={e.id} /> : null}
      <div className="sm:col-span-3"><label htmlFor="nome" className="rotulo">Nome</label><input autoComplete="off" id="nome" name="nome" required maxLength={80} defaultValue={e.nome} className="campo" /></div>
      <div className="sm:col-span-1"><label htmlFor="nome_curto" className="rotulo">Sigla</label><input autoComplete="off" id="nome_curto" name="nome_curto" required minLength={2} maxLength={4} pattern="[A-Za-z0-9]{2,4}" defaultValue={e.nome_curto} className="campo uppercase" /></div>
      <div className="sm:col-span-2"><label htmlFor="fundacao" className="rotulo">Fundação</label><input autoComplete="off" id="fundacao" name="fundacao" type="number" min={1900} max={2100} defaultValue={e.fundacao ?? ""} className="campo" /></div>
      <div className="sm:col-span-2"><label htmlFor="bairro" className="rotulo">Bairro</label><input autoComplete="off" id="bairro" name="bairro" maxLength={80} defaultValue={e.bairro ?? ""} className="campo" /></div>
      <div className="sm:col-span-2"><label htmlFor="cor_primaria" className="rotulo">Cor principal</label><input id="cor_primaria" name="cor_primaria" type="color" defaultValue={e.cor_primaria ?? "#1f9d55"} className="campo h-11 p-1" /></div>
      <div className="sm:col-span-2"><label htmlFor="cor_secundaria" className="rotulo">Cor secundária</label><input id="cor_secundaria" name="cor_secundaria" type="color" defaultValue={e.cor_secundaria ?? "#ffffff"} className="campo h-11 p-1" /></div>
      <div className="flex gap-3 sm:col-span-6">
        <button type="submit" className="botao botao-primario">{e.id ? "Salvar equipe" : "Criar equipe"}</button>
        {e.id ? <a href="/painel/equipes" className="botao botao-secundario">Cancelar</a> : null}
      </div>
    </form>
  );
}
