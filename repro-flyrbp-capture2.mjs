import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(20000);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const usFormat = (d) => { const [y,m,dd] = d.split('-'); return `${MONTHS[+m-1].slice(0,3)} ${+dd}, ${y}`; };

const captures = [];

async function captureSearch({ twoWay }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(20000);

  let body = null;
  pg.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('api2.php')) body = req.postData();
  });

  await pg.goto('https://flyrbp.com/en/flights/booking', { waitUntil: 'networkidle', timeout: 30000 });
  await pg.waitForTimeout(2000);

  const accept = pg.locator('button:has-text("Reject Cookies")');
  if (await accept.count()) { await accept.first().click().catch(() => {}); await pg.waitForTimeout(500); }

  const label = twoWay ? 'Round trip' : 'One way';
  await pg.locator('label', { hasText: new RegExp(`^${label}$`) }).first().click().catch(() => {});
  await pg.waitForTimeout(500);

  async function pickAirport(placeholder, code) {
    const input = pg.getByPlaceholder(placeholder);
    await input.click();
    await pg.waitForTimeout(800);
    await pg.locator('mat-option').filter({ hasText: `(${code})` }).first().click();
    await pg.waitForTimeout(800);
  }
  await pickAirport('Departure airport', 'PRN');
  await pickAirport('Arrival airport', 'STR');

  const dateInputs = pg.locator('input.mat-datepicker-input');
  async function setDate(idx, iso) {
    const el = dateInputs.nth(idx);
    await el.click();
    await pg.keyboard.press('ControlOrMeta+a');
    await pg.keyboard.type(usFormat(iso), { delay: 40 });
    await pg.keyboard.press('Tab');
    await pg.waitForTimeout(600);
  }
  await setDate(0, '2026-08-15');
  if (twoWay) await setDate(1, '2026-08-20');

  await pg.locator('button:has-text("Find flights")').click();
  await pg.waitForTimeout(4000);
  captures.push({ twoWay, body });
  console.log(`=== ${twoWay ? 'ROUND-TRIP' : 'ONE-WAY'} captured length:`, body?.length);
  await ctx.close();
}

await captureSearch({ twoWay: false });
await captureSearch({ twoWay: true });

const fields = (body) => {
  const boundary = body.split('\r\n')[0];
  const parts = body.split(boundary).filter((p) => p.includes('name='));
  const f = {};
  for (const p of parts) {
    const nameMatch = p.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const m = p.match(/\r\n\r\n([\s\S]*?)(?:\r\n)?$/);
    f[nameMatch[1]] = m ? m[1].replace(/\r?\n$/, '') : '';
  }
  return f;
};

console.log('\n\n=== ONE-WAY FIELDS ===');
console.log(JSON.stringify(fields(captures[0].body), null, 2));
console.log('\n=== ROUND-TRIP FIELDS ===');
console.log(JSON.stringify(fields(captures[1].body), null, 2));

await browser.close();
