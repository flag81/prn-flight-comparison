import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(20000);

await page.goto('https://flyksa.com/en', { waitUntil: 'networkidle', timeout: 30000 });

const cookies = await context.cookies('https://flyksa.com/en');
const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
const xsrfDecoded = decodeURIComponent(xsrf);

const params = new URLSearchParams({
  drejtim: '1',
  outd: 'PRN',
  outa: 'STR',
  'outd-date': '2026-08-15',
  'outa-date': '',
  passager_number: '1',
  children_number: '0',
  infant_number: '0',
  currency: 'EUR',
});

const searchResp = await context.request.post('https://flyksa.com/en', {
  headers: {
    'x-ajax-handler': 'onSearch',
    'x-ajax-partials': 'flash-messages',
    'x-xsrf-token': xsrfDecoded,
    'x-requested-with': 'XMLHttpRequest',
    'content-type': 'application/x-www-form-urlencoded',
    referer: 'https://flyksa.com/en',
  },
  data: params.toString(),
});
const searchJson = await searchResp.json();
const resultsUrl = searchJson.__ajax?.redirect ?? 'https://flyksa.com/en/search/results';

await page.goto(resultsUrl, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForSelector('#outbound-main .flight_info_content', { timeout: 7000 }).catch(() => {});

const html = await page.$eval('#outbound-main', (el) => el.outerHTML).catch((e) => `ERR: ${e.message}`);
writeFileSync('flyksa-outbound.html', html);
console.log('length:', html.length);

const bodyText = await page.evaluate(() => document.body.innerText);
console.log(bodyText.slice(0, 1500));

await browser.close();
