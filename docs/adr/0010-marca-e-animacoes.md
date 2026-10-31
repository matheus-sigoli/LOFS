# ADR 0010 — Marca oficial e animações Lottie

- **Status:** Aceito · 2026-10-31

## Decisão
- **Marca:** escudo oficial da LOFS (`public/marca/lofs.png`) no cabeçalho, rodapé e ícones (favicon/apple-icon).
- **Distintivos das equipes** seguem o desenho do escudo: contorno grafite, faixa superior com a sigla e faixas verticais nas cores do time. Abaixo de 30px a sigla é omitida.
- **Animações Lottie** geradas por código (`scripts/gerar_animacoes.py` → `src/animacoes/*.json`), tocadas com `lottie-web` *light* (só SVG, sem `eval`, compatível com a CSP com nonce):
  - `escudo` — o escudo se monta (contorno, faixas, letras, bola na rede). Toca **uma vez** na home.
  - `carregando` — bola quicando, em loop, na tela de carregamento.
  - `bola-fora` — bola acerta a trave e sai, na página 404.
- **Acessibilidade:** com `prefers-reduced-motion`, mostra o quadro final (ou o inicial nos loops) sem animar; loops pausam fora da tela.

## Consequências
- Um único momento animado por página (sem efeitos espalhados).
- Para editar uma animação: ajuste o gerador e rode `npm run animacoes`.
