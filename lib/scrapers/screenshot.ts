import type { Page } from 'playwright';

const RESULT_SELECTORS = [
  '[class*="flight-result"]',
  '[class*="flight_card"]',
  '[class*="flightCard"]',
  '[class*="flight-list"]',
  '[class*="flightList"]',
  '[class*="result-list"]',
  '[class*="resultList"]',
  '[class*="search-result"]',
  '[class*="searchResult"]',
  '[class*="itinerary-list"]',
  '[class*="itineraryList"]',
  '[class*="offer-list"]',
  '[class*="offerList"]',
  '[class*="ticket-list"]',
  '[class*="ticketList"]',
  '#flights',
  '#flight-results',
  '#search-results',
  '#results',
  '[role="list"][aria-label*="flight" i]',
  '[role="list"][aria-label*="result" i]',
  '[data-testid*="flight" i]',
  '[data-testid*="result" i]',
];

const DEBUG_ENABLED = process.env.DEBUG_SCRAPER !== '0';

function debugLog(step: string, details?: unknown): void {
  if (!DEBUG_ENABLED) return;
  if (details === undefined) {
    console.log(`[screenshot-helper] ${step}`);
  } else {
    console.log(`[screenshot-helper] ${step}`, details);
  }
}

async function tryElementScreenshot(page: Page, selector: string): Promise<Buffer | null> {
  try {
    const el = await page.$(selector);
    if (!el) return null;
    const box = await el.boundingBox();
    if (!box || box.width < 200 || box.height < 80) return null;
    const buf = await el.screenshot();
    debugLog('selector-hit', { selector, box });
    return buf;
  } catch {
    return null;
  }
}

async function getResultsBoundingBox(page: Page): Promise<{ top: number; bottom: number } | null> {
  return await page.evaluate(() => {
    const flightCards: Element[] = [];

    for (const el of document.querySelectorAll(
      'div, li, article, section, tr'
    )) {
      const text = el.textContent || '';
      const hasTime = /\d{2}:\d{2}/.test(text);
      const hasPrice = /[€]/.test(text) || /\d+[.,]\d{2}/.test(text);
      if (!hasTime || !hasPrice) continue;

      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 20) continue;
      if (r.width > window.innerWidth * 0.95) continue; // skip full-width wrappers

      flightCards.push(el);
    }

    if (flightCards.length < 2) return null;

    let minTop = Infinity;
    let maxBottom = 0;
    for (const card of flightCards) {
      const r = card.getBoundingClientRect();
      const y = r.top + window.scrollY;
      const b = r.bottom + window.scrollY;
      if (y < minTop) minTop = y;
      if (b > maxBottom) maxBottom = b;
    }

    const pad = 40;
    return {
      top: Math.max(0, minTop - pad),
      bottom: maxBottom + pad,
    };
  });
}

export async function screenshotResults(page: Page): Promise<Buffer> {
  debugLog('trying-selectors', { count: RESULT_SELECTORS.length });

  for (const sel of RESULT_SELECTORS) {
    const buf = await tryElementScreenshot(page, sel);
    if (buf) return buf;
  }

  debugLog('selectors-failed', 'trying content-based bounding box');

  const box = await getResultsBoundingBox(page);
  if (box) {
    const height = box.bottom - box.top;
    if (height > 80) {
      debugLog('content-box', { top: box.top, height });

      const viewportHeight = Math.ceil(Math.min(height, 5000));
      await page.setViewportSize({ width: 1440, height: viewportHeight });
      await page.evaluate((y) => window.scrollTo(0, y), box.top);
      await page.waitForTimeout(300);

      const buf = await page.screenshot();
      debugLog('content-screenshot', { size: buf.length });
      return buf;
    }
  }

  debugLog('using-fullpage-fallback');
  return await page.screenshot({ fullPage: true });
}
