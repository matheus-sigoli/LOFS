# ADR 0003 — Painel admin como fonte de verdade; Firecrawl como ferramenta de importação

- **Status:** Aceito (revisado após ADR 0008) · 2026-10-31

## Decisão
- O **painel admin** é a fonte de verdade: campeonatos, equipes, atletas, partidas e súmulas.
- **Firecrawl** vira uma **ferramenta de importação no painel**: o admin cola uma URL de tabela/súmula, o servidor chama `/scrape` com extração estruturada (JSON schema) e grava em tabelas de *staging*; nada vai para as tabelas públicas sem revisão e confirmação.
- Não há importação automática de eventos.admfutsal.com.br.

## Segurança
- Só admin acessa; chamada apenas no servidor; `FIRECRAWL_API_KEY` em variável de ambiente.
- URL validada (só `https`, sem IPs privados/localhost), limite de tamanho e rate limit por usuário.
- Conteúdo extraído tratado como dado não confiável: validado com Zod, nunca renderizado como HTML.
- Registro de auditoria (quem importou, URL, quando).

## Consequências
- Recurso demonstrável no projeto sem depender de dados de terceiros.
