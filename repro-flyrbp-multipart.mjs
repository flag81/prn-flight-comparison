import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

const formHiddenOneWay = 'YToyOntpOjA7YToxMDp7czozOiJWT04iO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NDoiTkFDSCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo3OiJSVUtfVk9OIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjg6IlJVS19OQUNIIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkZMR0FSVCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo5OiJEQVRVTV9ISU4iO2E6MTp7czo1OiJjaGVjayI7YToyOntpOjA7czo3OiJwZmxpY2h0IjtpOjE7czoxNjoiZGF0dW1PaG5lVWhyZWl0Ijt9fXM6OToiREFUVU1fUlVLIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkFOWkVSVyI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo2OiJBTlpDSEQiO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NjoiQU5aSU5GIjthOjE6e3M6NToiY2hlY2siO2E6MTp7aTowO3M6NzoicGZsaWNodCI7fX19aToxO2E6MDp7fX0=';

function makeRoundTripFormHidden() {
  const s = 'a:2:{i:0;a:10:{s:3:"VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:4:"NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:7:"RUK_VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:8:"RUK_NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"FLGART";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:9:"DATUM_HIN";a:1:{s:5:"check";a:2:{i:0;s:7:"pflicht";i:1;s:16:"datumOhneUhreit";}}s:9:"DATUM_RUK";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZERW";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZCHD";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZINF";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}}i:1;a:0:{}}';
  return Buffer.from(s, 'utf8').toString('base64');
}

async function doSearch(params) {
  const resp = await context.request.post('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    headers: { accept: 'application/json, text/plain, */*', referer: 'https://flyrbp.com/' },
    multipart: {
      class: 'Buchungen_Buchen_Fluglisten',
      DATUM_HIN: params.hin,
      DATUM_RUK: params.ruk,
      VON: params.von,
      NACH: params.nach,
      RUK_VON: 'undefined',
      RUK_NACH: 'undefined',
      form_hidden: params.formHidden,
      BOOK: 'V3',
      preis_cc_nur_eur: 'false',
      ANZERW: '1',
      ANZCHD: '0',
      ANZINF: '0',
      FLGART: params.flgart,
    },
  });
  const text = await resp.text();
  const json = JSON.parse(text);
  const data = json.data ?? {};
  const hinCount = (data.hin ?? []).length;
  const rueckCount = (data.rueck ?? []).length;
  console.log(`status=${resp.status()} hin=${hinCount} rueck=${rueckCount} error=${data.error ?? 'none'}`);
  if (data.hin?.[0]) console.log('  first hin:', JSON.stringify({ von: data.hin[0].von, nach: data.hin[0].nach, flugnr: data.hin[0].flugnr, ab_datum_zeit: data.hin[0].ab_datum_zeit, preis_erw: data.hin[0].preis_erw }));
  return json;
}

console.log('--- ONE-WAY via multipart (future date) ---');
await doSearch({ hin: '15.08.2026', ruk: '15.08.2026', von: 'PRN', nach: 'STR', flgart: 'ow', formHidden: formHiddenOneWay });

console.log('--- ROUND-TRIP via multipart (constructed form_hidden) ---');
const rt = await doSearch({ hin: '15.08.2026', ruk: '20.08.2026', von: 'PRN', nach: 'STR', flgart: 'rt', formHidden: makeRoundTripFormHidden() });

await browser.close();
