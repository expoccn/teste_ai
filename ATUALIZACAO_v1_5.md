# Atualização v1.5 — autenticação por API + aquecimento do frontend

## Motivo
O Artifact da execução 7 comprovou que DNS/HTTPS do frontend e Public API do n8n estavam OK, porém o navegador ficou em **"Verificando acesso..."** e não chegou a renderizar `#username` em 25 s.

O trace mostrou que o frontend publicado está servindo o **runtime Vite de desenvolvimento** (`/@vite/client`, `@react-refresh`, módulos individuais de `node_modules`). Em um GitHub Runner com cache frio, vários módulos demoraram muitos segundos e o carregamento ainda estava em andamento quando o teste encerrou a espera. Isso não é falha de credencial.

## Mudanças
1. O teste da IA não depende mais da tela de login para obter sessão.
2. O runner chama deterministicamente o endpoint oficial `/webhook/claro-rjo-am/auth/login` com o usuário de teste e recebe um token.
3. O token é injetado apenas em `sessionStorage` na chave usada pelo frontend (`claro-rjo-am-access-session`) antes de abrir `/analises-ia`.
4. A página da IA possui até 3 ciclos de aquecimento, com 90 s / 75 s / 60 s e reload no mesmo contexto para aproveitar o cache de módulos.
5. O Artifact passa a registrar requisições com falha, HTTP >= 400, erros de página, erros de console e tentativas de readiness.
6. O preflight detecta se o frontend está em `vite-dev` e registra o aviso no relatório.
7. O timeout do teste foi ampliado para 12 minutos para permitir carregamento frio + chamada IA + auditoria da execução.

## O que permanece igual
- Nenhuma senha ou token é gravado em Artifact.
- A API key do n8n continua usada apenas nas consultas de auditoria da Public API.
- `N8nClient` continua somente leitura.
- A pergunta `PUE-001` continua esperando `intent=pue`; não corrigimos ainda a lógica do workflow 42 para que a próxima execução exponha a falha semântica real.

## Próximo teste
Substitua o conteúdo do repositório pela v1.5, commit/push e execute somente `PUE-001`.

Resultado esperado: a automação deve ultrapassar autenticação e carregamento da tela. Se o workflow continuar retornando `intent=period`, a execução deverá chegar à fase `semantic_validation` e falhar como **SEMANTIC**, não como **AUTOMATION**.
