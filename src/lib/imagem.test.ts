import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararFoto } from "./imagem.ts";

const seg = (marcador: number, dados: number[]) => [0xff, marcador, ((dados.length + 2) >> 8) & 255, (dados.length + 2) & 255, ...dados];
const gps = [...Buffer.from("Exif\0\0GPS-LATITUDE-23.53")];

test("JPEG: remove EXIF e mantém o resto", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [...Buffer.from("JFIF\0")]), ...seg(0xe1, gps), ...seg(0xdb, [1, 2, 3]), 0xff, 0xda, 0, 4, 9, 9, 0xff, 0xd9]);
  const r = prepararFoto(jpeg);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.formato.ext, "jpg");
    assert.ok(!Buffer.from(r.bytes).includes("GPS"), "ainda contém EXIF");
    assert.ok(Buffer.from(r.bytes).includes("JFIF"));
    assert.equal(r.bytes.length, jpeg.length - (gps.length + 4));
  }
});

test("rejeita arquivo que finge ser imagem", () => {
  const r = prepararFoto(Uint8Array.from(Buffer.from("<svg onload=alert(1)>")));
  assert.equal(r.ok, false);
});

test("rejeita arquivo grande", () => {
  const r = prepararFoto(new Uint8Array(3 * 1024 * 1024).fill(0xff));
  assert.equal(r.ok, false);
});

test("PNG: remove chunk de texto", () => {
  const chunk = (tipo: string, dados: number[]) => {
    const t = dados.length;
    return [(t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255, ...Buffer.from(tipo), ...dados, 0, 0, 0, 0];
  };
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", new Array(13).fill(1)), ...chunk("tEXt", [...Buffer.from("GPS=x")]), ...chunk("IEND", [])]);
  const r = prepararFoto(png);
  assert.ok(r.ok);
  if (r.ok) assert.ok(!Buffer.from(r.bytes).includes("GPS"));
});
