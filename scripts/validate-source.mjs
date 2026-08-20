import fs from 'node:fs';

const spec = fs.readFileSync(new URL('../tests/ai-regression.spec.mjs', import.meta.url), 'utf8');
const checks = [
  ['timestamp é criado como startedAfterMs', /const\s+startedAfterMs\s*=\s*Date\.now\(\)/],
  ['sendQuestion retorna startedAfterMs', /return\s*\{[^}]*startedAfterMs[^}]*\}/s],
  ['chamada desestrutura startedAfterMs', /const\s*\{[^}]*startedAfterMs[^}]*\}\s*=\s*await\s+sendQuestion/s],
  ['waitForExecution recebe startedAfterMs', /waitForExecution\(\{[^}]*startedAfterMs[^}]*\}\)/s],
  ['nome antigo startedAtMs foi removido', (text) => !text.includes('startedAtMs')],
];

let failed = 0;
for (const [label, rule] of checks) {
  const ok = typeof rule === 'function' ? rule(spec) : rule.test(spec);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
