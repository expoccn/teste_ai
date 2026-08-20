import fs from 'node:fs';

const spec = fs.readFileSync(new URL('../tests/ai-regression.spec.mjs', import.meta.url), 'utf8');
const n8n = fs.readFileSync(new URL('../tests/lib/n8n.mjs', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../playwright.config.mjs', import.meta.url), 'utf8');
const preflight = fs.readFileSync(new URL('./preflight.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/ai-regression.yml', import.meta.url), 'utf8');

const checks = [
  ['timestamp é criado como startedAfterMs', /const\s+startedAfterMs\s*=\s*Date\.now\(\)/.test(spec)],
  ['sendQuestion retorna startedAfterMs', /return\s*\{[^}]*startedAfterMs[^}]*\}/s.test(spec)],
  ['chamada desestrutura startedAfterMs', /const\s*\{[^}]*startedAfterMs[^}]*\}\s*=\s*await\s+sendQuestion/s.test(spec)],
  ['waitForExecution recebe startedAfterMs', /waitForExecution\(\{[^}]*startedAfterMs[^}]*\}\)/s.test(spec)],
  ['nome antigo startedAtMs foi removido', !spec.includes('startedAtMs')],
  ['navegação possui retry controlado', spec.includes('navigateWithRetry') && spec.includes("waitUntil: 'commit'")],
  ['reload possui retry controlado', spec.includes('reloadWithRetry')],
  ['preflight testa DNS', preflight.includes('resolveHost') && preflight.includes('dns.lookup')],
  ['preflight testa frontend', preflight.includes('PREFLIGHT_FRONTEND')],
  ['preflight testa n8n Public API', preflight.includes('PREFLIGHT_N8N') && preflight.includes('X-N8N-API-KEY')],
  ['preflight exporta IP frontend', preflight.includes("appendGithubEnv('FRONTEND_RESOLVED_IP'")],
  ['preflight exporta IP n8n', preflight.includes("appendGithubEnv('N8N_RESOLVED_IP'")],
  ['Playwright usa host-resolver-rules', config.includes('--host-resolver-rules=')],
  ['N8nClient usa N8N_RESOLVED_IP', n8n.includes('N8N_RESOLVED_IP')],
  ['N8nClient mantém SNI/Host original', n8n.includes('servername: target.hostname') && n8n.includes('host: target.host')],
  ['N8nClient é somente leitura', n8n.includes('somente leitura (GET)')],
  ['GitHub executa preflight antes do Chromium', workflow.indexOf('Preflight frontend + n8n') < workflow.indexOf('Install Chromium')],
  ['GitHub pula browser se preflight falhar', workflow.includes("if: steps.preflight.outcome == 'success'")],
  ['Node prioriza IPv4', workflow.includes('NODE_OPTIONS: --dns-result-order=ipv4first')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
