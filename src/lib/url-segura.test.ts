import { test } from "node:test";
import assert from "node:assert/strict";
import { validarUrlImportacao } from "./url-segura.ts";

test("aceita https público", () => {
  const r = validarUrlImportacao("https://eventos.admfutsal.com.br/campeonato?id=1#x");
  assert.deepEqual(r, { ok: true, url: "https://eventos.admfutsal.com.br/campeonato?id=1" });
});

for (const ruim of [
  "http://exemplo.com",
  "javascript:alert(1)",
  "https://localhost/x",
  "https://127.0.0.1/",
  "https://2130706433/",
  "https://0x7f.0x0.0x0.0x1/",
  "https://[::1]/",
  "https://169.254.169.254/latest",
  "https://metadata.google.internal/",
  "https://user:senha@exemplo.com/",
  "https://exemplo.com:8080/",
  "https://intranet/",
  "file:///etc/passwd",
]) {
  test(`bloqueia ${ruim}`, () => assert.equal(validarUrlImportacao(ruim).ok, false));
}
