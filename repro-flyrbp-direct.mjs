import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

const formHiddenOneWay = 'YToyOntpOjA7YToxMDp7czozOiJWT04iO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NDoiTkFDSCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo3OiJSVUtfVk9OIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjg6IlJVS19OQUNIIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkZMR0FSVCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo5OiJEQVRVTV9ISU4iO2E6MTp7czo1OiJjaGVjayI7YToyOntpOjA7czo3OiJwZmxpY2h0IjtpOjE7czoxNjoiZGF0dW1PaG5lVWhyZWl0Ijt9fXM6OToiREFUVU1fUlVLIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkFOWkVSVyI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo2OiJBTlpDSEQiO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NjoiQU5aSU5GIjthOjE6e3M6NToiY2hlY2siO2E6MTp7aTowO3M6NzoicGZsaWNodCI7fX19aToxO2E6MDp7fX0=';

const payload = {
  class: 'Buchungen_Buchen_Fluglisten',
  DATUM_HIN: '15.08.2026',
  DATUM_RUK: '20.08.2026',
  VON: 'PRN',
  NACH: 'STR',
  RUK_VON: 'undefined',
  RUK_NACH: 'undefined',
  form_hidden: formHiddenOneWay,
  BOOK: 'V3',
  preis_cc_nur_eur: 'false',
  ANZERW: '1',
  ANZCHD: '0',
  ANZINF: '0',
  FLGART: 'ow',
};

const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
  headers: {
    accept: 'application/json, text/plain, */*',
    referer: 'https://flyrbp.com/',
  },
  multipart: payload,
});

console.log('=== STATUS', resp.status(), '===');
const ct = resp.headers()['content-type'] ?? '';
console.log('content-type:', ct);
const text = await resp.text();
console.log('length:', text.length);
console.log(text.slice(0, 2000));
await browser.close();
