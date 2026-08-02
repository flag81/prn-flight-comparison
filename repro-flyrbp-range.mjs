import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }

await page.locator('input.mat-start-date').click();
await page.waitForTimeout(1200);

const dump = await page.evaluate(() => {
  const overlays = [...document.querySelectorAll('.cdk-overlay-container .cdk-overlay-pane, .mat-datepicker-content, mat-date-range-input, .mat-calendar')];
  return overlays.map((el) => ({
    cls: String(el.className).slice(0, 80),
    html: el.outerHTML.slice(0, 600),
  }));
});
console.log(JSON.stringify(dump, null, 2).slice(0, 4000));
await browser.close();
