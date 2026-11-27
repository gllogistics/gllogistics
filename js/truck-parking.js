// GL Logistics — «ТИР парковки»: платные и бесплатные стоянки с ценами на карте OpenStreetMap (данные: /truck-parking.json)
// Режимы: «Все парковки» и «По моему маршруту» — пользователь пишет города, путь строится через OSRM, парковки вдоль него сортируются по км.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND = { price: 'цена известна', none: 'платная, цена не найдена', free: 'бесплатная', rest: 'площадка на трассе (открытые данные)', dkv: 'стоянка, где принимают DKV' };
  // площадки на трассах из открытых данных (/rest-areas.json): Autobahn GmbH (Германия) и OpenStreetMap
  const REST_SRC = [['Autobahn GmbH, открытые данные', 'https://verkehr.autobahn.de/'], ['© участники OpenStreetMap (ODbL)', 'https://www.openstreetmap.org/copyright'], ['DKV Maps', 'https://my.dkv-mobility.com/maps/']];
  const restStop = x => ({ name: x.n, country: x.c, where: x.w, lat: x.a, lon: x.o, kind: x.k || 'rest', spaces: x.s || 0,
    price: x.fee === 'no' ? 'бесплатно' : x.fee === 'yes' ? 'платная (цена неизвестна)' : '', note: x.f || '',
    src: [x.u ? [REST_SRC[x.src][0], 'https://www.openstreetmap.org/' + ({ n: 'node', w: 'way', r: 'relation' }[x.u[0]]) + '/' + x.u.slice(1)] : REST_SRC[x.src]] });
  const ROUTE_KEY = 'gl_tp_route_v1';
  let data = null, map = null, layer = null, markers = [], me = null, meMarker = null;
  let who = { to: 'вам', from: 'вас' };   // от кого считаем расстояние: от вас или от машины
  // ваши машины из Wialon (через сервер GL, как во вкладке «Машины на карте»)
  const W = 'https://gl-api.gltransam.workers.dev';
  let trucks = [], truckLayer = null, truckTimer = null, truckActive = false;
  let route = null, routeLayer = null;   // route: { line: [[lat,lon]], km, names, near: [{d, km}] по индексу стоянки }
  const f = { mode: 'all', country: 'all', kind: 'all', q: '', corridor: 15 };

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((res, rej) => {
      if (!document.querySelector('link[href*="leaflet"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(l); }
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = res; s.onerror = () => rej(new Error('Карта не загрузилась')); document.head.appendChild(s);
    });
  }
  // расстояние по прямой, км
  const dist = (a, b) => { const t = Math.PI / 180, dLat = (b[0] - a[0]) * t, dLon = (b[1] - a[1]) * t;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
  const fmtKm = n => Math.round(n).toLocaleString('ru') + ' км';
  const nav = s => `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Google Maps</a> · <a href="https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes" target="_blank" rel="noopener">Waze</a>`;
  const popup = s => `<div class="tp-pop"><b>${esc(s.name)}</b><div class="tp-sub">${esc(s.where)}</div>
    ${s.kind === 'dkv' ? '<div class="tp-sub">Стоянка из DKV Maps</div>' : ''}${s.kind === 'rest' ? `<div class="tp-sub">Площадка на трассе${s.spaces ? ' · мест для грузовиков: <b>' + s.spaces + '</b>' : ''}</div>` : ''}
    <div class="tp-price ${s.price ? '' : 'none'}">${esc(s.price || (s.kind === 'rest' ? 'Оплата не указана, обычно бесплатно' : s.kind === 'dkv' ? 'Цену смотрите в DKV Maps или на месте' : 'Цена в открытых источниках не найдена'))}</div>
    ${s.note ? `<div>${esc(s.note)}</div>` : ''}
    <div class="tp-sub">Проложить: ${nav(s)}</div>
    <div class="tp-sub">Источник: ${s.src.map(x => `<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])}</a>`).join(' · ')}</div></div>`;

  // ——— свой маршрут: города → координаты (Nominatim) → путь по дорогам (OSRM) ———
  const cache = {};
  async function geocode(q) {
    const k = q.trim().toLowerCase(); if (cache[k]) return cache[k];
    const j = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&q=' + encodeURIComponent(q)).then(r => r.json());
    if (!j.length) throw new Error('не нашёл «' + q + '»');
    return (cache[k] = { ll: [+j[0].lat, +j[0].lon], name: j[0].display_name.split(',')[0] });
  }
  // для каждой стоянки: расстояние до линии маршрута и на каком км от старта она стоит
  function measure(line) {
    const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + dist(line[i - 1], line[i]));
    // грубый отбор: стоянки дальше ~70 км от маршрута сразу отбрасываем (иначе тысячи площадок × десятки тысяч точек пути)
    const step = Math.max(1, Math.floor(line.length / 1500)), coarse = line.filter((_, i) => i % step === 0);
    let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180; line.forEach(([a, o]) => { la0 = Math.min(la0, a); la1 = Math.max(la1, a); lo0 = Math.min(lo0, o); lo1 = Math.max(lo1, o); });
    return data.stops.map(s => {
      if (s.lat < la0 - 0.7 || s.lat > la1 + 0.7 || s.lon < lo0 - 1 || s.lon > lo1 + 1) return { d: Infinity, km: 0 };
      const p = [s.lat, s.lon], kx = 111.32 * Math.cos(s.lat * Math.PI / 180), ky = 110.57;
      let near = Infinity, ni = 0; coarse.forEach((q, k) => { const d = Math.hypot((q[1] - p[1]) * kx, (q[0] - p[0]) * ky); if (d < near) { near = d; ni = k * step; } });
      if (near > 70) return { d: near, km: 0 };
      let best = Infinity, at = 0;
      const from = Math.max(1, ni - step * 3), to = Math.min(line.length, ni + step * 3 + 1);
      for (let i = from; i < to; i++) {
        const a = line[i - 1], b = line[i];
        const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky, bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
        const d = Math.hypot(ax + t * dx, ay + t * dy);
        if (d < best) { best = d; at = cum[i - 1] + t * (cum[i] - cum[i - 1]); }
      }
      return { d: best, km: at };
    });
  }
  // путь по дорогам: сначала Valhalla с профилем грузовика, при сбое — OSRM (легковой)
  const decode6 = s => { let i = 0, lat = 0, lon = 0; const out = [];
    while (i < s.length) { for (let k = 0; k < 2; k++) { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
      const v = (r & 1) ? ~(r >> 1) : (r >> 1); if (k === 0) lat += v; else lon += v; } out.push([lat / 1e6, lon / 1e6]); }
    return out; };
  async function roadRoute(lls) {
    try {
      const j = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: lls.map(([lat, lon]) => ({ lat, lon })), costing: 'truck', units: 'kilometers', directions_type: 'none' }) }).then(r => r.json());
      if (!j.trip) throw new Error(j.error || 'нет пути');
      const line = []; j.trip.legs.forEach((l, k) => { const p = decode6(l.shape); line.push(...(k ? p.slice(1) : p)); });
      return { line, km: j.trip.summary.length, truck: true };
    } catch (e) {
      const j = await fetch('https://router.project-osrm.org/route/v1/driving/' + lls.map(([lat, lon]) => lon + ',' + lat).join(';') + '?overview=full&geometries=geojson').then(r => r.json());
      if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('путь по дорогам не найден');
      return { line: j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]), km: j.routes[0].distance / 1000, truck: false };
    }
  }

  // ——— только через Евросоюз после Турции: страны вне ЕС из /non-eu.json, обход через города ЕС ———
  const HUBS = [['Свиленград', 41.77, 26.20], ['Пловдив', 42.15, 24.75], ['София', 42.70, 23.32], ['Монтана', 43.41, 23.23], ['Видин', 43.99, 22.88], ['Русе', 43.85, 25.97], ['Варна', 43.21, 27.91], ['Кулата', 41.40, 23.36],
    ['Салоники', 40.64, 22.94], ['Александруполис', 40.85, 25.87], ['Игуменица', 39.50, 20.27],
    ['Бухарест', 44.43, 26.10], ['Крайова', 44.32, 23.80], ['Калафат', 43.99, 22.93], ['Дробета-Турну-Северин', 44.63, 22.66], ['Тимишоара', 45.75, 21.23], ['Арад', 46.18, 21.31], ['Орадя', 47.06, 21.93], ['Клуж-Напока', 46.77, 23.59],
    ['Сату-Маре', 47.79, 22.89], ['Сибиу', 45.79, 24.15], ['Брашов', 45.65, 25.60], ['Яссы', 47.16, 27.59], ['Сучава', 47.65, 26.25], ['Бакэу', 46.57, 26.91], ['Галац', 45.44, 28.05], ['Констанца', 44.17, 28.63], ['Питешть', 44.86, 24.87],
    ['Сегед', 46.25, 20.15], ['Будапешт', 47.50, 19.04], ['Дебрецен', 47.53, 21.63], ['Мишкольц', 48.10, 20.78], ['Ньиредьхаза', 47.95, 21.72], ['Дьёр', 47.68, 17.63], ['Печ', 46.07, 18.23],
    ['Кошице', 48.72, 21.26], ['Прешов', 49.00, 21.24], ['Жилина', 49.22, 18.74], ['Братислава', 48.15, 17.11], ['Зволен', 48.58, 19.12],
    ['Жешув', 50.04, 22.00], ['Краков', 50.06, 19.94], ['Катовице', 50.26, 19.02], ['Люблин', 51.25, 22.57], ['Варшава', 52.23, 21.01], ['Белосток', 53.13, 23.16], ['Гданьск', 54.35, 18.65], ['Каунас', 54.90, 23.90],
    ['Острава', 49.83, 18.28], ['Брно', 49.20, 16.61], ['Вена', 48.21, 16.37], ['Грац', 47.07, 15.44], ['Инсбрук', 47.27, 11.40], ['Филлах', 46.61, 13.85],
    ['Любляна', 46.06, 14.51], ['Марибор', 46.55, 15.65], ['Загреб', 45.81, 15.98], ['Славонски-Брод', 45.16, 18.02], ['Осиек', 45.55, 18.69], ['Риека', 45.33, 14.44], ['Сплит', 43.51, 16.44], ['Карловац', 45.49, 15.55],
    ['Триест', 45.65, 13.78], ['Милан', 45.46, 9.19], ['Верона', 45.44, 10.99], ['Больцано', 46.50, 11.35], ['Турин', 45.07, 7.69], ['Бари', 41.12, 16.87], ['Анкона', 43.62, 13.52],
    ['Мюнхен', 48.14, 11.58], ['Штутгарт', 48.78, 9.18], ['Франкфурт-на-Майне', 50.11, 8.68], ['Фрайбург', 47.99, 7.85], ['Линдау', 47.55, 9.68], ['Лион', 45.76, 4.84], ['Мюлуз', 47.75, 7.34], ['Шамбери', 45.56, 5.92], ['Ницца', 43.70, 7.27], ['Страсбург', 48.58, 7.75]];
  let nonEU = null;
  const loadNonEU = async () => nonEU || (nonEU = await fetch('/non-eu.json?v=1').then(r => { if (!r.ok) throw new Error('нет границ стран'); return r.json(); }));
  const inRing = (p, r) => { let ins = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const yi = r[i][0], xi = r[i][1], yj = r[j][0], xj = r[j][1];
      if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) ins = !ins; }
    return ins; };
  const countryAt = p => { for (const c of nonEU) { const b = c.bb; if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue; if (inRing(p, c.r)) return c.c; } return null; };
  const crosses = (a, b) => { const n = Math.max(2, Math.ceil(dist(a, b) / 10));
    for (let i = 1; i < n; i++) { const t = i / n; if (countryAt([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return true; } return false; };
  // кратчайшая цепочка городов ЕС между двумя точками: прямые перегоны до 450 км, не задевающие страны вне ЕС
  function hubPath(a, b) {
    const nodes = [a, ...HUBS.map(h => [h[1], h[2]]), b], N = nodes.length, d = Array(N).fill(Infinity), prev = Array(N).fill(-1), done = Array(N).fill(false), memo = {};
    d[0] = 0;
    for (;;) {
      let u = -1; for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || u === N - 1) break; done[u] = true;
      for (let v = 0; v < N; v++) {
        if (done[v]) continue; const L = dist(nodes[u], nodes[v]); if (L > 450 || d[u] + L >= d[v]) continue;
        const k = Math.min(u, v) + '-' + Math.max(u, v); if (memo[k] === undefined) memo[k] = crosses(nodes[u], nodes[v]);
        if (!memo[k]) { d[v] = d[u] + L; prev[v] = u; }
      }
    }
    if (d[N - 1] === Infinity) return null;
    const path = []; for (let v = prev[N - 1]; v > 0; v = prev[v]) path.unshift(HUBS[v - 1]); return path;
  }
  const nearestIdx = (line, p) => { let bi = 0, bd = Infinity; for (let i = 0; i < line.length; i += 2) { const d = dist(line[i], p); if (d < bd) { bd = d; bi = i; } } return bi; };
  async function routeEU(stops) {
    const wp = stops.map(s => ({ ll: s.ll, name: s.name })), added = [];
    let res = null, bad = null;
    for (let it = 0; it < 5; it++) {
      res = await roadRoute(wp.map(w => w.ll));
      const line = res.line; let i = -1; bad = null;
      for (let k = 0; k < line.length; k += 3) { const c = countryAt(line[k]); if (c) { i = k; bad = c; break; } }
      if (i < 0) break;
      let j = i; while (j + 3 < line.length && countryAt(line[j + 3])) j += 3;
      const path = hubPath(line[Math.max(0, i - 3)], line[Math.min(line.length - 1, j + 3)]);
      const ins = (path || []).filter(h => !wp.some(w => w.name === h[0])).map(h => ({ ll: [h[1], h[2]], name: h[0] }));
      if (!ins.length) break;
      const idx = wp.map(w => nearestIdx(line, w.ll)); let leg = 0; while (leg < wp.length - 2 && idx[leg + 1] <= i) leg++;
      wp.splice(leg + 1, 0, ...ins); added.push(...ins);
    }
    return { res, added, bad };
  }

  async function buildRoute() {
    const names = [...document.querySelectorAll('.tp-pt')].map(i => i.value.trim()).filter(Boolean);
    if (names.length < 2) { $('tpRouteMsg').textContent = 'Напишите хотя бы «Откуда» и «Куда».'; return; }
    $('tpBuild').disabled = true; $('tpRouteMsg').textContent = 'Ищу города…';
    try {
      const pts = [];
      for (const n of names) { pts.push(await geocode(n)); if (names.length > 1) await new Promise(r => setTimeout(r, 1100)); }  // правило Nominatim: не чаще раза в секунду
      $('tpRouteMsg').textContent = 'Строю путь…';
      const euOnly = $('tpEU').checked;
      let res, added = [], bad = null, userOut = null;
      if (euOnly) {
        await loadNonEU();
        userOut = pts.map(p => countryAt(p.ll) && p.name + ' (' + countryAt(p.ll) + ')').filter(Boolean);
      }
      if (euOnly && !userOut.length) ({ res, added, bad } = await routeEU(pts));
      else res = await roadRoute(pts.map(p => p.ll));
      const line = res.line;
      route = { line, km: res.km, names: pts.map(p => p.name), added, near: measure(line) };
      try { localStorage.setItem(ROUTE_KEY, JSON.stringify(names)); } catch (e) {}
      drawRoute();
      let msg = route.names.join(' → ') + ' · ' + fmtKm(route.km) + ' по дорогам' + (res.truck ? ', для грузовика' : '');
      if (euOnly && userOut.length) msg += '. Обход стран вне ЕС выключен: ' + userOut.join(', ') + ' — не в Евросоюзе.';
      else if (euOnly && bad) msg += '. Не удалось обойти страну вне ЕС: ' + bad + '. Добавьте город ЕС по пути вручную.';
      else if (euOnly && added.length) msg += '. Только через ЕС: добавлены ' + added.map(a => a.name).join(', ') + '.';
      else if (euOnly) msg += '. Весь путь после Турции — по ЕС.';
      $('tpRouteMsg').textContent = msg;
      render(true);
    } catch (e) { $('tpRouteMsg').textContent = 'Не получилось: ' + e.message + '. Проверьте названия городов.'; }
    $('tpBuild').disabled = false;
  }
  function drawRoute() {
    if (!map) return;
    if (routeLayer) routeLayer.remove();
    if (!route || f.mode !== 'route') { routeLayer = null; return; }
    routeLayer = L.layerGroup([L.polyline(route.line, { color: '#146C72', weight: 5, opacity: .8 }),
      L.circleMarker(route.line[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#146C72', fillOpacity: 1 }).bindTooltip(route.names[0]),
      L.circleMarker(route.line[route.line.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#14202B', fillOpacity: 1 }).bindTooltip(route.names[route.names.length - 1]),
      ...(route.added || []).map(a => L.circleMarker(a.ll, { radius: 5, color: '#146C72', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip('Через ЕС: ' + a.name))]).addTo(map);
  }
  function ptRow(v, i, n) {
    const label = i === 0 ? 'Откуда' : i === n - 1 ? 'Куда' : 'Через';
    return `<label class="tp-pt-row"><span>${label}</span><input class="tp-pt" type="text" value="${esc(v)}" placeholder="${i === 0 ? 'например, Ереван' : i === n - 1 ? 'например, Варшава' : 'город по пути'}" autocomplete="off">${i > 0 && i < n - 1 ? '<button type="button" class="tp-x" data-del="' + i + '" aria-label="Убрать точку">×</button>' : ''}</label>`;
  }
  function renderPts(vals) { $('tpPts').innerHTML = vals.map((v, i) => ptRow(v, i, vals.length)).join(''); }
  const ptVals = () => [...document.querySelectorAll('.tp-pt')].map(i => i.value);

  // ——— список и карта ———
  function visible() {
    const q = f.q.trim().toLowerCase();
    let list = data.stops.map((s, i) => ({ s, i })).filter(({ s }) =>
      (f.country === 'all' || s.country === f.country) && (f.kind === 'all' || s.kind === f.kind) &&
      (!q || (s.name + ' ' + s.where + ' ' + s.note).toLowerCase().includes(q)));
    if (f.mode === 'route' && route) {
      list = list.filter(r => route.near[r.i].d <= f.corridor);
      list.forEach(r => r.r = route.near[r.i]);
      list.sort((a, b) => a.r.km - b.r.km);
    }
    if (me) { list.forEach(r => r.d = dist(me, [r.s.lat, r.s.lon])); if (!(f.mode === 'route' && route)) list.sort((a, b) => a.d - b.d); }
    return list;
  }

  function render(fit) {
    const list = visible();
    const inRoute = f.mode === 'route' && route;
    $('tpCount').textContent = f.mode === 'route' && !route ? 'Напишите маршрут и нажмите «Построить» — покажу парковки вдоль него.'
      : list.length + (inRoute ? ' вдоль маршрута (до ' + f.corridor + ' км от дороги), по порядку от старта' : ' из ' + data.stops.length + (me ? ' · ближайшие к ' + who.to + ' сверху' : ''));
    const rows = f.mode === 'route' && !route ? [] : list;
    const LIMIT = 300;   // в списке не больше 300 строк, на карте — все
    $('tpList').innerHTML = rows.length ? rows.slice(0, LIMIT).map(({ s, i, d, r }) => `<div class="tp-row" data-i="${i}" tabindex="0">
        <i class="tp-dot ${s.kind}" title="${KIND[s.kind]}"></i>
        <div class="tp-main">${r ? `<span class="tp-km">${fmtKm(r.km)}</span>` : ''}<b>${esc(s.name)}</b><div class="tp-sub">${esc(s.where)}</div>
          ${r || d != null ? `<div class="tp-sub">${r ? (r.d < 1 ? 'у дороги' : '≈ ' + fmtKm(r.d) + ' от дороги') : ''}${r && d != null ? ' · ' : ''}${d != null ? '<b>' + fmtKm(d) + ' от ' + esc(who.from) + '</b>' : ''}</div>` : ''}</div>
        <div class="tp-price ${s.price || s.kind === 'rest' || s.kind === 'dkv' ? '' : 'none'}">${esc(s.price || (s.kind === 'rest' ? (s.spaces ? s.spaces + ' мест для грузовиков' : 'площадка на трассе') : s.kind === 'dkv' ? 'принимают DKV' : 'цена не найдена'))}</div></div>`).join('')
        + (rows.length > LIMIT ? `<div class="tp-empty">Показаны первые ${LIMIT} из ${rows.length}. На карте видны все — уточните страну, тип или поиск.</div>` : '')
      : f.mode === 'route' && !route ? '' : '<div class="tp-empty">Ничего не найдено. ' + (inRoute ? 'Увеличьте расстояние от дороги или сбросьте фильтры.' : 'Сбросьте фильтры или измените поиск.') + '</div>';
    if (!map) return;
    layer.clearLayers();
    rows.forEach(r => layer.addLayer(markers[r.i]));
    if (fit) {
      if (inRoute) map.fitBounds(route.line, { padding: [30, 30] });
      else { const pts = rows.map(r => [r.s.lat, r.s.lon]); if (me) pts.push(me); if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 10 }); }
    }
  }

  function chips() {
    const counts = {}; data.stops.forEach(s => counts[s.country] = (counts[s.country] || 0) + 1);
    const c = [['all', 'Все страны', data.stops.length], ...Object.keys(counts).map(k => [k, k, counts[k]])];
    $('tpCountries').innerHTML = c.map(([v, l, n]) => `<button type="button" class="tp-chip${f.country === v ? ' on' : ''}" data-country="${esc(v)}">${esc(l)} <span>${n}</span></button>`).join('');
    const k = [['all', 'Все'], ['price', 'С ценой'], ['none', 'Без цены'], ['free', 'Бесплатные'], ['rest', 'Площадки на трассах'], ['dkv', 'Стоянки DKV']];
    $('tpKinds').innerHTML = k.map(([v, l]) => `<button type="button" class="tp-chip${f.kind === v ? ' on' : ''}" data-kind="${v}">${v === 'all' ? '' : `<i class="tp-dot ${v}"></i>`}${l}</button>`).join('');
    document.querySelectorAll('.tp-mode').forEach(b => { const on = b.dataset.mode === f.mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $('tpRouteBox').hidden = f.mode !== 'route';
  }

  function focus(i) {
    const s = data.stops[i], m = markers[i];
    if (!map || !m) return;
    if (!layer.hasLayer(m)) layer.addLayer(m);
    map.setView([s.lat, s.lon], 12); m.openPopup();
    $('tpMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function locate() {
    if (!navigator.geolocation) { $('tpCount').textContent = 'Браузер не умеет определять местоположение'; return; }
    $('tpNear').disabled = true; $('tpNear').textContent = 'Определяю…';
    navigator.geolocation.getCurrentPosition(p => {
      me = [p.coords.latitude, p.coords.longitude]; who = { to: 'вам', from: 'вас' };
      document.querySelectorAll('.tp-truck-btn.on').forEach(b => b.classList.remove('on'));
      $('tpNear').disabled = false; $('tpNear').textContent = 'Ближайшие ко мне ✓';
      if (map) { if (meMarker) meMarker.remove(); meMarker = L.circleMarker(me, { radius: 8, color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }).addTo(map).bindPopup('Вы здесь'); }
      render(false);
      const first = visible().slice().sort((a, b) => a.d - b.d).slice(0, 5).map(r => [r.s.lat, r.s.lon]);
      if (map && first.length) map.fitBounds([me, ...first], { padding: [30, 30], maxZoom: 11 });
    }, err => {
      $('tpNear').disabled = false; $('tpNear').textContent = 'Ближайшие ко мне';
      $('tpCount').textContent = err.code === 1 ? 'Нет доступа к местоположению: разрешите его в настройках браузера' : 'Не удалось определить местоположение';
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }

  // ——— ваши машины: координаты из Wialon, обновление раз в минуту, «парковки рядом с машиной» ———
  const ago = ts => { if (!ts) return 'нет данных'; const m = Math.round((Date.now() / 1000 - ts) / 60);
    return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин назад' : Math.floor(m / 1440) + ' дн. назад'; };
  const truckState = u => { const p = u.pos; if (!p) return { cls: 'off', text: 'нет координат' };
    if (Date.now() / 1000 - p.t > 6 * 3600) return { cls: 'off', text: 'нет сигнала ' + ago(p.t).replace(' назад', '') };
    return p.s > 5 ? { cls: 'move', text: 'едет, ' + p.s + ' км/ч' } : { cls: 'stop', text: 'стоит' }; };
  async function loadTrucks() {
    try {
      const r = await fetch(W + '/api/wialon/call', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svc: 'core/search_items', params: { spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' }, force: 1, flags: 1025, from: 0, to: 0 } }) }).then(r => r.json());
      if (r && r.error) throw new Error(typeof r.error === 'string' ? r.error : 'Wialon: ошибка ' + r.error);
      trucks = (r.items || []).map(i => ({ id: i.id, nm: i.nm, pos: i.pos || null }));
      drawTrucks();
    } catch (e) { $('tpTrucks').innerHTML = '<span class="tp-sub">Машины: не удалось получить данные (' + esc(e.message) + ')</span>'; }
  }
  function drawTrucks() {
    const on = (document.querySelector('.tp-truck-btn.on') || {}).dataset;
    $('tpTrucks').innerHTML = trucks.length ? '<span class="tp-sub">Мои машины:</span>' + trucks.map(u => { const st = truckState(u);
      return `<button type="button" class="tp-truck-btn${on && on.truck == u.id ? ' on' : ''}" data-truck="${u.id}"${u.pos ? '' : ' disabled'}><i class="tp-tdot ${st.cls}"></i><b>${esc(u.nm)}</b> <span>${esc(st.text)}</span></button>`; }).join('')
      + '<span class="tp-sub">Нажмите на машину, чтобы увидеть ближайшие парковки</span>'
      : '<span class="tp-sub">Машин в Wialon не найдено</span>';
    if (!map) return;
    truckLayer.clearLayers();
    trucks.forEach(u => { if (!u.pos) return; const st = truckState(u);
      L.marker([u.pos.y, u.pos.x], { zIndexOffset: 1000, icon: L.divIcon({ className: '', html: `<div class="tp-truck ${st.cls}">${esc(u.nm)}</div>`, iconSize: null }) })
        .bindPopup(`<div class="tp-pop"><b>${esc(u.nm)}</b><div>${esc(st.text)}</div><div class="tp-sub">Сигнал: ${ago(u.pos.t)}</div>
          <button type="button" class="tp-btn" data-truck="${u.id}">Парковки рядом</button></div>`).addTo(truckLayer); });
  }
  function nearTruck(id) {
    const u = trucks.find(x => x.id == id); if (!u || !u.pos) return;
    me = [u.pos.y, u.pos.x]; who = { to: u.nm, from: u.nm };
    if (meMarker) { meMarker.remove(); meMarker = null; }
    $('tpNear').textContent = 'Ближайшие ко мне';
    document.querySelectorAll('.tp-truck-btn').forEach(b => b.classList.toggle('on', b.dataset.truck == id));
    if (map) map.closePopup();
    render(false);
    const first = visible().slice().sort((a, b) => a.d - b.d).slice(0, 5).map(r => [r.s.lat, r.s.lon]);
    if (map) map.fitBounds([me, ...first], { padding: [40, 40], maxZoom: 11 });
    $('tpList').scrollTop = 0;
  }
  function startTrucks() {
    truckActive = true; if (!truckLayer) return;
    loadTrucks(); clearInterval(truckTimer);
    truckTimer = setInterval(() => { if (truckActive && !document.hidden) loadTrucks(); }, 60000);
  }

  async function show() {
    try {
      if (!data) {
        const [main, rest] = await Promise.all([
          fetch('/truck-parking.json?v=4').then(r => { if (!r.ok) throw new Error('нет данных'); return r.json(); }),
          fetch('/rest-areas.json?v=2').then(r => r.ok ? r.json() : null).catch(() => null)]);   // без площадок карта всё равно работает
        data = main; data.restCount = 0;
        if (rest && rest.items) { data.stops = data.stops.concat(rest.items.map(restStop)); data.restCount = rest.items.length; }
      }
      await loadLeaflet();
    } catch (e) { $('tpCount').textContent = 'Не удалось загрузить ТИР парковки: ' + e.message; return; }
    if (!map) {
      chips();
      $('tpUpdated').textContent = 'Данные собраны ' + new Date(data.updated).toLocaleDateString('ru') + '. Часть цен взята из отзывов водителей и могла измениться: у каждой цены указана дата.';
      map = L.map('tpMap', { scrollWheelZoom: true }).setView([46, 25], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
      layer = L.layerGroup().addTo(map);
      const canvas = L.canvas({ padding: 0.5 });   // тысячи площадок рисуем на canvas, это быстро
      markers = data.stops.map(s => s.kind === 'rest' || s.kind === 'dkv'
        ? L.circleMarker([s.lat, s.lon], { renderer: canvas, radius: 4, color: '#fff', weight: 1, fillColor: s.kind === 'dkv' ? '#D4561C' : '#4F6D8A', fillOpacity: .9 }).bindPopup(() => popup(s), { maxWidth: 300 })
        : L.marker([s.lat, s.lon], { title: s.name, zIndexOffset: 500, icon: L.divIcon({ className: '', html: `<div class="tp-pin ${s.kind}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9] }) }).bindPopup(popup(s), { maxWidth: 300 }));
      truckLayer = L.layerGroup().addTo(map);
      render(true);
    } else setTimeout(() => map.invalidateSize(), 50);
    startTrucks();
  }

  function init() {
    const mount = $('tpMount'); if (!mount) return;
    mount.innerHTML = `<section id="tpCard" aria-label="ТИР парковки">
      <div class="tp-modes" role="tablist"><button type="button" class="tp-mode on" data-mode="all" role="tab">Все парковки</button><button type="button" class="tp-mode" data-mode="route" role="tab">По моему маршруту</button></div>
      <div id="tpRouteBox" class="tp-route" hidden>
        <div id="tpPts"></div>
        <div class="tp-bar"><button type="button" class="tp-btn ghost" id="tpAddPt">+ Точка по пути</button>
          <label class="tp-check"><input type="checkbox" id="tpEU" checked> После Турции — только через Евросоюз</label>
          <label class="tp-check">Показывать до <select id="tpCorr"><option>5</option><option>10</option><option selected>15</option><option>25</option><option>50</option></select> км от дороги</label>
          <button type="button" class="tp-btn" id="tpBuild">Построить</button></div>
        <div class="tp-sub" id="tpRouteMsg">Напишите города, например: Ереван → Тбилиси → Стамбул → Варшава.</div></div>
      <div class="tp-bar"><div class="tp-chips" id="tpCountries"></div></div>
      <div class="tp-bar"><div class="tp-chips" id="tpKinds"></div>
        <input type="search" id="tpSearch" class="tp-search" placeholder="Поиск: город, трасса, название" aria-label="Поиск ТИР парковки">
        <button type="button" class="tp-btn" id="tpNear">Ближайшие ко мне</button></div>
      <div class="tp-trucks" id="tpTrucks"><span class="tp-sub">Мои машины: загружаю…</span></div>
      <div id="tpMap"></div>
      <div class="tp-sub" id="tpCount">Загружаю ТИР парковки…</div>
      <div class="tp-list" id="tpList"></div>
      <div class="tp-sub" id="tpUpdated"></div>
      <div class="tp-sub">Карта и поиск городов: © участники OpenStreetMap. Площадки на трассах: Autobahn GmbH (открытые данные, Германия) и © участники OpenStreetMap (ODbL). Стоянки DKV: DKV Maps. Путь строится автоматически для грузовика (Valhalla, при сбое — OSRM для легковой), это не замена грузовому навигатору: ограничения по весу и высоте проверяйте отдельно.</div></section>`;
    const st = document.createElement('style');
    st.textContent = `
      #tpCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .tp-modes { display: inline-flex; align-self: flex-start; border: 1px solid #D5DADF; border-radius: 6px; overflow: hidden; }
      .tp-mode { border: 0; background: #fff; padding: 7px 14px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; color: #14202B; }
      .tp-mode + .tp-mode { border-left: 1px solid #D5DADF; } .tp-mode.on { background: #146C72; color: #fff; }
      .tp-route { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #F5F9F9; border: 1px solid #DCEBEC; border-radius: 8px; }
      #tpPts { display: flex; flex-direction: column; gap: 6px; }
      .tp-pt-row { display: grid; grid-template-columns: 64px minmax(0,1fr) 32px; gap: 8px; align-items: center; font-size: 13px; color: #5B6670; }
      .tp-pt { height: 34px; padding: 0 10px; border: 1px solid #D5DADF; border-radius: 6px; font: inherit; font-size: 14px; background: #fff; min-width: 0; }
      .tp-x { width: 32px; height: 32px; border: 1px solid #D5DADF; border-radius: 6px; background: #fff; font-size: 18px; line-height: 1; cursor: pointer; color: #5B6670; }
      .tp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .tp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .tp-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 15px; border: 1px solid #D5DADF; background: #fff; font: inherit; font-size: 13px; cursor: pointer; color: #14202B; }
      .tp-chip span { color: #5B6670; font-variant-numeric: tabular-nums; } .tp-chip.on { background: #146C72; border-color: #146C72; color: #fff; } .tp-chip.on span { color: #D6ECEC; }
      .tp-chip:focus-visible, .tp-btn:focus-visible, .tp-row:focus-visible, .tp-mode:focus-visible { outline: 2px solid #146C72; outline-offset: 2px; }
      .tp-search { flex: 1 1 220px; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid #D5DADF; border-radius: 6px; font: inherit; font-size: 13.5px; }
      .tp-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #146C72; background: #146C72; color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
      .tp-btn.ghost { background: #fff; color: #146C72; } .tp-btn:disabled { opacity: .7; cursor: default; }
      .tp-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5B6670; } .tp-check select { height: 30px; border: 1px solid #D5DADF; border-radius: 6px; font: inherit; }
      #tpMap { height: 520px; border: 1px solid #E4E7EA; border-radius: 8px; }
      .tp-sub { font-size: 12.5px; color: #5B6670; }
      .tp-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .tp-dot.price, .tp-pin.price { background: #C27A00; } .tp-dot.none, .tp-pin.none { background: #8A949C; } .tp-dot.free, .tp-pin.free { background: #1B8A4C; } .tp-dot.rest { background: #4F6D8A; width: 8px; height: 8px; } .tp-dot.dkv { background: #D4561C; width: 8px; height: 8px; }
      .tp-pin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
      .tp-list { border: 1px solid #E4E7EA; border-radius: 8px; max-height: 560px; overflow-y: auto; } .tp-list:empty { display: none; }
      .tp-row { display: grid; grid-template-columns: 12px minmax(0,1fr) minmax(0,240px); gap: 12px; align-items: start; padding: 10px 12px; border-top: 1px solid #EEF0F2; cursor: pointer; }
      .tp-row:first-child { border-top: 0; } .tp-row:hover { background: #F5F9F9; } .tp-row .tp-dot { margin-top: 5px; }
      .tp-main b { font-size: 14px; font-weight: 600; }
      .tp-km { display: inline-block; margin-right: 8px; padding: 1px 7px; border-radius: 4px; background: #E8F2F2; color: #146C72; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .tp-price { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; } .tp-price.none { color: #8A949C; font-weight: 400; font-style: italic; }
      .tp-trucks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
      .tp-truck-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 15px; border: 1px solid #D5DADF; background: #fff; font: inherit; font-size: 13px; cursor: pointer; color: #14202B; }
      .tp-truck-btn span { color: #5B6670; } .tp-truck-btn.on { border-color: #14202B; box-shadow: inset 0 0 0 1px #14202B; } .tp-truck-btn:disabled { opacity: .6; cursor: default; }
      .tp-truck-btn:focus-visible { outline: 2px solid #146C72; outline-offset: 2px; }
      .tp-tdot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; } .tp-tdot.move, .tp-truck.move { background: #1B8A4C; } .tp-tdot.stop, .tp-truck.stop { background: #2B5FB8; } .tp-tdot.off, .tp-truck.off { background: #8A949C; }
      .tp-truck { display: inline-block; transform: translate(-50%, -50%); padding: 3px 9px; border-radius: 12px; font: 600 12px/1.3 system-ui, sans-serif; color: #fff; white-space: nowrap; border: 2px solid #fff; box-shadow: 0 1px 5px rgba(0,0,0,.45); }
      .tp-pop .tp-btn { align-self: flex-start; margin-top: 4px; }
      .tp-empty { padding: 20px; text-align: center; color: #5B6670; }
      .tp-pop { display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.4; } .tp-pop .tp-price { text-align: left; } .tp-pop a, .tp-row a { color: #146C72; }
      @media (max-width: 700px) { #tpCard { padding: 12px; } #tpMap { height: 60vh; } .tp-row { grid-template-columns: 12px minmax(0,1fr); } .tp-row .tp-price { grid-column: 2; text-align: left; } .tp-list { max-height: none; } .tp-pt-row { grid-template-columns: 52px minmax(0,1fr) 32px; } }`;
    document.head.appendChild(st);
    let saved = null; try { saved = JSON.parse(localStorage.getItem(ROUTE_KEY)); } catch (e) {}
    renderPts(Array.isArray(saved) && saved.length >= 2 ? saved : ['', '']);
    mount.addEventListener('click', e => {
      const m = e.target.closest('[data-mode]'); if (m) { f.mode = m.dataset.mode; chips(); drawRoute(); render(true); if (f.mode === 'route' && !route) { const i = document.querySelector('.tp-pt'); if (i && !i.value) i.focus(); } return; }
      const c = e.target.closest('[data-country]'); if (c) { f.country = c.dataset.country; chips(); render(true); return; }
      const k = e.target.closest('[data-kind]'); if (k) { f.kind = k.dataset.kind; chips(); render(true); return; }
      const tr = e.target.closest('[data-truck]'); if (tr) { nearTruck(tr.dataset.truck); return; }
      const x = e.target.closest('[data-del]'); if (x) { const v = ptVals(); v.splice(+x.dataset.del, 1); renderPts(v); return; }
      const r = e.target.closest('.tp-row'); if (r && !e.target.closest('a')) focus(+r.dataset.i);
    });
    $('tpAddPt').addEventListener('click', () => { const v = ptVals(); v.splice(v.length - 1, 0, ''); renderPts(v); document.querySelectorAll('.tp-pt')[v.length - 2].focus(); });
    $('tpPts').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('tp-pt')) { e.preventDefault(); buildRoute(); } });
    $('tpBuild').addEventListener('click', buildRoute);
    $('tpCorr').addEventListener('change', e => { f.corridor = +e.target.value; render(true); });
    $('tpList').addEventListener('keydown', e => { const r = e.target.closest('.tp-row'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); focus(+r.dataset.i); } });
    let t = null; $('tpSearch').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; render(true); }, 200); });
    $('tpNear').addEventListener('click', locate);
    window.addEventListener('gl-tab', e => { if (e.detail === 'tp') show(); else truckActive = false; });
    if (!mount.hidden) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
