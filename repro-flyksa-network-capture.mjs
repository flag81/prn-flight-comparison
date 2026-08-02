import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT_DIR = 'C:/Users/Flag81/AppData/Local/Temp/opencode';
mkdirSync(OUT_DIR, { recursive: true });

const from = 'PRN';
const to = 'STR';
const date = '2026-08-15';
const returnDate = '2026-08-20';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(30000);

const responseLog = [];

page.on('response', async (res) => {
  const req = res.request();
  if (!req.url().includes('flyksa.com')) return;
  const contentType = res.headers()['content-type'] ?? '';
  const isInteresting =
    req.resourceType() === 'xhr' ||
    req.resourceType() === 'fetch' ||
    contentType.includes('json') ||
    /search|result|flight|ajax|api/i.test(req.url());
  if (!isInteresting) return;

  const entry = {
    method: req.method(),
    url: req.url(),
    status: res.status(),
    contentType,
    resourceType: req.resourceType(),
  };
  try {
    if (contentType.includes('json')) {
      entry.body = await res.json();
    } else if (contentType.includes('text/html') && req.resourceType() !== 'document') {
      entry.bodyPreview = (await res.text()).slice(0, 2000);
    }
  } catch {
    // response body not readable (redirect/streamed/etc.)
  }
  responseLog.push(entry);
  console.log(`[RESP] ${entry.status} ${entry.method} ${entry.url} (${contentType})`);
});

await page.goto('https://flyksa.com/en', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);

const cookies = await context.cookies('https://flyksa.com/en');
const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
const xsrfDecoded = decodeURIComponent(xsrf);

const params = new URLSearchParams({
  drejtim: '2',
  outd: from,
  outa: to,
  'outd-date': date,
  'outa-date': returnDate,
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
console.log('=== SEARCH POST RESPONSE ===');
console.log(JSON.stringify(searchJson, null, 2));

const resultsUrl = searchJson.__ajax?.redirect ?? 'https://flyksa.com/en/search/results';
console.log(`=== NAVIGATING TO RESULTS: ${resultsUrl} ===`);

await page.goto(resultsUrl, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(8000);

writeFileSync(`${OUT_DIR}/flyksa-results-rt.html`, await page.content());
await page.screenshot({ path: `${OUT_DIR}/flyksa-results-rt-raw.png`, fullPage: true });

console.log(`\n=== JSON/XHR RESPONSES CAPTURED: ${responseLog.length} ===`);
writeFileSync(`${OUT_DIR}/flyksa-response-log.json`, JSON.stringify(responseLog, null, 2));
console.log(`Saved HTML, screenshot, and response log to ${OUT_DIR}`);

await browser.close();
