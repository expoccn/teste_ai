import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { N8nClient } from './lib/n8n.mjs';
import { validateSemantic } from './lib/semantic.mjs';
import { acquireFrontendAccessToken, installAccessTokenInitScript, confirmAccessTokenInstalled } from './lib/frontend-auth.mjs';

const cases = JSON.parse(fs.readFileSync(new URL('./data/cases.json', import.meta.url), 'utf8'));
const onlyGroup = process.env.TEST_GROUP || '';
const selected = onlyGroup ? cases.filter((c) => c.group === onlyGroup || c.id === onlyGroup) : cases;
const artifactsDir = path.resolve('artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Secret/env obrigatório ausente: ${name}`);
  return v;
}

const periodLabels = { d1: 'Último dia', '7d': '7 dias', '30d': '30 dias' };
const AI_SESSION_KEY = 'claro-rjo-am-ai-session-v1';
const PERIOD_STORAGE_KEY = 'claro-rjo-am-dashboard-period';
let results = [];

function setPhase(record, phase) {
  record.phase = phase;
}



function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function navigateWithRetry(page, target, label) {
  const timeouts = [30_000, 45_000, 60_000, 75_000];
  const attempts = [];
  for (let i = 0; i < timeouts.length; i++) {
    const started = Date.now();
    try {
      const response = await page.goto(target, { waitUntil: 'commit', timeout: timeouts[i] });
      const status = response?.status?.() ?? null;
      if (status !== null && status >= 500) throw new Error(`HTTP ${status}`);
      attempts.push({ attempt: i + 1, ok: true, status, elapsed_ms: Date.now() - started, url: page.url() });
      // O locator da etapa seguinte confirma que a aplicação renderizou. Não
      // dependemos de domcontentloaded para considerar a navegação iniciada.
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
      return { response, attempts };
    } catch (error) {
      attempts.push({ attempt: i + 1, ok: false, elapsed_ms: Date.now() - started, error: error instanceof Error ? error.message : String(error), url: page.url() });
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 10_000 }).catch(() => {});
      if (i < timeouts.length - 1) await sleep(Math.min(5000 * (i + 1), 15000));
    }
  }
  const compact = attempts.map((x) => `#${x.attempt}:${x.ok ? `HTTP ${x.status ?? '?'}` : x.error}`).join(' | ');
  throw new Error(`NAVIGATION_FAILED [${label}] após ${attempts.length} tentativas — ${compact}`);
}

async function reloadWithRetry(page, label) {
  const timeouts = [30_000, 45_000, 60_000];
  const attempts = [];
  for (let i = 0; i < timeouts.length; i++) {
    const started = Date.now();
    try {
      const response = await page.reload({ waitUntil: 'commit', timeout: timeouts[i] });
      attempts.push({ attempt: i + 1, ok: true, status: response?.status?.() ?? null, elapsed_ms: Date.now() - started });
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
      return attempts;
    } catch (error) {
      attempts.push({ attempt: i + 1, ok: false, elapsed_ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
      if (i < timeouts.length - 1) await sleep(Math.min(4000 * (i + 1), 10000));
    }
  }
  throw new Error(`RELOAD_FAILED [${label}] após ${attempts.length} tentativas — ${attempts.map((x) => `#${x.attempt}:${x.ok ? x.status : x.error}`).join(' | ')}`);
}
async function attachJson(testInfo, name, value) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
}

function installBrowserDiagnostics(page, record) {
  record.browser_diagnostics = {
    request_failures: [],
    http_errors: [],
    page_errors: [],
    console_errors: [],
    readiness_attempts: [],
  };
  const diag = record.browser_diagnostics;
  const pushLimited = (list, value, limit = 40) => {
    if (list.length < limit) list.push(value);
  };

  page.on('requestfailed', (request) => {
    pushLimited(diag.request_failures, {
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText || 'request failed',
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      pushLimited(diag.http_errors, {
        status: response.status(),
        method: response.request().method(),
        url: response.url(),
      });
    }
  });
  page.on('pageerror', (error) => pushLimited(diag.page_errors, String(error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') pushLimited(diag.console_errors, message.text());
  });
}

async function waitForAiRuntimeReady(page, record) {
  const heading = page.getByRole('heading', { name: 'Análises por IA', exact: true });
  const assistant = page.getByRole('heading', { name: 'Assistente de análise', exact: true });
  const timeouts = [90_000, 75_000, 60_000];

  for (let attempt = 1; attempt <= timeouts.length; attempt++) {
    const started = Date.now();
    try {
      await heading.waitFor({ state: 'visible', timeout: timeouts[attempt - 1] });
      await assistant.waitFor({ state: 'visible', timeout: 60_000 });
      record.browser_diagnostics.readiness_attempts.push({
        attempt,
        ok: true,
        elapsed_ms: Date.now() - started,
        url: page.url(),
      });
      return;
    } catch (error) {
      const loginVisible = await page.locator('#username').isVisible().catch(() => false);
      const checkingVisible = await page.getByText('Verificando acesso...', { exact: true }).isVisible().catch(() => false);
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      record.browser_diagnostics.readiness_attempts.push({
        attempt,
        ok: false,
        elapsed_ms: Date.now() - started,
        url: page.url(),
        login_visible: loginVisible,
        checking_access: checkingVisible,
        body_preview: String(bodyText || '').replace(/\s+/g, ' ').slice(0, 500),
        error: error instanceof Error ? error.message : String(error),
      });

      if (loginVisible || /\/login\/?(?:\?.*)?$/.test(new URL(page.url()).pathname)) {
        throw new Error('AUTH_SESSION_NOT_ACCEPTED: o token obtido pela API não foi aceito pelo frontend e a aplicação retornou para /login.');
      }

      if (attempt < timeouts.length) {
        // O frontend publicado atualmente pode estar servindo Vite em modo de desenvolvimento.
        // Um primeiro carregamento frio pode exigir dezenas/centenas de módulos. Mantemos a
        // mesma página/contexto e recarregamos para aproveitar o cache já aquecido.
        await reloadWithRetry(page, `ai-runtime-warmup-${attempt}`);
      }
    }
  }

  const failed = record.browser_diagnostics.request_failures.slice(-8)
    .map((x) => `${x.method} ${x.url} — ${x.error}`)
    .join(' | ');
  throw new Error(`FRONTEND_RUNTIME_NOT_READY: a tela de IA não ficou pronta após aquecimento e recargas. ${failed ? `Últimas requisições com falha: ${failed}` : 'Nenhuma falha HTTP explícita foi capturada.'}`);
}

async function authenticateFrontend(page, record) {
  const auth = await acquireFrontendAccessToken();
  record.auth = {
    status: auth.status,
    attempt: auth.attempt,
    username: auth.user?.username || null,
    display_name: auth.user?.display_name || null,
    role: auth.user?.role || null,
    must_change_password: Boolean(auth.user?.must_change_password),
  };
  if (record.auth.must_change_password) {
    throw new Error('AUTH_TEST_USER_REQUIRES_PASSWORD_CHANGE: o usuário E2E está marcado para troca obrigatória de senha.');
  }
  await installAccessTokenInitScript(page, auth.token);
}

async function openAuthenticatedAiPage(page, record) {
  await navigateWithRetry(page, '/analises-ia', 'analises-ia-authenticated');
  await waitForAiRuntimeReady(page, record);

  const tokenInstalled = await confirmAccessTokenInstalled(page);
  if (!tokenInstalled) {
    throw new Error('AUTH_TOKEN_NOT_PRESENT: a sessão autenticada não permaneceu no sessionStorage do frontend.');
  }
}

async function setPeriod(page, period) {
  const label = periodLabels[period];
  const header = page.locator('header').first();
  const button = header.getByRole('button', { name: label, exact: true });

  await expect(button, `Botão de período "${label}" não encontrado no cabeçalho`).toHaveCount(1);
  await expect(button).toBeVisible();
  await button.click();

  await expect.poll(
    () => page.evaluate((key) => localStorage.getItem(key), PERIOD_STORAGE_KEY),
    { timeout: 10_000, message: `Período ${period} não foi persistido no frontend` },
  ).toBe(period);
}

async function uniqueAiSession(page, caseId, record) {
  const id = `e2e-${Date.now()}-${caseId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 96);
  await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [AI_SESSION_KEY, id]);
  await reloadWithRetry(page, 'session-reload');
  await waitForAiRuntimeReady(page, record);
  const textarea = page.getByPlaceholder('Pergunte sobre os dados consolidados...', { exact: true });
  await expect(textarea).toHaveCount(1);
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeEnabled({ timeout: 30_000 });

  const stored = await page.evaluate((key) => sessionStorage.getItem(key), AI_SESSION_KEY);
  expect(stored, 'session_id E2E não permaneceu no sessionStorage após reload').toBe(id);
  return id;
}

async function sendQuestion(page, question) {
  const textarea = page.getByPlaceholder('Pergunte sobre os dados consolidados...', { exact: true });
  const sendButton = page.getByRole('button', { name: 'Enviar pergunta', exact: true });

  await expect(textarea).toHaveCount(1);
  await expect(sendButton).toHaveCount(1);
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeEnabled();
  await textarea.fill(question);
  await expect(textarea).toHaveValue(question);
  await expect(sendButton).toBeEnabled();

  const startedAfterMs = Date.now();
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/ai-chat') && response.request().method() === 'POST',
    { timeout: 130_000 },
  );

  await sendButton.click();
  const response = await responsePromise;
  const status = response.status();

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = { parse_error: await response.text().catch(() => '') };
  }

  let requestBody = null;
  try {
    requestBody = response.request().postDataJSON();
  } catch {
    requestBody = response.request().postData() || null;
  }

  return { response, status, body, requestBody, startedAfterMs };
}

for (const testCase of selected) {
  test(`${testCase.id} :: ${testCase.question}`, async ({ page }, testInfo) => {
    const n8n = new N8nClient();
    const record = {
      id: testCase.id,
      group: testCase.group,
      question: testCase.question,
      period: testCase.period,
      phase: 'init',
      failure_type: null,
      failures: [],
    };

    try {
      installBrowserDiagnostics(page, record);

      setPhase(record, 'auth_api');
      await authenticateFrontend(page, record);

      setPhase(record, 'open_ai_page');
      await openAuthenticatedAiPage(page, record);

      setPhase(record, 'session');
      const sessionId = await uniqueAiSession(page, testCase.id, record);
      record.session_id = sessionId;

      setPhase(record, 'period');
      await setPeriod(page, testCase.period);

      setPhase(record, 'frontend_request');
      const { status, body, requestBody, startedAfterMs } = await sendQuestion(page, testCase.question);
      record.http_status = status;
      record.api_response = body;
      record.frontend_request = requestBody;

      expect(status, `HTTP /ai-chat deveria ser 200. Corpo: ${JSON.stringify(body)}`).toBe(200);
      expect(body?.ok, `Resposta /ai-chat deveria conter ok=true. Corpo: ${JSON.stringify(body)}`).toBe(true);

      if (requestBody && typeof requestBody === 'object') {
        expect(String(requestBody.question || ''), 'Frontend enviou question diferente da pergunta do caso').toBe(testCase.question);
        expect(String(requestBody.period || ''), 'Frontend enviou period diferente do período selecionado').toBe(testCase.period);
        expect(String(requestBody.session_id || ''), 'Frontend enviou session_id diferente da sessão E2E').toBe(sessionId);
      }

      setPhase(record, 'n8n_execution');
      const execution = await n8n.waitForExecution({ question: testCase.question, sessionId, startedAfterMs });
      record.execution_id = String(execution?.id || '');
      record.execution_status = execution?.status || (execution?.finished ? 'success' : 'unknown');

      setPhase(record, 'semantic_validation');
      const semantic = validateSemantic({ testCase, apiResponse: body, execution, N8nClient });
      record.intent = semantic.context?.intent;
      record.temporal_query = semantic.context?.temporal_query;
      record.used_llm = body?.used_llm;
      record.executed_nodes = semantic.executedNodes;
      record.answer = semantic.answer;
      record.failures = [...semantic.failures];

      if (body?.answer) {
        const uiAnswer = page.getByText(String(body.answer), { exact: true }).last();
        await expect(uiAnswer, 'A resposta HTTP não apareceu textualmente na interface').toBeVisible({ timeout: 20_000 });
      }

      await attachJson(testInfo, 'n8n-execution-summary.json', {
        execution_id: record.execution_id,
        status: record.execution_status,
        executed_nodes: record.executed_nodes,
        context: semantic.context,
        response: semantic.response,
      });
      await attachJson(testInfo, 'semantic-result.json', record);

      if (semantic.failures.length) {
        record.failure_type = 'SEMANTIC';
        throw new Error(`FALHA_SEMANTICA:\n- ${semantic.failures.join('\n- ')}`);
      }

      record.phase = 'done';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!record.failure_type) record.failure_type = record.phase === 'semantic_validation' ? 'SEMANTIC' : 'AUTOMATION';
      if (!record.failures.length || !message.includes('FALHA_SEMANTICA')) record.failures.push(message);

      await attachJson(testInfo, 'test-diagnostic.json', {
        id: record.id,
        phase: record.phase,
        failure_type: record.failure_type,
        page_url: page.url(),
        error: message,
        auth: record.auth || null,
        browser_diagnostics: record.browser_diagnostics || null,
        frontend_request: record.frontend_request || null,
        http_status: record.http_status ?? null,
        execution_id: record.execution_id || null,
        intent: record.intent || null,
      });
      throw error;
    } finally {
      results.push(record);
      fs.writeFileSync(path.join(artifactsDir, 'semantic-results.json'), JSON.stringify(results, null, 2));
    }
  });
}
