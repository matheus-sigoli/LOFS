# ADR 0005 — Classificação calculada e formatos de disputa

- **Status:** Aceito · 2026-10-31

## Decisão
- Pontuação padrão **3/1/0**, configurável por campeonato.
- Critérios de desempate padrão (ordem configurável): pontos → vitórias → saldo de gols → gols pró → confronto direto → menos cartões vermelhos → menos amarelos → sorteio.
- Formatos: **grupos** (turno/returno) e **mata-mata** (jogo único ou ida/volta), com **pênaltis/tiros livres** registrados na súmula.
- Classificação é **derivada** das partidas encerradas (view no Postgres), nunca digitada à mão.

## Consequências
- Corrigir uma súmula atualiza a tabela automaticamente.
- Confronto direto exige cálculo em subconjunto (função SQL).
