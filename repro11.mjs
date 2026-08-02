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

const dateInputs = page.locator('input[type="text"]')
  .filter({ hasNot: page.getByPlaceholder('Departure airport') })
  .filter({ hasNot: page.getByPlaceholder('Arrival airport') });
console.log('date count:', await dateInputs.count());

// dump the date field structure
const html = await dateInputs.first().evaluate((el) => {
  const wrap = el.closest('div');
  const p = el.parentElement;
  const up = p ? p.parentElement : null;
  return {
    inputClass: el.className,
    parentClass: p ? p.className : null,
    parentHTML: p ? p.outerHTML.slice(0, 1200) : null,
    upHTML: up ? up.outerHTML.slice(0, 1200) : null,
  };
});
console.log('=== DATE FIELD STRUCTURE ===');
console.log(JSON.stringify(html, null, 2));

// look for calendar/datepicker toggle buttons
const toggles = await page.evaluate(() => {
  return [...document.querySelectorAll('button, [class*="calendar"], [class*="picker"], [class*="toggle"]')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 60), aria: el.getAttribute('aria-label'), title: el.getAttribute('title') }))
    .filter((x) => x.cls || x.aria || x.title)
    .slice(0, 15);
});
console.log('=== BUTTONS/TOGGLES ===');
console.log(JSON.stringify(toggles, null, 2));

await browser.close();
