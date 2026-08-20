import assert from 'node:assert/strict';
import { N8nClient } from '../tests/lib/n8n.mjs';
import { validateSemantic } from '../tests/lib/semantic.mjs';

process.env.N8N_URL ||= 'https://example.invalid';
process.env.N8N_API_KEY ||= 'test-only';
process.env.N8N_AI_WORKFLOW_ID ||= '42-test';

const question = 'Como está o PUE no período?';
const sessionId = 'e2e-selftest-pue-001';
const startedAfterMs = Date.now() - 1000;

const fakeExecution = {
  id: '999',
  status: 'success',
  data: {
    resultData: {
      runData: {
        normaliza_requisicao: [{ data: { main: [[{ json: { question, session_id: sessionId, period: '30d' } }]] } }],
        montar_contexto_deterministico: [{ data: { main: [[{ json: {
          question,
          session_id: sessionId,
          intent: 'period',
          temporal_query: { mode: 'none' },
          evidence: [{ id: 'PERIOD' }],
          answer_draft: 'Período selecionado: 30 últimos dias válidos.'
        } }]] } }],
        restaura_resposta: [{ data: { main: [[{ json: {
          answer: 'Período selecionado: 30 últimos dias válidos.',
          used_llm: false
        } }]] } }],
      }
    }
  }
};

const client = new N8nClient();
client.listExecutions = async () => ({ data: [{ id: '999', startedAt: new Date().toISOString() }] });
client.getExecution = async (id) => {
  assert.equal(String(id), '999');
  return fakeExecution;
};

const found = await client.waitForExecution({ question, sessionId, startedAfterMs, timeoutMs: 1000 });
assert.equal(found.id, '999');
console.log('PASS — waitForExecution correlaciona pergunta + session_id com startedAfterMs');

const testCase = {
  id: 'PUE-001',
  question,
  expected: {
    intent: 'pue',
    used_llm: false,
    evidence_ids: ['PUE_VALUE'],
    answer_must_not_be_period_only: true
  }
};
const semantic = validateSemantic({
  testCase,
  apiResponse: { answer: 'Período selecionado: 30 últimos dias válidos.', used_llm: false },
  execution: fakeExecution,
  N8nClient,
});
assert(semantic.failures.some((x) => x.includes('intent esperado')));
assert(semantic.failures.some((x) => x.includes('evidência ausente')));
assert(semantic.failures.some((x) => x.includes('metadado de período')));
console.log('PASS — validador semântico detecta o bug real do PUE-001');
