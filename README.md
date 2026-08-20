# Claro RJO-AM — Harness E2E / IA v1.2

Este repositório executa regressão ponta a ponta da tela **Análises por IA** e correlaciona cada pergunta com a execução real do workflow 42 no n8n.

O teste não considera `Execution successful` como aprovação. Ele verifica:

1. login no frontend real;
2. abertura da rota `/analises-ia`;
3. criação de uma sessão E2E exclusiva;
4. período selecionado e persistido pelo frontend;
5. pergunta enviada pela UI;
6. payload real enviado para `/ai-chat` (`question`, `period`, `session_id`);
7. resposta HTTP de `/ai-chat`;
8. resposta renderizada na tela;
9. execução n8n correspondente;
10. nodes realmente executados;
11. `intent`, `temporal_query`, `used_llm`, evidências e limitações;
12. regras semânticas específicas de cada pergunta.

## Correções da v1.2

A primeira execução real revelou uma ambiguidade do Playwright: `getByLabel('Senha')` encontrava tanto o campo de senha quanto o botão **Mostrar senha**.

A v1.2 usa seletores ancorados na implementação real do frontend v18:

- usuário: `#username`;
- senha: `#password`;
- login: `form button[type="submit"]`;
- período: botão exato dentro de `header`;
- pergunta: placeholder exato `Pergunte sobre os dados consolidados...`;
- envio: botão com nome acessível exato `Enviar pergunta`;
- sessão: chave real `claro-rjo-am-ai-session-v1`;
- período persistido: chave real `claro-rjo-am-dashboard-period`.

Também foram adicionados:

- diagnóstico por fase (`login`, `open_ai_page`, `session`, `period`, `frontend_request`, `n8n_execution`, `semantic_validation`);
- `test-diagnostic.json` em falhas;
- validação do payload que saiu do frontend;
- distinção no resumo entre falha semântica e falha de automação/infraestrutura;
- GitHub Actions em Node.js 24 e actions atualizadas para runtime Node.js 24.

## Secrets obrigatórios

Configure em **Settings → Secrets and variables → Actions → Repository secrets**:

- `FRONTEND_URL` — URL pública do frontend Claro;
- `FRONTEND_TEST_USER` — usuário exclusivo de testes;
- `FRONTEND_TEST_PASSWORD` — senha desse usuário;
- `N8N_URL` — URL base do n8n, sem `/api/v1`;
- `N8N_API_KEY` — chave temporária/restrita da Public API;
- `N8N_AI_WORKFLOW_ID` — opcional, mas recomendado; ID do workflow 42 no n8n.

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

Para a primeira execução da v1.2, execute somente `PUE-001`.

## Como interpretar a falha

O resumo agora mostra a **fase** e o **tipo** da falha.

- `AUTOMATION` antes de existir `execution_id`: problema de navegação, seletor, login, frontend ou integração antes da correlação com n8n.
- `SEMANTIC` com `execution_id`: o fluxo chegou ao n8n e a execução pode estar tecnicamente em sucesso, mas a resposta/intenção não respeitou a expectativa do caso.

O objetivo do `PUE-001` é chegar à segunda situação enquanto o workflow 42 ainda possuir a prioridade incorreta de `period` sobre `pue`.

## Artefatos

Cada execução publica:

- `AI_REGRESSION_SUMMARY.md` — resumo PASS/FAIL;
- `semantic-results.json` — resultado estruturado;
- `playwright-results.json` — resultado bruto do Playwright;
- relatório HTML do Playwright;
- screenshots/traces/vídeos de falhas;
- `test-diagnostic.json` para falhas de automação/integração;
- `n8n-execution-summary.json` quando a execução do n8n é localizada;
- `semantic-result.json` após a auditoria semântica.

## Primeiro teste importante

`PUE-001 — Como está o PUE no período?`

Esperado:

- `intent = pue`;
- `used_llm = false`;
- evidência `PUE_VALUE`;
- resposta deve mencionar PUE;
- não pode responder apenas `Período selecionado...`.

Se a v2.1 atual do workflow 42 continuar com a prioridade incorreta, o resultado ideal da próxima rodada é: **login e automação passam, execução n8n é localizada e o caso falha como SEMANTIC**.

## Segurança

- GitHub Actions recebe credenciais somente via Secrets.
- A API key do n8n nunca é escrita nos artefatos.
- O relatório guarda apenas IDs de execução e dados necessários à auditoria.
- Recomenda-se revogar a API key temporária após a estabilização do harness e substituí-la por uma chave exclusiva de automação com leitura mínima necessária.
