import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const url = 'https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY&FROM=PRN&TO=STR&DATE_FROM=15.08.2026';
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const formInfo = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input, select')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      value: el.value,
      visible: r.width > 0 && r.height > 0,
    };
  });
  return { inputs };
});
console.log('=== FORM ===');
console.log(JSON.stringify(formInfo, null, 2));

const body = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('=== BODY TEXT ===');
console.log(body);

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-form.png' });
await browser.close();
