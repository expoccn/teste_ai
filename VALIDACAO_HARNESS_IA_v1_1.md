# VALIDAÇÃO — Harness E2E IA Claro RJO-AM v1.1

## Resultado

- Verificações: **59**
- Aprovadas: **59**
- Falhas: **0**

## Escopo da correção

- Corrigido o seletor ambíguo do campo de senha identificado no Artifact real do GitHub Actions.
- Revisados os seletores de login e da tela Análises por IA contra o código do frontend v18 utilizado em produção.
- Adicionada validação do payload enviado pelo frontend antes da correlação com o n8n.
- Adicionado diagnóstico por fase e separação entre falha de automação/infraestrutura e falha semântica.
- Mantida a matriz de 29 perguntas de regressão.
- Atualizado o GitHub Actions para Node.js 24 e actions com runtime Node.js 24.

## Verificações

- ✅ package version 1.1.0
- ✅ 29 casos preservados — 29
- ✅ IDs de casos únicos
- ✅ PUE-001 presente
- ✅ seletor ambíguo getByLabel Senha removido
- ✅ harness usa #username
- ✅ harness usa #password
- ✅ frontend v18 possui id username uma vez — 1
- ✅ frontend v18 possui id password uma vez — 1
- ✅ frontend v18 possui submit de login
- ✅ harness usa submit de formulário
- ✅ diagnóstico LOGIN_FAILED presente
- ✅ diagnóstico LOGIN_TIMEOUT presente
- ✅ placeholder frontend existe uma vez — 1
- ✅ aria Enviar pergunta existe uma vez — 1
- ✅ heading Assistente existe
- ✅ harness usa placeholder exato
- ✅ harness usa nome exato Enviar pergunta
- ✅ harness ancora período em header
- ✅ label período Último dia presente no contexto
- ✅ label período 7 dias presente no contexto
- ✅ label período 30 dias presente no contexto
- ✅ botões de período são button
- ✅ session key do frontend coincide
- ✅ period storage key coincide
- ✅ verificação de sessionStorage presente
- ✅ verificação de localStorage do período presente
- ✅ captura postDataJSON
- ✅ valida question enviado
- ✅ valida period enviado
- ✅ valida session_id enviado
- ✅ test-diagnostic attachment
- ✅ n8n execution summary attachment
- ✅ semantic result attachment
- ✅ failure type semantic
- ✅ failure type automation
- ✅ summary separa falhas semânticas
- ✅ summary separa automação
- ✅ summary inclui fase
- ✅ checkout v7
- ✅ setup-node v7
- ✅ Node 24
- ✅ upload-artifact v6
- ✅ workflow ainda aceita ID/grupo
- ✅ artefatos sempre enviados
- ✅ node n8n esperado existe: normaliza_requisicao
- ✅ node n8n esperado existe: planeja_consulta_temporal
- ✅ node n8n esperado existe: busca_temporal
- ✅ node n8n esperado existe: montar_contexto_deterministico
- ✅ node n8n esperado existe: Google Gemini Flash Lite
- ✅ node n8n esperado existe: valida_redacao_gemini
- ✅ node n8n esperado existe: prepara_historico
- ✅ node n8n esperado existe: restaura_resposta
- ✅ workflow 42 normaliza question
- ✅ workflow 42 normaliza session_id
- ✅ evidence id usada em testes existe no workflow: PUE_VALUE
- ✅ evidence id usada em testes existe no workflow: INTEGRATIONS_OFFLINE
- ✅ nenhum JWT hardcoded
- ✅ nenhuma senha de teste hardcoded

## Limite desta validação

Esta validação é estrutural/offline. A confirmação final exige nova execução no GitHub Actions contra o frontend e o n8n reais. O primeiro caso recomendado continua sendo `PUE-001`.

Na próxima execução, se as credenciais estiverem corretas, o teste deve ultrapassar a fase `login`. Se o workflow 42 ainda mantiver a classificação incorreta observada anteriormente, espera-se uma falha do tipo `SEMANTIC` com `execution_id` preenchido, o que confirma que a auditoria node por node está funcionando.