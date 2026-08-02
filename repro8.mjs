import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(12000);

await page.goto('https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

const dep = page.getByPlaceholder('Departure airport');
const arr = page.getByPlaceholder('Arrival airport');

async function typeAndDump(input, code, label) {
  await input.click();
  await input.type(code, { delay: 120 });
  await page.waitForTimeout(3000);
  const opts = await page.evaluate(() => {
    return [...document.querySelectorAll('mat-option, [role="option"]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => (el.innerText || '').trim().slice(0, 60))
      .filter(Boolean);
  });
  console.log(`--- ${label} options (code=${code}) ---`);
  console.log(JSON.stringify(opts, null, 2));
  return opts;
}

let opts = await typeAndDump(dep, 'PRN', 'departure');
if (opts.length) {
  await page.locator('mat-option').filter({ hasText: 'PRN' }).first().click();
  await page.waitForTimeout(800);
}
console.log('dep after select:', JSON.stringify(await dep.inputValue()), 'ph:', JSON.stringify(await dep.getAttribute('placeholder')));

opts = await typeAndDump(arr, 'STR', 'arrival');
if (opts.length) {
  await page.locator('mat-option').filter({ hasText: 'STR' }).first().click();
  await page.waitForTimeout(800);
}
console.log('arr after select:', JSON.stringify(await arr.inputValue()), 'ph:', JSON.stringify(await arr.getAttribute('placeholder')));

// dump all text inputs now
const allText = page.locator('input[type="text"]');
const n = await allText.count();
for (let i = 0; i < n; i++) {
  const el = allText.nth(i);
  console.log(`  textinput#${i} ph=${JSON.stringify(await el.getAttribute('placeholder'))} value=${JSON.stringify(await el.inputValue())}`);
}

const btn = page.locator('button:has-text("Find flights")');
console.log('find-flights disabled?', await btn.isDisabled().catch(() => 'n/a'));

await browser.close();
