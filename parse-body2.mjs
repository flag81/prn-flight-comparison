import { readFileSync } from 'node:fs';
const b = readFileSync('C:/Users/Flag81/AppData/Local/Temp/opencode/rbp-body.bin');
console.log('total bytes:', b.length);
console.log('first 500 chars:');
console.log(JSON.stringify(b.toString('utf8').slice(0, 500)));
console.log('\nline endings check:');
const s = b.toString('utf8');
console.log('has \\r\\n:', s.includes('\r\n'), ' has lone \\n:', /[^\r]\n/.test(s));
