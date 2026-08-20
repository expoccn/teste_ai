# Atualização do repositório teste_ai — v1.1

## Como aplicar

Substitua no repositório `expoccn/teste_ai` os arquivos/pastas do pacote v1.1 pelos equivalentes existentes.

Os Secrets do GitHub **não precisam ser recriados**.

Depois faça commit/push e execute:

- Actions → `IA Regression - Claro RJO-AM`
- `Run workflow`
- `test_group`: `PUE-001`

## O que mudou

1. `getByLabel('Senha')` foi removido.
2. Login usa `#username` e `#password`, confirmados no frontend v18 e no Artifact da execução que falhou.
3. Seletores da tela de IA foram estreitados para evitar ambiguidades futuras.
4. O runner valida o payload real enviado a `/ai-chat`.
5. Falhas agora registram `phase` e `failure_type`.
6. Toda falha gera `test-diagnostic.json`.
7. O resumo diferencia `SEMANTIC` de `AUTOMATION`.
8. GitHub Actions atualizado para Node.js 24 / actions com runtime Node.js 24.

## Resultado esperado no próximo PUE-001

A falha anterior em `login` não deve se repetir. Se o workflow 42 ainda estiver com a classificação atual, esperamos chegar ao n8n, obter `execution_id` e então registrar uma falha `SEMANTIC` mostrando a intenção recebida versus a esperada.
