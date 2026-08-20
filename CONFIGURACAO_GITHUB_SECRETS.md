# Configuração dos Secrets no GitHub

No repositório `expoccn/teste_ai`:

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`

Criar os seguintes secrets:

| Secret | Valor |
|---|---|
| `FRONTEND_URL` | URL pública do frontend Claro |
| `FRONTEND_TEST_USER` | usuário exclusivo de testes |
| `FRONTEND_TEST_PASSWORD` | senha do usuário de testes |
| `N8N_URL` | URL base pública do n8n |
| `N8N_API_KEY` | API key temporária/restrita |
| `N8N_AI_WORKFLOW_ID` | ID numérico/string do workflow 42 (recomendado) |

Não colocar esses valores em `.env`, JSON, README ou workflow YAML commitado.

Após a estabilização, revogue a API key temporária criada para a implantação inicial e gere uma chave exclusiva para o runner, preferencialmente somente leitura.
