# ADR 0009 — Regra do ranking da temporada

- **Status:** Aceito · 2026-10-31

## Decisão
Ranking por **grupo de categoria** (Base / Principal) e temporada, somando a colocação final da equipe em cada campeonato encerrado:

| Colocação | Pontos |
|---|---|
| Campeão | 10 |
| Vice | 8 |
| 3º | 6 |
| 4º | 5 |
| 5º–8º | 3 |
| Demais (participação) | 1 |

Série **Ouro vale o dobro** da Prata (multiplicador por série, configurável). Empate no ranking: mais títulos → mais vices → melhor saldo somado.

## Consequências
- Colocação final é gravada ao encerrar o campeonato (`inscricao.colocacao_final`), definida pelo mata-mata ou pela classificação.
