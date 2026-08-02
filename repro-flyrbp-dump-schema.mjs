const boundary = '----WebKitFormBoundaryBANDa3D9CqLrNKBx';
const formHiddenSerialized = 'a:2:{i:0;a:10:{s:3:"VON";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:4:"NACH";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:7:"RUK_VON";a:1:{s:5:"check";a:0:{}}s:8:"RUK_NACH";a:1:{s:5:"check";a:0:{}}s:6:"FLGART";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:9:"DATUM_HIN";a:1:{s:5:"check";a:2:{i:0;s:7:"pflicht";i:1;s:16:"datumOhneUhrzeit";}}s:9:"DATUM_RUK";a:1:{s:5:"check";a:0:{}}s:6:"ANZERW";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZCHD";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}s:6:"ANZINF";a:1:{s:5:"check";a:1:{i:0;s:7:"pflicht";}}}i:1;a:0:{}}';
const formHidden = Buffer.from(formHiddenSerialized, 'utf8').toString('base64');
const fields = { class: 'Buchungen_Buchen_Fluglisten', DATUM_HIN: '15.08.2026', DATUM_RUK: '15.08.2026', VON: 'PRN', NACH: 'STR', RUK_VON: 'undefined', RUK_NACH: 'undefined', form_hidden: formHidden, BOOK: 'V3', preis_cc_nur_eur: 'false', ANZERW: '1', ANZCHD: '0', ANZINF: '0', FLGART: 'ow' };
function build(b, d) {
  const p = [];
  for (const [k, v] of Object.entries(d)) p.push(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  p.push(`--${b}--\r\n`);
  return p.join('');
}
const body = build(boundary, fields);
const resp = await fetch('https://sys.flyrbp.com/api2.php?scope=Booking&action=getFlights', {
  method: 'POST',
  headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': `multipart/form-data; boundary=${boundary}`, Origin: 'https://flyrbp.com', Referer: 'https://flyrbp.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36' },
  body,
});
const json = await resp.json();
const target = (json.data.hin ?? []).filter((f) => (f.ab_datum_zeit ?? '').startsWith('2026-08-15'));
console.log('count for 08-15:', target.length);
console.log(JSON.stringify(target[0], null, 2));
