import { readFileSync, writeFileSync } from 'node:fs';

const body = readFileSync('C:/Users/Flag81/AppData/Local/Temp/opencode/rbp-body.bin', 'utf8');
const boundary = body.split('\r\n')[0];
const parts = body.split(boundary).filter((p) => p.includes('name='));

const fields = {};
for (const p of parts) {
  const nameMatch = p.match(/name="([^"]+)"/);
  if (!nameMatch) continue;
  const name = nameMatch[1];
  const m = p.match(/\r\n\r\n([\s\S]*?)(?:\r\n)?$/)
  fields[name] = m ? m[1].replace(/\r?\n$/, '') : '';
}

console.log(JSON.stringify(fields, null, 2));
writeFileSync('C:/Users/Flag81/AppData/Local/Temp/opencode/rbp-fields.json', JSON.stringify(fields, null, 2));
