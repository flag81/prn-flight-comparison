// Probe several near-term dates via direct fetch to confirm the API returns real flight data (not just noDataFound).
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

async function fetchFlights(dateStr) {
  const fields = {
    class: 'Buchungen_Buchen_Fluglisten',
    DATUM_HIN: dateStr,
    DATUM_RUK: dateStr,
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
    FLGART: 'ow',
  };
  const body = buildMultipartBody(boundary, fields);
  const resp = await fetch('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,sq;q=0.8',
      'Cache-Control': 'no-cache',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Origin: 'https://flyrbp.com',
      Pragma: 'no-cache',
      Referer: 'https://flyrbp.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
    body,
  });
  const json = await resp.json();
  return { status: resp.status, error: json.data?.error ?? null, hin: json.data?.hin ?? [] };
}

function fmt(d) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const today = new Date('2026-08-01T00:00:00');
for (let offset = 1; offset <= 60; offset += 1) {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  const dateStr = fmt(d);
  const result = await fetchFlights(dateStr);
  console.log(`${dateStr}: status=${result.status} error=${result.error ?? 'none'} hin=${result.hin.length}`);
  if (result.hin.length > 0) {
    console.log('  first hin:', JSON.stringify({ flugnr: result.hin[0].flugnr, ab_zeit: result.hin[0].ab_zeit, an_zeit: result.hin[0].an_zeit, preis_erw: result.hin[0].preis_erw }));
    break;
  }
}
