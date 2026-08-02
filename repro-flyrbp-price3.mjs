import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(25000);

let apiResponse = null;
page.on('response', async (res) => {
  if (res.url().includes('api2.php') && res.request().method() === 'POST') {
    apiResponse = JSON.parse(await res.text());
  }
});

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(() => {}); await page.waitForTimeout(500); }
await page.locator('label', { hasText: /^One way$/ }).first().click().catch(() => {});
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

async function setDateViaCalendar(iso) {
  const [y, m, dd] = iso.split('-');
  const input = page.locator('input.mat-datepicker-input').first();
  await input.click();
  await page.waitForTimeout(800);
  const monthYear = page.locator('.mat-calendar-period-button, .mat-calendar-arrow').first();
  await monthYear.click().catch(() => {});
  await page.waitForTimeout(500);
  const monthOpt = page.locator('.mat-calendar-table-header th .mat-calendar-body-cell-content', { hasText: new RegExp(`^${['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][+m-1]}$`) }).first();
  await monthOpt.click().catch(() => {});
  await page.waitForTimeout(500);
  const dayCell = page.locator('.mat-calendar-body-cell', { hasText: new RegExp(`^${+dd}$`) }).first();
  await dayCell.click();
  await page.waitForTimeout(800);
  console.log('date input value:', JSON.stringify(await input.inputValue()));
}
await setDateViaCalendar('2026-08-15');

await page.locator('button:has-text("Find flights")').click();
await page.waitForTimeout(8000);

const uiFlights = await page.evaluate(() => {
  const results = [];
  const rows = [...document.querySelectorAll('[class*="flight"], [class*="flug"], .flight-item, mat-card, [class*="result"], app-flights, app-flight-list')];
  for (const row of rows) {
    const text = (row.innerText ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 500) continue;
    if (!/\b(8230|8232|8234|8236|8238|IV|GP-)/i.test(text)) continue;
    results.push(text.slice(0, 220));
  }
  return results.slice(0, 12);
});
console.log('=== UI flight texts ===');
console.log(JSON.stringify(uiFlights, null, 2));

if (apiResponse?.data) {
  const d = apiResponse.data;
  console.log('\n=== API hin (15.08) price fields ===');
  for (const f of (d.hin ?? []).filter((x) => x.ab_datum_original === '2026-08-15')) {
    console.log(JSON.stringify({ flugnr: f.flugnr, ab_zeit: f.ab_zeit, ec: f.ec, pec: f.pec, tax: f.tax, stufe_1: f.stufe_1, stufe_2: f.stufe_2, preis_b_platz: f.preis_b_platz, ota_preis_diff: f.ota_preis_diff }));
  }
  console.log('s1_form_werte:', JSON.stringify(d.s1_form_werte)?.slice(0, 400));
}

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-compare2.png' });
await browser.close();
