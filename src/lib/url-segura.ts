// Validação de URL para a importação (ADR 0003). A busca em si é feita pela
// infraestrutura do Firecrawl, mas validamos para não enviar destinos internos
// nem esquemas perigosos, e para limitar a ferramenta a páginas públicas.

const HOST_BLOQUEADO = /^(localhost|.*\.local|.*\.internal|.*\.localhost|metadata(\..*)?)$/i;

function ipv4Privado(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export type ResultadoUrl = { ok: true; url: string } | { ok: false; motivo: string };

export function validarUrlImportacao(entrada: string): ResultadoUrl {
  const texto = entrada.trim();
  if (texto.length > 2048) return { ok: false, motivo: "O endereço é longo demais." };
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, motivo: "Cole um endereço completo, começando com https://." };
  }
  if (url.protocol !== "https:") return { ok: false, motivo: "Só aceitamos endereços https://." };
  if (url.username || url.password) return { ok: false, motivo: "O endereço não pode conter usuário ou senha." };
  if (url.port && url.port !== "443") return { ok: false, motivo: "Use a porta padrão (443)." };

  const host = url.hostname.toLowerCase();
  // WHATWG URL normaliza IPs decimais/octais/hex para a forma pontuada; IPv6 vem entre colchetes.
  if (host.startsWith("[") || host.includes(":")) return { ok: false, motivo: "Endereços IP não são aceitos." };
  if (/^[\d.]+$/.test(host)) return { ok: false, motivo: "Endereços IP não são aceitos." };
  if (ipv4Privado(host) || HOST_BLOQUEADO.test(host) || !host.includes(".")) {
    return { ok: false, motivo: "Esse endereço não é público." };
  }
  if (!/^[a-z0-9.-]+$/.test(host)) return { ok: false, motivo: "Domínios com caracteres especiais não são aceitos." };

  url.hash = "";
  return { ok: true, url: url.toString() };
}
