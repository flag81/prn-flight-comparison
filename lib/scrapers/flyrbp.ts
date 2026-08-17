import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { FlightSearchResponse, FlightSegment } from '../types/flight';

const DEBUG_ENABLED = process.env.DEBUG_SCRAPER !== '0';

type UnknownRecord = Record<string, unknown>;

function formatError(error: unknown): UnknownRecord {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

function debugLog(_scope: string, step: string, details?: unknown): void {
  if (!DEBUG_ENABLED) return;
  const timestamp = new Date().toISOString();
  if (details === undefined) {
    console.log(`[scraper:${_scope}] ${timestamp} ${step}`);
  } else {
    console.log(`[scraper:${_scope}] ${timestamp} ${step}`, details);
  }
}

const API_URL = 'https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights';

// base64(PHP-serialized client-side validation rules) required by the endpoint; a one-character
// typo here ("Uhreit" vs "Uhrzeit") corrupts PHP's unserialize() server-side and makes every
// request silently come back as noDataFound, so keep this in sync with a live-captured value.
const FORM_HIDDEN_SERIALIZED =
  'a:2:{i:0;a:10:{s:3:"VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:4:"NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:7:"RUK_VON";a:1:{s:5:"check";a:0:{}}s:8:"RUK_NACH";a:1:{s:5:"check";a:0:{}}s:6:"FLGART";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:9:"DATUM_HIN";a:1:{s:5:"check";a:2:{i:0;s:7:"pflicht";i:1;s:16:"datumOhneUhrzeit";}}s:9:"DATUM_RUK";a:1:{s:5:"check";a:0:{}}s:6:"ANZERW";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZCHD";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZINF";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}}i:1;a:0:{}}';
const FORM_HIDDEN = Buffer.from(FORM_HIDDEN_SERIALIZED, 'utf8').toString('base64');
const DEFAULT_HOMEPAGE_URL = 'https://flyrbp.com/en/flights/booking';

// The backend blocks datacenter/VPS source IPs at the application layer (returns a plain
// `{"error":"forbidden"}`, not a CDN/WAF challenge), so production needs to egress through a
// non-datacenter proxy. Configure via SCRAPER_PROXY_SERVER (e.g. "http://host:port") and, if the
// proxy requires auth, SCRAPER_PROXY_USERNAME / SCRAPER_PROXY_PASSWORD.
function getProxyConfig(): { server: string; username?: string; password?: string } | undefined {
  const server = process.env.SCRAPER_PROXY_SERVER;
  if (!server) return undefined;
  return {
    server,
    username: process.env.SCRAPER_PROXY_USERNAME,
    password: process.env.SCRAPER_PROXY_PASSWORD,
  };
}

interface FlyRbpFlight {
  flugnr?: string;
  carrier_flugnr?: string;
  ab_zeit?: string;
  an_zeit?: string;
  ab_datum_original?: string;
  von?: string;
  nach?: string;
  company_name?: string;
  preise?: { summe_hs?: number; summe_ns?: number };
}

interface FlyRbpFlightData {
  error?: string;
  hin?: FlyRbpFlight[];
  ruk?: FlyRbpFlight[];
}

function toApiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

// The server only attaches the `preise` pricing object to each flight when the request carries a
// valid session/cookies (established by loading the booking page first). ALSO: the target's bot
// detection distinguishes Playwright's Node-based APIRequestContext from a real browser fetch and
// blocks it with 403 on datacenter/VPS IPs (even though the preceding page.goto succeeds), so the
// request must run inside the page itself via page.evaluate to share the browser's own fingerprint.
async function fetchFlyRbpFlightData(
  from: string,
  to: string,
  flgart: 'ow' | 'rt',
  hinDate: string,
  rukDate: string,
  page: Page,
  scope: string,
  api: { url: string; origin: string; referer: string } = { url: API_URL, origin: 'https://flyrbp.com', referer: 'https://flyrbp.com/' }
): Promise<FlyRbpFlightData> {
  const fields: Record<string, string> = {
    class: 'Buchungen_Buchen_Fluglisten',
    DATUM_HIN: hinDate,
    DATUM_RUK: rukDate,
    VON: from,
    NACH: to,
    RUK_VON: 'undefined',
    RUK_NACH: 'undefined',
    form_hidden: FORM_HIDDEN,
    BOOK: 'V3',
    preis_cc_nur_eur: 'false',
    ANZERW: '1',
    ANZCHD: '0',
    ANZINF: '0',
    FLGART: flgart,
  };

  const result = await page.evaluate(
    async ({ apiUrl, formFields }) => {
      // Referer/Origin are forbidden headers in browser fetch(); the browser sets them
      // itself based on the current page, matching what a real user's request looks like.
      const formData = new FormData();
      for (const [key, value] of Object.entries(formFields)) {
        formData.append(key, value);
      }
      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { Accept: 'application/json, text/plain, */*' },
          body: formData,
          credentials: 'include',
        });
        const text = await resp.text();
        const headers = Object.fromEntries(resp.headers.entries());
        return { status: resp.status, ok: resp.ok, text, headers, currentUrl: window.location.href };
      } catch (err) {
        return {
          status: 0,
          ok: false,
          text: '',
          headers: {} as Record<string, string>,
          currentUrl: window.location.href,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    { apiUrl: api.url, formFields: fields }
  );

  if (!result.ok) {
    debugLog(scope, 'flight-api-blocked', {
      status: result.status,
      headers: result.headers,
      currentUrl: result.currentUrl,
      bodySnippet: result.text.slice(0, 1000),
      error: result.error,
    });
    throw new Error(`Flight API responded with status ${result.status}${result.error ? ` (${result.error})` : ''}`);
  }

  const json = JSON.parse(result.text) as { data?: FlyRbpFlightData };
  return json.data ?? {};
}

function flightToSegment(f: FlyRbpFlight): FlightSegment {
  return {
    departureTime: f.ab_zeit ?? '',
    arrivalTime: f.an_zeit ?? '',
    duration: '',
    flightNumber: f.carrier_flugnr ?? f.flugnr ?? '',
    operator: f.company_name ?? '',
    price: flightPrice(f),
  };
}

function flightPrice(f: FlyRbpFlight): number | null {
  const price = f.preise?.summe_hs;
  return typeof price === 'number' && Number.isFinite(price) ? price : null;
}

function cheapestPrice(flights: FlyRbpFlight[]): number | null {
  const prices = flights.map(flightPrice).filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export async function scrapeWithDevToolsAgent(
  from: string,
  to: string,
  date: string,
  options?: Partial<{ providerName: string; homepageUrl: string; returnDate: string; apiUrl: string; apiOrigin: string; apiReferer: string }>
): Promise<FlightSearchResponse> {
  const providerName = options?.providerName ?? 'FlyRBP';
  const returnDate = options?.returnDate;
  const homepageUrl = options?.homepageUrl ?? DEFAULT_HOMEPAGE_URL;
  const scope = `flyrbp_api_${Date.now()}`;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    debugLog(scope, 'fetch-start', { from, to, date, returnDate });

    const proxy = getProxyConfig();
    debugLog(scope, 'proxy-config', { enabled: Boolean(proxy), server: proxy?.server });
    browser = await chromium.launch({ headless: true, proxy });
    context = await browser.newContext();
    const page = await context.newPage();
    const homepageResponse = await page.goto(homepageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const pageTitle = await page.title();
    const cookies = await context.cookies();
    debugLog(scope, 'session-bootstrapped', {
      homepageUrl,
      homepageStatus: homepageResponse?.status(),
      pageTitle,
      cookieNames: cookies.map((c) => c.name),
    });

    const flgart = returnDate ? 'rt' : 'ow';
    const hinDate = toApiDate(date);
    const rukDate = returnDate ? toApiDate(returnDate) : hinDate;
    const api = options?.apiUrl
      ? { url: options.apiUrl, origin: options.apiOrigin ?? options.apiUrl, referer: options.apiReferer ?? options.apiUrl }
      : undefined;
    const data = await fetchFlyRbpFlightData(from, to, flgart, hinDate, rukDate, page, scope, api);

    debugLog(scope, 'api-response', { error: data.error, hinCount: data.hin?.length ?? 0, rukCount: data.ruk?.length ?? 0 });

    const hinFlights = (data.hin ?? []).filter((f) => f.ab_datum_original === date);
    const outboundPrice = cheapestPrice(hinFlights);

    const response: FlightSearchResponse = {
      provider: providerName,
      outbound: {
        date,
        price: outboundPrice,
        currency: 'EUR',
        isAvailable: hinFlights.length > 0 && outboundPrice != null,
        flights: hinFlights.map(flightToSegment),
      },
    };

    if (returnDate) {
      const rukFlights = (data.ruk ?? []).filter((f) => f.ab_datum_original === returnDate);
      const inboundPrice = cheapestPrice(rukFlights);
      response.inbound = {
        date: returnDate,
        price: inboundPrice,
        currency: 'EUR',
        isAvailable: rukFlights.length > 0 && inboundPrice != null,
        flights: rukFlights.map(flightToSegment),
      };
    }

    debugLog(scope, 'fetch-finish', {
      isAvailable: response.outbound.isAvailable,
      price: response.outbound.price,
      flightsCount: response.outbound.flights.length,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog(scope, 'fetch-failed', formatError(err));
    return {
      provider: providerName,
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
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

// PrishtinaTicket runs the identical white-labeled booking backend as FlyRBP (verified live: same
// api2.php?scope=Booking&action=getFlights contract and form_hidden payload), just on its own host.
export async function scrapePrishtinaTicketWithDevToolsAgent(
  from: string,
  to: string,
  date: string,
  options?: Partial<{ returnDate: string }>
): Promise<FlightSearchResponse> {
  return scrapeWithDevToolsAgent(from, to, date, {
    providerName: 'PrishtinaTicket',
    returnDate: options?.returnDate,
    homepageUrl: 'https://www.prishtinaticket.net/en/flights/booking',
    apiUrl: 'https://sys.prishtinaticket.net/api2.php?scope=Booking&action=getFlights',
    apiOrigin: 'https://www.prishtinaticket.net',
    apiReferer: 'https://www.prishtinaticket.net/',
  });
}
