# Glossário do domínio — LOFS · Liga Osasquense de Futsal (projeto acadêmico)

> Site da **LOFS — Liga Osasquense de Futsal**, liga do próprio projeto acadêmico (Osasco/SP).
> eventos.admfutsal.com.br (FPFS) serve só como **referência de estrutura** (entidades, filtros, páginas), não como fonte de dados da LOFS.

| Termo | Definição | Observações |
|---|---|---|
| **Temporada** | Ano esportivo (ex.: 2026). | |
| **Título** | Nome da competição recorrente (ex.: "Campeonato Osasquense", "Copa LOFS"). | Existe entre temporadas. |
| **Série** | Nível de acesso dentro de um título: **Ouro** ou **Prata** (ou Única). Há acesso e rebaixamento entre temporadas. | Equivale à "Divisão" (A1/A2) da referência. |
| **Categoria** | Faixa etária/naipe: Sub-9, Sub-11, Sub-13, Sub-15, Sub-17, Adulto, Veteranos (masc.) e Feminino. | |
| **Grupo de categoria** | Agrupamento usado no ranking: Base (Sub-9 a Sub-17) e Principal (Adulto, Veteranos, Feminino). | |
| **Campeonato (Evento)** | Combinação Título + Temporada + Série + Categoria. É a unidade que tem tabela, jogos e artilharia. | Ex.: "Osasquense · Ouro · Sub-15 · 2026". |
| **Fase** | Etapa de um campeonato: grupos (turno/returno) ou mata-mata (jogo único/ida e volta). | ADR 0005 |
| **Grupo (chave)** | Subdivisão de uma fase em que as equipes se enfrentam. | Não confundir com *Grupo de categoria*. |
| **Equipe** | Clube/entidade filiada que inscreve times em campeonatos. | |
| **Inscrição** | Vínculo de uma equipe a um campeonato. | |
| **Atleta** | Pessoa cadastrada que joga por equipes. | Perfil público depende de consentimento (ADR 0004). |
| **Partida (Jogo)** | Confronto entre duas equipes em uma fase/grupo, com data, local e placar. | |
| **Súmula** | Registro oficial da partida: gols, cartões, ocorrências. | Lançada no painel admin. |
| **Classificação** | Tabela calculada a partir das partidas encerradas de um grupo. | 3/1/0 + desempate (ADR 0005). |
| **Artilharia** | Ranking de gols por atleta em um campeonato. | |
| **Disciplina (Cartões)** | Amarelos/vermelhos por atleta e equipe. | |
| **Ranking** | Pontuação acumulada das equipes por grupo de categoria e série na temporada. | _A definir: regra de cálculo._ |
| **Favorito** | Campeonato/equipe que o torcedor logado acompanha. | ADR 0006 |
| **Mesário** | Usuário do painel que lança súmulas dos jogos atribuídos a ele. | ADR 0006 |
| **Importação** | Extração de uma URL externa (via Firecrawl) para área de revisão antes de virar dado da liga. | ADR 0003 |
| **Local (Ginásio)** | Onde a partida é disputada. | |
