# ADR 0008 — Pivô: site da LOFS (Liga Osasquense de Futsal)

- **Status:** Aceito · 2026-10-31 · **Substitui** o tema da ADR 0001 e o nome pendente da ADR 0007

## Contexto
O usuário trocou o tema: em vez da Federação Paulista de Futsal, o site é da **LOFS — Liga Osasquense de Futsal**. Não foi encontrada liga real com esse nome; tratada como entidade do próprio projeto.

## Decisão
- Marca, nome e logo próprios da LOFS.
- eventos.admfutsal.com.br vira **referência de estrutura** (Temporada → Campeonato → Divisão → Categoria, classificação, jogos, artilharia, cartões, ranking, favoritos), não fonte de dados.
- Importar dados reais da FPFS sob a marca LOFS seria enganoso → ver ADR 0003 (revisão pendente).

## Consequências
- Questão de marca resolvida.
- Seed e papel do Firecrawl precisam ser redefinidos.
