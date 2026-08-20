import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('artifacts/semantic-results.json');
const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const pass = rows.filter((x) => !(x.failures || []).length);
const fail = rows.filter((x) => (x.failures || []).length);
const lines = [
  '# Claro RJO-AM — Regressão IA',
  '',
  `- Total: **${rows.length}**`,
  `- PASS: **${pass.length}**`,
  `- FAIL: **${fail.length}**`,
  '',
  '| ID | Período | Pergunta | Execução n8n | Intent | LLM | Resultado |',
  '|---|---|---|---:|---|---|---|',
];
for (const r of rows) {
  const result = (r.failures || []).length ? `FAIL — ${(r.failures || []).join('; ')}` : 'PASS';
  lines.push(`| ${r.id} | ${r.period} | ${String(r.question).replaceAll('|','\\|')} | ${r.execution_id || '-'} | ${r.intent || '-'} | ${r.used_llm === true ? 'sim' : 'não'} | ${result.replaceAll('|','\\|')} |`);
}
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/AI_REGRESSION_SUMMARY.md', lines.join('\n'));
console.log(lines.join('\n'));
