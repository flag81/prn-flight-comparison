import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(25000);

// 1) Direct API call
let capturedBody = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('api2.php')) capturedBody = req.postData();
});

await page.goto('https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY&FROM=PRN&TO=STR&DATE_FROM=15.08.2026', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
await page.locator('button:has-text("Find flights")').click();
await page.waitForTimeout(5000);

const apiBody = capturedBody;
const boundary = apiBody.split('\r\n')[0].replace('--', '');
const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
  headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/', 'content-type': `multipart/form-data; boundary=${boundary}` },
  data: apiBody,
});
const apiJson = JSON.parse(await resp.text());
const apiFlights = (apiJson.data?.hin ?? []).filter((f) => (f.ab_datum_original ?? f.ab_datum) === '2026-08-15');
console.log('=== API flights for 15.08.2026 ===');
for (const f of apiFlights) {
  console.log(JSON.stringify({ flugnr: f.flugnr, ab_zeit: f.ab_zeit, an_zeit: f.an_zeit, ec: f.ec, pec: f.pec, tax: f.tax, stufe_1: f.stufe_1, stufe_2: f.stufe_2, available: f.available, company: f.company_name }));
}

// 2) Now read the UI displayed prices
await page.waitForTimeout(4000);
const ui = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[class*="flight"], [class*="flug"], app-flight, .flight-item, mat-card')]
    .filter((el) => el.offsetParent !== null && el.innerText && /(IV|GP|flytik)/i.test(el.innerText))
    .slice(0, 8)
    .map((el) => el.innerText.replace(/\s+/g, ' ').slice(0, 250));
  return rows;
});
console.log('\n=== UI flight rows ===');
console.log(JSON.stringify(ui, null, 2));

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-compare.png' });
await browser.close();
