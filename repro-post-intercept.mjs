import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

const postLog = [];

page.on('request', (req) => {
  if (req.method() !== 'POST') return;
  const entry = {
    method: req.method(),
    url: req.url(),
    headers: req.headers(),
    postData: req.postData(),
    postDataBuffer: req.postDataBuffer()?.toString('utf8'),
  };
  postLog.push(entry);
  console.log(`[POST] ${req.method()} ${req.url()}`);
  if (entry.postData) {
    console.log(`  body: ${entry.postData}`);
  }
  console.log(`  headers: ${JSON.stringify(entry.headers, null, 2)}`);
});

page.on('request', (req) => {
  if (req.url().startsWith('https://flyksa.com') && !req.url().includes('cdn-cgi')) {
    console.log(`[FLYKSA:${req.method()}] ${req.url()}${req.postData() ? `\n  body: ${req.postData()}` : ''}`);
  }
});

page.on('response', (res) => {
  if (res.request().method() !== 'POST') return;
  console.log(`[RESP] ${res.status()} ${res.url()}`);
});

page.on('requestfailed', (req) => {
  if (req.method() !== 'POST') return;
  console.log(`[FAIL] ${req.url()} -> ${req.failure()?.errorText}`);
});

page.on('console', (msg) => {
  const text = msg.text();
  if (/fetch|post|axios|XMLHttpRequest|graphql/i.test(text)) {
    console.log(`[console:${msg.type()}] ${text.slice(0, 500)}`);
  }
});

await page.goto('https://flyksa.com/en', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

await page.click('#oneWay').catch(() => {});

async function pickDestination(code) {
  const inner = page.locator('#outa').locator('..');
  const container = page.locator('.choices').filter({ has: page.locator('#outa') });
  for (let i = 0; i < 5; i++) {
    await inner.click();
    await page.waitForTimeout(400);
    if (await container.evaluate((el) => el.classList.contains('is-open')).catch(() => false)) break;
  }
  await container
    .locator('.choices__list--dropdown .choices__item')
    .filter({ hasText: code })
    .first()
    .click();
  await page.waitForTimeout(600);
}

await pickDestination('STR');
await page.fill('#outdate', '2026-08-15');

await Promise.all([
  page.click('#search-flights'),
  page.waitForNavigation({ waitUntil: 'networkidle', timeout: 45000 }).catch(() => {}),
]);
await page.waitForTimeout(8000);

console.log(`\n=== FINAL URL: ${page.url()} ===`);
const firstParty = postLog.filter((e) => e.url.startsWith('https://flyksa.com'));
console.log(`=== FLYKSA POSTS: ${firstParty.length} ===`);
console.log(JSON.stringify(firstParty, null, 2));
console.log(`\n=== TOTAL POST REQUESTS: ${postLog.length} ===`);

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyksa-post-intercept.png' });
await browser.close();
