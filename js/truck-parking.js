// GL Logistics — «ТИР парковки»: платные и бесплатные стоянки с ценами на карте OpenStreetMap (данные: /truck-parking.json)
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND = { price: 'цена известна', none: 'платная, цена не найдена', free: 'бесплатная' };
  let data = null, map = null, layer = null, routeLine = null, markers = [], me = null, meMarker = null;
  const f = { country: 'all', kind: 'all', q: '' };

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
  const where = s => s.km != null ? s.km.toLocaleString('ru') + ' км от Еревана' + (s.off > 0 ? ' · ≈ ' + s.off + ' км в стороне' : '') : 'вне маршрута Ереван → Варшава';
  const nav = s => `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Google Maps</a> · <a href="https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes" target="_blank" rel="noopener">Waze</a>`;
  const popup = s => `<div class="tp-pop"><b>${esc(s.name)}</b><div class="tp-sub">${esc(s.where)}</div>
    <div class="tp-price ${s.price ? '' : 'none'}">${esc(s.price || 'Цена в открытых источниках не найдена')}</div>
    ${s.note ? `<div>${esc(s.note)}</div>` : ''}
    <div class="tp-sub">Проложить: ${nav(s)}</div>
    <div class="tp-sub">Источник: ${s.src.map(x => `<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])}</a>`).join(' · ')}</div></div>`;

  function visible() {
    const q = f.q.trim().toLowerCase();
    let list = data.stops.map((s, i) => ({ s, i })).filter(({ s }) =>
      (f.country === 'all' || s.country === f.country) && (f.kind === 'all' || s.kind === f.kind) &&
      (!q || (s.name + ' ' + s.where + ' ' + s.note).toLowerCase().includes(q)));
    if (me) list.forEach(r => r.d = dist(me, [r.s.lat, r.s.lon])), list.sort((a, b) => a.d - b.d);
    return list;
  }

  function render(fit) {
    const list = visible();
    $('tpCount').textContent = list.length + ' из ' + data.stops.length + (me ? ' · ближайшие сверху' : '');
    $('tpList').innerHTML = list.length ? list.map(({ s, i, d }) => `<div class="tp-row" data-i="${i}" tabindex="0">
        <i class="tp-dot ${s.kind}" title="${KIND[s.kind]}"></i>
        <div class="tp-main"><b>${esc(s.name)}</b><div class="tp-sub">${esc(s.where)}</div>
          <div class="tp-sub">${d != null ? '<b>' + Math.round(d).toLocaleString('ru') + ' км от вас</b> · ' : ''}${where(s)}</div></div>
        <div class="tp-price ${s.price ? '' : 'none'}">${esc(s.price || 'цена не найдена')}</div></div>`).join('')
      : '<div class="tp-empty">Ничего не найдено. Сбросьте фильтры или измените поиск.</div>';
    if (!map) return;
    layer.clearLayers();
    const shown = new Set(list.map(r => r.i));
    markers.forEach((m, i) => { if (shown.has(i)) layer.addLayer(m); });
    if (fit) {
      const pts = list.map(r => [r.s.lat, r.s.lon]); if (me) pts.push(me);
      if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 10 });
    }
  }

  function chips() {
    const counts = {}; data.stops.forEach(s => counts[s.country] = (counts[s.country] || 0) + 1);
    const c = [['all', 'Все страны', data.stops.length], ...Object.keys(counts).map(k => [k, k, counts[k]])];
    $('tpCountries').innerHTML = c.map(([v, l, n]) => `<button type="button" class="tp-chip${f.country === v ? ' on' : ''}" data-country="${esc(v)}">${esc(l)} <span>${n}</span></button>`).join('');
    const k = [['all', 'Все'], ['price', 'С ценой'], ['none', 'Без цены'], ['free', 'Бесплатные']];
    $('tpKinds').innerHTML = k.map(([v, l]) => `<button type="button" class="tp-chip${f.kind === v ? ' on' : ''}" data-kind="${v}">${v === 'all' ? '' : `<i class="tp-dot ${v}"></i>`}${l}</button>`).join('');
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
      me = [p.coords.latitude, p.coords.longitude];
      $('tpNear').disabled = false; $('tpNear').textContent = 'Ближайшие ко мне ✓';
      if (map) { if (meMarker) meMarker.remove(); meMarker = L.circleMarker(me, { radius: 8, color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }).addTo(map).bindPopup('Вы здесь'); }
      render(false);
      const first = visible().slice(0, 5).map(r => [r.s.lat, r.s.lon]);
      if (map && first.length) map.fitBounds([me, ...first], { padding: [30, 30], maxZoom: 11 });
    }, err => {
      $('tpNear').disabled = false; $('tpNear').textContent = 'Ближайшие ко мне';
      $('tpCount').textContent = err.code === 1 ? 'Нет доступа к местоположению: разрешите его в настройках браузера' : 'Не удалось определить местоположение';
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }

  async function show() {
    try {
      if (!data) data = await fetch('/truck-parking.json?v=1').then(r => { if (!r.ok) throw new Error('нет данных'); return r.json(); });
      await loadLeaflet();
    } catch (e) { $('tpCount').textContent = 'Не удалось загрузить ТИР парковки: ' + e.message; return; }
    if (!map) {
      chips();
      $('tpUpdated').textContent = 'Данные собраны ' + new Date(data.updated).toLocaleDateString('ru') + '. Часть цен взята из отзывов водителей и могла измениться: у каждой цены указана дата.';
      map = L.map('tpMap', { scrollWheelZoom: true }).setView([46, 25], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
      routeLine = L.polyline(data.route.line.map(([lon, lat]) => [lat, lon]), { color: '#146C72', weight: 4, opacity: .75 });
      if ($('tpRoute').checked) routeLine.addTo(map);
      layer = L.layerGroup().addTo(map);
      markers = data.stops.map(s => L.marker([s.lat, s.lon], { title: s.name, icon: L.divIcon({ className: '', html: `<div class="tp-pin ${s.kind}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9] }) }).bindPopup(popup(s), { maxWidth: 300 }));
      render(true);
    } else setTimeout(() => map.invalidateSize(), 50);
  }

  function init() {
    const mount = $('tpMount'); if (!mount) return;
    mount.innerHTML = `<section id="tpCard" aria-label="ТИР парковки">
      <div class="tp-bar"><div class="tp-chips" id="tpCountries"></div></div>
      <div class="tp-bar"><div class="tp-chips" id="tpKinds"></div>
        <input type="search" id="tpSearch" class="tp-search" placeholder="Поиск: город, трасса, название" aria-label="Поиск ТИР парковки">
        <button type="button" class="tp-btn" id="tpNear">Ближайшие ко мне</button>
        <label class="tp-check"><input type="checkbox" id="tpRoute" checked> Маршрут Ереван → Варшава</label></div>
      <div id="tpMap"></div>
      <div class="tp-sub" id="tpCount">Загружаю ТИР парковки…</div>
      <div class="tp-list" id="tpList"></div>
      <div class="tp-sub" id="tpUpdated"></div>
      <div class="tp-sub">Карта: © участники OpenStreetMap. Маршрут построен автоматически (OSRM), это не грузовой навигатор.</div></section>`;
    const st = document.createElement('style');
    st.textContent = `
      #tpCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .tp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .tp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .tp-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 15px; border: 1px solid #D5DADF; background: #fff; font: inherit; font-size: 13px; cursor: pointer; color: #14202B; }
      .tp-chip span { color: #5B6670; font-variant-numeric: tabular-nums; } .tp-chip.on { background: #146C72; border-color: #146C72; color: #fff; } .tp-chip.on span { color: #D6ECEC; }
      .tp-chip:focus-visible, .tp-btn:focus-visible, .tp-row:focus-visible { outline: 2px solid #146C72; outline-offset: 2px; }
      .tp-search { flex: 1 1 220px; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid #D5DADF; border-radius: 6px; font: inherit; font-size: 13.5px; }
      .tp-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #146C72; background: #146C72; color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
      .tp-btn:disabled { opacity: .7; cursor: default; }
      .tp-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5B6670; }
      #tpMap { height: 520px; border: 1px solid #E4E7EA; border-radius: 8px; }
      .tp-sub { font-size: 12.5px; color: #5B6670; }
      .tp-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .tp-dot.price, .tp-pin.price { background: #C27A00; } .tp-dot.none, .tp-pin.none { background: #8A949C; } .tp-dot.free, .tp-pin.free { background: #1B8A4C; }
      .tp-pin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
      .tp-list { border: 1px solid #E4E7EA; border-radius: 8px; max-height: 560px; overflow-y: auto; }
      .tp-row { display: grid; grid-template-columns: 12px minmax(0,1fr) minmax(0,240px); gap: 12px; align-items: start; padding: 10px 12px; border-top: 1px solid #EEF0F2; cursor: pointer; }
      .tp-row:first-child { border-top: 0; } .tp-row:hover { background: #F5F9F9; } .tp-row .tp-dot { margin-top: 5px; }
      .tp-main b { font-size: 14px; font-weight: 600; }
      .tp-price { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; } .tp-price.none { color: #8A949C; font-weight: 400; font-style: italic; }
      .tp-empty { padding: 20px; text-align: center; color: #5B6670; }
      .tp-pop { display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.4; } .tp-pop .tp-price { text-align: left; } .tp-pop a, .tp-row a { color: #146C72; }
      @media (max-width: 700px) { #tpCard { padding: 12px; } #tpMap { height: 60vh; } .tp-row { grid-template-columns: 12px minmax(0,1fr); } .tp-row .tp-price { grid-column: 2; text-align: left; } .tp-list { max-height: none; } }`;
    document.head.appendChild(st);
    mount.addEventListener('click', e => {
      const c = e.target.closest('[data-country]'); if (c) { f.country = c.dataset.country; chips(); render(true); return; }
      const k = e.target.closest('[data-kind]'); if (k) { f.kind = k.dataset.kind; chips(); render(true); return; }
      const r = e.target.closest('.tp-row'); if (r && !e.target.closest('a')) focus(+r.dataset.i);
    });
    $('tpList').addEventListener('keydown', e => { const r = e.target.closest('.tp-row'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); focus(+r.dataset.i); } });
    let t = null; $('tpSearch').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; render(true); }, 200); });
    $('tpNear').addEventListener('click', locate);
    $('tpRoute').addEventListener('change', e => { if (routeLine) e.target.checked ? routeLine.addTo(map) : routeLine.remove(); });
    window.addEventListener('gl-tab', e => { if (e.detail === 'tp') show(); });
    if (!mount.hidden) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
