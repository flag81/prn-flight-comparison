import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

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

function boundary(body) { return body.split('\r\n')[0].replace('--', ''); }
async function sendRaw(body) {
  const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/', 'content-type': `multipart/form-data; boundary=${boundary(body)}` },
    data: body,
  });
  const text = await resp.text();
  const json = JSON.parse(text);
  return { status: resp.status(), json };
}

// 1) exact capture (date = today 01.08.2026)
const r1 = await sendRaw(capturedBody);
console.log('1) exact capture hin:', (r1.json.data?.hin ?? []).length, 'err:', r1.json.data?.error ?? 'none');

// 2) exact capture with date replaced properly to future
const mod = capturedBody.replace('name="DATUM_HIN"\r\n\r\n01.08.2026', 'name="DATUM_HIN"\r\n\r\n15.08.2026').replace('name="DATUM_RUK"\r\n\r\n01.08.2026', 'name="DATUM_RUK"\r\n\r\n15.08.2026');
console.log('date replaced?', mod.includes('15.08.2026'));
const r2 = await sendRaw(mod);
console.log('2) exact+future hin:', (r2.json.data?.hin ?? []).length, 'err:', r2.json.data?.error ?? 'none');
if (r2.json.data?.hin?.[0]) console.log('   first:', JSON.stringify(r2.json.data.hin[0]));

await browser.close();
