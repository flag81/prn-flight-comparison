// Direct API call to sys.flyrbp.com/api2.php replicating captured browser headers, no Playwright/browser involved.
const boundary = '----WebKitFormBoundaryBANDa3D9CqLrNKBx';

// Corrected form_hidden: base64(PHP-serialized validation rules), fixes a prior transcription typo (Uhreit -> Uhrzeit)
// that corrupted the serialized array and caused the server to silently return noDataFound.
const formHiddenSerialized = 'a:2:{i:0;a:10:{s:3:"VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:4:"NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:7:"RUK_VON";a:1:{s:5:"check";a:0:{}}s:8:"RUK_NACH";a:1:{s:5:"check";a:0:{}}s:6:"FLGART";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:9:"DATUM_HIN";a:1:{s:5:"check";a:2:{i:0;s:7:"pflicht";i:1;s:16:"datumOhneUhrzeit";}}s:9:"DATUM_RUK";a:1:{s:5:"check";a:0:{}}s:6:"ANZERW";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZCHD";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZINF";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}}i:1;a:0:{}}';
const formHiddenOneWay = Buffer.from(formHiddenSerialized, 'utf8').toString('base64');

const fields = {
  class: 'Buchungen_Buchen_Fluglisten',
  DATUM_HIN: '15.08.2026',
  DATUM_RUK: '15.08.2026',
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

function buildMultipartBody(boundaryStr, data) {
  const parts = [];
  for (const [name, value] of Object.entries(data)) {
    parts.push(`--${boundaryStr}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  parts.push(`--${boundaryStr}--\r\n`);
  return parts.join('');
}

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

console.log('=== STATUS', resp.status, '===');
console.log('content-type:', resp.headers.get('content-type'));
const text = await resp.text();
console.log('length:', text.length);

try {
  const json = JSON.parse(text);
  const hin = json.data?.hin ?? [];
  console.log('hin count:', hin.length, 'error:', json.data?.error ?? 'none');
  if (hin[0]) {
    console.log('first hin:', JSON.stringify({ von: hin[0].von, nach: hin[0].nach, flugnr: hin[0].flugnr, ab_datum_zeit: hin[0].ab_datum_zeit, preis_erw: hin[0].preis_erw }));
  }
} catch {
  console.log(text.slice(0, 2000));
}
