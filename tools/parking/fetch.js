// GL Logistics — refresh of truck-parking sources for the «ТИР парковки» map layers.
// usage: node tools/parking/fetch.js [de] [osm] [dkv] [travis] [lkw] [countries]   (no args = all)
// OSM_CC=RU,BY node tools/parking/fetch.js osm   — only these countries
// Writes raw source files into tools/parking/cache/. Each source is independent: a failure is logged and the
// previous cache file is kept, so build-rest.js always has something to build from.
// Bosch Secure Truck Parking has no fetcher: its list (data/bosch.txt) is read from the public map page in a browser.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CACHE = path.join(__dirname, 'cache');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = (name, data) => { fs.writeFileSync(path.join(CACHE, name), typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
const UA = { 'User-Agent': 'gl-parking-map/1.0 (gllogistics.org)' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Germany: Autobahn GmbH open data, truck rest areas on every motorway
async function de() {
  const roads = (await fetch('https://verkehr.autobahn.de/o/autobahn/', { headers: UA }).then(r => r.json())).roads;
  const all = {};
  for (const r of roads) {
    try { const j = await fetch('https://verkehr.autobahn.de/o/autobahn/' + encodeURIComponent(r) + '/services/parking_lorry', { headers: UA }).then(x => x.json());
      for (const p of j.parking_lorry || []) all[p.identifier] = { ...p, road: r }; } catch (e) { log('de: road', r, e.message); }
    await sleep(150);
  }
  const list = Object.values(all);
  if (list.length < 1000) throw new Error('only ' + list.length + ' rest areas, keeping old file');
  save('de_lorry.json', list); return list.length;
}

// OpenStreetMap: truck parkings (the «P» on the map) per country, via a public Overpass server
async function osm() {
  const SERVERS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'];
  const out = {};
  const LIST = process.env.OSM_CC ? process.env.OSM_CC.split(',') : ['TR', 'BG', 'RO', 'HU', 'SK', 'CZ', 'PL', 'SI', 'HR', 'IT', 'FR', 'ES', 'RU', 'BY', 'KZ', 'GE', 'AM', 'AZ'];
  // Russia is too big for one query: European part and the Urals in 6 tiles (s,w,n,e), merged by OSM id
  const TILES = { RU: [[41, 27, 50, 45], [50, 27, 56, 45], [56, 27, 62, 45], [41, 45, 50, 62], [50, 45, 56, 62], [56, 45, 62, 62]] };
  const all = [];
  for (const cc of LIST) for (const t of TILES[cc] || [null]) all.push([cc, t]);
  const parts = {};
  for (const [cc, tile] of all) {
    const f = tile ? `(area.a)(${tile.join(',')})` : '(area.a)';
    const q = `[out:json][timeout:250];area["ISO3166-1"="${cc}"][admin_level=2]->.a;(nwr["amenity"="parking"]["hgv"~"^(designated|yes)$"]${f};nwr["amenity"="parking"]["parking"="truck"]${f};nwr["highway"~"^(rest_area|services)$"]["hgv"~"^(designated|yes)$"]${f};);out center tags;`;
    let ok = false;
    for (let t = 0; t < 6 && !ok; t++) {
      const s = SERVERS[t % SERVERS.length];
      try {
        const r = await fetch(s, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(280000) });
        const txt = await r.text();
        if (r.ok && txt.trim().startsWith('{')) { const e = JSON.parse(txt).elements || [];
          if (parts[cc] !== null) (parts[cc] = parts[cc] || []).push(...e); ok = true; break; }
        log('osm', cc, 'HTTP', r.status);
      } catch (e) { log('osm', cc, e.message); }
      await sleep(20000);
    }
    if (!ok) { out[cc] = 'failed (old file kept)'; parts[cc] = null; }
    else if (parts[cc] !== null && all.filter(x => x[0] === cc).pop()[1] === tile) {
      // last tile of this country: save if every tile succeeded
      const e = [...new Map(parts[cc].map(x => [x.type + x.id, x])).values()];
      const oldF = path.join(CACHE, 'osm_' + cc + '.json');
      const old = fs.existsSync(oldF) ? JSON.parse(fs.readFileSync(oldF, 'utf8')).length : 0;
      if (e.length === 0 && old > 0) out[cc] = 'empty answer, old file kept';
      else { save('osm_' + cc + '.json', e); out[cc] = e.length; }
    }
    await sleep(3000);
  }
  return out;
}

// DKV Maps: public map (no login), truck-suitable parking stations; added at the owner's request
async function dkv() {
  const U = 'https://my.dkv-mobility.com/apidnext/web-maps/api/pois/search/station-list/v1';
  const out = []; let total = 1;
  for (let p = 1; p <= total && p <= 40; p++) {
    const body = { page: p, pageSize: 100, location: { latitude: 47, longitude: 15 }, upperLeftLat: 55.2, upperLeftLong: -9.6, lowerRightLat: 35.8, lowerRightLong: 45,
      filters: [{ id: 'parking_station' }], isSuitableForTrucks: true, withNovofleetAcceptance: false };
    const r = await fetch(U, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' on page ' + p);
    const j = await r.json(); total = j.totalPages || total; (j.pois || []).forEach(x => out.push(x));
    await sleep(2000);
  }
  if (out.length < 500) throw new Error('only ' + out.length + ', keeping old file');
  save('dkv.json', out); return out.length;
}

// TRAVIS: the public map page on yourtravis.com embeds all locations; keep those with parking
async function travis() {
  const h = await fetch('https://www.yourtravis.com/map/en/', { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
  const i = h.indexOf('mapData = '); if (i < 0) throw new Error('mapData not found on the page');
  let d = 0, j = i + 10; for (; j < h.length; j++) { if (h[j] === '{') d++; else if (h[j] === '}') { d--; if (d === 0) { j++; break; } } }
  const park = JSON.parse(h.slice(i + 10, j)).locations.filter(l => (l.services || []).includes('parking'));
  if (park.length < 300) throw new Error('only ' + park.length + ', keeping old file');
  save('travis.json', park); return park.length;
}

// LKW WALTER: secure parkings PDF that LKW WALTER publishes for its carriers
async function lkw() {
  const pdf = path.join(CACHE, 'lkw_list.pdf');
  const r = await fetch('https://catalog.walter-group.com/catalog/LKW_WALTER/EN/catalogs/Liste_Parkplaetze/pdf/Liste_Parkplaetze.pdf');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  fs.writeFileSync(pdf, Buffer.from(await r.arrayBuffer()));
  const raw = path.join(CACHE, 'lkw_rows_raw.json');
  execFileSync('python', ['-I', path.join(__dirname, 'lkw_parse.py'), pdf, raw], { stdio: 'inherit' });
  let rows = JSON.parse(fs.readFileSync(raw, 'utf8'));
  // pypdf loses some umlauts (U+FFFD); restore them from pdftotext output when available
  try {
    const txtFile = path.join(CACHE, 'lkw_list.txt');
    execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, txtFile]);
    const txt = fs.readFileSync(txtFile, 'utf8');
    const cells = [...new Set(txt.split(/\r?\n/).flatMap(l => l.split(/\s{2,}/).map(s => s.trim())).filter(Boolean))];
    const words = [...new Set(txt.split(/[\s,;]+/).filter(Boolean))];
    const pat = s => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/�/g, '.') + '$');
    const fix = s => typeof s !== 'string' || !s.includes('�') ? s : (cells.find(c => pat(s).test(c)) || s.split(' ').map(w => w.includes('�') ? (words.find(x => pat(w).test(x)) || w.replace(/�/g, '?')) : w).join(' '));
    rows = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fix(v)])));
  } catch (e) { log('lkw: pdftotext not available, umlauts may be broken:', e.message); }
  if (rows.length < 100) throw new Error('only ' + rows.length + ' rows, keeping old file');
  save('lkw_rows.json', rows); return rows.length;
}

// country borders for locating Bosch points
async function countries() {
  const r = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  save('countries-50m.json', await r.text()); return 'ok';
}

(async () => {
  const steps = { countries, de, osm, dkv, travis, lkw };
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(steps);
  const report = {};
  for (const k of want) {
    if (!steps[k]) { report[k] = 'unknown source'; continue; }
    if (k === 'countries' && fs.existsSync(path.join(CACHE, 'countries-50m.json'))) { report[k] = 'cached'; continue; }
    log('source', k);
    try { report[k] = await steps[k](); } catch (e) { report[k] = 'FAILED: ' + e.message; }
  }
  console.log(JSON.stringify(report, null, 1));
})();
