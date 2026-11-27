// Builds rest-areas.json for the site from Autobahn GmbH open data (Germany) and OpenStreetMap (other countries).
// usage: node tools/parking/build-rest.js <out rest-areas.json> <curated truck-parking.json>
// Inputs come from tools/parking/cache (filled by fetch.js) and tools/parking/data/bosch.txt.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const CACHE = path.join(DIR, 'cache');
const OUT = process.argv[2];
const MAIN = process.argv[3];

const RU = { TR: 'Турция', BG: 'Болгария', RO: 'Румыния', HU: 'Венгрия', SK: 'Словакия', CZ: 'Чехия', PL: 'Польша', SI: 'Словения', HR: 'Хорватия', IT: 'Италия', FR: 'Франция', ES: 'Испания' };
const dist = (a, b) => { const t = Math.PI / 180, dLat = (b[0] - a[0]) * t, dLon = (b[1] - a[1]) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
// grid index for fast "is there already a stop within N km" checks
const grid = {};
const cell = (a, o) => Math.floor(a * 20) + ':' + Math.floor(o * 20);
const addGrid = (a, o) => { (grid[cell(a, o)] ||= []).push([a, o]); };
const near = (a, o, km) => { const ca = Math.floor(a * 20), co = Math.floor(o * 20);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of grid[(ca + i) + ':' + (co + j)] || []) if (dist(p, [a, o]) < km) return true; return false; };
JSON.parse(fs.readFileSync(MAIN, 'utf8')).stops.forEach(s => addGrid(s.lat, s.lon));

const items = [];
const r5 = x => +(+x).toFixed(5);
let skipped = 0;

const RU_ALL = { ...RU, DE: 'Германия', AT: 'Австрия', BE: 'Бельгия', NL: 'Нидерланды', LU: 'Люксембург', PT: 'Португалия', DK: 'Дания', LT: 'Литва', CH: 'Швейцария', GB: 'Великобритания',
  AZ: 'Азербайджан', BA: 'Босния и Герцеговина', EE: 'Эстония', FI: 'Финляндия', GR: 'Греция', LV: 'Латвия', MA: 'Марокко', ME: 'Черногория', MK: 'Северная Македония', RS: 'Сербия', SE: 'Швеция' };

// ——— LKW WALTER: list of secure parkings for carriers (portal PDF "Security parking areas", downloaded by the owner's request) ———
let safeN = 0;
const SAFE = path.join(CACHE, 'lkw_rows.json');
if (fs.existsSync(SAFE)) for (const x of JSON.parse(fs.readFileSync(SAFE, 'utf8'))) {
  const c = RU_ALL[x['Country code']], a = +x.lat, o = +x.lon;
  if (!c || !isFinite(a) || !isFinite(o)) continue;
  const info = (x['Additional Info'] || '').trim();
  const price = /€|EUR|zł|PLN|лв|Ft|HUF|Kč|lei|RON/i.test(info) ? info : '';
  items.push({ n: x.Name || 'Безопасная стоянка', c, w: c + ', ' + [x['Zip Code'], x.City].filter(Boolean).join(' ') + (x.Street ? ', ' + x.Street : ''), a: r5(a), o: r5(o), s: 0,
    f: 'В списке безопасных стоянок LKW WALTER.' + (info && !price ? ' ' + info + '.' : ''), src: 3, k: 'safe', ...(price ? { p: price } : {}) });
  addGrid(a, o); safeN++;
}
console.log('LKW WALTER', safeN);

// ——— country lookup by coordinates (world-atlas 50m) ———
const ISO_NUM = { '040': 'Австрия', '056': 'Бельгия', '100': 'Болгария', '191': 'Хорватия', '203': 'Чехия', '208': 'Дания', '233': 'Эстония', '246': 'Финляндия', '250': 'Франция', '276': 'Германия',
  '300': 'Греция', '348': 'Венгрия', '380': 'Италия', '428': 'Латвия', '440': 'Литва', '442': 'Люксембург', '528': 'Нидерланды', '616': 'Польша', '620': 'Португалия', '642': 'Румыния',
  '703': 'Словакия', '705': 'Словения', '724': 'Испания', '752': 'Швеция', '756': 'Швейцария', '826': 'Великобритания', '792': 'Турция', '688': 'Сербия' };
const topo = JSON.parse(fs.readFileSync(path.join(CACHE, 'countries-50m.json'), 'utf8'));
const tarcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * topo.transform.scale[0] + topo.transform.translate[0], y * topo.transform.scale[1] + topo.transform.translate[1]]; }); });
const tring = r => { const out = []; r.forEach((i, k) => { const a = i < 0 ? tarcs[~i].slice().reverse() : tarcs[i]; out.push(...(k ? a.slice(1) : a)); }); return out; };
const CPOLY = [];
for (const g of topo.objects.countries.geometries) { const nm = ISO_NUM[g.id]; if (!nm) continue;
  for (const p of (g.type === 'Polygon' ? [g.arcs] : g.arcs)) { const r = tring(p[0]); const xs = r.map(q => q[0]), ys = r.map(q => q[1]);
    CPOLY.push({ nm, r, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }); } }
const inR = (x, y, r) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const countryOf = (a, o) => { for (const c of CPOLY) { if (o < c.bb[0] || o > c.bb[2] || a < c.bb[1] || a > c.bb[3]) continue; if (inR(o, a, c.r)) return c.nm; }
  // on the coast / border: nearest vertex
  let best = null, bd = 1e9; for (const c of CPOLY) { if (o < c.bb[0] - 0.3 || o > c.bb[2] + 0.3 || a < c.bb[1] - 0.3 || a > c.bb[3] + 0.3) continue; for (const [x, y] of c.r) { const d = (x - o) ** 2 + (y - a) ** 2; if (d < bd) { bd = d; best = c.nm; } } } return bd < 0.05 ? best : null; };

// ——— Bosch Secure Truck Parking: list shown on the public map at portal.bosch-secure-truck-parking.com ———
let boschN = 0;
const BOSCH = path.join(DIR, 'data', 'bosch.txt');
if (fs.existsSync(BOSCH)) for (const line of fs.readFileSync(BOSCH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(.*)\|(-?[\d.]+)\|(-?[\d.]+)$/); if (!m) continue;
  const a = +m[2], o = +m[3], c = countryOf(a, o); if (!c) continue;
  if (near(a, o, 0.05)) { skipped++; continue; }
  const depot = /depot parking/i.test(m[1]);
  items.push({ n: m[1].trim(), c, w: c, a: r5(a), o: r5(o), s: 0,
    f: 'Охраняемая стоянка в сети Bosch Secure Truck Parking, место можно забронировать на портале Bosch.' + (depot ? ' Это стоянка при складе или депо.' : ''), src: 5, k: 'bosch' });
  addGrid(a, o); boschN++;
}
console.log('Bosch', boschN);

// ——— TRAVIS: parkings from the public map on yourtravis.com (bookable via TRAVIS) ———
let travisN = 0;
const TRAVIS = path.join(CACHE, 'travis.json');
const TRAVIS_S = { truckwash: 'мойка', repair: 'ремонт', truckcharging: 'зарядка электрогрузовиков', tankcleaning: 'мойка цистерн' };
if (fs.existsSync(TRAVIS)) for (const x of JSON.parse(fs.readFileSync(TRAVIS, 'utf8'))) {
  const c = RU_ALL[x.address && x.address.country], a = +x.location.latitude, o = +x.location.longitude;
  if (!c || !isFinite(a) || !isFinite(o)) continue;
  if (near(a, o, 0.15)) {
    // same place already on the map (often a Bosch or LKW WALTER site) — keep one point, add the TRAVIS booking hint
    const twin = items.find(it => (it.k === 'bosch' || it.k === 'safe') && dist([it.a, it.o], [a, o]) < 0.15);
    if (twin && !/TRAVIS/.test(twin.f)) { twin.f += ' Также можно забронировать через TRAVIS.'; if (x.locationUrl && !twin.u2) twin.u2t = x.locationUrl; }
    skipped++; continue;
  }
  const feats = (x.services || []).map(s => TRAVIS_S[s]).filter(Boolean);
  const ad = x.address || {};
  items.push({ n: x.name, c, w: c + ', ' + [ad.zip, ad.city].filter(Boolean).join(' ') + (ad.address ? ', ' + ad.address : ''), a: r5(a), o: r5(o), s: 0,
    f: 'Стоянка в сети TRAVIS, можно забронировать место в приложении TRAVIS.' + (feats.length ? ' Есть: ' + feats.join(', ') + '.' : ''), src: 4, k: 'travis',
    ...(x.locationUrl ? { u2: x.locationUrl } : {}) });
  addGrid(a, o); travisN++;
}
console.log('TRAVIS', travisN);

// ——— DKV Maps: truck-suitable parkings accepting DKV (taken at the owner's request, under their contract) ———
const DKV_F = { Fuelling: 'заправка', Washing: 'мойка', Repairing: 'ремонт', 'Eat & Drink': 'еда' };
let dkvN = 0;
if (fs.existsSync(path.join(CACHE, 'dkv.json'))) for (const x of JSON.parse(fs.readFileSync(path.join(CACHE, 'dkv.json'), 'utf8'))) {
  const a = +x.latitude, o = +x.longitude, c = RU_ALL[x.country];
  if (!c || !isFinite(a) || !isFinite(o)) continue;
  if (near(a, o, 0.15)) { skipped++; continue; }
  const feats = (x.availableFeatureCategories || []).map(f => DKV_F[f]).filter(Boolean);
  const travis = /TRAVIS/i.test(x.name || '');
  items.push({ n: x.name, c, w: c + ', ' + [x.zipCode, x.city].filter(Boolean).join(' ') + (x.street ? ', ' + x.street : ''), a: r5(a), o: r5(o), s: 0,
    f: 'Принимают карту DKV.' + (travis ? ' Только по предварительной брони (TRAVIS).' : '') + (feats.length ? ' Есть: ' + feats.join(', ') + '.' : ''), src: 2, k: 'dkv' });
  addGrid(a, o); dkvN++;
}
console.log('DKV', dkvN);

// ——— Germany: Autobahn GmbH ———
const FEAT = { 'Toilette vorhanden': 'туалет', 'Dusche vorhanden': 'душ', 'Raststätte/Restaurant': 'ресторан', 'Tankstelle': 'заправка', 'Tankstelle mit Raststätte': 'заправка и ресторан',
  'Motel/Hotel': 'гостиница', 'Frischwasser': 'питьевая вода', 'Telematik-Parken, Parkplatzdetektionssystem': 'табло свободных мест', 'Mautterminal': 'терминал Toll Collect', 'Docstop': 'Docstop (врач для водителей)' };
if (fs.existsSync(path.join(CACHE, 'de_lorry.json'))) for (const p of JSON.parse(fs.readFileSync(path.join(CACHE, 'de_lorry.json'), 'utf8'))) {
  const a = +p.coordinate.lat, o = +p.coordinate.long;
  if (!isFinite(a) || !isFinite(o)) continue;
  if (near(a, o, 0.15)) { skipped++; continue; }
  const m = (p.description || []).join(' ').match(/LKW Stellplätze: (\d+)/);
  const [road, dir] = String(p.title || '').split('|').map(s => s.trim());
  const feats = [...new Set((p.lorryParkingFeatureIcons || []).map(x => FEAT[x.description]).filter(Boolean))];
  items.push({ n: p.subtitle || road, c: 'Германия', w: 'Германия, ' + road + (dir ? ', в сторону ' + dir : ''), a: r5(a), o: r5(o), s: m ? +m[1] : 0,
    f: 'Площадка отдыха на автобане.' + (feats.length ? ' Есть: ' + feats.join(', ') + '.' : ''), src: 0 });
  addGrid(a, o);
}

// ——— other countries: OpenStreetMap ———
const osmCount = {};
for (const cc of Object.keys(RU)) {
  const file = path.join(CACHE, 'osm_' + cc + '.json');
  if (!fs.existsSync(file)) continue;
  for (const e of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const t = e.tags || {}, a = e.lat ?? (e.center && e.center.lat), o = e.lon ?? (e.center && e.center.lon);
    if (a == null || o == null) continue;
    if (['private', 'no'].includes(t.access) || ['private', 'no'].includes(t.hgv)) continue;
    if (near(a, o, 0.15)) { skipped++; continue; }
    const feats = [];
    if (t.supervised === 'yes' || t.surveillance) feats.push('охрана или камеры');
    if (t.toilets === 'yes') feats.push('туалет');
    if (t.shower === 'yes') feats.push('душ');
    if (t.lit === 'yes') feats.push('освещение');
    const name = t.name || t.operator || (t.highway === 'services' ? 'Зона обслуживания' : t.highway === 'rest_area' ? 'Площадка отдыха' : 'Стоянка для грузовиков');
    const place = t['addr:city'] || t['addr:place'] || '';
    const cap = parseInt(t['capacity:hgv'] || (t.parking === 'truck' ? t.capacity : '') || '', 10);
    if (!t.name && !t.operator && !t.highway && isFinite(cap) && cap < 5) continue;   // мелкие безымянные карманы на 1–4 машины — шум
    items.push({ n: name, c: RU[cc], w: RU[cc] + (t.ref ? ', ' + t.ref : '') + (place ? ', ' + place : ''), a: r5(a), o: r5(o), s: isFinite(cap) ? cap : 0,
      f: (feats.length ? 'Есть: ' + feats.join(', ') + '. ' : '') + 'Данные OpenStreetMap, без проверки.', src: 1, u: e.type[0] + e.id,
      ...(t.fee === 'no' ? { fee: 'no' } : t.fee === 'yes' ? { fee: 'yes' } : {}) });
    addGrid(a, o);
    osmCount[cc] = (osmCount[cc] || 0) + 1;
  }
}
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), items }));
console.log('DE', items.filter(x => x.c === 'Германия').length, '| OSM', JSON.stringify(osmCount), '| skipped (near existing)', skipped, '| total', items.length, '|', (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB');
