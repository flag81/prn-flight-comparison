import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

let capturedBody = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('api2.php')) capturedBody = req.postData();
});

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }
await page.locator('label', { hasText: /^One way$/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
async function pickAirport(placeholder, code) {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await page.waitForTimeout(800);
  await page.locator('mat-option').filter({ hasText: `(${code})` }).first().click();
  await page.waitForTimeout(800);
}
await pickAirport('Departure airport', 'PRN');
await pickAirport('Arrival airport', 'STR');
await page.locator('button:has-text("Find flights")').click();
await page.waitForTimeout(4000);

const owFormHidden = (() => {
  const parts = capturedBody.split('\r\n');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes('name="form_hidden"')) return parts[i + 2];
  }
})();

const rtFormHidden = (() => {
  const s = 'a:2:{i:0;a:10:{s:3:"VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:4:"NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:7:"RUK_VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:8:"RUK_NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"FLGART";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:9:"DATUM_HIN";a:1:{s:5:"check";a:2:{i:0;s:7:"pflicht";i:1;s:16:"datumOhneUhreit";}}s:9:"DATUM_RUK";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZERW";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZCHD";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZINF";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}}i:1;a:0:{}}';
  return Buffer.from(s, 'utf8').toString('base64');
})();

function buildBody({ hin, ruk, flgart, formHidden, rukVon = 'undefined', rukNach = 'undefined' }) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2, 18);
  const d = `--${boundary}`;
  const lines = [
    d, 'Content-Disposition: form-data; name="class"', '', 'Buchungen_Buchen_Fluglisten',
    d, 'Content-Disposition: form-data; name="DATUM_HIN"', '', hin,
    d, 'Content-Disposition: form-data; name="DATUM_RUK"', '', ruk,
    d, 'Content-Disposition: form-data; name="VON"', '', 'PRN',
    d, 'Content-Disposition: form-data; name="NACH"', '', 'STR',
    d, 'Content-Disposition: form-data; name="RUK_VON"', '', rukVon,
    d, 'Content-Disposition: form-data; name="RUK_NACH"', '', rukNach,
    d, 'Content-Disposition: form-data; name="form_hidden"', '', formHidden,
    d, 'Content-Disposition: form-data; name="BOOK"', '', 'V3',
    d, 'Content-Disposition: form-data; name="preis_cc_nur_eur"', '', 'false',
    d, 'Content-Disposition: form-data; name="ANZERW"', '', '1',
    d, 'Content-Disposition: form-data; name="ANZCHD"', '', '0',
    d, 'Content-Disposition: form-data; name="ANZINF"', '', '0',
    d, 'Content-Disposition: form-data; name="FLGART"', '', flgart,
    `${d}--`, '',
  ];
  return { body: lines.join('\r\n'), boundary };
}

async function send(formBody, boundary) {
  const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/', 'content-type': `multipart/form-data; boundary=${boundary}` },
    data: formBody,
  });
  return JSON.parse(await resp.text());
}

async function test(name, opts) {
  const { body, boundary } = buildBody({ hin: '15.08.2026', ruk: '20.08.2026', flgart: 'rt', formHidden: owFormHidden, ...opts });
  const res = await send(body, boundary);
  const hin = (res.data?.hin ?? []).length;
  const rueck = (res.data?.rueck ?? []).length;
  console.log(`${name}: err=${res.data?.error ?? 'none'} hin=${hin} rueck=${rueck}`);
  return res;
}

console.log('=== round-trip variations (FLGART=rt) ===');
const a = await test('A: ow form_hidden, ruk=undefined', {});
if (a.data) console.log('A data keys:', Object.keys(a.data));
if (a.data?.hin?.[0]) {
  const f = a.data.hin[0];
  console.log('A hin[0]:', JSON.stringify({ flugnr: f.flugnr, ab_datum: f.ab_datum, ab_zeit: f.ab_zeit, an_zeit: f.an_zeit }));
}
console.log('A ruk count:', (a.data?.ruk ?? []).length);
if (a.data?.ruk?.[0]) {
  const f = a.data.ruk[0];
  console.log('A ruk[0]:', JSON.stringify({ flugnr: f.flugnr, ab_datum: f.ab_datum, ab_zeit: f.ab_zeit, an_zeit: f.an_zeit, von: f.von, nach: f.nach, ec: f.ec, tax: f.tax, company_name: f.company_name }));
}
await test('B: rt form_hidden, ruk=undefined', { formHidden: rtFormHidden });
await test('C: ow form_hidden, ruk=PRN/STR', { rukVon: 'PRN', rukNach: 'STR' });
await test('D: rt form_hidden, ruk=PRN/STR', { formHidden: rtFormHidden, rukVon: 'PRN', rukNach: 'STR' });

await browser.close();
