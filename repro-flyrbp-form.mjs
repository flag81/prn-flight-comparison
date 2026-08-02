import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }

const dump = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map((el) => {
    const r = el.getBoundingClientRect();
    return { type: el.type, class: String(el.className).slice(0, 60), placeholder: el.placeholder, value: el.value, visible: r.width > 0 && r.height > 0, readonly: el.readOnly };
  });
  const buttons = [...document.querySelectorAll('button')].map((b) => ({ text: (b.innerText || '').trim().slice(0, 30), disabled: b.disabled, cls: String(b.className).slice(0, 40) })).filter((b) => b.text);
  const matInputs = [...document.querySelectorAll('mat-form-field, .mat-mdc-form-field, [class*="datepicker"]')].map((el) => ({ cls: String(el.className).slice(0, 80), html: el.outerHTML.slice(0, 300) }));
  return { inputs: inputs.filter((i) => i.visible), buttons, matInputs: matInputs.slice(0, 5) };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
