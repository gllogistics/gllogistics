// GL Logistics — «Машины на карте»: последние координаты машин из Wialon на карте OpenStreetMap
(function () {
  const W = 'https://gl-api.gltransam.workers.dev';
  const WIALON = 'https://hst-api.wialon.com/wialon/ajax.html';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');   // «284 HT 61» = «284HT61»
  let sid = null, map = null, layer = null, units = [], trips = [], timer = null, fitted = false, active = false;
  const PLACE_KEY = 'gl_fm_places_v1';
  const places = (() => { try { return JSON.parse(localStorage.getItem(PLACE_KEY)) || {}; } catch (e) { return {}; } })();

  const ago = ts => { if (!ts) return 'нет данных'; const m = Math.round((Date.now() / 1000 - ts) / 60);
    return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин назад' : Math.floor(m / 1440) + ' дн. назад'; };
  // состояние: едет / стоит / давно нет сигнала
  const stateOf = u => { const p = u.pos; if (!p) return { cls: 'off', text: 'нет координат' };
    const age = Date.now() / 1000 - p.t;
    if (age > 6 * 3600) return { cls: 'off', text: 'нет сигнала ' + ago(p.t).replace(' назад', '') };
    if (p.s > 5) return { cls: 'move', text: 'едет, ' + p.s + ' км/ч' };
    return { cls: 'stop', text: 'стоит' }; };

  async function wialon(svc, params) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!sid) { const r = await fetch(W + '/api/wialon/session', { method: 'POST' }).then(r => r.json()); if (!r.sid) throw new Error(r.error || 'нет сеанса Wialon'); sid = r.sid; }
      const r = await fetch(WIALON, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `svc=${svc}&params=${encodeURIComponent(JSON.stringify(params))}&sid=${sid}` }).then(r => r.json());
      if (r && r.error === 1) { sid = null; continue; }   // сеанс истёк — берём новый
      if (r && r.error) throw new Error('Wialon: ошибка ' + r.error);
      return r;
    }
    throw new Error('Wialon: не удалось получить сеанс');
  }
  // ближайший населённый пункт (OpenStreetMap Nominatim), запоминаем по округлённым координатам
  async function placeOf(p) {
    const k = p.y.toFixed(2) + ',' + p.x.toFixed(2);
    if (places[k]) return places[k];
    try {
      const j = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=ru&lat=${p.y}&lon=${p.x}`).then(r => r.json());
      const a = j.address || {};
      const name = [a.city || a.town || a.village || a.municipality || a.county || a.state, a.country].filter(Boolean).join(', ');
      places[k] = name || '—'; localStorage.setItem(PLACE_KEY, JSON.stringify(places));
      await new Promise(r => setTimeout(r, 1100));   // правило Nominatim: не чаще раза в секунду
      return places[k];
    } catch (e) { return '—'; }
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((res, rej) => {
      if (!document.querySelector('link[href*="leaflet"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(l); }
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = res; s.onerror = () => rej(new Error('Карта не загрузилась')); document.head.appendChild(s);
    });
  }
  const tripOf = u => trips.find(t => t.status !== 'closed' && norm(t.truck) && norm(u.nm).includes(norm(t.truck)));

  function render() {
    const rows = units.map(u => ({ u, st: stateOf(u), trip: tripOf(u) }));
    $('fmTable').innerHTML = rows.length ? rows.map(({ u, st, trip }) => `<tr data-unit="${u.id}">
      <td><b>${esc(u.nm)}</b></td><td><span class="fm-dot ${st.cls}"></span>${esc(st.text)}</td>
      <td>${u.pos ? esc(u._place || '…') + `<div class="fm-sub">${u.pos.y.toFixed(4)}, ${u.pos.x.toFixed(4)}</div>` : '—'}</td>
      <td>${u.pos ? ago(u.pos.t) : '—'}</td>
      <td>${trip ? `<a href="/trip-report.html?trip=${trip.id}">${esc(trip.route_from || '')} → ${esc(trip.route_to || '')}</a>` : '<span class="fm-sub">нет открытого рейса</span>'}</td></tr>`).join('')
      : '<tr><td colspan="5" class="fm-empty">Машин в Wialon не найдено</td></tr>';
    if (!map) return;
    layer.clearLayers();
    const pts = [];
    rows.forEach(({ u, st, trip }) => {
      if (!u.pos) return;
      const ll = [u.pos.y, u.pos.x]; pts.push(ll);
      const icon = L.divIcon({ className: '', html: `<div class="fm-pin ${st.cls}">${esc(u.nm)}</div>`, iconSize: null });
      L.marker(ll, { icon }).addTo(layer).bindPopup(`<b>${esc(u.nm)}</b><br>${esc(st.text)}<br>${esc(u._place || '')}<br>Сигнал: ${ago(u.pos.t)}`
        + (trip ? `<br><a href="/trip-report.html?trip=${trip.id}">Рейс: ${esc(trip.route_from || '')} → ${esc(trip.route_to || '')}</a>` : '')
        + `<br><a href="https://www.openstreetmap.org/?mlat=${u.pos.y}&mlon=${u.pos.x}#map=12/${u.pos.y}/${u.pos.x}" target="_blank" rel="noopener">Открыть в OpenStreetMap</a>`);
    });
    if (!fitted && pts.length) { map.fitBounds(pts, { padding: [40, 40], maxZoom: 9 }); fitted = true; }
  }
  async function refresh() {
    $('fmTime').textContent = 'Обновляю…';
    try {
      const r = await wialon('core/search_items', { spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' }, force: 1, flags: 1025, from: 0, to: 0 });
      units = (r.items || []).map(i => ({ id: i.id, nm: i.nm, pos: i.pos || null, _place: (units.find(x => x.id === i.id) || {})._place }));
      $('fmTime').textContent = 'Обновлено ' + new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) + ' · обновляется раз в минуту';
      render();
      for (const u of units) { if (u.pos) { const p = await placeOf(u.pos); if (u._place !== p) { u._place = p; render(); } } }
    } catch (e) { $('fmTime').textContent = 'Не удалось получить данные: ' + e.message; }
  }
  async function show() {
    active = true;
    try { await loadLeaflet(); } catch (e) { $('fmTime').textContent = e.message; return; }
    if (!map) {
      map = L.map('fmMap', { scrollWheelZoom: true }).setView([42, 35], 4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
      layer = L.layerGroup().addTo(map);
    } else setTimeout(() => map.invalidateSize(), 50);
    if (!trips.length) trips = await fetch(W + '/api/trips').then(r => r.json()).catch(() => []) || [];
    await refresh();
    clearInterval(timer); timer = setInterval(() => { if (active && !document.hidden) refresh(); }, 60000);
  }

  function init() {
    const mount = $('fmMount'); if (!mount) return;
    mount.innerHTML = `<section id="fmCard" aria-label="Машины на карте">
      <div class="fm-top"><span class="fm-sub" id="fmTime"></span><button type="button" class="fm-btn" id="fmRefresh">Обновить</button></div>
      <div class="fm-legend"><span><i class="fm-dot move"></i>едет</span><span><i class="fm-dot stop"></i>стоит</span><span><i class="fm-dot off"></i>нет сигнала больше 6 ч</span></div>
      <div id="fmMap"></div>
      <div class="fm-wrap"><table class="fm-table"><thead><tr><th>Машина</th><th>Состояние</th><th>Где</th><th>Последний сигнал</th><th>Рейс</th></tr></thead><tbody id="fmTable"></tbody></table></div>
      <div class="fm-sub">Координаты: Wialon. Карта и названия мест: © участники OpenStreetMap.</div></section>`;
    const st = document.createElement('style');
    st.textContent = `
      #fmCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .fm-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; } .fm-sub { font-size: 12.5px; color: #5B6670; }
      .fm-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; font: inherit; font-size: 13px; cursor: pointer; }
      .fm-legend { display: flex; gap: 14px; font-size: 12.5px; color: #5B6670; } .fm-legend span { display: flex; align-items: center; gap: 5px; }
      #fmMap { height: 480px; border: 1px solid #E4E7EA; border-radius: 8px; }
      .fm-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
      .fm-dot.move { background: #1B8A4C; } .fm-dot.stop { background: #C27A00; } .fm-dot.off { background: #8A949C; }
      .fm-pin { display: inline-block; transform: translate(-50%, -50%); padding: 3px 9px; border-radius: 12px; font: 600 12px/1.3 system-ui, sans-serif; color: #fff; white-space: nowrap; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
      .fm-pin.move { background: #1B8A4C; } .fm-pin.stop { background: #C27A00; } .fm-pin.off { background: #8A949C; }
      .fm-wrap { border: 1px solid #E4E7EA; border-radius: 8px; overflow-x: auto; }
      .fm-table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 700px; } .fm-table th { text-align: left; padding: 9px 12px; font-size: 12px; font-weight: 600; color: #5B6670; background: #FAFBFB; border-bottom: 1px solid #E4E7EA; }
      .fm-table td { padding: 9px 12px; border-top: 1px solid #EEF0F2; vertical-align: top; } .fm-table tr[data-unit] { cursor: pointer; } .fm-table tr[data-unit]:hover td { background: #F5F9F9; }
      .fm-table a { color: #146C72; } .fm-empty { text-align: center; color: #5B6670; padding: 20px; }`;
    document.head.appendChild(st);
    $('fmRefresh').addEventListener('click', refresh);
    $('fmTable').addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const tr = e.target.closest('[data-unit]'); const u = tr && units.find(x => x.id == tr.dataset.unit);
      if (u && u.pos && map) { map.setView([u.pos.y, u.pos.x], 11); $('fmMap').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    window.addEventListener('gl-tab', e => { if (e.detail === 'fm') show(); else active = false; });
    if (!mount.hidden) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
