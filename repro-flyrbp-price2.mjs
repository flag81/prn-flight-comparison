import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(25000);

let capturedBody = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('api2.php')) capturedBody = req.postData();
});

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const usFormat = (d) => { const [y,m,dd] = d.split('-'); return `${MONTHS[+m-1].slice(0,3)} ${+dd}, ${y}`; };

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

const dateInputs = page.locator('input.mat-datepicker-input');
const el = dateInputs.first();
await el.click();
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type(usFormat('2026-08-15'), { delay: 40 });
await page.keyboard.press('Tab');
await page.waitForTimeout(800);
console.log('date value:', JSON.stringify(await el.inputValue()));

await page.locator('button:has-text("Find flights")').click();
await page.waitForTimeout(7000);

const uiFlights = await page.evaluate(() => {
  const results = [];
  const rows = [...document.querySelectorAll('[class*="flight"], [class*="flug"], .flight-item, mat-card, [class*="result"]')];
  for (const row of rows) {
    const text = (row.innerText ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 400) continue;
    if (!/IV\s*\d|\b823[0-9]\b|GP-Aviation|GP Aviation/i.test(text)) continue;
    const priceMatch = text.match(/(\d{2,4}(?:[.,]\d{2})?)\s*(€|EUR|EUR\b)/i);
    const timeMatch = text.match(/(\d{1,2}:\d{2})/);
    if (priceMatch) {
      results.push({ price: priceMatch[1], time: timeMatch?.[1] ?? null, text: text.slice(0, 200) });
    }
  }
  return results.slice(0, 10);
});
console.log('=== UI flights ===');
console.log(JSON.stringify(uiFlights, null, 2));

if (capturedBody) {
  const boundary = capturedBody.split('\r\n')[0].replace('--', '');
  const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/', 'content-type': `multipart/form-data; boundary=${boundary}` },
    data: capturedBody,
  });
  const json = JSON.parse(await resp.text());
  const apiFlights = (json.data?.hin ?? []).filter((f) => (f.ab_datum_original ?? '') === '2026-08-15');
  console.log('=== API flights for 15.08.2026 ===');
  for (const f of apiFlights) {
    console.log(JSON.stringify({ flugnr: f.flugnr, ab_zeit: f.ab_zeit, an_zeit: f.an_zeit, ec: f.ec, pec: f.pec, tax: f.tax, stufe_1: f.stufe_1, stufe_2: f.stufe_2, stufe_3: f.stufe_3, preis_b_platz: f.preis_b_platz, ota_preis_diff: f.ota_preis_diff, company: f.company_name }));
  }
}

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-compare.png' });
await browser.close();
