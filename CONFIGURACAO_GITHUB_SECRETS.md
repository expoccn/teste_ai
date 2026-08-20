# Configuração GitHub Secrets — Harness v1.5

# Configuração dos Secrets no GitHub — Harness v1.3

No repositório `expoccn/teste_ai`:

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`

Manter os seguintes secrets:

| Secret | Uso |
|---|---|
| `FRONTEND_URL` | URL pública do frontend Claro |
| `FRONTEND_TEST_USER` | usuário exclusivo de testes |
| `FRONTEND_TEST_PASSWORD` | senha do usuário de testes |
| `N8N_URL` | URL base pública do n8n |
| `N8N_API_KEY` | API key temporária/restrita para leitura |
| `N8N_AI_WORKFLOW_ID` | ID do workflow 42 (recomendado) |

Não colocar os valores reais em `.env`, JSON, README ou workflow YAML commitado.

## Não adicionar login/senha do n8n

A auditoria interna usa somente `N8N_API_KEY`. Não crie Secrets com usuário ou senha da interface administrativa do n8n.

A v1.3 testa automaticamente, antes do navegador:

- DNS do frontend;
- HTTPS do frontend;
- DNS do n8n;
- validade/permissão da `N8N_API_KEY`;
- acesso ao workflow 42;
- acesso à API de executions.

Se a Public API responder `401` ou `403`, o relatório identifica isso como falha de autenticação/permissão da API. Se não houver resposta HTTP, o relatório diferencia DNS/conectividade.

## Próximo teste

Depois do Commit + Push da v1.3, execute somente:

`PUE-001`

Baixe o ZIP em **Artifacts** e envie-o para análise.

Após estabilizar os testes, revogue a API key temporária e gere uma chave exclusiva para o runner, preferencialmente somente leitura.
