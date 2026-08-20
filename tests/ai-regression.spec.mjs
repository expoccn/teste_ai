import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { N8nClient } from './lib/n8n.mjs';
import { validateSemantic } from './lib/semantic.mjs';

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

async function attachJson(testInfo, name, value) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
}

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  if (!page.url().includes('/login')) return;

  // Seletores ancorados nos IDs reais do frontend v18. Evitam a ambiguidade
  // entre o campo #password e o botão aria-label="Mostrar senha".
  const username = page.locator('#username');
  const password = page.locator('#password');
  const submit = page.locator('form button[type="submit"]');

  await expect(username, 'Campo #username não encontrado na tela de login').toHaveCount(1);
  await expect(password, 'Campo #password não encontrado na tela de login').toHaveCount(1);
  await expect(submit, 'Botão submit do formulário de login não encontrado').toHaveCount(1);
  await expect(username).toBeVisible();
  await expect(password).toBeVisible();
  await expect(submit).toBeVisible();

  await username.fill(env('FRONTEND_TEST_USER'));
  await password.fill(env('FRONTEND_TEST_PASSWORD'));

  await submit.click();

  const loginResult = await Promise.race([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 45_000 })
      .then(() => ({ ok: true })),
    page.getByRole('alert').waitFor({ state: 'visible', timeout: 45_000 })
      .then(async () => ({ ok: false, message: (await page.getByRole('alert').innerText()).trim() })),
  ]).catch(() => null);

  if (!loginResult) {
    throw new Error(`LOGIN_TIMEOUT: o frontend permaneceu em ${page.url()} sem redirecionar nem exibir erro de autenticação.`);
  }
  if (!loginResult.ok) {
    throw new Error(`LOGIN_FAILED: ${loginResult.message || 'o frontend recusou as credenciais de teste.'}`);
  }

  await expect(page, 'Login concluiu, mas a URL ainda aponta para /login').not.toHaveURL(/\/login\/?(?:\?.*)?$/);
}

async function openAiPage(page) {
  await page.goto('/analises-ia', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Análises por IA', exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Assistente de análise', exact: true })).toBeVisible({ timeout: 60_000 });
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

async function uniqueAiSession(page, caseId) {
  const id = `e2e-${Date.now()}-${caseId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 96);
  await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [AI_SESSION_KEY, id]);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Assistente de análise', exact: true })).toBeVisible({ timeout: 60_000 });
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
      setPhase(record, 'login');
      await login(page);

      setPhase(record, 'open_ai_page');
      await openAiPage(page);

      setPhase(record, 'session');
      const sessionId = await uniqueAiSession(page, testCase.id);
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
