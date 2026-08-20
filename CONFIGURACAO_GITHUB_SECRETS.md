# Configuração dos Secrets no GitHub — Harness v1.1

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
| `N8N_AI_WORKFLOW_ID` | ID do workflow 42 (recomendado) |

Não colocar esses valores em `.env`, JSON, README ou workflow YAML commitado.

## Antes de executar novamente

A execução anterior comprovou que os Secrets chegaram ao runner. Entretanto, se a v1.1 retornar `LOGIN_FAILED`, revise **somente** os Secrets `FRONTEND_TEST_USER` e `FRONTEND_TEST_PASSWORD` no GitHub e confirme que correspondem exatamente ao usuário de teste que acessa o frontend manualmente.

Depois rode apenas:

`PUE-001`

O resultado que queremos nesta etapa é que o teste ultrapasse `login`, `open_ai_page`, `session`, `period` e `frontend_request`, encontre um `execution_id` do n8n e então faça a validação semântica.

Após a estabilização, revogue a API key temporária criada para a implantação inicial e gere uma chave exclusiva para o runner, preferencialmente somente leitura.
