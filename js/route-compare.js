// GL Logistics — «Сравнить пути»: стоимость вариантов маршрута фуры (расчёт RouteCalc, routecalc.eu) + ваш расход и цены дизеля
(function () {
  const W = 'https://gl-api.gltransam.workers.dev';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const E = n => n == null || isNaN(n) ? '—' : '€' + Math.round(n).toLocaleString('ru');
  const hm = s => { const m = Math.round(s / 60); return Math.floor(m / 60) + ' ч ' + String(m % 60).padStart(2, '0') + ' мин'; };
  const CN = { BG: 'Болгария', RO: 'Румыния', HU: 'Венгрия', TR: 'Турция', GR: 'Греция', RS: 'Сербия', MK: 'Сев. Македония', AT: 'Австрия', DE: 'Германия', PL: 'Польша', SK: 'Словакия',
    CZ: 'Чехия', SI: 'Словения', HR: 'Хорватия', IT: 'Италия', FR: 'Франция', LT: 'Литва', LV: 'Латвия', EE: 'Эстония', UA: 'Украина', MD: 'Молдова', GE: 'Грузия', AM: 'Армения',
    BA: 'Босния', ME: 'Черногория', AL: 'Албания', NL: 'Нидерланды', BE: 'Бельгия', LU: 'Люксембург', CH: 'Швейцария', ES: 'Испания', PT: 'Португалия', DK: 'Дания', SE: 'Швеция', BY: 'Беларусь', RU: 'Россия' };
  const STORE = 'gl_route_compare_v1';
  let fuel = {}, openState = false, last = null;

  const avgRate = () => { const r = (typeof trips !== 'undefined' ? trips : []).map(t => parseFloat(t.wialon_fuel_rate)).filter(x => x > 10 && x < 60); return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length * 10) / 10 : 31; };

  function rowHtml(v) {
    return `<div class="rc-var"><input class="rc-name" placeholder="Название, напр. Через Видин" value="${esc(v.name || '')}">
      <input class="rc-via" placeholder="Через (через запятую): Vidin, Bulgaria; Calafat, Romania" value="${esc((v.via || []).join('; '))}">
      <input class="rc-extra" type="number" step="1" min="0" placeholder="Паром, разрешения, €" value="${v.extra || ''}" title="Расходы, которых нет в расчёте: паром, разрешения и т.п.">
      <input class="rc-hours" type="number" step="0.5" min="0" placeholder="Доп. часы" value="${v.hours || ''}" title="Например, 64 ч на пароме Пендик — Триест">
      <button type="button" class="rc-del" title="Убрать вариант" aria-label="Убрать вариант">✕</button></div>`;
  }
  function readForm() {
    return {
      origin: $('rcFrom').value.trim(), destination: $('rcTo').value.trim(), cargo: $('rcCargo').value, euro: $('rcEuro').value,
      rate: parseFloat($('rcRate').value) || avgRate(), nonEu: parseFloat($('rcNonEu').value) || null, dayCost: parseFloat($('rcDay').value) || 0,
      variants: [...document.querySelectorAll('.rc-var')].map(r => ({ name: r.querySelector('.rc-name').value.trim(),
        via: r.querySelector('.rc-via').value.split(/[;\n]+/).map(s => s.trim()).filter(Boolean),
        extra: parseFloat(r.querySelector('.rc-extra').value) || 0, hours: parseFloat(r.querySelector('.rc-hours').value) || 0 })).filter(v => v.name || v.via.length)
    };
  }
  function fillForm(s) {
    $('rcFrom').value = s.origin || ''; $('rcTo').value = s.destination || ''; $('rcCargo').value = s.cargo || 'dry'; $('rcEuro').value = s.euro || 'euro6';
    $('rcRate').value = s.rate || avgRate(); $('rcNonEu').value = s.nonEu || ''; $('rcDay').value = s.dayCost || '';
    const vs = (s.variants && s.variants.length ? s.variants : [{}, {}]);
    $('rcVars').innerHTML = vs.map(rowHtml).join(''); updCost();
  }
  function updCost() { const n = document.querySelectorAll('.rc-var').length; $('rcGo').textContent = 'Рассчитать (до ' + n + ' ' + (n === 1 ? 'кредита' : 'кредитов') + ')'; }

  // Стоимость варианта: дороги + мосты + виньетки + дизель (ваш расход × цена в стране) + доп. расходы + время
  function costOf(v, f) {
    const t = v.totals || {};
    let fuelCost = 0, fuelL = 0, unpriced = [];
    for (const c of v.countries || []) {
      const l = (c.km || 0) * f.rate / 100; fuelL += l;
      const p = fuel[c.country] != null ? fuel[c.country] : f.nonEu;
      if (p == null) unpriced.push(c.country); else fuelCost += l * p;
    }
    const hours = (t.duration_s || 0) / 3600 + (v.extraHours || 0);
    const timeCost = f.dayCost ? hours / 24 * f.dayCost : 0;
    const road = (t.toll_eur || 0) + (t.tunnel_bridge_eur || 0) + (t.vignette_eur || 0) + (t.ferry_eur || 0);
    return { road, fuelL, fuelCost, unpriced, hours, timeCost, extra: v.extra || 0, total: road + fuelCost + (v.extra || 0) + timeCost };
  }
  function render(res, f) {
    const vs = res.variants.map((v, i) => Object.assign(v, { extra: f.variants[i] ? f.variants[i].extra : 0, extraHours: f.variants[i] ? f.variants[i].hours : 0 }));
    const ok = vs.filter(v => !v.error).map(v => Object.assign(v, { cost: costOf(v, f) }));
    const best = ok.length ? ok.reduce((a, b) => b.cost.total < a.cost.total ? b : a) : null;
    const anyUnpriced = ok.some(v => v.cost.unpriced.length);
    const cols = ok.map(v => `<th>${esc(v.name || 'Вариант')}${v === best && ok.length > 1 ? '<span class="rc-best">дешевле всего</span>' : ''}</th>`).join('');
    const row = (label, fn, cls) => `<tr class="${cls || ''}"><td>${label}</td>${ok.map(v => `<td class="r">${fn(v)}</td>`).join('')}</tr>`;
    let html = ok.length ? `<div class="rc-scroll"><table class="rc-table"><thead><tr><th></th>${cols}</tr></thead><tbody>
      ${row('Расстояние', v => Math.round(v.totals.distance_km).toLocaleString('ru') + ' км')}
      ${row('Время в пути', v => hm(v.totals.duration_s) + (v.extraHours ? `<div class="rc-sub">+ ${v.extraHours} ч доп.</div>` : ''))}
      ${row('Платные дороги и маршрутные карты', v => E(v.totals.toll_eur))}
      ${row('Мосты, тоннели', v => E(v.totals.tunnel_bridge_eur || 0))}
      ${row('Виньетки', v => E(v.totals.vignette_eur || 0))}
      ${row(`Дизель (${f.rate} л/100 км)`, v => Math.round(v.cost.fuelL) + ' л · ' + E(v.cost.fuelCost) + (v.cost.unpriced.length ? `<div class="rc-sub warn">без цены: ${v.cost.unpriced.join(', ')}</div>` : ''))}
      ${row('Паром, разрешения и др.', v => E(v.cost.extra))}
      ${f.dayCost ? row('Время машины с водителем', v => E(v.cost.timeCost)) : ''}
      ${row('<b>Итого</b>', v => `<b>${E(v.cost.total)}</b>` + (best && v !== best ? `<div class="rc-sub">+${E(v.cost.total - best.cost.total)} к лучшему</div>` : ''), 'rc-total')}
      </tbody></table></div>` : '';
    // По странам
    html += ok.map(v => `<details class="rc-det"><summary>${esc(v.name || 'Вариант')}: по странам${v.cached ? ' <span class="rc-cache">из сохранённого расчёта, кредит не потрачен</span>' : ''}</summary>
      <div class="rc-route">${esc([v.resolved && v.resolved.origin].concat((v.resolved && v.resolved.via) || [], [v.resolved && v.resolved.destination]).filter(Boolean).join(' → '))}</div>
      <table class="rc-table small"><thead><tr><th>Страна</th><th class="r">Км</th><th class="r">Дороги</th><th class="r">Виньетка</th><th class="r">Дизель, л</th><th class="r">Цена дизеля</th><th class="r">Время</th></tr></thead><tbody>
      ${(v.countries || []).map(c => { const p = fuel[c.country] != null ? fuel[c.country] : f.nonEu; return `<tr><td>${esc(CN[c.country] || c.country)}</td><td class="r">${Math.round(c.km)}</td><td class="r">${E(c.toll_eur)}</td><td class="r">${E(c.vignette_eur)}</td>
        <td class="r">${Math.round(c.km * f.rate / 100)}</td><td class="r">${p != null ? '€' + p.toFixed(2) + (fuel[c.country] == null ? ' <span class="rc-sub">ваша</span>' : '') : '—'}</td><td class="r">${hm(c.duration_s)}</td></tr>`; }).join('')}
      </tbody></table>${v.info_url ? `<a class="rc-link" href="${esc(v.info_url)}" target="_blank" rel="noopener">Открыть этот маршрут в RouteCalc</a>` : ''}</details>`).join('');
    const errs = vs.filter(v => v.error);
    if (errs.length) html += errs.map(v => `<div class="rc-err">${esc(v.name || 'Вариант')}: ${esc(v.error)}${v.info_url ? ` · <a href="${esc(v.info_url)}" target="_blank" rel="noopener">подробнее</a>` : ''}</div>`).join('');
    html += `<div class="rc-notes"><div>Расчёт маршрута и сборов: <a href="https://routecalc.eu" target="_blank" rel="noopener">RouteCalc</a> (routecalc.eu). Для планирования и ставок, не для бухгалтерии.</div>
      <div>Дизель считается по вашему расходу ${f.rate} л/100 км и ценам с налогами из бюллетеня ЕС${Object.keys(fuel).length ? '' : ' (цены сейчас недоступны)'}${anyUnpriced ? '; для стран вне ЕС укажите цену дизеля в поле выше' : ''}.</div>
      <div>Сверяйте с фактом: по вашему билету TollRO Калафат — Орадя RouteCalc считает на ~20% меньше (похоже, без НДС).</div>
      ${res.quota && res.quota.remaining != null ? `<div>Осталось кредитов RouteCalc: <b>${res.quota.remaining}</b>.</div>` : ''}</div>`;
    $('rcRes').innerHTML = html;
  }
  async function go() {
    const f = readForm();
    if (!f.origin || !f.destination) return alert('Укажите, откуда и куда');
    if (!f.variants.length) f.variants = [{ name: 'Прямой путь', via: [], extra: 0, hours: 0 }];
    localStorage.setItem(STORE, JSON.stringify(f));
    const btn = $('rcGo'); btn.disabled = true; btn.textContent = 'Считаю…'; $('rcRes').innerHTML = '<div class="rc-wait">Считаю маршруты, это занимает несколько секунд на вариант…</div>';
    try {
      const r = await fetch(W + '/api/routes/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: f.origin, destination: f.destination, cargo: f.cargo, euro: f.euro, variants: f.variants.map(v => ({ name: v.name, via: v.via })) }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      last = { res: j, f }; render(j, f);
    } catch (e) { $('rcRes').innerHTML = `<div class="rc-err">Не удалось рассчитать: ${esc(e.message)}</div>`; }
    btn.disabled = false; updCost();
  }
  function setOpen(v) {
    openState = v; $('rcCard').hidden = !v; $('rcBtn').classList.toggle('on', v);
    if (v && $('raCard') && !$('raCard').hidden && $('raClose')) $('raClose').click();   // аналитику закрываем
    const d = $('tripDetail'); if (d) { d.style.visibility = v ? 'hidden' : ''; d.style.position = v ? 'absolute' : ''; }
    if (v) {
      if (!$('rcFrom').value && !$('rcTo').value) { try { fillForm(JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { fillForm({}); } }
      fetch(W + '/api/routes/fuel').then(r => r.json()).then(j => { fuel = (j && j.prices) || {}; if (last) render(last.res, readForm()); }).catch(() => {});
      $('rcCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function init() {
    const detail = $('tripDetail'); if (!detail) return;
    const card = document.createElement('section'); card.id = 'rcCard'; card.hidden = true; card.setAttribute('aria-label', 'Сравнить пути');
    card.innerHTML = `<div class="rc-top"><h3>Сравнить пути</h3><div><button type="button" class="rc-btn" id="rcExample">Пример: Видин или Русе</button> <button type="button" class="rc-btn" id="rcClose">Закрыть</button></div></div>
      <div class="rc-grid">
        <label>Откуда<input id="rcFrom" placeholder="Kapitan Andreevo, Bulgaria"></label>
        <label>Куда<input id="rcTo" placeholder="Bors, Romania"></label>
        <label>Груз<select id="rcCargo"><option value="dry">Тент</option><option value="reefer_plus_2">Реф +2 °C</option><option value="reefer_minus_18">Реф −18 °C</option></select></label>
        <label>Экокласс<select id="rcEuro"><option value="euro6">Euro 6</option><option value="euro5">Euro 5</option><option value="euro3">Euro 3 и старше</option></select></label>
        <label>Расход, л/100 км<input id="rcRate" type="number" step="0.1" title="По умолчанию — средний расход ваших машин по Wialon"></label>
        <label>Дизель вне ЕС, €/л<input id="rcNonEu" type="number" step="0.01" placeholder="напр. Турция"></label>
        <label>День машины с водителем, €<input id="rcDay" type="number" step="10" placeholder="необязательно"></label>
      </div>
      <div class="rc-hint">Варианты пути: точки «через» пишите латиницей через точку с запятой, как в навигаторе (город, страна). Паром и разрешения, которых нет в расчёте, добавьте суммой и часами.</div>
      <div id="rcVars"></div>
      <div class="rc-actions"><button type="button" class="rc-btn" id="rcAdd">+ Вариант</button><button type="button" class="rc-btn primary" id="rcGo">Рассчитать</button></div>
      <div id="rcRes"></div>`;
    detail.parentNode.insertBefore(card, detail.parentNode.firstChild);
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'rcBtn'; btn.className = 'ra-open-btn'; btn.textContent = 'Сравнить пути';
    const after = $('raBtn') || $('tripTabs'); if (after && after.parentNode) after.parentNode.insertBefore(btn, after.nextSibling);
    const st = document.createElement('style');
    st.textContent = `
      #rcCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      #rcCard[hidden] { display: none; } .rc-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; } .rc-top h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .rc-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; color: #14202B; font: inherit; font-size: 13px; cursor: pointer; }
      .rc-btn.primary { background: #146C72; border-color: #146C72; color: #fff; font-weight: 600; } .rc-btn:disabled { opacity: .6; }
      .rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
      .rc-grid label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 600; color: #5B6670; }
      .rc-grid input, .rc-grid select, .rc-var input { height: 34px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 8px; font: inherit; font-size: 13.5px; color: #14202B; min-width: 0; }
      .rc-hint { font-size: 12px; color: #5B6670; }
      #rcVars { display: flex; flex-direction: column; gap: 6px; }
      .rc-var { display: grid; grid-template-columns: 1.1fr 2.4fr .9fr .7fr 32px; gap: 6px; }
      .rc-del { border: none; background: none; color: #8A949C; cursor: pointer; font-size: 14px; border-radius: 6px; } .rc-del:hover { background: #FBE9E7; color: #A3241B; }
      .rc-actions { display: flex; gap: 8px; }
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
    btn.addEventListener('click', () => setOpen(!openState));
    $('rcClose').addEventListener('click', () => setOpen(false));
    $('rcAdd').addEventListener('click', () => { if (document.querySelectorAll('.rc-var').length >= 4) return alert('Не больше 4 вариантов за раз'); $('rcVars').insertAdjacentHTML('beforeend', rowHtml({})); updCost(); });
    $('rcVars').addEventListener('click', e => { if (e.target.closest('.rc-del')) { e.target.closest('.rc-var').remove(); updCost(); } });
    $('rcGo').addEventListener('click', go);
    $('rcExample').addEventListener('click', () => fillForm({ origin: 'Kapitan Andreevo, Bulgaria', destination: 'Bors, Romania', cargo: 'dry', euro: 'euro6', rate: avgRate(),
      variants: [{ name: 'Через Видин', via: ['Vidin, Bulgaria', 'Calafat, Romania'] }, { name: 'Через Русе', via: ['Ruse, Bulgaria', 'Giurgiu, Romania'] }] }));
    // выбор рейса в списке или открытие аналитики закрывает это окно
    document.addEventListener('click', e => { if (openState && (e.target.closest('.trip-card') || e.target.closest('#raBtn'))) setOpen(false); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 20)); else setTimeout(init, 20);
})();
