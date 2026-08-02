// Test whether the flyrbp API requires a session cookie obtained from visiting the booking page first.
const boundary = '----WebKitFormBoundaryBANDa3D9CqLrNKBx';

const formHiddenOneWay = 'YToyOntpOjA7YToxMDp7czozOiJWT04iO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NDoiTkFDSCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo3OiJSVUtfVk9OIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjg6IlJVS19OQUNIIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkZMR0FSVCI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo5OiJEQVRVTV9ISU4iO2E6MTp7czo1OiJjaGVjayI7YToyOntpOjA7czo3OiJwZmxpY2h0IjtpOjE7czoxNjoiZGF0dW1PaG5lVWhyZWl0Ijt9fXM6OToiREFUVU1fUlVLIjthOjE6e3M6NToiY2hlY2siO2E6MDp7fX1zOjY6IkFOWkVSVyI7YToxOntzOjU6ImNoZWNrIjthOjE6e2k6MDtzOjc6InBmbGljaHQiO319czo2OiJBTlpDSEQiO2E6MTp7czo1OiJjaGVjayI7YToxOntpOjA7czo3OiJwZmxpY2h0Ijt9fXM6NjoiQU5aSU5GIjthOjE6e3M6NToiY2hlY2siO2E6MTp7aTowO3M6NzoicGZsaWNodCI7fX19aToxO2E6MDp7fX0=';

function buildMultipartBody(boundaryStr, data) {
  const parts = [];
  for (const [name, value] of Object.entries(data)) {
    parts.push(`--${boundaryStr}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  parts.push(`--${boundaryStr}--\r\n`);
  return parts.join('');
}

// Step 1: visit the booking page to obtain any session cookies.
const pageResp = await fetch('https://flyrbp.com/en/flights/booking', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  },
});
const setCookies = pageResp.headers.getSetCookie?.() ?? [];
console.log('=== Set-Cookie from booking page ===');
console.log(setCookies);
const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
console.log('cookie header to send:', cookieHeader || '(none)');

async function fetchFlights(flgart) {
  const fields = {
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
    FLGART: flgart,
  };
  const body = buildMultipartBody(boundary, fields);
  const resp = await fetch('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Origin: 'https://flyrbp.com',
      Referer: 'https://flyrbp.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body,
  });
  const json = await resp.json();
  return { status: resp.status, error: json.data?.error ?? null, hin: (json.data?.hin ?? []).length, rueck: (json.data?.rueck ?? []).length };
}

console.log('\n=== with cookie, FLGART=ow ===');
console.log(await fetchFlights('ow'));
console.log('\n=== with cookie, FLGART=rt ===');
console.log(await fetchFlights('rt'));
