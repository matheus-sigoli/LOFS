# ADR 0004 — Perfil completo de atleta, condicionado a consentimento

- **Status:** Aceito com condições · 2026-10-31

## Contexto
O site exibirá perfil completo com foto. Boa parte dos atletas é menor de idade (categorias de base), o que pela LGPD (art. 14) exige consentimento específico de um dos pais/responsável.

## Decisão
- Campos públicos (foto, idade/data de nascimento) só aparecem se `consentimento_publicacao` estiver registrado (responsável, data, versão do termo). Sem consentimento: nome esportivo + número.
- Exibir **idade/categoria**, nunca data de nascimento completa; documentos (RG/CPF) nunca são públicos e ficam em tabela separada com RLS restrito.
- Fotos no Supabase Storage em bucket privado, servidas por URL assinada/transformada após consentimento; EXIF removido no upload.
- **O importador nunca traz fotos, documentos ou datas de nascimento** do site de referência.
- Responsável pode solicitar remoção (fluxo no painel).

## Consequências
- Mais campos e um fluxo de consentimento no painel.
- Projeto demonstra conformidade com LGPD.
