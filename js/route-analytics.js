// GL Logistics — «Аналитика маршрутов»: сколько в среднем стоил каждый вариант пути на направлении
(function () {
  const API = 'https://gl-api.gltransam.workers.dev/api/trips/analytics';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = n => n == null || isNaN(n) ? '—' : '֏' + Math.round(n).toLocaleString('ru');
  const N = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('ru');
  const fd = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; };
  // «Ереван РА» и «Ереван» — одно и то же место
  const place = s => String(s || '').replace(/\s+/g, ' ').trim().replace(/[,.]?\s*(РА|ՀՀ|РФ|RA|Armenia|Армения)$/i, '').trim();
  const NOVAR = 'Не указан';
  // Комбинация пути: «туда» и «обратно»; если обратно тем же путём или не указано — просто вариант
  const combo = r => { const t = r.route_variant || '', b = r.route_variant_back || '';
    if (!t && !b) return NOVAR; if (!b || b === t) return t + (b ? ' (туда и обратно)' : ''); return 'туда: ' + (t || '—') + ' · обратно: ' + b; };
  let rows = [], openState = false, dir = '', onlyClosed = true, expanded = {};

  const avg = (list, f, cond) => { const v = list.filter(cond || (() => true)).map(f).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  function directions() {
    const m = {};
    rows.forEach(r => { const k = (place(r.route_from) + ' → ' + place(r.route_to)); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }
  function render() {
    const dirs = directions();
    if (!dir || !dirs.some(([k]) => k === dir)) dir = dirs.length ? dirs[0][0] : '';
    $('raDir').innerHTML = dirs.map(([k, n]) => `<option value="${esc(k)}"${k === dir ? ' selected' : ''}>${esc(k)} (${n})</option>`).join('') || '<option>Рейсов пока нет</option>';
    let list = rows.filter(r => place(r.route_from) + ' → ' + place(r.route_to) === dir);
    const closed = list.filter(r => r.status === 'closed');
    const useClosed = onlyClosed && closed.length;
    if (useClosed) list = closed;
    $('raScope').textContent = onlyClosed && !closed.length ? 'Закрытых рейсов на этом направлении нет — считаю по всем.' : '';
    const groups = {};
    list.forEach(r => { const v = combo(r); (groups[v] = groups[v] || []).push(r); });
    const stat = Object.entries(groups).map(([v, l]) => {
      const kmTrips = l.filter(r => r.km > 0);
      const fuelKm = kmTrips.length ? kmTrips.reduce((s, r) => s + r.fuel, 0) / kmTrips.reduce((s, r) => s + r.km, 0) : null;
      return { v, l, n: l.length, days: avg(l, r => r.days), km: avg(l, r => r.km, r => r.km > 0), fuel: avg(l, r => r.fuel), fuelKm,
        toll: avg(l, r => r.toll), ferry: avg(l, r => r.ferry), transit: avg(l, r => r.transit), other: avg(l, r => r.other),
        crew: avg(l, r => r.crew), total: avg(l, r => r.total), profit: avg(l, r => r.profit) };
    }).sort((a, b) => (a.v === NOVAR) - (b.v === NOVAR) || (a.total ?? 1e18) - (b.total ?? 1e18));
    const known = stat.filter(s => s.v !== NOVAR);
    const cheapest = known.length > 1 ? known.reduce((a, b) => (b.total < a.total ? b : a)).v : null;
    const best = known.length > 1 ? known.reduce((a, b) => (b.profit > a.profit ? b : a)).v : null;
    const head = '<tr><th>Путь (туда / обратно)</th><th class="r">Рейсов</th><th class="r">Дней</th><th class="r">Км (GPS)</th><th class="r">Дизель</th><th class="r">Дизель на 1 км</th><th class="r">Дороги, мосты</th><th class="r">Паромы</th><th class="r">Транзит, разрешения</th><th class="r">Прочее</th><th class="r">Экипаж</th><th class="r">Затраты</th><th class="r">Прибыль</th></tr>';
    const body = stat.map(s => {
      const tags = (s.v === cheapest ? '<span class="ra-tag ok">дешевле всего</span>' : '') + (s.v === best ? '<span class="ra-tag best">выгоднее всего</span>' : '');
      const trips = expanded[s.v] ? s.l.map(r => `<tr class="ra-trip" data-trip="${r.id}"><td colspan="2">${esc(r.truck)} · ${fd(r.date_start)}${r.date_end ? ' — ' + fd(r.date_end) : ''}${r.status === 'closed' ? '' : ' <span class="ra-open">в пути</span>'}</td>
        <td class="r">${N(r.days)}</td><td class="r">${r.km ? N(r.km) : '—'}</td><td class="r">${A(r.fuel)}</td><td class="r">${r.km ? (r.fuel / r.km).toFixed(0) + ' ֏' : '—'}</td>
        <td class="r">${A(r.toll)}</td><td class="r">${A(r.ferry)}</td><td class="r">${A(r.transit)}</td><td class="r">${A(r.other)}</td><td class="r">${A(r.crew)}</td>
        <td class="r b">${A(r.total)}</td><td class="r b ${r.profit < 0 ? 'neg' : 'pos'}">${A(r.profit)}</td></tr>`).join('') : '';
      return `<tr class="ra-grp" data-var="${esc(s.v)}"><td><button type="button" class="ra-exp" aria-expanded="${!!expanded[s.v]}">${expanded[s.v] ? '▾' : '▸'}</button> <b>${esc(s.v)}</b> ${tags}</td>
        <td class="r">${s.n}</td><td class="r">${N(s.days)}</td><td class="r">${N(s.km)}</td><td class="r">${A(s.fuel)}</td><td class="r">${s.fuelKm != null ? s.fuelKm.toFixed(0) + ' ֏' : '—'}</td>
        <td class="r">${A(s.toll)}</td><td class="r">${A(s.ferry)}</td><td class="r">${A(s.transit)}</td><td class="r">${A(s.other)}</td><td class="r">${A(s.crew)}</td>
        <td class="r b">${A(s.total)}</td><td class="r b ${s.profit < 0 ? 'neg' : 'pos'}">${A(s.profit)}</td></tr>` + trips;
    }).join('');
    $('raTable').innerHTML = list.length ? `<thead>${head}</thead><tbody>${body}</tbody>` : '<tbody><tr><td class="ra-empty">На этом направлении пока нет рейсов.</td></tr></tbody>';
    const noVar = list.filter(r => !r.route_variant && !r.route_variant_back).length, noKm = list.filter(r => !(r.km > 0)).length;
    $('raNotes').innerHTML = [
      'Средние значения на один рейс. Затраты = все расходы рейса + зарплата и неизрасходованный аванс (как в прибыли рейса).',
      noVar ? `<b>${noVar}</b> ${noVar === 1 ? 'рейс' : 'рейсов'} без варианта пути — откройте рейс → «Изменить» → «Вариант пути», и он попадёт в сравнение.` : '',
      noKm ? `<b>${noKm}</b> без пробега GPS — нажмите «Wialon» в рейсе, чтобы считался дизель на 1 км.` : '',
      known.length < 2 ? 'Для сравнения нужно хотя бы два разных варианта пути на одном направлении.' : ''
    ].filter(Boolean).map(t => `<div>${t}</div>`).join('');
  }
  async function load() {
    $('raTable').innerHTML = '<tbody><tr><td class="ra-empty">Загрузка…</td></tr></tbody>';
    try { const r = await (await fetch(API)).json(); rows = Array.isArray(r) ? r : []; } catch (e) { rows = []; }
    render();
  }
  function setOpen(v) {
    openState = v;
    $('raCard').hidden = !v; $('raBtn').classList.toggle('on', v);
    const d = $('tripDetail'); if (d) d.style.visibility = v ? 'hidden' : '';
    if (d) d.style.position = v ? 'absolute' : '';
    if (v) { load(); $('raCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  function init() {
    const detail = $('tripDetail'); if (!detail) return;
    const right = detail.parentNode;
    const card = document.createElement('section');
    card.id = 'raCard'; card.hidden = true; card.setAttribute('aria-label', 'Аналитика маршрутов');
    card.innerHTML = `<div class="ra-top"><h3>Аналитика маршрутов</h3><button type="button" class="ra-btn" id="raClose">Закрыть</button></div>
      <div class="ra-ctl"><label>Направление <select id="raDir"></select></label><label class="ra-chk"><input type="checkbox" id="raClosed" checked> Только закрытые рейсы</label></div>
      <div class="ra-scope" id="raScope"></div>
      <div class="ra-scroll"><table class="ra-table" id="raTable"></table></div>
      <div class="ra-notes" id="raNotes"></div>`;
    right.insertBefore(card, right.firstChild);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'raBtn'; btn.className = 'ra-open-btn'; btn.textContent = 'Аналитика маршрутов';
    const tabs = $('tripTabs');
    (tabs && tabs.parentNode ? tabs.parentNode : detail.parentNode.parentNode).insertBefore(btn, tabs ? tabs.nextSibling : null);
    const st = document.createElement('style');
    st.textContent = `
      .ra-open-btn { width: 100%; height: 36px; margin: 2px 0 6px; border: 1px solid #D5DADF; background: #fff; color: #14202B; border-radius: 6px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
      .ra-open-btn.on, .ra-open-btn:hover { border-color: #146C72; color: #146C72; }
      #raCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      #raCard[hidden] { display: none; }
      .ra-top { display: flex; justify-content: space-between; align-items: center; } .ra-top h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .ra-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; font: inherit; font-size: 13px; cursor: pointer; }
      .ra-ctl { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; font-size: 13px; color: #5B6670; }
      .ra-ctl select { height: 34px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 8px; font: inherit; font-size: 14px; color: #14202B; margin-left: 6px; max-width: 340px; }
      .ra-chk { display: flex; align-items: center; gap: 6px; } .ra-chk input { width: 16px; height: 16px; accent-color: #146C72; }
      .ra-scope { font-size: 12.5px; color: #8A4B00; } .ra-scope:empty { display: none; }
      .ra-scroll { overflow-x: auto; border: 1px solid #E4E7EA; border-radius: 8px; }
      .ra-table { width: 100%; border-collapse: collapse; min-width: 1100px; font-size: 13px; }
      .ra-table th { text-align: left; padding: 9px 10px; font-size: 11.5px; font-weight: 600; color: #5B6670; background: #FAFBFB; border-bottom: 1px solid #E4E7EA; white-space: nowrap; }
      .ra-table td { padding: 9px 10px; border-top: 1px solid #EEF0F2; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .ra-table .r { text-align: right; } .ra-table .b { font-weight: 600; } .ra-table .pos { color: #1B6B3F; } .ra-table .neg { color: #A3241B; }
      .ra-grp { background: #fff; } .ra-trip td { background: #FAFBFB; color: #3D4852; font-size: 12.5px; } .ra-trip { cursor: pointer; } .ra-trip:hover td { background: #EEF5F5; }
      .ra-exp { border: none; background: none; cursor: pointer; font-size: 13px; color: #5B6670; width: 20px; }
      .ra-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; }
      .ra-tag.ok { background: #E7F4EC; color: #1B6B3F; } .ra-tag.best { background: #E8F1F2; color: #0F5A60; }
      .ra-open { font-size: 11px; color: #8A4B00; } .ra-empty { padding: 20px; color: #5B6670; }
      .ra-notes { font-size: 12.5px; color: #5B6670; display: flex; flex-direction: column; gap: 3px; }`;
    document.head.appendChild(st);
    btn.addEventListener('click', () => setOpen(!openState));
    $('raClose').addEventListener('click', () => setOpen(false));
    $('raDir').addEventListener('change', () => { dir = $('raDir').value; expanded = {}; render(); });
    $('raClosed').addEventListener('change', () => { onlyClosed = $('raClosed').checked; render(); });
    $('raTable').addEventListener('click', e => {
      const g = e.target.closest('.ra-grp'); if (g) { const v = g.dataset.var; expanded[v] = !expanded[v]; render(); return; }
      const t = e.target.closest('[data-trip]'); if (!t) return;
      const trip = (typeof trips !== 'undefined' ? trips : []).find(x => x.id == t.dataset.trip);
      if (trip && typeof openTrip === 'function') { setOpen(false); openTrip(trip); }
    });
    // выбор рейса в списке слева закрывает аналитику
    document.addEventListener('click', e => { if (openState && e.target.closest('.trip-card')) setOpen(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
})();
