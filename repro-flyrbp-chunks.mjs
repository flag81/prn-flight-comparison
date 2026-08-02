import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const r = await page.request.get('https://flyrbp.com/main-MHEJEFJR.js');
const t = await r.text();
const chunks = [...t.matchAll(/import\("\.\/([^"]+)\.js"\)/g)].map((m) => 'https://flyrbp.com/' + m[1] + '.js');
console.log('chunks:', chunks.length);
for (const url of chunks) {
  const cr = await page.request.get(url);
  const ct = await cr.text();
  if (/stufe_1|DATUM_RUK|getFlights|api2/.test(ct)) {
    console.log('MATCH:', url, 'len', ct.length);
    for (const pat of ['stufe_1', 'tax', 'preis_erw', 'datumOhneUhreit', 'DATUM_RUK', 'getFlights']) {
      const i = ct.indexOf(pat);
      if (i >= 0) console.log('  ', pat, '->', ct.slice(i - 120, i + 220).replace(/\s+/g, ' '));
    }
  }
}
await browser.close();
