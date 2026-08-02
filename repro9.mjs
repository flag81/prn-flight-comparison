import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(12000);

await page.goto('https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

const arr = page.getByPlaceholder('Arrival airport');

async function dumpOpts(label) {
  const opts = await page.evaluate(() => {
    const all = [...document.querySelectorAll('mat-option, [role="option"], [class*="option"]')];
    const vis = all.filter((el) => el.offsetParent !== null);
    return { all: all.length, visible: vis.length, items: vis.map((el) => (el.innerText || '').trim().slice(0, 50)).filter(Boolean).slice(0, 25) };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(opts));
}

await arr.click();
await page.waitForTimeout(3000);
await dumpOpts('after click arrival (no typing)');

await arr.type('ST', { delay: 120 });
await page.waitForTimeout(2000);
await dumpOpts('after typing ST');

await arr.type('U', { delay: 120 });
await page.waitForTimeout(2000);
await dumpOpts('after typing STU');

console.log('arr value:', JSON.stringify(await arr.inputValue()));

await browser.close();
