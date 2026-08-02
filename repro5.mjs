import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

async function dumpInputs(tag) {
  console.log(`=== TEXT INPUTS (${tag}) ===`);
  const allText = page.locator('input[type="text"]');
  const n = await allText.count();
  for (let i = 0; i < n; i++) {
    const el = allText.nth(i);
    const ph = await el.getAttribute('placeholder');
    const val = await el.inputValue();
    console.log(`  #${i} placeholder=${JSON.stringify(ph)} value=${JSON.stringify(val)}`);
  }
}

const radios = await page.evaluate(() => {
  return [...document.querySelectorAll('input[type="radio"]')].map((el) => ({
    name: el.name,
    value: el.value,
    checked: el.checked,
    label: (el.closest('label')?.innerText || '').trim().slice(0, 30),
  }));
});
console.log('=== RADIOS ===');
console.log(JSON.stringify(radios, null, 2));

await dumpInputs('default');

await page.locator('label:has-text("One way")').first().click().catch(()=>{});
await page.waitForTimeout(800);
await dumpInputs('after One way');

const btn = page.locator('button:has-text("Find flights")');
console.log('find-flights count:', await btn.count());

await browser.close();
