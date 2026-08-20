import https from 'node:https';

const ACCESS_SESSION_KEY = 'claro-rjo-am-access-session';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Secret/env obrigatório ausente: ${name}`);
  return value;
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return ['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(code)
    || /timeout|socket hang up|network/i.test(message);
}

function postJsonViaResolvedIp(url, payload, { resolvedIp = '', timeoutMs = 35_000 } = {}) {
  const target = new URL(url);
  const body = Buffer.from(JSON.stringify(payload));
  const hostname = resolvedIp || target.hostname;

  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: target.protocol,
      hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      servername: target.hostname,
      timeout: timeoutMs,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'content-length': body.length,
        host: target.host,
        'user-agent': 'claro-rjo-am-ai-regression/1.5',
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        resolve({ status: Number(response.statusCode || 0), body: parsed });
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error(`auth API timeout após ${timeoutMs}ms`), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function acquireFrontendAccessToken() {
  const n8nBase = normalizeBase(required('N8N_URL'));
  const username = required('FRONTEND_TEST_USER');
  const password = required('FRONTEND_TEST_PASSWORD');
  const resolvedIp = process.env.N8N_RESOLVED_IP || '';
  const url = `${n8nBase}/webhook/claro-rjo-am/auth/login`;

  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const result = await postJsonViaResolvedIp(url, { username, password }, {
        resolvedIp,
        timeoutMs: 30_000 + (attempt - 1) * 10_000,
      });
      if (result.status === 401 || result.status === 403) {
        throw new Error(`AUTH_API_REJECTED: login de teste recusado (HTTP ${result.status}).`);
      }
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`AUTH_API_HTTP_${result.status}: endpoint de login não respondeu 2xx.`);
      }
      const token = result.body?.access_token;
      if (!token || typeof token !== 'string') {
        throw new Error('AUTH_API_INVALID_RESPONSE: login retornou sucesso sem access_token.');
      }
      return {
        token,
        user: result.body?.user || null,
        status: result.status,
        attempt,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || /^AUTH_API_/.test(String(error?.message || ''))) throw error;
      if (attempt < 4) await sleep(Math.min(3000 * attempt, 9000));
    }
  }
  throw lastError || new Error('AUTH_API_FAILED: falha desconhecida ao obter token de acesso.');
}

export async function installAccessTokenInitScript(page, token) {
  const frontendOrigin = new URL(required('FRONTEND_URL')).origin;
  await page.addInitScript(({ key, tokenValue, expectedOrigin }) => {
    try {
      if (globalThis.location?.origin === expectedOrigin) {
        globalThis.sessionStorage.setItem(key, tokenValue);
      }
    } catch {
      // A aplicação fará a própria validação; o teste reportará falha de autenticação.
    }
  }, { key: ACCESS_SESSION_KEY, tokenValue: token, expectedOrigin: frontendOrigin });
}

export async function confirmAccessTokenInstalled(page) {
  return page.evaluate((key) => {
    try {
      const value = sessionStorage.getItem(key) || '';
      return value.length > 20;
    } catch {
      return false;
    }
  }, ACCESS_SESSION_KEY);
}
