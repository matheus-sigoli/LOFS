# ADR 0007 — Direção visual, dados de exemplo e ambiente

- **Status:** Aceito (revisado após ADR 0008) · 2026-10-31

## Decisão
- **Visual esportivo editorial, tema escuro por padrão**: verde + vermelho + branco sobre fundo escuro; tipografia condensada forte, números de placar grandes, tabelas densas e legíveis. Modo claro disponível. Vermelho reservado para destaque/ao vivo/cartão vermelho, nunca como único portador de significado.
- **Seed totalmente fictício, estilo Osasco**: equipes com nomes de bairros de Osasco, atletas com nomes gerados (sem fotos), jogos e placares coerentes com a classificação.
- **Estrutura**: Séries Ouro/Prata com acesso e rebaixamento; categorias Sub-9 a Sub-17, Adulto, Veteranos e Feminino.
- **Ambiente**: Supabase local (CLI + Docker) e migrations versionadas; importador ativado quando `FIRECRAWL_API_KEY` existir.
