import { test } from "node:test";
import assert from "node:assert/strict";
import { ordenarClassificacao, type LinhaTabela } from "./classificacao.ts";

const linha = (id: string, o: Partial<LinhaTabela> = {}): LinhaTabela => ({
  inscricao_id: id, pontos: 0, vitorias: 0, saldo: 0, gols_pro: 0, amarelos: 0, vermelhos: 0, ...o,
});

test("ordena por pontos", () => {
  const r = ordenarClassificacao([linha("a", { pontos: 3 }), linha("b", { pontos: 9 }), linha("c", { pontos: 6 })], []);
  assert.deepEqual(r.map((l) => l.inscricao_id), ["b", "c", "a"]);
});

test("empate em pontos e vitórias decide pelo saldo", () => {
  const r = ordenarClassificacao([
    linha("a", { pontos: 6, vitorias: 2, saldo: 1 }),
    linha("b", { pontos: 6, vitorias: 2, saldo: 4 }),
  ], []);
  assert.deepEqual(r.map((l) => l.inscricao_id), ["b", "a"]);
});

test("confronto direto entre empatados em tudo antes dele", () => {
  const base = { pontos: 6, vitorias: 2, saldo: 2, gols_pro: 8 };
  const r = ordenarClassificacao(
    [linha("a", base), linha("b", base)],
    [{ mandante_id: "a", visitante_id: "b", gols_mandante: 1, gols_visitante: 3 }],
  );
  assert.deepEqual(r.map((l) => l.inscricao_id), ["b", "a"]);
});

test("confronto direto ignora jogos contra quem não está empatado", () => {
  const base = { pontos: 4, vitorias: 1, saldo: 0, gols_pro: 5 };
  const r = ordenarClassificacao(
    [linha("a", base), linha("b", base), linha("c", { pontos: 9, vitorias: 3 })],
    [
      { mandante_id: "a", visitante_id: "c", gols_mandante: 9, gols_visitante: 0 },
      { mandante_id: "b", visitante_id: "a", gols_mandante: 2, gols_visitante: 1 },
    ],
  );
  assert.deepEqual(r.map((l) => l.inscricao_id), ["c", "b", "a"]);
});

test("respeita a ordem configurada (cartões antes do saldo)", () => {
  const r = ordenarClassificacao(
    [linha("a", { pontos: 3, saldo: 5, vermelhos: 1 }), linha("b", { pontos: 3, saldo: 0 })],
    [],
    ["pontos", "menos_vermelhos", "saldo"],
  );
  assert.deepEqual(r.map((l) => l.inscricao_id), ["b", "a"]);
});
