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

function boundary(body) { return body.split('\r\n')[0].replace('--', ''); }
async function sendRaw(body) {
  const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/', 'content-type': `multipart/form-data; boundary=${boundary(body)}` },
    data: body,
  });
  return JSON.parse(await resp.text());
}

const mod = capturedBody.replace('name="DATUM_HIN"\r\n\r\n01.08.2026', 'name="DATUM_HIN"\r\n\r\n15.08.2026').replace('name="DATUM_RUK"\r\n\r\n01.08.2026', 'name="DATUM_RUK"\r\n\r\n20.08.2026');
const json = await sendRaw(mod);
const data = json.data ?? {};
console.log('data keys:', Object.keys(data));
console.log('error:', data.error ?? 'none');
console.log('hin count:', (data.hin ?? []).length, 'rueck count:', (data.rueck ?? []).length);
if (data.hin?.length) {
  console.log('hin sample:', JSON.stringify(data.hin[0]));
  const dates = [...new Set(data.hin.map((f) => f.ab_datum))];
  console.log('hin distinct ab_datum:', dates.slice(0, 10));
}
if (data.rueck?.length) {
  console.log('rueck sample:', JSON.stringify(data.rueck[0]));
  const dates = [...new Set(data.rueck.map((f) => f.ab_datum))];
  console.log('rueck distinct ab_datum:', dates.slice(0, 10));
}
await browser.close();
