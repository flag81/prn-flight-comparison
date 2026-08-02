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

const liveFormHidden = (() => {
  const parts = capturedBody.split('\r\n');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes('name="form_hidden"')) return parts[i + 2];
  }
})();

const hardcoded = 'YToyOntpOjA7YToxMDp7czozOiJWT04iO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NDoiTkFDSCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo3OiJSVUtfVk9OIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjg6IlJVS19OQUNIIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkZMR0FSVCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo5OiJEQVRVTV9ISU4iO2E6MTp7czo1OiJjaGVjayI7YToyOntpOjA7czo3OiJwZmxpY2h0IjtpOjE7czoxNjoiZGF0dW1PaG5lVWhyZWl0Ijt9fXM6OToiREFUVU1fUlVLIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkFOWkVSVyI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo2OiJBTlpDSEQiO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NjoiQU5aSU5GIjthOjE6e3M6NToiY2hlY2siO2E6MTp7aTowO3M6NzoicGZsaWNodCI7fX19aToxO2E6MDp7fX0=';

console.log('live === hardcoded:', liveFormHidden === hardcoded);
console.log('live length:', liveFormHidden?.length, 'hardcoded length:', hardcoded.length);
console.log('live decoded:', Buffer.from(liveFormHidden, 'base64').toString('utf8'));
console.log('\nfull captured body:\n', capturedBody);

await browser.close();
