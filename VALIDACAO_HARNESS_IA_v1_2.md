# Validação do Harness IA — v1.2

## Diagnóstico da execução `claro-rjo-am-ai-regression-3`

A terceira execução avançou corretamente por:

- login no frontend;
- abertura de `/analises-ia`;
- criação/persistência de `session_id` exclusivo;
- seleção do período `30d`;
- envio do POST `/ai-chat`;
- captura do request do frontend;
- retorno HTTP `200` do workflow de IA.

O request capturado foi:

- pergunta: `Como está o PUE no período?`
- período: `30d`
- sessão: sessão E2E exclusiva.

O backend respondeu com:

- `ok: true`;
- `intent: period`;
- `used_llm: false`;
- resposta iniciando em `Período selecionado:`;
- evidências `PERIOD` e `REFERENCE_DATE`.

Isso confirma uma **falha semântica real do workflow 42** para o caso PUE-001. O esperado pelo teste é `intent: pue`, evidência `PUE_VALUE` e uma resposta sobre o indicador PUE.

## Falha do harness encontrada

Depois de receber o HTTP 200, o runner tentou correlacionar a chamada com a execução do n8n e parou com:

`ReferenceError: startedAfterMs is not defined`

A causa era um nome inconsistente:

- `sendQuestion()` criava/retornava `startedAtMs`;
- a chamada a `waitForExecution()` usava `startedAfterMs`.

## Correção v1.2

O nome foi padronizado para `startedAfterMs` em toda a cadeia:

1. captura do timestamp antes do POST;
2. retorno de `sendQuestion()`;
3. desestruturação no teste;
4. envio para `n8n.waitForExecution()`.

Também foi adicionada uma etapa de **self-check do próprio harness** no GitHub Actions antes de instalar/abrir o Chromium. Ela valida especificamente o handoff do timestamp e executa um teste simulado do cliente n8n e do validador semântico.

## Validações executadas offline

- sintaxe Node de todos os arquivos `.mjs`: aprovada;
- JSONs do pacote: aprovados;
- YAML do GitHub Actions: aprovado;
- 29 casos de regressão preservados e com IDs únicos;
- `PUE-001` presente;
- `startedAfterMs` criado, retornado, desestruturado e consumido de forma consistente;
- nome antigo removido do arquivo de teste;
- self-test de `waitForExecution()` com pergunta + `session_id`: aprovado;
- self-test do validador semântico detectando `intent=period` no PUE-001: aprovado;
- varredura por senha, usuário e API key fornecidos na conversa: nenhum segredo hardcoded.

## Próxima execução esperada

Execute somente `PUE-001` novamente. A expectativa agora é que o runner consiga localizar a execução n8n e avance até `semantic_validation`. Como o backend já devolveu `intent: period` na execução anterior, o resultado esperado neste momento é um **FAIL SEMANTIC**, não um FAIL AUTOMATION.

Esse FAIL será útil: o Artifact deverá passar a incluir `n8n-execution-summary.json`, permitindo identificar o primeiro node do workflow 42 em que a interpretação divergiu de `pue` para `period`.
