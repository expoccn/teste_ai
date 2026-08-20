# Atualização Harness IA v1.4

## Causa encontrada no Artifact #6
O frontend e a Public API do n8n estão acessíveis. O POST `/ai-chat` retornou HTTP 200, porém `/api/v1/executions?workflowId=...` retornou zero execuções.

O workflow 42 fornecido no pacote v2.1 está configurado com:

```json
"saveDataSuccessExecution": "none",
"saveDataErrorExecution": "none"
```

Assim, o n8n executa o workflow e devolve a resposta, mas não persiste o `runData` necessário para auditoria node por node.

## Mudança da v1.4
O preflight agora:
1. lê o workflow configurado em `N8N_AI_WORKFLOW_ID`;
2. confirma que ele contém o webhook `claro-rjo-am/ai-chat`;
3. confirma que `saveDataSuccessExecution` não está `none`;
4. mostra nome, status ativo e políticas de salvamento no relatório;
5. falha imediatamente com `WORKFLOW_EXECUTION_STORAGE_DISABLED` em vez de aguardar 120 segundos.

Use junto com o workflow 42 AUDIT fornecido separadamente.
