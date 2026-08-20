# Claro RJO-AM — Harness de Regressão da IA v1.5

Suíte E2E para validar o frontend publicado, a resposta do workflow 42 e a execução interna do n8n.

## Fluxo
1. Preflight de DNS/HTTPS do frontend e Public API do n8n.
2. Autenticação do usuário E2E diretamente no endpoint oficial `/auth/login`.
3. Injeção do Bearer em `sessionStorage` antes de abrir `/analises-ia`.
4. Aquecimento/reload do frontend caso o runtime publicado esteja lento.
5. Seleção de período, criação de `session_id` E2E e envio da pergunta real pelo frontend.
6. Captura do POST `/ai-chat` e da resposta HTTP.
7. Correlação com a execução n8n e leitura de `runData` node por node.
8. Validação semântica de intent, evidências, uso de LLM e resposta.

## Execução no GitHub
Actions → **IA Regression - Claro RJO-AM** → Run workflow.

Para o primeiro teste, informe:

`PUE-001`

## Artifacts
Em caso de falha, envie o ZIP `claro-rjo-am-ai-regression-<run>` completo. Ele inclui preflight, summary, trace, screenshot, vídeo e `test-diagnostic.json`. Quando a execução n8n for encontrada, também inclui `n8n-execution-summary.json` e `semantic-result.json`.

## Observação de infraestrutura
O preflight v1.5 identifica runtime Vite de desenvolvimento. Esse modo funciona para homologação, porém um GitHub Runner com cache frio pode precisar carregar muitos módulos. O harness v1.5 tolera isso com aquecimento e reload. Para estabilidade e desempenho de produção, recomenda-se posteriormente publicar um build de produção do frontend em vez de `vite dev`.
