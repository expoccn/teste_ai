import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import https from 'node:https';
import { N8nClient } from '../tests/lib/n8n.mjs';

const artifactsDir = path.resolve('artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Secret/env obrigatório ausente: ${name}`);
  return value;
}

function normalizeUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(process.env.N8N_API_KEY || '__NO_KEY__', '[REDACTED]')
    .replaceAll(process.env.FRONTEND_TEST_PASSWORD || '__NO_PASSWORD__', '[REDACTED]');
}

async function resolveHost(hostname, attempts = 6) {
  const history = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now();
    try {
      const lookup = await dns.lookup(hostname, { all: true, verbatim: false });
      const ipv4 = lookup.filter((x) => x.family === 4).map((x) => x.address);
      const ipv6 = lookup.filter((x) => x.family === 6).map((x) => x.address);
      history.push({ attempt, ok: true, elapsed_ms: Date.now() - started, ipv4, ipv6 });
      if (ipv4.length || ipv6.length) return { ok: true, ipv4, ipv6, history };
      throw new Error('DNS respondeu sem endereços');
    } catch (error) {
      history.push({ attempt, ok: false, elapsed_ms: Date.now() - started, error: redactError(error) });
      if (attempt < attempts) await sleep(Math.min(3000 * attempt, 12000));
    }
  }
  return { ok: false, ipv4: [], ipv6: [], history };
}

function requestHttps({ url, ip, headers = {}, timeoutMs = 20000 }) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = https.request({
      protocol: parsed.protocol,
      hostname: ip || parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      servername: parsed.hostname,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'claro-rjo-am-ai-preflight/1.3',
        host: parsed.host,
        ...headers,
      },
      timeout: timeoutMs,
    }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => resolve({
        ok: true,
        status: Number(res.statusCode || 0),
        elapsed_ms: Date.now() - started,
        bytes,
        remote_ip: res.socket?.remoteAddress || ip || null,
      }));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout após ${timeoutMs}ms`)));
    req.on('error', (error) => reject(error));
    req.end();
  });
}

async function checkEndpoint({ name, url, ip, headers = {}, attempts = 5, acceptStatus }) {
  const history = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await requestHttps({ url, ip, headers, timeoutMs: 20000 + (attempt - 1) * 5000 });
      const accepted = acceptStatus(result.status);
      history.push({ attempt, ...result, accepted });
      if (accepted) return { ok: true, name, history, last: history.at(-1) };
      // 401/403 no n8n não é transitório: é credencial/permissão.
      if (name === 'n8n_api' && [401, 403].includes(result.status)) {
        return { ok: false, name, auth_error: true, history, last: history.at(-1) };
      }
    } catch (error) {
      history.push({ attempt, ok: false, error: redactError(error) });
    }
    if (attempt < attempts) await sleep(Math.min(4000 * attempt, 15000));
  }
  return { ok: false, name, history, last: history.at(-1) || null };
}

function appendGithubEnv(name, value) {
  if (!process.env.GITHUB_ENV || !value) return;
  fs.appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}

function mdStatus(ok) {
  return ok ? '✅ OK' : '❌ FALHOU';
}

const report = {
  version: '1.3',
  generated_at: new Date().toISOString(),
  ok: false,
  frontend: {},
  n8n: {},
};

try {
  const frontendBase = normalizeUrl(required('FRONTEND_URL'));
  const n8nBase = normalizeUrl(required('N8N_URL'));
  required('N8N_API_KEY');
  required('FRONTEND_TEST_USER');
  required('FRONTEND_TEST_PASSWORD');

  const frontendUrl = new URL(`${frontendBase}/login`);
  const n8nUrl = new URL(n8nBase);

  console.log(`[preflight] Resolvendo frontend: ${frontendUrl.hostname}`);
  const frontDns = await resolveHost(frontendUrl.hostname);
  report.frontend.dns = frontDns;
  const frontIp = frontDns.ipv4[0] || frontDns.ipv6[0] || '';
  report.frontend.selected_ip = frontIp || null;
  if (!frontDns.ok || !frontIp) throw new Error(`PREFLIGHT_FRONTEND_DNS_FAILED: não foi possível resolver ${frontendUrl.hostname} após ${frontDns.history.length} tentativas.`);

  console.log(`[preflight] Testando frontend via IP resolvido ${frontIp}`);
  const frontHttp = await checkEndpoint({
    name: 'frontend',
    url: frontendUrl.toString(),
    ip: frontIp,
    acceptStatus: (status) => status >= 200 && status < 500,
  });
  report.frontend.http = frontHttp;
  if (!frontHttp.ok) throw new Error(`PREFLIGHT_FRONTEND_HTTP_FAILED: ${frontendUrl.origin} não respondeu de forma utilizável após ${frontHttp.history.length} tentativas.`);

  console.log(`[preflight] Resolvendo n8n: ${n8nUrl.hostname}`);
  const n8nDns = await resolveHost(n8nUrl.hostname);
  report.n8n.dns = n8nDns;
  const n8nIp = n8nDns.ipv4[0] || n8nDns.ipv6[0] || '';
  report.n8n.selected_ip = n8nIp || null;
  if (!n8nDns.ok || !n8nIp) throw new Error(`PREFLIGHT_N8N_DNS_FAILED: não foi possível resolver ${n8nUrl.hostname} após ${n8nDns.history.length} tentativas.`);

  // Primeiro valida o endpoint Public API e a API key diretamente pelo IP resolvido.
  const workflowId = process.env.N8N_AI_WORKFLOW_ID || '';
  const apiPath = workflowId ? `/api/v1/workflows/${encodeURIComponent(workflowId)}` : '/api/v1/workflows?limit=1';
  const n8nApiUrl = `${n8nBase}${apiPath}`;
  console.log(`[preflight] Testando Public API do n8n via IP resolvido ${n8nIp}`);
  const n8nHttp = await checkEndpoint({
    name: 'n8n_api',
    url: n8nApiUrl,
    ip: n8nIp,
    headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY },
    acceptStatus: (status) => status >= 200 && status < 300,
  });
  report.n8n.api = n8nHttp;
  if (!n8nHttp.ok) {
    if (n8nHttp.auth_error) throw new Error(`PREFLIGHT_N8N_AUTH_FAILED: Public API respondeu HTTP ${n8nHttp.last?.status}. Verifique N8N_API_KEY e permissões de leitura.`);
    throw new Error(`PREFLIGHT_N8N_API_FAILED: Public API do n8n não ficou disponível após ${n8nHttp.history.length} tentativas.`);
  }

  // Propaga os IPs para as próximas etapas do GitHub Actions. O Playwright usa
  // host-resolver-rules e o N8nClient usa conexão HTTPS direta com SNI correto.
  process.env.FRONTEND_RESOLVED_IP = frontIp;
  process.env.N8N_RESOLVED_IP = n8nIp;
  appendGithubEnv('FRONTEND_RESOLVED_IP', frontIp);
  appendGithubEnv('N8N_RESOLVED_IP', n8nIp);
  appendGithubEnv('PREFLIGHT_OK', 'true');

  // Verifica também o endpoint de executions usando o cliente final que será usado nos testes.
  const n8n = new N8nClient();
  const resolvedWorkflowId = await n8n.resolveWorkflowId();
  report.n8n.workflow_id = resolvedWorkflowId;
  const executionList = await n8n.listExecutions(1);
  report.n8n.executions_api = {
    ok: Array.isArray(executionList?.data),
    rows: Array.isArray(executionList?.data) ? executionList.data.length : 0,
  };
  if (!report.n8n.executions_api.ok) throw new Error('PREFLIGHT_N8N_EXECUTIONS_FAILED: /executions não retornou o formato esperado.');

  report.ok = true;
  console.log('[preflight] OK — frontend, n8n Public API, workflow e executions acessíveis.');
} catch (error) {
  report.ok = false;
  report.error = redactError(error);
  appendGithubEnv('PREFLIGHT_OK', 'false');
  console.error(`[preflight] ${report.error}`);
} finally {
  fs.writeFileSync(path.join(artifactsDir, 'PREFLIGHT_REPORT.json'), JSON.stringify(report, null, 2));
  const frontDnsAttempts = report.frontend?.dns?.history?.length || 0;
  const n8nDnsAttempts = report.n8n?.dns?.history?.length || 0;
  const frontHttpAttempts = report.frontend?.http?.history?.length || 0;
  const n8nHttpAttempts = report.n8n?.api?.history?.length || 0;
  const lines = [
    '# Preflight — Claro RJO-AM IA',
    '',
    `- Resultado: **${mdStatus(report.ok)}**`,
    `- Frontend DNS: **${report.frontend?.dns?.ok ? 'OK' : 'FALHOU'}** (${frontDnsAttempts} tentativa(s))`,
    `- Frontend HTTPS: **${report.frontend?.http?.ok ? 'OK' : 'FALHOU'}** (${frontHttpAttempts} tentativa(s))`,
    `- n8n DNS: **${report.n8n?.dns?.ok ? 'OK' : 'FALHOU'}** (${n8nDnsAttempts} tentativa(s))`,
    `- n8n Public API: **${report.n8n?.api?.ok ? 'OK' : 'FALHOU'}** (${n8nHttpAttempts} tentativa(s))`,
    `- n8n Executions API: **${report.n8n?.executions_api?.ok ? 'OK' : 'FALHOU'}**`,
    report.error ? `- Erro: \`${String(report.error).replaceAll('`', "'")}\`` : '',
  ].filter(Boolean);
  fs.writeFileSync(path.join(artifactsDir, 'PREFLIGHT_REPORT.md'), lines.join('\n'));
}

if (!report.ok) process.exit(1);
