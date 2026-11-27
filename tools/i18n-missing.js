// GL Logistics — translations of parking texts for the GLL drivers assistant app.
// Texts in truck-parking.json (name, where, note, price) and rest-areas.json (n, f, p) are written in Russian;
// i18n/parking-<lang>.json holds {"updated": "...", "t": {"<russian text>": "<translation>"}} for hy, en, de, tr, kk.
// usage:
//   node tools/i18n-missing.js            — how many texts each language is missing
//   node tools/i18n-missing.js hy out.json — write the missing Russian texts for one language as a JSON array
//   node tools/i18n-missing.js --prune     — drop translations of texts no longer in the data
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LANGS = ['hy', 'en', 'de', 'tr', 'kk'];
const cyr = s => typeof s === 'string' && /[А-Яа-яЁё]/.test(s);
function sourceTexts() {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'truck-parking.json'), 'utf8'));
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'rest-areas.json'), 'utf8'));
  const U = new Set();
  t.stops.forEach(s => [s.name, s.where, s.note, s.price].forEach(x => cyr(x) && U.add(x)));
  (r.items || []).forEach(x => [x.n, x.f, x.p].forEach(v => cyr(v) && U.add(v)));
  return [...U];
}
const file = l => path.join(ROOT, 'i18n', 'parking-' + l + '.json');
const load = l => fs.existsSync(file(l)) ? JSON.parse(fs.readFileSync(file(l), 'utf8')) : { updated: '', t: {} };
const src = sourceTexts();
const [, , a, b] = process.argv;
if (a === '--prune') {
  const keep = new Set(src);
  for (const l of LANGS) { const d = load(l); let n = 0; for (const k of Object.keys(d.t)) if (!keep.has(k)) { delete d.t[k]; n++; }
    fs.writeFileSync(file(l), JSON.stringify(d)); console.log(l, 'pruned', n); }
} else if (a && LANGS.includes(a)) {
  const d = load(a); const miss = src.filter(s => !d.t[s]);
  fs.writeFileSync(b || 'missing-' + a + '.json', JSON.stringify(miss, null, 1)); console.log(a, 'missing', miss.length);
} else {
  for (const l of LANGS) { const d = load(l); console.log(l, 'missing', src.filter(s => !d.t[s]).length, 'of', src.length); }
}
