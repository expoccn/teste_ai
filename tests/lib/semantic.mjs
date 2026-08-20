const fold = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function getContext(execution, N8nClient) {
  return N8nClient.lastNodeJson(execution, 'montar_contexto_deterministico') || {};
}

export function getResponsePayload(execution, N8nClient) {
  return N8nClient.lastNodeJson(execution, 'restaura_resposta') || N8nClient.lastNodeJson(execution, 'prepara_historico')?.response_payload || {};
}

export function validateSemantic({ testCase, apiResponse, execution, N8nClient }) {
  const failures = [];
  const context = getContext(execution, N8nClient);
  const response = getResponsePayload(execution, N8nClient);
  const executedNodes = N8nClient.executedNodes(execution);
  const answer = String(apiResponse?.answer ?? response?.answer ?? context?.final_answer ?? context?.answer_draft ?? '');
  const answerFold = fold(answer);
  const expected = testCase.expected || {};

  if (expected.intent) {
    const allowed = Array.isArray(expected.intent) ? expected.intent : [expected.intent];
    if (!allowed.includes(context?.intent)) failures.push(`intent esperado ${allowed.join(' | ')}, obtido ${context?.intent ?? '<ausente>'}`);
  }
  if (typeof expected.used_llm === 'boolean' && Boolean(apiResponse?.used_llm ?? response?.used_llm ?? context?.used_llm) !== expected.used_llm) {
    failures.push(`used_llm esperado ${expected.used_llm}, obtido ${Boolean(apiResponse?.used_llm ?? response?.used_llm ?? context?.used_llm)}`);
  }
  if (expected.temporal_mode && context?.temporal_query?.mode !== expected.temporal_mode) {
    failures.push(`temporal_query.mode esperado ${expected.temporal_mode}, obtido ${context?.temporal_query?.mode ?? '<ausente>'}`);
  }
  for (const token of expected.answer_contains || []) {
    if (!answerFold.includes(fold(token))) failures.push(`resposta não contém "${token}"`);
  }
  for (const token of expected.answer_not_contains || []) {
    if (answerFold.includes(fold(token))) failures.push(`resposta contém termo proibido "${token}"`);
  }
  for (const node of expected.nodes_must_execute || []) {
    if (!executedNodes.includes(node)) failures.push(`node esperado não executou: ${node}`);
  }
  for (const node of expected.nodes_must_not_execute || []) {
    if (executedNodes.includes(node)) failures.push(`node não deveria executar: ${node}`);
  }
  if (expected.evidence_ids?.length) {
    const ids = new Set((context?.evidence || []).map((e) => e?.id));
    for (const id of expected.evidence_ids) if (!ids.has(id)) failures.push(`evidência ausente: ${id}`);
  }
  if (expected.require_limitations && !(context?.limitations || []).length) failures.push('esperava ao menos uma limitação governada');
  if (expected.answer_must_not_be_period_only) {
    const periodOnly = /^periodo selecionado:/i.test(fold(answer)) && !/pue|cag|ups|rpp|gmg|manut|integrac|quadro|completude|qualidade/.test(answerFold);
    if (periodOnly) failures.push('resposta caiu em metadado de período e não respondeu ao indicador solicitado');
  }
  if (apiResponse?.answer && response?.answer && String(apiResponse.answer) !== String(response.answer)) {
    failures.push('resposta HTTP difere da resposta final registrada pelo workflow');
  }

  return { failures, context, response, executedNodes, answer };
}
