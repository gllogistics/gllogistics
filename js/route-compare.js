// GL Logistics — «Сравнить пути»: стоимость вариантов маршрута фуры (расчёт RouteCalc, routecalc.eu) + ваш расход и цены дизеля
(function () {
  const W = 'https://gl-api.gltransam.workers.dev';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const E = n => n == null || isNaN(n) ? '—' : '€' + Math.round(n).toLocaleString('ru');
  const hm = s => { const m = Math.round(s / 60); return Math.floor(m / 60) + ' ч ' + String(m % 60).padStart(2, '0') + ' мин'; };
  const CN = { BG: 'Болгария', RO: 'Румыния', HU: 'Венгрия', TR: 'Турция', GR: 'Греция', RS: 'Сербия', MK: 'Сев. Македония', AT: 'Австрия', DE: 'Германия', PL: 'Польша', SK: 'Словакия',
    CZ: 'Чехия', SI: 'Словения', HR: 'Хорватия', IT: 'Италия', FR: 'Франция', LT: 'Литва', LV: 'Латвия', EE: 'Эстония', UA: 'Украина', MD: 'Молдова', GE: 'Грузия', AM: 'Армения',
    BA: 'Босния', ME: 'Черногория', AL: 'Албания', NL: 'Нидерланды', BE: 'Бельгия', LU: 'Люксембург', CH: 'Швейцария', ES: 'Испания', PT: 'Португалия', DK: 'Дания', SE: 'Швеция', BY: 'Беларусь', RU: 'Россия', AZ: 'Азербайджан', XK: 'Косово', KZ: 'Казахстан', GB: 'Великобритания', NO: 'Норвегия', KG: 'Кыргызстан', UZ: 'Узбекистан', TJ: 'Таджикистан', TM: 'Туркменистан', CN: 'Китай', IR: 'Иран', FI: 'Финляндия', CY: 'Кипр' };
  const STORE = 'gl_route_compare_v1';
  const COLORS = ['#146C72', '#C2410C', '#6D28D9', '#B91C1C'];
  let rmap = null, rlayer = null;
  let settings = { diesel: {}, ferries: [] };   // тарифы паромов и цены дизеля вне ЕС (с сервера)
  const NONEU = ['TR', 'GE', 'AM', 'AZ', 'RS', 'MK', 'BA', 'ME', 'AL', 'XK', 'UA', 'MD', 'BY', 'RU', 'KZ', 'CH', 'GB', 'NO'];
  const ferryById = id => settings.ferries.find(x => x.id === id);
  const priceOf = (cc, f) => fuel[cc] != null ? fuel[cc] : settings.diesel[cc] != null ? settings.diesel[cc] : f.nonEu;
  const ferryOpts = sel => '<option value="">без парома</option>' + settings.ferries.map(x => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((res, rej) => {
      if (!document.querySelector('link[href*="leaflet"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(l); }
      const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Карта не загрузилась')); document.head.appendChild(sc);
    });
  }
  // Линии вариантов на карте OpenStreetMap (линию даёт OpenRouteService — кредиты RouteCalc не тратятся)
  async function drawMap(list) {
    const box = $('rcMap'); const withLine = (list || []).filter(v => v && ((v.segments && v.segments.length) || (v.geometry && v.geometry.length)));
    if (!withLine.length) { box.hidden = true; return; }
    box.hidden = false;
    try { await loadLeaflet(); } catch (e) { box.hidden = true; return; }
    if (!rmap) { rmap = L.map('rcMap', { scrollWheelZoom: true }); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(rmap); rlayer = L.layerGroup().addTo(rmap); }
    else setTimeout(() => rmap.invalidateSize(), 50);
    rlayer.clearLayers(); const all = [];
    withLine.forEach(v => {
      const col = COLORS[v._i % COLORS.length];
      const segs = v.segments && v.segments.length ? v.segments : [v.geometry];
      segs.forEach(g => L.polyline(g, { color: col, weight: 5, opacity: .8 }).addTo(rlayer).bindTooltip(esc(v.name || 'Вариант'), { sticky: true }));
      if (segs.length > 1) for (let k = 0; k < segs.length - 1; k++) L.polyline([segs[k][segs[k].length - 1], segs[k + 1][0]], { color: col, weight: 3, opacity: .7, dashArray: '6 8' }).addTo(rlayer).bindTooltip('Паром', { sticky: true });
      (v.points || []).forEach((p, k) => L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).addTo(rlayer)
        .bindTooltip(esc(p.label) + (k === 0 ? ' (откуда)' : k === v.points.length - 1 ? ' (куда)' : ''), { direction: 'top' }));
      segs.forEach(g => all.push(...g));
    });
    rmap.fitBounds(all, { padding: [30, 30] });
  }
  let fuel = {}, last = null, tripsList = [];

  const avgRate = () => { const r = tripsList.map(t => parseFloat(t.wialon_fuel_rate)).filter(x => x > 10 && x < 60); return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length * 10) / 10 : 31; };

  function rowHtml(v) {
    return `<div class="rc-var"><input class="rc-name" placeholder="Название, напр. Через Видин" value="${esc(v.name || '')}">
      <input class="rc-via" placeholder="Через (через запятую): Vidin, Bulgaria; Calafat, Romania" value="${esc((v.via || []).join('; '))}">
      <select class="rc-ferry" title="Паром: дорога до порта + паром + дорога от порта">${ferryOpts(v.ferry || '')}</select>
      <input class="rc-extra" type="number" step="1" min="0" placeholder="Разрешения и др., €" value="${v.extra || ''}" title="Расходы, которых нет в расчёте: разрешения и т.п. Цена парома берётся из тарифа">
      <input class="rc-hours" type="number" step="0.5" min="0" placeholder="Доп. часы" value="${v.hours || ''}" title="Например, ожидание на границе. Часы парома берутся из тарифа">
      <button type="button" class="rc-del" title="Убрать вариант" aria-label="Убрать вариант">✕</button></div>`;
  }
  function readForm() {
    return {
      origin: $('rcFrom').value.trim(), destination: $('rcTo').value.trim(), cargo: $('rcCargo').value, euro: $('rcEuro').value,
      rate: parseFloat($('rcRate').value) || avgRate(), nonEu: parseFloat($('rcNonEu').value) || null, dayCost: parseFloat($('rcDay').value) || 0,
      variants: [...document.querySelectorAll('.rc-var')].map(r => ({ name: r.querySelector('.rc-name').value.trim(),
        via: r.querySelector('.rc-via').value.split(/[;\n]+/).map(s => s.trim()).filter(Boolean),
        ferry: r.querySelector('.rc-ferry').value, extra: parseFloat(r.querySelector('.rc-extra').value) || 0, hours: parseFloat(r.querySelector('.rc-hours').value) || 0 })).filter(v => v.name || v.via.length || v.ferry)
    };
  }
  function fillForm(s) {
    $('rcFrom').value = s.origin || ''; $('rcTo').value = s.destination || ''; $('rcCargo').value = s.cargo || 'dry'; $('rcEuro').value = s.euro || 'euro6';
    $('rcRate').value = s.rate || avgRate(); $('rcNonEu').value = s.nonEu || ''; $('rcDay').value = s.dayCost || '';
    const vs = (s.variants && s.variants.length ? s.variants : [{}, {}]);
    $('rcVars').innerHTML = vs.map(rowHtml).join(''); updCost();
  }
  function updCost() { const n = [...document.querySelectorAll('.rc-var')].reduce((t, r) => t + (r.querySelector('.rc-ferry').value ? 2 : 1), 0); $('rcGo').textContent = 'Полный расчёт (до ' + n + ' ' + (n === 1 ? 'кредита' : 'кредитов') + ')'; }

  // Стоимость варианта: дороги + мосты + виньетки + дизель (ваш расход × цена в стране) + доп. расходы + время
  function costOf(v, f) {
    const t = v.totals || {};
    let fuelCost = 0, fuelL = 0, unpriced = [];
    for (const c of v.countries || []) {
      const l = (c.km || 0) * f.rate / 100; fuelL += l;
      const p = priceOf(c.country, f);
      if (p == null) unpriced.push(c.country); else fuelCost += l * p;
    }
    const hours = (t.duration_s || 0) / 3600 + (v.extraHours || 0);
    const timeCost = f.dayCost ? hours / 24 * f.dayCost : 0;
    const road = (t.toll_eur || 0) + (t.tunnel_bridge_eur || 0) + (t.vignette_eur || 0) + (t.ferry_eur || 0);
    const ferryEur = v.ferryObj && v.ferryObj.price_eur ? v.ferryObj.price_eur : 0;
    return { road, fuelL, fuelCost, unpriced, hours, timeCost, extra: v.extra || 0, ferry: ferryEur, total: road + fuelCost + (v.extra || 0) + ferryEur + timeCost };
  }
  function render(res, f) {
    const vs = res.variants.map((v, i) => { const fv = f.variants[i] || {}; const fo = fv.ferry ? ferryById(fv.ferry) : null;
      return Object.assign(v, { _i: i, ferryObj: fo, extra: fv.extra || 0, extraHours: (fv.hours || 0) + (fo && fo.hours ? fo.hours : 0) }); });
    const osm = vs.some(v => v.mode === 'osm');
    const ok = vs.filter(v => !v.error).map(v => Object.assign(v, { cost: costOf(v, f) }));
    // если посчитать деньги нечем (нет цен дизеля и сборов) — сравниваем по расстоянию
    const byKm = ok.length && ok.every(v => !v.cost.total);
    const best = ok.length ? ok.reduce((a, b) => (byKm ? b.totals.distance_km < a.totals.distance_km : b.cost.total < a.cost.total) ? b : a) : null;
    const anyUnpriced = ok.some(v => v.cost.unpriced.length);
    const cols = ok.map(v => `<th><span class="rc-sw" style="background:${COLORS[v._i % COLORS.length]}"></span>${esc(v.name || 'Вариант')}${v === best && ok.length > 1 ? '<span class="rc-best">' + (byKm ? 'короче всего' : 'дешевле всего') + '</span>' : ''}</th>`).join('');
    const row = (label, fn, cls) => `<tr class="${cls || ''}"><td>${label}</td>${ok.map(v => `<td class="r">${fn(v)}</td>`).join('')}</tr>`;
    let html = ok.length ? `<div class="rc-scroll"><table class="rc-table"><thead><tr><th></th>${cols}</tr></thead><tbody>
      ${row('Расстояние', v => Math.round(v.totals.distance_km).toLocaleString('ru') + ' км')}
      ${row('Время в пути', v => hm(v.totals.duration_s) + (v.extraHours ? `<div class="rc-sub">+ ${v.extraHours} ч доп.</div>` : ''))}
      ${osm ? row('По платным дорогам', v => v.totals.toll_km != null ? Math.round(v.totals.toll_km).toLocaleString('ru') + ' км' : '—') : ''}
      ${row('Платные дороги и маршрутные карты', v => v.mode === 'osm' ? '<span class="rc-sub">в полном расчёте</span>' : E(v.totals.toll_eur))}
      ${row('Мосты, тоннели', v => v.mode === 'osm' ? '<span class="rc-sub">в полном расчёте</span>' : E(v.totals.tunnel_bridge_eur || 0))}
      ${row('Виньетки', v => v.mode === 'osm' ? '<span class="rc-sub">в полном расчёте</span>' : E(v.totals.vignette_eur || 0))}
      ${row(`Дизель (${f.rate} л/100 км)`, v => Math.round(v.cost.fuelL) + ' л · ' + (v.cost.unpriced.length && !v.cost.fuelCost ? '—' : E(v.cost.fuelCost)) + (v.cost.unpriced.length ? `<div class="rc-sub warn">без цены: ${v.cost.unpriced.join(', ')}</div>` : ''))}
      ${ok.some(v => v.ferryObj) ? row('Паром', v => v.ferryObj ? (v.ferryObj.price_eur ? E(v.ferryObj.price_eur) : '<span class="rc-sub warn">цена не задана</span>') + `<div class="rc-sub">${esc(v.ferryObj.name)}${v.ferryObj.hours ? ', ' + v.ferryObj.hours + ' ч' : ''}</div>` : '—') : ''}
      ${row('Разрешения и др.', v => E(v.cost.extra))}
      ${f.dayCost ? row('Время машины с водителем', v => E(v.cost.timeCost)) : ''}
      ${row(osm ? '<b>Итого без платных дорог</b>' : '<b>Итого</b>', v => (byKm ? '<b>—</b>' : `<b>${E(v.cost.total)}</b>`) + (best && v !== best && !byKm ? `<div class="rc-sub">+${E(v.cost.total - best.cost.total)} к лучшему</div>` : ''), 'rc-total')}
      </tbody></table></div>` : '';
    // По странам
    html += ok.map(v => `<details class="rc-det"><summary>${esc(v.name || 'Вариант')}: по странам${v.cached ? ` <span class="rc-cache">${v.mode === 'osm' ? 'из сохранённого расчёта' : 'из сохранённого расчёта, кредит не потрачен'}</span>` : ''}</summary>
      <div class="rc-route">${esc([v.resolved && v.resolved.origin].concat((v.resolved && v.resolved.via) || [], [v.resolved && v.resolved.destination]).filter(Boolean).join(' → '))}</div>
      <table class="rc-table small"><thead><tr><th>Страна</th><th class="r">Км</th><th class="r">Дороги</th><th class="r">Виньетка</th><th class="r">Дизель, л</th><th class="r">Цена дизеля</th><th class="r">Время</th></tr></thead><tbody>
      ${(v.countries || []).map(c => { const p = priceOf(c.country, f); return `<tr><td>${esc(CN[c.country] || c.country)}</td><td class="r">${Math.round(c.km)}</td><td class="r">${E(c.toll_eur)}</td><td class="r">${E(c.vignette_eur)}</td>
        <td class="r">${Math.round(c.km * f.rate / 100)}</td><td class="r">${p != null ? '€' + p.toFixed(2) + (fuel[c.country] == null ? ' <span class="rc-sub">ваша</span>' : '') : '—'}</td><td class="r">${hm(c.duration_s)}</td></tr>`; }).join('')}
      </tbody></table>${v.info_url ? `<a class="rc-link" href="${esc(v.info_url)}" target="_blank" rel="noopener">Открыть этот маршрут в RouteCalc</a>` : ''}</details>`).join('');
    const errs = vs.filter(v => v.error);
    if (errs.length) html += errs.map(v => `<div class="rc-err">${esc(v.name || 'Вариант')}: ${esc(v.error)}${v.info_url ? ` · <a href="${esc(v.info_url)}" target="_blank" rel="noopener">подробнее</a>` : ''}</div>`).join('');
    html += `<div class="rc-notes">${osm ? '<div><b>Быстрый расчёт:</b> маршрут фуры OpenRouteService по данным © участники OpenStreetMap. Платные дороги, маршрутные карты и мосты здесь не считаются — для полной стоимости нажмите «Полный расчёт».</div>' : '<div>Расчёт маршрута и сборов: <a href="https://routecalc.eu" target="_blank" rel="noopener">RouteCalc</a> (routecalc.eu). Для планирования и ставок, не для бухгалтерии. Линии на карте: OpenRouteService / © OpenStreetMap.</div>'}
      <div>Дизель считается по вашему расходу ${f.rate} л/100 км и ценам с налогами из бюллетеня ЕС${Object.keys(fuel).length ? '' : ' (цены сейчас недоступны)'}${anyUnpriced ? '; для стран вне ЕС укажите цену дизеля в поле выше' : ''}.</div>
      ${osm ? '' : '<div>Сверяйте с фактом: по вашему билету TollRO Калафат — Орадя RouteCalc считает на ~20% меньше (похоже, без НДС).</div>'}
      ${res.quota && res.quota.remaining != null ? `<div>Осталось кредитов RouteCalc: <b>${res.quota.remaining}</b>.</div>` : ''}</div>`;
    $('rcRes').innerHTML = html;
  }
  async function go(mode) {
    const f = readForm();
    if (!f.origin || !f.destination) return alert('Укажите, откуда и куда');
    if (!f.variants.length) f.variants = [{ name: 'Прямой путь', via: [], extra: 0, hours: 0 }];
    localStorage.setItem(STORE, JSON.stringify(f));
    const btn = mode === 'osm' ? $('rcFree') : $('rcGo'); const was = btn.textContent;
    btn.disabled = true; btn.textContent = 'Считаю…'; $('rcRes').innerHTML = '<div class="rc-wait">Считаю маршруты, это занимает несколько секунд на вариант…</div>';
    const body = JSON.stringify({ origin: f.origin, destination: f.destination, cargo: f.cargo, euro: f.euro, variants: f.variants.map(v => {
      const fo = v.ferry ? ferryById(v.ferry) : null;
      return fo ? { name: v.name, via: v.via, legs: [{ origin: f.origin, destination: fo.from, via: v.via }, { origin: fo.to, destination: f.destination, via: [] }] } : { name: v.name, via: v.via }; }) });
    const post = p => fetch(W + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(r => r.json());
    try {
      if (mode === 'osm') {
        const j = await post('/api/routes/osm'); if (j.error) throw new Error(j.error);
        last = { res: j, f }; render(j, f); drawMap(j.variants);
      } else {
        const geo = post('/api/routes/osm').catch(() => null);   // линия для карты — параллельно и бесплатно
        const j = await post('/api/routes/compare'); if (j.error) throw new Error(j.error);
        last = { res: j, f }; render(j, f);
        const g = await geo; if (g && g.variants) drawMap(g.variants.map((v, i) => Object.assign(v, { _i: i })));
      }
    } catch (e) { $('rcRes').innerHTML = `<div class="rc-err">Не удалось рассчитать: ${esc(e.message)}</div>`; $('rcMap').hidden = true; }
    btn.disabled = false; btn.textContent = was; updCost();
  }
  function renderSettings() {
    $('rcFerries').innerHTML = settings.ferries.map((x, i) => `<tr data-i="${i}"><td><input class="fe-name" value="${esc(x.name)}"></td><td><input class="fe-from" value="${esc(x.from)}"></td>
      <td><input class="fe-to" value="${esc(x.to)}"></td><td><input class="fe-price" type="number" step="1" min="0" value="${x.price_eur || ''}" placeholder="—"></td>
      <td><input class="fe-hours" type="number" step="1" min="0" value="${x.hours || ''}"></td><td><input class="fe-note" value="${esc(x.note || '')}"></td>
      <td><button type="button" class="rc-del" data-fdel="${i}" title="Удалить линию">✕</button></td></tr>`).join('');
    $('rcDiesel').innerHTML = NONEU.map(cc => `<label>${esc(CN[cc] || cc)}<input type="number" step="0.01" min="0" data-dz="${cc}" value="${settings.diesel[cc] != null ? settings.diesel[cc] : ''}" placeholder="—"></label>`).join('');
  }
  function readSettings() {
    return { diesel: Object.fromEntries([...document.querySelectorAll('[data-dz]')].filter(i => parseFloat(i.value) > 0).map(i => [i.dataset.dz, parseFloat(i.value)])),
      ferries: [...document.querySelectorAll('#rcFerries tr')].map((tr, i) => ({ id: (settings.ferries[+tr.dataset.i] || {}).id || ('f' + Date.now() + i), name: tr.querySelector('.fe-name').value,
        from: tr.querySelector('.fe-from').value, to: tr.querySelector('.fe-to').value, price_eur: tr.querySelector('.fe-price').value, hours: tr.querySelector('.fe-hours').value, note: tr.querySelector('.fe-note').value })) };
  }
  function refreshFerrySelects() { document.querySelectorAll('.rc-ferry').forEach(sel => { const v = sel.value; sel.innerHTML = ferryOpts(v); }); updCost(); }
  function init() {
    const mount = $('rcMount'); if (!mount) return;
    const card = document.createElement('section'); card.id = 'rcCard'; card.setAttribute('aria-label', 'Сравнить пути');
    card.innerHTML = `<div class="rc-top"><span class="rc-hint">Расчёт маршрута фуры по странам: дороги, маршрутные карты, мосты, дизель и время.</span><button type="button" class="rc-btn" id="rcExample">Пример: Видин или Русе</button></div>
      <div class="rc-grid">
        <label>Откуда<input id="rcFrom" placeholder="Kapitan Andreevo, Bulgaria"></label>
        <label>Куда<input id="rcTo" placeholder="Bors, Romania"></label>
        <label>Груз<select id="rcCargo"><option value="dry">Тент</option><option value="reefer_plus_2">Реф +2 °C</option><option value="reefer_minus_18">Реф −18 °C</option></select></label>
        <label>Экокласс<select id="rcEuro"><option value="euro6">Euro 6</option><option value="euro5">Euro 5</option><option value="euro3">Euro 3 и старше</option></select></label>
        <label>Расход, л/100 км<input id="rcRate" type="number" step="0.1" title="По умолчанию — средний расход ваших машин по Wialon"></label>
        <label>Дизель в остальных странах, €/л<input id="rcNonEu" type="number" step="0.01" placeholder="если нет в тарифах"></label>
        <label>День машины с водителем, €<input id="rcDay" type="number" step="10" placeholder="необязательно"></label>
      </div>
      <details class="rc-set" id="rcSet"><summary>Тарифы паромов и цены дизеля вне ЕС</summary>
        <h4>Паромы (цена — по последнему предложению DFDS, публичного прайса нет)</h4>
        <table><thead><tr><td class="rc-sub">Название</td><td class="rc-sub">Откуда (порт)</td><td class="rc-sub">Куда (порт)</td><td class="rc-sub">Цена, €</td><td class="rc-sub">Часов</td><td class="rc-sub">Расписание</td><td></td></tr></thead><tbody id="rcFerries"></tbody></table>
        <button type="button" class="rc-btn" id="rcFerryAdd" style="margin-top:6px">+ Линия</button>
        <h4>Дизель вне ЕС, € за литр (для стран ЕС цена берётся из бюллетеня ЕС сама)</h4>
        <div class="rc-dz" id="rcDiesel"></div>
        <div class="rc-set-foot"><button type="button" class="rc-btn primary" id="rcSetSave">Сохранить тарифы</button><span class="rc-sub" id="rcSetMsg"></span></div>
      </details>
      <div class="rc-hint">Варианты пути: точки «через» пишите латиницей через точку с запятой, как в навигаторе (город, страна). Паром и разрешения, которых нет в расчёте, добавьте суммой и часами.</div>
      <div id="rcVars"></div>
      <div class="rc-actions"><button type="button" class="rc-btn" id="rcAdd">+ Вариант</button><button type="button" class="rc-btn" id="rcFree" title="Километры, время и дизель по странам — без платных дорог. Бесплатно.">Быстрый расчёт (бесплатно)</button><button type="button" class="rc-btn primary" id="rcGo">Полный расчёт</button></div>
      <div id="rcRes"></div><div id="rcMap" hidden></div>`;
    mount.appendChild(card);
    const st = document.createElement('style');
    st.textContent = `
      #rcCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .rc-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; } .rc-top h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .rc-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; color: #14202B; font: inherit; font-size: 13px; cursor: pointer; }
      .rc-btn.primary { background: #146C72; border-color: #146C72; color: #fff; font-weight: 600; } .rc-btn:disabled { opacity: .6; }
      .rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
      .rc-grid label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 600; color: #5B6670; }
      .rc-grid input, .rc-grid select, .rc-var input { height: 34px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 8px; font: inherit; font-size: 13.5px; color: #14202B; min-width: 0; }
      .rc-hint { font-size: 12px; color: #5B6670; }
      #rcVars { display: flex; flex-direction: column; gap: 6px; }
      .rc-var { display: grid; grid-template-columns: 1fr 2.1fr 1.3fr .8fr .6fr 32px; gap: 6px; } .rc-var select { height: 34px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 6px; font: inherit; font-size: 13px; min-width: 0; }
      .rc-set { border: 1px solid #E4E7EA; border-radius: 8px; padding: 8px 12px; } .rc-set summary { cursor: pointer; font-size: 13.5px; font-weight: 600; }
      .rc-set h4 { margin: 12px 0 6px; font-size: 13px; font-weight: 600; } .rc-set table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .rc-set td { padding: 3px 4px; } .rc-set input { width: 100%; height: 32px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 6px; font: inherit; font-size: 13px; }
      .rc-dz { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; } .rc-dz label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
      .rc-dz input { width: 70px; } .rc-set-foot { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
      .rc-del { border: none; background: none; color: #8A949C; cursor: pointer; font-size: 14px; border-radius: 6px; } .rc-del:hover { background: #FBE9E7; color: #A3241B; }
      .rc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      #rcMap { height: 440px; border: 1px solid #E4E7EA; border-radius: 8px; } #rcMap[hidden] { display: none; }
      .rc-sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
      .rc-scroll { overflow-x: auto; border: 1px solid #E4E7EA; border-radius: 8px; }
      .rc-table { width: 100%; border-collapse: collapse; font-size: 13px; } .rc-table th { text-align: left; padding: 9px 10px; font-size: 12px; font-weight: 600; color: #14202B; background: #FAFBFB; border-bottom: 1px solid #E4E7EA; white-space: nowrap; }
      .rc-table td { padding: 8px 10px; border-top: 1px solid #EEF0F2; font-variant-numeric: tabular-nums; } .rc-table .r { text-align: right; white-space: nowrap; } .rc-table.small { font-size: 12.5px; }
      .rc-total td { background: #F2F6F6; font-size: 14px; } .rc-best { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 10px; background: #E7F4EC; color: #1B6B3F; font-size: 11px; }
      .rc-sub { font-size: 11.5px; color: #5B6670; font-weight: 400; } .rc-sub.warn { color: #8A4B00; }
      .rc-det { border: 1px solid #E4E7EA; border-radius: 8px; padding: 8px 10px; } .rc-det summary { cursor: pointer; font-size: 13.5px; font-weight: 600; }
      .rc-route { font-size: 12px; color: #5B6670; margin: 6px 0; } .rc-cache { font-size: 11.5px; color: #1B6B3F; font-weight: 400; }
      .rc-link { display: inline-block; margin-top: 6px; font-size: 12.5px; color: #146C72; }
      .rc-err { font-size: 13px; color: #A3241B; background: #FBE9E7; border-radius: 6px; padding: 8px 10px; } .rc-wait { font-size: 13px; color: #5B6670; padding: 10px 0; }
      .rc-notes { font-size: 12px; color: #5B6670; display: flex; flex-direction: column; gap: 3px; } .rc-notes a { color: #146C72; }
      @media (max-width: 900px) { .rc-var { grid-template-columns: 1fr 1fr; } }`;
    document.head.appendChild(st);

    $('rcAdd').addEventListener('click', () => { if (document.querySelectorAll('.rc-var').length >= 4) return alert('Не больше 4 вариантов за раз'); $('rcVars').insertAdjacentHTML('beforeend', rowHtml({})); updCost(); });
    $('rcVars').addEventListener('click', e => { if (e.target.closest('.rc-del')) { e.target.closest('.rc-var').remove(); updCost(); } });
    $('rcGo').addEventListener('click', () => go('full'));
    $('rcVars').addEventListener('change', e => { if (e.target.closest('.rc-ferry')) updCost(); });
    $('rcFerryAdd').addEventListener('click', () => { settings.ferries = readSettings().ferries.concat([{ id: 'f' + Date.now(), name: '', from: '', to: '', price_eur: null, hours: null, note: '' }]); renderSettings(); });
    $('rcFerries').addEventListener('click', e => { const b = e.target.closest('[data-fdel]'); if (b) { const cur = readSettings(); cur.ferries.splice(+b.dataset.fdel, 1); settings.ferries = cur.ferries; renderSettings(); } });
    $('rcSetSave').addEventListener('click', async () => {
      const r = await fetch(W + '/api/settings/routes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(readSettings()) }).then(x => x.json()).catch(() => ({ error: 'нет связи' }));
      if (r.error) { $('rcSetMsg').textContent = 'Не сохранилось: ' + r.error; return; }
      settings = { diesel: r.diesel, ferries: r.ferries }; renderSettings(); refreshFerrySelects(); $('rcSetMsg').textContent = 'Сохранено';
      if (last) render(last.res, readForm());
    });
    $('rcFree').addEventListener('click', () => go('osm'));
    $('rcExample').addEventListener('click', () => fillForm({ origin: 'Kapitan Andreevo, Bulgaria', destination: 'Bors, Romania', cargo: 'dry', euro: 'euro6', rate: avgRate(),
      variants: [{ name: 'Через Видин', via: ['Vidin, Bulgaria', 'Calafat, Romania'] }, { name: 'Через Русе', via: ['Ruse, Bulgaria', 'Giurgiu, Romania'] }] }));
    // форма: последнее заполнение; средний расход машин из рейсов; цены дизеля
    try { fillForm(JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { fillForm({}); }
    fetch(W + '/api/trips').then(r => r.json()).then(t => { tripsList = Array.isArray(t) ? t : []; if (!(JSON.parse(localStorage.getItem(STORE) || '{}').rate)) $('rcRate').value = avgRate(); }).catch(() => {});
    fetch(W + '/api/routes/fuel').then(r => r.json()).then(j => { fuel = (j && j.prices) || {}; if (last) render(last.res, readForm()); }).catch(() => {});
    fetch(W + '/api/settings/routes').then(r => r.json()).then(j => { if (j && Array.isArray(j.ferries)) { settings = { diesel: j.diesel || {}, ferries: j.ferries }; renderSettings(); refreshFerrySelects();
      try { const st = JSON.parse(localStorage.getItem(STORE) || '{}'); if (st.variants) document.querySelectorAll('.rc-var').forEach((r, i) => { if (st.variants[i] && st.variants[i].ferry) r.querySelector('.rc-ferry').value = st.variants[i].ferry; }); updCost(); } catch (e) {} } }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 20)); else setTimeout(init, 20);
})();
