# Atualização do Harness IA — v1.3

Esta versão trata a falha repetida de navegação observada em três execuções do GitHub Actions, em que o Chromium não recebia resposta de `https://claro-rj-am.2see.io/login` e encerrava após 60 segundos.

## O que mudou

1. **Preflight de infraestrutura antes do navegador**
   - valida DNS do frontend com até 6 tentativas;
   - valida HTTPS do frontend com até 5 tentativas;
   - valida DNS do n8n com até 6 tentativas;
   - valida Public API do n8n e `N8N_API_KEY`;
   - valida acesso a workflows e executions.

2. **Fixação dinâmica dos IPs resolvidos**
   - o preflight resolve os hosts em tempo de execução;
   - os IPs são propagados para o Playwright;
   - Chromium usa `--host-resolver-rules`, evitando uma nova dependência de DNS durante a bateria;
   - o cliente de auditoria n8n conecta diretamente ao IP resolvido, mantendo `Host` e SNI TLS originais.

3. **Retry real de navegação**
   - `/login`: até 4 tentativas;
   - `/analises-ia`: até 4 tentativas;
   - reload da sessão: até 3 tentativas;
   - navegação usa `waitUntil: commit` e a renderização é confirmada pelos locators da aplicação.

4. **Relatório de infraestrutura no Artifact**
   - `artifacts/PREFLIGHT_REPORT.md`
   - `artifacts/PREFLIGHT_REPORT.json`

Se o preflight falhar, as perguntas não são executadas. O Job Summary passa a dizer explicitamente se a falha foi DNS, HTTPS, API n8n ou autenticação da API.

## Atualização

Substitua todo o conteúdo do repositório `teste_ai` pelo conteúdo deste pacote, faça Commit e Push. Os GitHub Secrets existentes permanecem válidos; não é necessário fornecer login/senha da interface do n8n.

Depois execute apenas `PUE-001` novamente.
