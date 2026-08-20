# Claro RJO-AM — Harness E2E da IA v1.3

Suite de regressão para validar o caminho completo:

`Frontend publicado → login → Análises por IA → workflow 42 → n8n Public API → execução node por node → validação semântica`.

A v1.3 adiciona um **preflight de infraestrutura** porque o host publicado apresentou falhas intermitentes de resolução/conexão em GitHub Actions. O preflight resolve e testa frontend/n8n antes de instalar/abrir o Chromium e fixa dinamicamente os IPs resolvidos durante a bateria.

## Execução recomendada

Em `Actions → IA Regression - Claro RJO-AM → Run workflow`, informe primeiro:

`PUE-001`

## Artifacts importantes

- `artifacts/PREFLIGHT_REPORT.md`
- `artifacts/PREFLIGHT_REPORT.json`
- `artifacts/AI_REGRESSION_SUMMARY.md`
- `artifacts/semantic-results.json`
- `playwright-report/`
- `test-results/`

Se o preflight falhar, envie o Artifact mesmo assim. Ele terá o diagnóstico das tentativas DNS/HTTPS/API sem expor API key ou senha.
