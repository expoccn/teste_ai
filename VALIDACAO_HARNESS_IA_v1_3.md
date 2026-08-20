# Validação — Harness IA Claro RJO-AM v1.3

Data: 20/08/2026

## Motivo da revisão

Foram analisadas três execuções consecutivas com a mesma falha de navegação no GitHub Actions. No Artifact mais recente (`claro-rjo-am-ai-regression-4.zip`), o Playwright ficou 60 s em `page.goto('/login')` e o trace registrou o request do documento com `response.status = -1`, sem headers e sem corpo. Portanto, a falha ocorreu antes do login, antes do workflow 42 e antes da Public API do n8n.

Também foi comparado o Artifact anterior em que a mesma URL respondeu HTTP 200 e o `/ai-chat` respondeu HTTP 200. Isso confirma que o harness precisa tratar indisponibilidade/resolução intermitente e separar infraestrutura de semântica.

## Ajustes implementados

- preflight DNS do frontend com até 6 tentativas;
- preflight HTTPS do frontend com até 5 tentativas;
- preflight DNS do n8n com até 6 tentativas;
- validação da Public API n8n com `X-N8N-API-KEY`;
- validação de workflow + executions antes do navegador;
- propagação dinâmica dos IPs resolvidos via `GITHUB_ENV`;
- Chromium com `--host-resolver-rules` para frontend e n8n;
- N8nClient com conexão direta ao IP resolvido, preservando Host e SNI TLS;
- retry de navegação para `/login` e `/analises-ia`;
- retry de reload da sessão;
- `waitUntil: commit` para não depender de `domcontentloaded` como primeiro critério de conectividade;
- relatório `PREFLIGHT_REPORT.json` + `PREFLIGHT_REPORT.md` no Artifact;
- testes E2E não iniciam se o preflight falhar;
- Job Summary diferencia DNS, HTTPS, API n8n e falha semântica;
- cliente n8n continua somente leitura; login/senha da interface n8n não são necessários.

## Validações offline

- Sintaxe Node dos arquivos `.mjs`: **8/8 PASS**
- Verificações estáticas do harness: **19/19 PASS**
- Self-tests de correlação n8n + semântica: **2/2 PASS**
- Arquivos JSON válidos: **2/2 PASS**
- Workflow YAML parseável: **1/1 PASS**
- Casos de regressão preservados e com IDs únicos: **29/29**
- Busca por credenciais reais/API key no pacote: **0 ocorrências**

### Verificações estáticas aprovadas

- timestamp `startedAfterMs` preservado;
- handoff do timestamp preservado até `waitForExecution`;
- navegação com retry controlado;
- reload com retry controlado;
- preflight DNS presente;
- preflight frontend presente;
- preflight Public API n8n presente;
- IP frontend exportado para `GITHUB_ENV`;
- IP n8n exportado para `GITHUB_ENV`;
- Playwright usa `host-resolver-rules`;
- N8nClient usa `N8N_RESOLVED_IP`;
- Host/SNI originais preservados;
- N8nClient explicitamente somente leitura;
- preflight roda antes do Chromium;
- browser/testes são pulados quando preflight falha;
- Node prioriza IPv4.

## Limite desta validação

O ambiente desta sessão não resolve atualmente os domínios `*.2see.io` e `*.easypanel.host`, então não foi possível executar daqui um teste de rede real contra os hosts. Esse é justamente o motivo de o preflight ter sido movido para o GitHub Runner, onde o teste real ocorre. O pacote foi validado offline quanto a sintaxe, estrutura, lógica de retries, propagação de IP e proteção de credenciais.

## Resultado

**APROVADO PARA NOVO TESTE `PUE-001` NO GITHUB ACTIONS.**

Na próxima execução, há dois resultados úteis:

1. `PREFLIGHT FAIL`: o Artifact informará objetivamente se foi DNS do frontend, HTTPS, DNS do n8n ou Public API/API key;
2. `PREFLIGHT PASS`: o Playwright usará os IPs resolvidos e deverá prosseguir até a validação semântica do workflow 42.
