import { chromium } from 'playwright';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const from = 'PRN', to = 'STR', date = '2026-08-15';

await page.goto('https://flyrbp.com/en/flights/booking?FLIGHT_TYPE=ONE_WAY', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const accept = page.locator('button:has-text("Reject Cookies")');
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }

// click "One way" label
await page.locator('label:has-text("One way")').first().click().catch(()=>{});
await page.waitForTimeout(500);

async function pickAirport(placeholder, code) {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await input.type(code, { delay: 120 });
  await page.waitForTimeout(1500);
  const option = page.locator('[class*="option"], li, [role="option"]').filter({ hasText: code }).first();
  await option.click().catch(async (e) => { console.log('opt click failed', e.message); });
  await page.waitForTimeout(800);
}

await pickAirport('Departure airport', from);
await pickAirport('Arrival airport', to);

// set departure date - the visible date inputs have placeholders ''; find by value pattern
const dateInputs = page.locator('input[type="text"]').filter({ hasNot: page.getByPlaceholder('Departure airport') });
// Instead, find date inputs: they had ids like ffeu7ud850vq and ffeu7ud850vq1 with value "Jul 31, 2026"
const dateFields = page.locator('input.form__input, input[type="text"]').filter({ hasNot: page.getByPlaceholder('') });
console.log('date-ish inputs:', await dateFields.count());

// Click the first date field and type date
const allText = page.locator('input[type="text"]');
const n = await allText.count();
for (let i = 0; i < n; i++) {
  const el = allText.nth(i);
  const ph = await el.getAttribute('placeholder');
  const val = await el.inputValue();
  console.log(`  textinput#${i} placeholder=${JSON.stringify(ph)} value=${JSON.stringify(val)}`);
}

// fill date using keyboard on the field whose value is today (departing)
const departing = allText.filter({ hasNot: page.getByPlaceholder('Departure airport') }).filter({ hasNot: page.getByPlaceholder('Arrival airport') });
await departing.first().click();
// clear + type date
for (let i = 0; i < 12; i++) { await page.keyboard.press('Backspace'); }
await page.keyboard.type('15.08.2026', { delay: 80 });
await page.waitForTimeout(800);

const btn = page.locator('button:has-text("Find flights")');
console.log('btn disabled?', await btn.isDisabled().catch(() => 'n/a'));
console.log('dep value:', JSON.stringify(await page.getByPlaceholder('Departure airport').inputValue()));
console.log('arr value:', JSON.stringify(await page.getByPlaceholder('Arrival airport').inputValue()));

await btn.click().catch((e) => console.log('btn click err', e.message));
await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('nav err', e.message));
await page.waitForTimeout(8000);

// capture DOM prices
const domPrices = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    const t = (el.innerText || '').trim();
    if (/^\d+([.,]\d{2})?\s*€|\$\s?\d/.test(t) || /€\s?\d/.test(t)) out.push(t);
  }
  return out.slice(0, 20);
});
console.log('=== DOM PRICES ===');
console.log(JSON.stringify(domPrices, null, 2));

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
console.log('=== RESULTS TEXT (first 2000) ===');
console.log(bodyText);

await page.screenshot({ path: 'C:/Users/Flag81/AppData/Local/Temp/opencode/flyrbp-results.png', fullPage: false });

// Run Gemini on a clipped screenshot of results area
const buf = await page.screenshot({ fullPage: true });
const aiStudio = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PROMPT = `The image shows flight search results from a booking website. For each flight card return a JSON array with objects: departure_time, arrival_time, flight_number, airline, price (string euro amount), is_return (boolean). Return ONLY the raw JSON array.`;
const result = await aiStudio.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ inlineData: { mimeType: 'image/png', data: buf.toString('base64') } }, PROMPT],
  config: { responseMimeType: 'application/json', temperature: 0.1 },
});
console.log('=== GEMINI EXTRACTED ===');
console.log(result.text);

await browser.close();
