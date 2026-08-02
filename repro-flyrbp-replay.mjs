import { chromium, request } from 'playwright';
import { readFileSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

let capturedBody = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('api2.php')) {
    capturedBody = req.postData();
  }
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

// Build exact captured body but with a real future date
await page.locator('button:has-text("Find flights")').click();
await page.waitForTimeout(4000);

console.log('captured length:', capturedBody?.length);

// Replay exact body via raw data
const api = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
  headers: {
    accept: 'application/json, text/plain, */*',
    referer: 'https://flyrbp.com/',
    'content-type': 'multipart/form-data; boundary=' + capturedBody.split('\r\n')[0].replace('--', ''),
  },
  data: capturedBody,
});
console.log('=== REPLAY EXACT ===');
console.log('status', api.status());
const t1 = await api.text();
console.log(t1.slice(0, 300));

// Now modify the captured body: change DATUM_HIN to a future date and DATUM_RUK
const modified = capturedBody.replace(/DATUM_HIN\r\n\r\n01\.08\.2026/, 'DATUM_HIN\r\n\r\n15.08.2026').replace(/DATUM_RUK\r\n\r\n01\.08\.2026/, 'DATUM_RUK\r\n\r\n15.08.2026');
const api2 = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
  headers: {
    accept: 'application/json, text/plain, */*',
    referer: 'https://flyrbp.com/',
    'content-type': 'multipart/form-data; boundary=' + modified.split('\r\n')[0].replace('--', ''),
  },
  data: modified,
});
console.log('\n=== REPLAY MODIFIED (future dates) ===');
console.log('status', api2.status());
const t2 = await api2.text();
console.log(t2.slice(0, 500));

await browser.close();
