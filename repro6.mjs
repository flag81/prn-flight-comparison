import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const from = 'PRN', to = 'STR', date = '2026-08-15', returnDate = '2026-08-22';

const formatDate = (d) => {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
};

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

const tripLabel = page.locator('label', { hasText: /^Round trip$/ });
console.log('trip label count:', await tripLabel.count());
if (await tripLabel.count()) { await tripLabel.first().click().catch(()=>{}); await page.waitForTimeout(500); }

async function pickAirport(placeholder, code) {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await input.type(code, { delay: 120 });
  await page.waitForTimeout(1500);
  const option = page.locator('[class*="option"], li, [role="option"]').filter({ hasText: code }).first();
  await option.click().catch((e) => console.log('opt click failed', e.message));
  await page.waitForTimeout(800);
}

await pickAirport('Departure airport', from);
await pickAirport('Arrival airport', to);

const dateInputs = page.locator('input[type="text"]')
  .filter({ hasNot: page.getByPlaceholder('Departure airport') })
  .filter({ hasNot: page.getByPlaceholder('Arrival airport') });
const dates = [date, returnDate];
const dateCount = await dateInputs.count();
console.log('date input count:', dateCount);
for (let i = 0; i < dates.length && i < dateCount; i++) {
  await dateInputs.nth(i).click();
  for (let j = 0; j < 12; j++) await page.keyboard.press('Backspace');
  await page.keyboard.type(formatDate(dates[i]), { delay: 80 });
  await page.waitForTimeout(500);
}

console.log('dep value:', JSON.stringify(await page.getByPlaceholder('Departure airport').inputValue()));
console.log('arr value:', JSON.stringify(await page.getByPlaceholder('Arrival airport').inputValue()));
const dt = page.locator('input[type="text"]').filter({ hasNot: page.getByPlaceholder('Departure airport') }).filter({ hasNot: page.getByPlaceholder('Arrival airport') });
for (let i = 0; i < (await dt.count()); i++) {
  console.log(`date #${i}:`, JSON.stringify(await dt.nth(i).inputValue()));
}

const btn = page.locator('button:has-text("Find flights")');
console.log('btn disabled?', await btn.isDisabled().catch(() => 'n/a'));
await btn.click().catch((e) => console.log('btn click err', e.message));
await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('nav err', e.message));
await page.waitForTimeout(8000);

console.log('=== URL ===');
console.log(page.url());
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('=== RESULTS TEXT (first 1500) ===');
console.log(bodyText);
await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-rt-results.png' });

await browser.close();
