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
let results = [];

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  if (!page.url().includes('/login')) return;
  await page.getByLabel('Usuário').fill(env('FRONTEND_TEST_USER'));
  await page.getByLabel('Senha').fill(env('FRONTEND_TEST_PASSWORD'));
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 45_000 }),
    page.getByRole('button', { name: 'Entrar' }).click(),
  ]);
}

async function setPeriod(page, period) {
  const label = periodLabels[period];
  const button = page.getByRole('button', { name: label, exact: true }).first();
  await expect(button).toBeVisible();
  await button.click();
  await page.waitForTimeout(700);
}

async function uniqueAiSession(page, caseId) {
  const id = `e2e-${Date.now()}-${caseId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 96);
  await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), ['claro-rjo-am-ai-session-v1', id]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  return id;
}

async function sendQuestion(page, question) {
  const textarea = page.getByPlaceholder('Pergunte sobre os dados consolidados...');
  await expect(textarea).toBeVisible();
  await textarea.fill(question);
  const startedAtMs = Date.now();
  const responsePromise = page.waitForResponse((response) => response.url().includes('/ai-chat') && response.request().method() === 'POST', { timeout: 130_000 });
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  const response = await responsePromise;
  const status = response.status();
  let body = null;
  try { body = await response.json(); } catch { body = { parse_error: await response.text().catch(() => '') }; }
  return { response, status, body, startedAtMs };
}

for (const testCase of selected) {
  test(`${testCase.id} :: ${testCase.question}`, async ({ page }, testInfo) => {
    const n8n = new N8nClient();
    const record = { id: testCase.id, group: testCase.group, question: testCase.question, period: testCase.period, failures: [] };
    try {
      await login(page);
      await page.goto('/analises-ia', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Assistente de análise')).toBeVisible({ timeout: 60_000 });
      const sessionId = await uniqueAiSession(page, testCase.id);
      await setPeriod(page, testCase.period);

      const { status, body, startedAtMs } = await sendQuestion(page, testCase.question);
      record.http_status = status;
      record.api_response = body;
      record.session_id = sessionId;
      expect(status, `HTTP /ai-chat deveria ser 200. Corpo: ${JSON.stringify(body)}`).toBe(200);
      expect(body?.ok).toBe(true);

      const execution = await n8n.waitForExecution({ question: testCase.question, sessionId, startedAfterMs });
      record.execution_id = String(execution?.id || '');
      record.execution_status = execution?.status || (execution?.finished ? 'success' : 'unknown');

      const semantic = validateSemantic({ testCase, apiResponse: body, execution, N8nClient });
      record.intent = semantic.context?.intent;
      record.temporal_query = semantic.context?.temporal_query;
      record.used_llm = body?.used_llm;
      record.executed_nodes = semantic.executedNodes;
      record.answer = semantic.answer;
      record.failures = semantic.failures;

      const uiAnswer = page.getByText(String(body?.answer || ''), { exact: false }).last();
      if (body?.answer) await expect(uiAnswer).toBeVisible({ timeout: 20_000 });

      await testInfo.attach('n8n-execution-summary.json', {
        body: Buffer.from(JSON.stringify({
          execution_id: record.execution_id,
          status: record.execution_status,
          executed_nodes: record.executed_nodes,
          context: semantic.context,
          response: semantic.response,
        }, null, 2)),
        contentType: 'application/json',
      });
      await testInfo.attach('semantic-result.json', {
        body: Buffer.from(JSON.stringify(record, null, 2)),
        contentType: 'application/json',
      });

      expect(semantic.failures, semantic.failures.join('\n')).toEqual([]);
    } catch (error) {
      record.failures.push(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      results.push(record);
      fs.writeFileSync(path.join(artifactsDir, 'semantic-results.json'), JSON.stringify(results, null, 2));
    }
  });
}
