import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const usFormat = (d) => { const [y,m,dd] = d.split('-'); return `${MONTHS[+m-1].slice(0,3)} ${+dd}, ${y}`; };

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
  await page.locator('mat-option').filter({ hasText: `(${code})` }).first().click();
  await page.waitForTimeout(800);
}
await pickAirport('Departure airport', 'PRN');
await pickAirport('Arrival airport', 'STR');

const dateInputs = page.locator('input.mat-datepicker-input');
const btn = page.locator('button:has-text("Find flights")');

async function setDate(idx, iso) {
  const el = dateInputs.nth(idx);
  await el.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(usFormat(iso), { delay: 40 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
  console.log(`date#${idx} value:`, JSON.stringify(await el.inputValue()));
}

await setDate(0, '2026-08-15');
console.log('btn disabled after date?', await btn.isDisabled().catch(() => 'n/a'));

// confirm selected date via calendar
await page.locator('button[aria-label="Open calendar"]').first().click();
await page.waitForTimeout(800);
const selected = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.mat-calendar-body-cell[aria-pressed="true"]')];
  return cells.map((c) => c.getAttribute('aria-label'));
});
console.log('=== SELECTED DATE (calendar) ===');
console.log(JSON.stringify(selected));
await page.keyboard.press('Escape');

console.log('btn disabled?', await btn.isDisabled().catch(() => 'n/a'));
await btn.click();
await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('nav err', e.message));
await page.waitForTimeout(8000);

console.log('=== URL ===');
console.log(page.url());
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('=== RESULTS TEXT (first 1500) ===');
console.log(bodyText);
await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-ow-ui2.png' });

await browser.close();
