import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(10000);

await page.goto('https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

async function dumpOptions(label) {
  const opts = await page.evaluate(() => {
    return [...document.querySelectorAll('[class*="option"], [class*="item"], [role="option"], li')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 60), text: (el.innerText || '').trim().slice(0, 60) }))
      .filter((x) => x.text)
      .slice(0, 20);
  });
  console.log(`--- options after ${label} ---`);
  console.log(JSON.stringify(opts, null, 2));
}

async function pickAirport(placeholder, code, label) {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await input.type(code, { delay: 120 });
  await page.waitForTimeout(1500);
  await dumpOptions(`${placeholder}=${code}`);
}

await pickAirport('Departure airport', 'PRN', 'dep');
await dumpOptions('after PRN typed');
const depValue = await page.getByPlaceholder('Departure airport').inputValue();
console.log('dep input value:', JSON.stringify(depValue));

await pickAirport('Arrival airport', 'STR', 'arr');
const arrValue = await page.getByPlaceholder('Arrival airport').inputValue();
console.log('arr input value:', JSON.stringify(arrValue));

await browser.close();
