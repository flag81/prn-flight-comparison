import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const mainUrl = 'https://flyrbp.com/main-MHEJEFJR.js';
const r = await page.request.get(mainUrl);
const main = await r.text();
const chunks = [...new Set([...main.matchAll(/import\("\.\/([^"]+)\.js"\)/g)].map((m) => 'https://flyrbp.com/' + m[1] + '.js'))];

const files = { [mainUrl]: main };
for (const url of chunks) {
  const cr = await page.request.get(url);
  files[url] = await cr.text();
}

const patterns = [/\.ec\b/, /\.pec\b/, /\.tax\b/, /stufe/, /preis/i, /waehrung/, /currency/];
for (const [url, t] of Object.entries(files)) {
  const hits = [];
  for (const pat of patterns) {
    let m;
    const re = new RegExp(pat.source, 'gi');
    let count = 0;
    while ((m = re.exec(t)) && count < 3) {
      hits.push({ pat: pat.source, ctx: t.slice(Math.max(0, m.index - 150), m.index + 200).replace(/\s+/g, ' ') });
      count++;
    }
  }
  if (hits.length) {
    console.log('\n===== ' + url + ' =====');
    for (const h of hits) console.log('[' + h.pat + ']', h.ctx);
  }
}
await browser.close();
