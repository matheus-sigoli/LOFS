import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoSeguro } from "./caminho.ts";

test("aceita caminho interno", () => assert.equal(caminhoSeguro("/painel/partidas?x=1"), "/painel/partidas?x=1"));
for (const ruim of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a@evil.com", " /x", "/x\n", null]) {
  test(`recusa ${JSON.stringify(ruim)}`, () => assert.equal(caminhoSeguro(ruim), "/"));
}
