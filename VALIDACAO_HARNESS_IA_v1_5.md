# Validação — Harness IA Claro RJO-AM v1.5

## Diagnóstico da execução 7
Artifact analisado: `claro-rjo-am-ai-regression-7.zip`.

Resultado observado:
- Preflight: PASS.
- Frontend DNS/HTTPS: OK.
- n8n DNS/Public API: OK.
- Workflow de IA identificado e ativo.
- Falha antes da pergunta: fase `login`, `#username` não apareceu.
- Snapshot da página: `Verificando acesso...`.

O trace de rede mostrou **154 recursos** no carregamento frio do frontend. A própria página carregou assets de desenvolvimento como `@vite/client`, `@react-refresh`, arquivos de `src/` e módulos individuais de `node_modules`.

Exemplos do trace:
- `react-dom_client.js`: ~22,2 s / ~2,82 MB transferidos.
- `seroval development`: ~8,6 s / ~451 KB.
- `@tanstack/react-query`: ~8,0 s / ~355 KB.
- rota `analises-ia.tsx`: ~4,2 s.

No momento em que a espera de 25 s encerrou, ainda havia módulo pendente/cancelado. Portanto a ausência de `#username` não comprovava erro de credencial: o runtime ainda não tinha terminado de hidratar.

## Correções v1.5
- Autenticação da suíte de IA passou a ser obtida diretamente pelo endpoint oficial `/webhook/claro-rjo-am/auth/login`.
- A senha continua vindo exclusivamente de `FRONTEND_TEST_PASSWORD`; não é persistida em arquivos ou Artifacts.
- O token retornado é injetado somente no `sessionStorage` na chave oficial do frontend.
- A tela `/analises-ia` agora possui aquecimento e até três ciclos de readiness/reload (90 s, 75 s e 60 s), mantendo o mesmo contexto para aproveitar cache.
- Diagnóstico adicional de `requestfailed`, HTTP >= 400, `pageerror`, console error e tentativas de readiness.
- Preflight detecta `vite-dev` e registra aviso de runtime.
- Preflight trata settings de persistência do n8n não expostos pela Public API como “não exposto”, sem confundir com `none`.
- Timeout por teste ampliado para 720 s e timeout padrão de expect para 60 s.

## Validações offline
- 9/9 arquivos `.mjs`: sintaxe Node válida.
- 28/28 verificações estruturais do harness: PASS.
- 2/2 self-tests: PASS.
- 29/29 casos de regressão preservados e IDs únicos.
- JSON: válido.
- YAML do GitHub Actions: válido.
- Busca por JWT/API key literal: nenhuma ocorrência.
- Busca pela senha de teste literal: nenhuma ocorrência.
- `N8nClient` de auditoria continua somente leitura (GET).
- Helper de autenticação não recebe nem utiliza `N8N_API_KEY`.

## Limite desta validação
O ambiente local usado para preparar o pacote não consegue resolver os domínios públicos do projeto, então a validação E2E real continua sendo executada no GitHub Actions. A v1.5 foi preparada especificamente a partir do trace real da execução 7.

## Próxima execução
Executar apenas `PUE-001`.

Esperado:
1. preflight PASS;
2. auth API PASS;
3. `/analises-ia` pronta após warmup/cache;
4. pergunta enviada pelo frontend;
5. execução do workflow 42 localizada;
6. validação semântica identifica `intent=period` versus esperado `intent=pue`, caso o workflow ainda esteja com a lógica atual.
