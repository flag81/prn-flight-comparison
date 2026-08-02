import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { FlightSearchResponse, FlightSegment } from '../types/flight';

interface FlyKsaFlightCard {
  departureTime: string;
  arrivalTime: string;
  duration: string;
  flightNumber: string;
  airline: string;
  price: number | null;
}

// Flight cards are server-rendered directly in the results HTML (no separate JSON API),
// so we read them straight from the DOM instead of screenshotting + OCR-ing the page.
async function extractFlyKsaFlights(page: Page, containerId: string, date: string): Promise<FlyKsaFlightCard[]> {
  return page.$$eval(`#${containerId} .swiper-slide[data-date="${date}"] label.flight_info_content`, (labels) =>
    labels.map((label) => {
      const times = Array.from(label.querySelectorAll('.time_content h5')).map((el) => el.textContent?.trim() ?? '');
      const duration = label.querySelector('.direction-names.justify-content-center .small-font')?.textContent?.trim() ?? '';
      const routeRow = label.querySelector('.direction-names.justify-content-between');
      const flightNumber = routeRow?.querySelector('.small-font')?.textContent?.trim() ?? '';
      const airline = label.querySelector('.operated_by b')?.textContent?.trim() ?? '';
      const priceText = label.querySelector('.price_content strong')?.textContent?.trim() ?? '';
      const price = priceText ? Number.parseFloat(priceText.replace(',', '.')) : NaN;
      return {
        departureTime: times[0] ?? '',
        arrivalTime: times[1] ?? '',
        duration,
        flightNumber,
        airline,
        price: Number.isFinite(price) ? price : null,
      };
    })
  );
}

function flightToSegment(f: FlyKsaFlightCard): FlightSegment {
  return {
    departureTime: f.departureTime,
    arrivalTime: f.arrivalTime,
    duration: f.duration,
    flightNumber: f.flightNumber,
    operator: f.airline,
    price: f.price,
  };
}

export async function scrapeFlyKsaWithDevToolsAgent(
  from: string,
  to: string,
  date: string,
  options?: { returnDate?: string }
): Promise<FlightSearchResponse> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    page = await context.newPage();

    await page.goto('https://flyksa.com/en', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const cookies = await context.cookies('https://flyksa.com/en');
    const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
    const xsrfDecoded = decodeURIComponent(xsrf);

    const params = new URLSearchParams({
      drejtim: options?.returnDate ? '2' : '1',
      outd: from,
      outa: to,
      'outd-date': date,
      'outa-date': options?.returnDate ?? '',
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
        'referer': 'https://flyksa.com/en',
      },
      data: params.toString(),
    });

    const searchJson = (await searchResp.json()) as { __ajax?: { redirect?: string } };
    const resultsUrl = searchJson.__ajax?.redirect ?? 'https://flyksa.com/en/search/results';

    await page.goto(resultsUrl, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(7000);

    const outboundFlights = await extractFlyKsaFlights(page, 'outbound-main', date);
    console.log(`[scraper:flyksa] outbound-raw`, JSON.stringify(outboundFlights));

    const outboundPrices = outboundFlights.map((f) => f.price).filter((p): p is number => p != null);
    const outboundPrice = outboundPrices.length > 0 ? Math.min(...outboundPrices) : null;

    const response: FlightSearchResponse = {
      provider: 'FlyKSA',
      outbound: {
        date,
        price: outboundPrice,
        currency: 'EUR',
        isAvailable: outboundFlights.length > 0 && outboundPrice != null,
        flights: outboundFlights.map(flightToSegment),
      },
    };

    if (options?.returnDate) {
      const inboundFlights = await extractFlyKsaFlights(page, 'inbound-main', options.returnDate);
      console.log(`[scraper:flyksa] inbound-raw`, JSON.stringify(inboundFlights));

      const inboundPrices = inboundFlights.map((f) => f.price).filter((p): p is number => p != null);
      const inboundPrice = inboundPrices.length > 0 ? Math.min(...inboundPrices) : null;

      if (inboundFlights.length > 0) {
        response.inbound = {
          date: options.returnDate,
          price: inboundPrice,
          currency: 'EUR',
          isAvailable: inboundPrice != null,
          flights: inboundFlights.map(flightToSegment),
        };
      }
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      provider: 'FlyKSA',
      error: true,
      message,
      outbound: {
        date,
        price: null,
        currency: 'EUR',
        isAvailable: false,
        flights: [],
      },
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
