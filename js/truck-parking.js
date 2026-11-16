// GL Logistics — «ТИР парковки»: платные и бесплатные стоянки с ценами на карте OpenStreetMap (данные: /truck-parking.json)
// Режимы: «Все парковки» и «По моему маршруту» — пользователь пишет города, путь строится через OSRM, парковки вдоль него сортируются по км.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND = { price: 'цена известна', none: 'платная, цена не найдена', free: 'бесплатная' };
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
    <div class="tp-price ${s.price ? '' : 'none'}">${esc(s.price || 'Цена в открытых источниках не найдена')}</div>
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
    return data.stops.map(s => {
      const p = [s.lat, s.lon], kx = 111.32 * Math.cos(s.lat * Math.PI / 180), ky = 110.57;
      let best = Infinity, at = 0;
      for (let i = 1; i < line.length; i++) {
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
  async function buildRoute() {
    const names = [...document.querySelectorAll('.tp-pt')].map(i => i.value.trim()).filter(Boolean);
    if (names.length < 2) { $('tpRouteMsg').textContent = 'Напишите хотя бы «Откуда» и «Куда».'; return; }
    $('tpBuild').disabled = true; $('tpRouteMsg').textContent = 'Ищу города…';
    try {
      const pts = [];
      for (const n of names) { pts.push(await geocode(n)); if (names.length > 1) await new Promise(r => setTimeout(r, 1100)); }  // правило Nominatim: не чаще раза в секунду
      $('tpRouteMsg').textContent = 'Строю путь…';
      const coords = pts.map(p => p.ll[1] + ',' + p.ll[0]).join(';');
      const j = await fetch('https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&geometries=geojson').then(r => r.json());
      if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('путь по дорогам не найден');
      const line = j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      route = { line, km: j.routes[0].distance / 1000, names: pts.map(p => p.name), near: measure(line) };
      try { localStorage.setItem(ROUTE_KEY, JSON.stringify(names)); } catch (e) {}
      drawRoute();
      $('tpRouteMsg').textContent = route.names.join(' → ') + ' · ' + fmtKm(route.km) + ' по дорогам';
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
      L.circleMarker(route.line[route.line.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#14202B', fillOpacity: 1 }).bindTooltip(route.names[route.names.length - 1])]).addTo(map);
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
    $('tpList').innerHTML = rows.length ? rows.map(({ s, i, d, r }) => `<div class="tp-row" data-i="${i}" tabindex="0">
        <i class="tp-dot ${s.kind}" title="${KIND[s.kind]}"></i>
        <div class="tp-main">${r ? `<span class="tp-km">${fmtKm(r.km)}</span>` : ''}<b>${esc(s.name)}</b><div class="tp-sub">${esc(s.where)}</div>
          ${r || d != null ? `<div class="tp-sub">${r ? (r.d < 1 ? 'у дороги' : '≈ ' + fmtKm(r.d) + ' от дороги') : ''}${r && d != null ? ' · ' : ''}${d != null ? '<b>' + fmtKm(d) + ' от ' + esc(who.from) + '</b>' : ''}</div>` : ''}</div>
        <div class="tp-price ${s.price ? '' : 'none'}">${esc(s.price || 'цена не найдена')}</div></div>`).join('')
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
    const k = [['all', 'Все'], ['price', 'С ценой'], ['none', 'Без цены'], ['free', 'Бесплатные']];
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
      if (!data) data = await fetch('/truck-parking.json?v=4').then(r => { if (!r.ok) throw new Error('нет данных'); return r.json(); });
      await loadLeaflet();
    } catch (e) { $('tpCount').textContent = 'Не удалось загрузить ТИР парковки: ' + e.message; return; }
    if (!map) {
      chips();
      $('tpUpdated').textContent = 'Данные собраны ' + new Date(data.updated).toLocaleDateString('ru') + '. Часть цен взята из отзывов водителей и могла измениться: у каждой цены указана дата.';
      map = L.map('tpMap', { scrollWheelZoom: true }).setView([46, 25], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
      layer = L.layerGroup().addTo(map);
      markers = data.stops.map(s => L.marker([s.lat, s.lon], { title: s.name, icon: L.divIcon({ className: '', html: `<div class="tp-pin ${s.kind}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9] }) }).bindPopup(popup(s), { maxWidth: 300 }));
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
      <div class="tp-sub">Карта и поиск городов: © участники OpenStreetMap. Путь строится автоматически (OSRM) как для легковой машины, это не грузовой навигатор.</div></section>`;
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
      .tp-dot.price, .tp-pin.price { background: #C27A00; } .tp-dot.none, .tp-pin.none { background: #8A949C; } .tp-dot.free, .tp-pin.free { background: #1B8A4C; }
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
