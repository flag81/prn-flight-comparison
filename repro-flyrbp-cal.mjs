import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }

const input = page.locator('input.mat-datepicker-input').first();
await input.click();
await page.waitForTimeout(1000);

const dump = await page.evaluate(() => {
  const cal = document.querySelector('.mat-datepicker-content');
  if (!cal) return { found: false };
  const out = { found: true, html: cal.outerHTML.slice(0, 1500) };
  return out;
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
