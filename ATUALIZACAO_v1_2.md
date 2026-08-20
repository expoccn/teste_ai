# Atualização do Harness IA — v1.2

## Correção principal

A execução `claro-rjo-am-ai-regression-3` comprovou que o login, a navegação, a seleção de período e o POST `/ai-chat` estavam funcionando. O teste parou antes de consultar a API de execuções do n8n por um erro de nome de variável no próprio harness:

- produzido por `sendQuestion()`: `startedAtMs`
- consumido por `waitForExecution()`: `startedAfterMs`

Na v1.2 o nome foi padronizado para `startedAfterMs` desde a captura do timestamp até a chamada do cliente n8n.

## Evidência da execução anterior

Antes da falha do harness, o frontend retornou HTTP 200 com:

- pergunta: `Como está o PUE no período?`
- período: `30d`
- `intent`: `period`
- `used_llm`: `false`
- resposta iniciando em `Período selecionado:`

Portanto, já existe uma falha semântica real no workflow 42. A v1.2 permite prosseguir e localizar a execução n8n correspondente para identificar o primeiro node divergente.

## O que substituir

Substitua o conteúdo do repositório pelo pacote v1.2 e preserve os GitHub Secrets. Depois execute novamente apenas `PUE-001`.
