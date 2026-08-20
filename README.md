# Claro RJO-AM — Harness E2E / IA

Este repositório executa regressão ponta a ponta da tela **Análises por IA** e correlaciona cada pergunta com a execução real do workflow 42 no n8n.

O teste não considera `Execution successful` como aprovação. Ele verifica:

1. login no frontend real;
2. período selecionado;
3. pergunta enviada pela UI;
4. resposta HTTP de `/ai-chat`;
5. resposta renderizada na tela;
6. execução n8n correspondente;
7. nodes realmente executados;
8. `intent`, `temporal_query`, `used_llm`, evidências e limitações;
9. regras semânticas específicas de cada pergunta.

## Secrets obrigatórios

Configure em **Settings → Secrets and variables → Actions → Repository secrets**:

- `FRONTEND_URL` — `https://claro-rj-am.2see.io`
- `FRONTEND_TEST_USER` — usuário exclusivo de testes
- `FRONTEND_TEST_PASSWORD` — senha desse usuário
- `N8N_URL` — URL base do n8n, sem `/api/v1`
- `N8N_API_KEY` — chave temporária/restrita da Public API
- `N8N_AI_WORKFLOW_ID` — opcional, mas recomendado; ID do workflow 42 no n8n

Em **Repository variables**, opcional:

- `N8N_AI_WORKFLOW_NAME` — prefixo/nome do workflow 42. Se não definido, usa `42 CLARO RJO-AM - IA Chat`.

Nenhuma credencial deve ser commitada no Git.

## Executar

Abra **Actions → IA Regression - Claro RJO-AM → Run workflow**.

O campo `test_group` pode ficar vazio para executar tudo, ou receber um grupo/ID, por exemplo:

- `pue`
- `temporal`
- `gemini`
- `PUE-001`

## Artefatos

Cada execução publica:

- `AI_REGRESSION_SUMMARY.md` — resumo PASS/FAIL;
- `semantic-results.json` — resultado estruturado;
- relatório HTML do Playwright;
- screenshots/traces/vídeos de falhas;
- para cada teste, resumo da execução do n8n com os nodes executados e o contexto determinístico.

## Primeiro teste importante

`PUE-001 — Como está o PUE no período?`

Esperado:

- `intent = pue`;
- `used_llm = false`;
- evidência `PUE_VALUE`;
- resposta deve mencionar PUE;
- não pode responder apenas `Período selecionado...`.

Na versão 42 v2.1 atual, este caso é esperado como **FAIL** e evidencia a prioridade incorreta da intenção `period` sobre `pue`.

## Segurança

- GitHub Actions recebe credenciais somente via Secrets.
- A API key do n8n nunca é escrita nos artefatos.
- O relatório guarda apenas IDs de execução, dados dos nodes do workflow de IA e respostas necessárias à auditoria.
- Recomenda-se revogar a API key temporária após a estabilização do harness e substituí-la por uma chave exclusiva de automação com leitura mínima necessária.
