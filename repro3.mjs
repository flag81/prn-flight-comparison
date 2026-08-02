import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const url = 'https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY&FROM=PRN&TO=STR&DATE_FROM=15.08.2026';
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

// click "One way" label
const oneWay = page.locator('label:has-text("One way")');
console.log('oneway labels:', await oneWay.count());
if (await oneWay.count()) { await oneWay.first().click().catch((e)=>console.log('click err', e.message)); }
await page.waitForTimeout(800);

const dep = page.getByPlaceholder('Departure airport');
console.log('dep count:', await dep.count());
await dep.click();
await dep.type('PRN', { delay: 120 });
await page.waitForTimeout(1800);

const dd = await page.evaluate(() => {
  const items = [...document.querySelectorAll('[class*="option"], [class*="item"], [class*="listbox"], li, [role="option"]')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => el.innerText.trim().slice(0, 140))
    .filter(Boolean)
    .slice(0, 15);
  return items;
});
console.log('=== DROPDOWN ITEMS ===');
console.log(JSON.stringify(dd, null, 2));

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-dropdown.png' });
await browser.close();
