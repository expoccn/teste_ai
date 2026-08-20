const normalizeBase = (value) => String(value || '').replace(/\/+$/, '');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Secret/env obrigatório ausente: ${name}`);
  return value;
}

export class N8nClient {
  constructor() {
    this.baseUrl = normalizeBase(requiredEnv('N8N_URL'));
    this.apiKey = requiredEnv('N8N_API_KEY');
    this.workflowId = process.env.N8N_AI_WORKFLOW_ID || '';
    this.workflowName = process.env.N8N_AI_WORKFLOW_NAME || '42 CLARO RJO-AM - IA Chat';
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers: {
        accept: 'application/json',
        'X-N8N-API-KEY': this.apiKey,
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
      throw new Error(`n8n API ${response.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    return body;
  }

  async resolveWorkflowId() {
    if (this.workflowId) return this.workflowId;
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const qs = new URLSearchParams({ limit: '100' });
      if (cursor) qs.set('cursor', cursor);
      const body = await this.request(`/workflows?${qs}`);
      const rows = Array.isArray(body?.data) ? body.data : [];
      const exact = rows.find((w) => String(w?.name || '') === this.workflowName);
      const prefix = rows.find((w) => String(w?.name || '').startsWith(this.workflowName));
      const by42 = rows.find((w) => /^42\b/.test(String(w?.name || '')) && /IA Chat/i.test(String(w?.name || '')));
      const found = exact || prefix || by42;
      if (found?.id) {
        this.workflowId = String(found.id);
        return this.workflowId;
      }
      cursor = body?.nextCursor || '';
      if (!cursor) break;
    }
    throw new Error(`Workflow da IA não encontrado. Configure N8N_AI_WORKFLOW_ID ou ajuste N8N_AI_WORKFLOW_NAME (atual: ${this.workflowName}).`);
  }

  async listExecutions(limit = 30) {
    const workflowId = await this.resolveWorkflowId();
    const qs = new URLSearchParams({ workflowId, limit: String(limit) });
    return this.request(`/executions?${qs}`);
  }

  async getExecution(id) {
    return this.request(`/executions/${encodeURIComponent(String(id))}?includeData=true`);
  }

  static runData(execution) {
    return execution?.data?.resultData?.runData || execution?.data?.resultData?.runData || {};
  }

  static nodeJsons(execution, nodeName) {
    const runData = N8nClient.runData(execution);
    const runs = Array.isArray(runData?.[nodeName]) ? runData[nodeName] : [];
    const out = [];
    for (const run of runs) {
      const main = run?.data?.main;
      if (!Array.isArray(main)) continue;
      for (const branch of main) {
        if (!Array.isArray(branch)) continue;
        for (const item of branch) {
          if (item?.json && typeof item.json === 'object') out.push(item.json);
        }
      }
    }
    return out;
  }

  static lastNodeJson(execution, nodeName) {
    const rows = N8nClient.nodeJsons(execution, nodeName);
    return rows.at(-1) || null;
  }

  static executedNodes(execution) {
    return Object.keys(N8nClient.runData(execution));
  }

  static executionContains(execution, { question, sessionId }) {
    const candidateNodes = ['normaliza_requisicao', 'montar_contexto_deterministico', 'prepara_historico', 'restaura_resposta'];
    for (const name of candidateNodes) {
      for (const j of N8nClient.nodeJsons(execution, name)) {
        if (String(j?.question || '') === String(question || '') && (!sessionId || String(j?.session_id || '') === String(sessionId))) return true;
      }
    }
    return false;
  }

  async waitForExecution({ question, sessionId, startedAfterMs, timeoutMs = 90_000 }) {
    const deadline = Date.now() + timeoutMs;
    const checked = new Set();
    while (Date.now() < deadline) {
      const list = await this.listExecutions(40);
      const rows = Array.isArray(list?.data) ? list.data : [];
      for (const row of rows) {
        const id = String(row?.id || '');
        if (!id || checked.has(id)) continue;
        const started = Date.parse(row?.startedAt || row?.createdAt || 0);
        if (Number.isFinite(started) && started + 15_000 < startedAfterMs) continue;
        const execution = await this.getExecution(id);
        checked.add(id);
        if (N8nClient.executionContains(execution, { question, sessionId })) return execution;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(`Não encontrei execução do workflow 42 para a pergunta "${question}" e sessão "${sessionId}" dentro de ${timeoutMs / 1000}s.`);
  }
}
