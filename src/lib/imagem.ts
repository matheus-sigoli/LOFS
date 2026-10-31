// Validação de upload de foto por assinatura binária + remoção de metadados
// (EXIF/XMP podem conter GPS e dados do aparelho — relevante para atletas menores).

export type Formato = { ext: "jpg" | "png" | "webp"; mime: "image/jpeg" | "image/png" | "image/webp" };

export function detectarFormato(b: Uint8Array): Formato | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { ext: "png", mime: "image/png" };
  if (b.length > 12 && txt(b, 0, 4) === "RIFF" && txt(b, 8, 4) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

const txt = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** JPEG: remove segmentos APP1..APP15 (EXIF, XMP, etc.) e COM; mantém APP0 (JFIF). */
function limparJpeg(b: Uint8Array): Uint8Array | null {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marcador = b[i + 1]!;
    if (marcador === 0xda) { // início dos dados de imagem: copia o resto
      out.push(...b.subarray(i));
      return Uint8Array.from(out);
    }
    const tam = (b[i + 2]! << 8) | b[i + 3]!;
    if (tam < 2 || i + 2 + tam > b.length) return null;
    const descartar = (marcador >= 0xe1 && marcador <= 0xef) || marcador === 0xfe;
    if (!descartar) out.push(...b.subarray(i, i + 2 + tam));
    i += 2 + tam;
  }
  return null;
}

/** PNG: remove chunks de texto e eXIf; valida estrutura. */
function limparPng(b: Uint8Array): Uint8Array | null {
  const out: number[] = [...b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const tam = ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
    const tipo = txt(b, i + 4, 4);
    const fim = i + 12 + tam;
    if (fim > b.length) return null;
    if (!["eXIf", "tEXt", "zTXt", "iTXt", "tIME"].includes(tipo)) out.push(...b.subarray(i, fim));
    i = fim;
    if (tipo === "IEND") return Uint8Array.from(out);
  }
  return null;
}

/** WebP: remove chunks EXIF e XMP e ajusta o tamanho RIFF e as flags VP8X. */
function limparWebp(b: Uint8Array): Uint8Array | null {
  const partes: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const tipo = txt(b, i, 4);
    const tam = b[i + 4]! | (b[i + 5]! << 8) | (b[i + 6]! << 16) | (b[i + 7]! << 24);
    const fim = i + 8 + tam + (tam % 2);
    if (tam < 0 || fim > b.length + 1) return null;
    if (tipo !== "EXIF" && tipo !== "XMP ") {
      const chunk = Uint8Array.from(b.subarray(i, Math.min(fim, b.length)));
      if (tipo === "VP8X" && chunk.length > 8) chunk[8] = chunk[8]! & ~0x0c; // limpa flags EXIF/XMP
      partes.push(chunk);
    }
    i = fim;
  }
  const corpo = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(12 + corpo);
  out.set(b.subarray(0, 12));
  const riff = 4 + corpo;
  out[4] = riff & 255; out[5] = (riff >> 8) & 255; out[6] = (riff >> 16) & 255; out[7] = (riff >> 24) & 255;
  let o = 12;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

export function prepararFoto(bytes: Uint8Array, limite = 2 * 1024 * 1024): { ok: true; bytes: Uint8Array; formato: Formato } | { ok: false; motivo: string } {
  if (bytes.length === 0) return { ok: false, motivo: "Arquivo vazio." };
  if (bytes.length > limite) return { ok: false, motivo: "A foto precisa ter até 2 MB." };
  const formato = detectarFormato(bytes);
  if (!formato) return { ok: false, motivo: "Envie uma foto JPG, PNG ou WebP." };
  const limpo = formato.ext === "jpg" ? limparJpeg(bytes) : formato.ext === "png" ? limparPng(bytes) : limparWebp(bytes);
  if (!limpo) return { ok: false, motivo: "Arquivo de imagem corrompido." };
  return { ok: true, bytes: limpo, formato };
}
