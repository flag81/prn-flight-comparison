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
console.log('captured ow form_hidden:', owFormHidden.slice(0, 40) + '...');

function buildRoundTripFormHidden() {
  const s = 'a:2:{i:0;a:10:{s:3:"VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:4:"NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:7:"RUK_VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:8:"RUK_NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"FLGART";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:9:"DATUM_HIN";a:1:{s:5:"check";a:2:{i:0;s:7:"pflicht";i:1;s:16:"datumOhneUhreit";}}s:9:"DATUM_RUK";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZERW";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZCHD";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZINF";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}}i:1;a:0:{}}';
  return Buffer.from(s, 'utf8').toString('base64');
}

function buildBody({ hin, ruk, flgart, formHidden }) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2, 18);
  const d = `--${boundary}`;
  const lines = [
    d,
    'Content-Disposition: form-data; name="class"', '', 'Buchungen_Buchen_Fluglisten',
    d,
    'Content-Disposition: form-data; name="DATUM_HIN"', '', hin,
    d,
    'Content-Disposition: form-data; name="DATUM_RUK"', '', ruk,
    d,
    'Content-Disposition: form-data; name="VON"', '', 'PRN',
    d,
    'Content-Disposition: form-data; name="NACH"', '', 'STR',
    d,
    'Content-Disposition: form-data; name="RUK_VON"', '', 'undefined',
    d,
    'Content-Disposition: form-data; name="RUK_NACH"', '', 'undefined',
    d,
    'Content-Disposition: form-data; name="form_hidden"', '', formHidden,
    d,
    'Content-Disposition: form-data; name="BOOK"', '', 'V3',
    d,
    'Content-Disposition: form-data; name="preis_cc_nur_eur"', '', 'false',
    d,
    'Content-Disposition: form-data; name="ANZERW"', '', '1',
    d,
    'Content-Disposition: form-data; name="ANZCHD"', '', '0',
    d,
    'Content-Disposition: form-data; name="ANZINF"', '', '0',
    d,
    'Content-Disposition: form-data; name="FLGART"', '', flgart,
    `${d}--`, '',
  ];
  const body = lines.join('\r\n');
  return { body, boundary };
}

async function send(formBody, boundary) {
  const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/', 'content-type': `multipart/form-data; boundary=${boundary}` },
    data: formBody,
  });
  return JSON.parse(await resp.text());
}

const rtFormHidden = buildRoundTripFormHidden();
console.log('rt form_hidden prefix:', rtFormHidden.slice(0, 30) + '...');

// One-way via constructed body
const ow = buildBody({ hin: '15.08.2026', ruk: '20.08.2026', flgart: 'ow', formHidden: owFormHidden });
const owRes = await send(ow.body, ow.boundary);
console.log('\n=== OW constructed ===');
console.log('err:', owRes.data?.error ?? 'none', 'hin:', (owRes.data?.hin ?? []).length, 'rueck:', (owRes.data?.rueck ?? []).length);

// Round-trip via constructed body
const rt = buildBody({ hin: '15.08.2026', ruk: '20.08.2026', flgart: 'rt', formHidden: rtFormHidden });
const rtRes = await send(rt.body, rt.boundary);
console.log('\n=== RT constructed ===');
console.log('err:', rtRes.data?.error ?? 'none', 'hin:', (rtRes.data?.hin ?? []).length, 'rueck:', (rtRes.data?.rueck ?? []).length);
if (rtRes.data?.rueck?.length) {
  console.log('rueck sample:', JSON.stringify(rtRes.data.rueck[0]).slice(0, 600));
}
if (rtRes.data?.hin?.length) {
  console.log('hin sample price fields:', JSON.stringify({
    flugnr: rtRes.data.hin[0].flugnr,
    ab: rtRes.data.hin[0].ab_datum,
    ab_zeit: rtRes.data.hin[0].ab_zeit,
    an_zeit: rtRes.data.hin[0].an_zeit,
    ec: rtRes.data.hin[0].ec,
    pec: rtRes.data.hin[0].pec,
    stufe_1: rtRes.data.hin[0].stufe_1,
    tax: rtRes.data.hin[0].tax,
    available: rtRes.data.hin[0].available,
    company_name: rtRes.data.hin[0].company_name,
  }));
}
await browser.close();
