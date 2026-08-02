import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

let apiJson = null;
page.on('response', async (res) => {
  if (res.url().includes('api2.php') && res.request().method() === 'POST') {
    apiJson = JSON.parse(await res.text());
  }
});

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }

await page.locator('label', { hasText: /^One way$/ }).first().click().catch(() => {});
await page.waitForTimeout(800);

async function pickAirport(placeholder, code) {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await page.waitForTimeout(800);
  await page.locator('mat-option').filter({ hasText: `(${code})` }).first().click();
  await page.waitForTimeout(800);
}
await pickAirport('Departure airport', 'PRN');
await pickAirport('Arrival airport', 'STR');

async function setDate(iso) {
  const [y, m, dd] = iso.split('-');
  const input = page.locator('input.mat-datepicker-input').first();
  await input.click();
  await page.waitForTimeout(1000);
  const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1];
  const day = page.locator('.mat-calendar-body-cell[aria-label="' + monthShort + ' ' + (+dd) + ', ' + y + '"]').first();
  await day.click();
  await page.waitForTimeout(800);
  console.log('date input value:', JSON.stringify(await input.inputValue()));
}
await setDate('2026-08-15');

await page.locator('button:has-text("Search")').first().click();
await page.waitForTimeout(10000);

const uiPrices = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const text = (el.innerText ?? '').trim();
    if (!text || text.length > 260) continue;
    const m = text.match(/^\s*(\d{1,2}:\d{2})\s+([\s\S]*?)\s+(\d{1,3}(?:[.,]\d{2})?)\s*€/);
    if (m && el.children.length === 0) {
      out.push({ time: m[1], rest: m[2].replace(/\s+/g, ' ').slice(0, 80), price: m[3] });
    }
  }
  return out.slice(0, 12);
});
console.log('=== UI prices (leaf nodes) ===');
console.log(JSON.stringify(uiPrices, null, 2));

if (apiJson?.data) {
  console.log('\n=== API hin for 15.08 ===');
  for (const f of (apiJson.data.hin ?? []).filter((x) => x.ab_datum_original === '2026-08-15')) {
    console.log(JSON.stringify({ flugnr: f.flugnr, ab_zeit: f.ab_zeit, an_zeit: f.an_zeit, ec: f.ec, pec: f.pec, tax: f.tax, stufe_1: f.stufe_1, stufe_2: f.stufe_2, stufe_3: f.stufe_3, preis_b_platz: f.preis_b_platz, ota_preis_diff: f.ota_preis_diff }));
  }
}

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-prices.png' });
await browser.close();
