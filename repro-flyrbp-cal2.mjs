import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }
await page.locator('label', { hasText: /^One way$/ }).first().click().catch(() => {});
await page.waitForTimeout(800);

const input = page.locator('input.mat-datepicker-input').first();
await input.click();
await page.waitForTimeout(1200);

const dump = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.mat-calendar-body-cell')];
  return {
    count: cells.length,
    labels: cells.slice(0, 35).map((c) => ({
      aria: c.getAttribute('aria-label'),
      inner: c.innerText,
      hasButton: !!c.querySelector('button'),
      btnAria: c.querySelector('button')?.getAttribute('aria-label'),
    })),
    period: document.querySelector('.mat-calendar-period-button')?.innerText,
  };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
