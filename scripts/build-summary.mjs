import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('artifacts/semantic-results.json');
const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const pass = rows.filter((x) => !(x.failures || []).length);
const fail = rows.filter((x) => (x.failures || []).length);
const semanticFail = fail.filter((x) => x.failure_type === 'SEMANTIC');
const automationFail = fail.filter((x) => x.failure_type === 'AUTOMATION');

const esc = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = [
  '# Claro RJO-AM — Regressão IA',
  '',
  `- Total: **${rows.length}**`,
  `- PASS: **${pass.length}**`,
  `- FAIL semântico: **${semanticFail.length}**`,
  `- FAIL de automação/infraestrutura: **${automationFail.length}**`,
  '',
  '| ID | Período | Pergunta | Fase | Tipo | Execução n8n | Intent | LLM | Resultado |',
  '|---|---|---|---|---|---:|---|---|---|',
];

for (const r of rows) {
  const result = (r.failures || []).length ? `FAIL — ${(r.failures || []).join('; ')}` : 'PASS';
  lines.push(`| ${esc(r.id)} | ${esc(r.period)} | ${esc(r.question)} | ${esc(r.phase || '-')} | ${esc(r.failure_type || '-')} | ${esc(r.execution_id || '-')} | ${esc(r.intent || '-')} | ${r.used_llm === true ? 'sim' : 'não'} | ${esc(result)} |`);
}

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/AI_REGRESSION_SUMMARY.md', lines.join('\n'));
console.log(lines.join('\n'));
