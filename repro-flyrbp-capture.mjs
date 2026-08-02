import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

let capturedBody = null;
let capturedHeaders = null;

page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('api2.php')) {
    capturedBody = req.postData();
    capturedHeaders = req.headers();
    console.log('=== CAPTURED POST URL ===');
    console.log(req.url());
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

await page.locator('button:has-text("Find flights")').click();
await page.waitForTimeout(4000);

console.log('captured headers:', JSON.stringify(capturedHeaders, null, 2));
console.log('captured body length:', capturedBody?.length);

const ls = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = (localStorage.getItem(k) ?? '').slice(0, 200);
  }
  return out;
});
console.log('=== localStorage ===');
console.log(JSON.stringify(ls, null, 2));

import { writeFileSync } from 'node:fs';
writeFileSync('C:/Users/Flag81/AppData/Local/Temp/opencode/rbp-body.bin', capturedBody ?? '');
console.log('saved captured body to temp');

await browser.close();
