import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

await page.locator('label', { hasText: /^One way$/ }).first().click().catch(()=>{});
await page.waitForTimeout(500);

async function pickAirport(placeholder, code) {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await page.waitForTimeout(800);
  const option = page.locator('mat-option').filter({ hasText: `(${code})` });
  const count = await option.count();
  console.log(`${placeholder}: options matching (${code}):`, count);
  await option.first().click();
  await page.waitForTimeout(800);
  console.log(`${placeholder} value:`, JSON.stringify(await input.inputValue()));
}

await pickAirport('Departure airport', 'PRN');
await pickAirport('Arrival airport', 'STR');

// date fill
const dateInputs = page.locator('input[type="text"]')
  .filter({ hasNot: page.getByPlaceholder('Departure airport') })
  .filter({ hasNot: page.getByPlaceholder('Arrival airport') });
console.log('date input count:', await dateInputs.count());

const formatDate = (d) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const date = '2026-08-15';
await dateInputs.first().click();
for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
await page.keyboard.type(formatDate(date), { delay: 80 });
await page.waitForTimeout(500);
console.log('date value:', JSON.stringify(await dateInputs.first().inputValue()));

const btn = page.locator('button:has-text("Find flights")');
console.log('find-flights disabled?', await btn.isDisabled().catch(() => 'n/a'));

await btn.click().catch((e) => console.log('btn click err', e.message));
await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('nav err', e.message));
await page.waitForTimeout(8000);

console.log('=== URL ===');
console.log(page.url());
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1200));
console.log('=== RESULTS TEXT (first 1200) ===');
console.log(bodyText);
await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-ow-ui.png' });

await browser.close();
