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
  await page.locator('mat-option').filter({ hasText: `(${code})` }).first().click();
  await page.waitForTimeout(800);
}
await pickAirport('Departure airport', 'PRN');
await pickAirport('Arrival airport', 'STR');

const dateInput = page.locator('input.mat-datepicker-input');
const btn = page.locator('button:has-text("Find flights")');
const btnDisabled = () => btn.isDisabled().catch(() => 'n/a');

async function resetDate() {
  const clearBtn = page.locator('button[aria-label="Clear"]');
  if (await clearBtn.count()) { await clearBtn.first().click().catch(()=>{}); }
  await page.waitForTimeout(500);
}

// Method A: type US format
await dateInput.first().click();
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type('Aug 15, 2026', { delay: 40 });
await page.keyboard.press('Tab');
await page.waitForTimeout(800);
console.log('A) typed "Aug 15, 2026" value:', JSON.stringify(await dateInput.first().inputValue()), 'btn disabled?', await btnDisabled());

// Method B: calendar
await resetDate();
const openCal = page.locator('button[aria-label="Open calendar"]');
await openCal.first().click();
await page.waitForTimeout(1000);
const calInfo = await page.evaluate(() => {
  const cal = document.querySelector('.mat-calendar');
  if (!cal) return { found: false };
  const months = cal.querySelectorAll('.mat-calendar-period-button');
  const period = months.length ? months[0].innerText : '';
  const arrows = cal.querySelectorAll('button.mat-calendar-previous-button, button.mat-calendar-next-button');
  return { found: true, period, arrows: arrows.length, has15: !!cal.querySelector('.mat-calendar-body-cell[aria-label*="15"]') };
});
console.log('=== CALENDAR ===');
console.log(JSON.stringify(calInfo, null, 2));

// navigate to Aug 2026 if needed and click day 15
const periodBtn = page.locator('.mat-calendar-period-button');
let periodText = await periodBtn.first().innerText().catch(() => '');
console.log('period:', JSON.stringify(periodText));
const targetYear = 2026;
for (let guard = 0; guard < 4; guard++) {
  const head = await page.locator('.mat-calendar-header').first().innerText().catch(() => '');
  const m = head.match(/(\w+) (\d{4})/);
  if (m) {
    const year = parseInt(m[2], 10);
    if (year < targetYear) {
      await page.locator('.mat-calendar-next-button').first().click();
      await page.waitForTimeout(400);
      continue;
    }
    if (year > targetYear) {
      await page.locator('.mat-calendar-previous-button').first().click();
      await page.waitForTimeout(400);
      continue;
    }
  }
  break;
}
// now within the year, adjust month via view or next/prev
const day = page.locator('.mat-calendar-body-cell').filter({ hasText: '15' });
const dayCount = await day.count();
console.log('day cells with 15:', dayCount);
if (dayCount) {
  await day.first().click();
  await page.waitForTimeout(800);
}
console.log('B) calendar value:', JSON.stringify(await dateInput.first().inputValue()), 'btn disabled?', await btnDisabled());

await browser.close();
