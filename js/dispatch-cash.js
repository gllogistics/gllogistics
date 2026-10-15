// GL Logistics — касса диспатчинга: приход за T1 и страховки, выдачи и расходы. Отдельно от сумм за машины.
(function () {
  const API = 'https://gl-api.gltransam.workers.dev/api/dispatch-cash';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SIGN = { EUR: '€', USD: '$', AMD: '֏', RUB: '₽', GEL: '₾' };
  const KIND = { t1: 'T1', insurance: 'Страховка', other: 'Другое' };
  const bucket = o => (o.kind === 't1' || o.kind === 'insurance') ? o.kind : 'other';   // старые «выдача/расход» — в «Другое»
  const money = (n, c) => (SIGN[c] || '') + Number(n || 0).toLocaleString('ru', { maximumFractionDigits: 2 }) + (SIGN[c] ? '' : ' ' + c);
  const fd = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; };
  const today = () => new Date().toISOString().slice(0, 10);
  const monthStart = () => today().slice(0, 8) + '01';
  let ops = [], editId = null, dirn = 'in', rates = null;
  // всё в драмах по курсу ЦБ: курсы с сервера — драмов за 1 единицу (доллар хранится как AMD)
  const toAmd = o => { const c = o.currency; if (c === 'AMD') return o.amount; if (!rates) return null;
    const r = c === 'USD' ? rates.AMD : rates[c]; return r ? o.amount * r : null; };
  const AMD = n => '֏' + Math.round(n).toLocaleString('ru');

  const api = (p, m = 'GET', b) => fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());

  // суммы по валютам: { EUR: 120, AMD: 50000 }
  const byCur = (list, f) => list.reduce((acc, o) => { if (f(o)) acc[o.currency] = (acc[o.currency] || 0) + o.amount * (o.direction === 'out' ? -1 : 1); return acc; }, {});
  const plain = (list, f) => list.reduce((acc, o) => { if (f(o)) acc[o.currency] = (acc[o.currency] || 0) + o.amount; return acc; }, {});
  const show = obj => { const k = Object.keys(obj).filter(c => Math.abs(obj[c]) > 0.004); return k.length ? k.map(c => `<span class="${obj[c] < 0 ? 'neg' : ''}">${money(obj[c], c)}</span>`).join('<br>') : '—'; };

  function render() {
    const from = $('dcFrom').value, to = $('dcTo').value;
    const inPeriod = o => (!from || o.date >= from) && (!to || o.date <= to);
    const per = ops.filter(inPeriod);
    const sum = (list, f) => { let t = 0, miss = 0; list.forEach(o => { if (!f(o)) return; const v = toAmd(o); if (v == null) miss++; else t += v * (o.direction === 'out' ? -1 : 1); }); return { t, miss }; };
    const card = k => {
      const all = sum(ops, o => bucket(o) === k), pin = sum(per, o => bucket(o) === k && o.direction === 'in'), pout = sum(per, o => bucket(o) === k && o.direction === 'out');
      const eur = rates && rates.EUR ? ' <span class="dc-eur">≈ €' + Math.round(all.t / rates.EUR).toLocaleString('ru') + '</span>' : '';
      return `<div class="dc-lbl">${k === 't1' ? 'T1' : k === 'insurance' ? 'Страховка' : 'Другое'}: накоплено</div><div class="dc-num ${all.t < 0 ? 'neg' : ''}">${AMD(all.t)}${eur}</div>
        <div class="dc-per">за период: <b class="pos">+${AMD(pin.t)}</b> · <b class="neg">−${AMD(Math.abs(pout.t))}</b></div>${all.miss ? '<div class="dc-per warn">нет курса для ' + all.miss + ' операций</div>' : ''}`;
    };
    $('dcCardT1').innerHTML = card('t1'); $('dcCardIns').innerHTML = card('insurance');
    const hasOther = ops.some(o => bucket(o) === 'other'); $('dcCardOther').hidden = !hasOther; if (hasOther) $('dcCardOther').innerHTML = card('other');
    $('dcBody').innerHTML = per.length ? per.map(o => `<tr>
      <td>${fd(o.date)}</td><td><span class="dc-kind ${o.direction}">${KIND[bucket(o)]}${o.direction === 'out' ? ' · расход' : ''}</span></td><td>${esc(o.truck)}</td><td class="dc-note">${esc(o.note)}</td>
      <td class="r in" title="${o.currency !== 'AMD' && toAmd(o) != null ? '≈ ' + AMD(toAmd(o)) : ''}">${o.direction === 'in' ? money(o.amount, o.currency) : ''}</td><td class="r out" title="${o.currency !== 'AMD' && toAmd(o) != null ? '≈ ' + AMD(toAmd(o)) : ''}">${o.direction === 'out' ? money(o.amount, o.currency) : ''}</td>
      <td class="r"><button type="button" class="dc-ic" data-edit="${o.id}" title="Изменить">✎</button><button type="button" class="dc-ic del" data-del="${o.id}" title="Удалить">✕</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="dc-empty">За этот период операций нет</td></tr>';
  }
  async function load() {
    if (!rates) rates = await fetch('https://gl-api.gltransam.workers.dev/api/rates').then(r => r.json()).catch(() => null);
    const r = await api('').catch(() => []); ops = Array.isArray(r) ? r.map(o => Object.assign(o, { amount: +o.amount })) : []; render(); }

  function openModal(dir, o) {
    dirn = o ? o.direction : dir; editId = o ? o.id : null;
    $('dcTitle').textContent = (o ? 'Изменить: ' : '') + (dirn === 'in' ? 'приход в кассу' : 'расход / выдача из кассы');
    $('dcKind').innerHTML = [['t1', 'T1'], ['insurance', 'Страховка'], ['other', 'Другое']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    $('dcKind').value = o ? bucket(o) : 't1';
    $('dcKindLbl').firstChild.textContent = dirn === 'in' ? 'В копилку' : 'Из копилки';
    $('dcDate').value = o ? o.date : today(); $('dcAmount').value = o ? o.amount : ''; $('dcCur').value = o ? o.currency : (localStorage.getItem('gl_dc_cur') || 'EUR');
    $('dcTruck').value = o ? (o.truck || '') : ''; $('dcNote').value = o ? (o.note || '') : '';
    const trucks = [...new Set((typeof allData !== 'undefined' ? allData : []).map(d => d.truck_number).filter(Boolean).concat(ops.map(x => x.truck).filter(Boolean)))];
    $('dcTrucks').innerHTML = trucks.map(t => `<option value="${esc(t)}">`).join('');
    $('dcModal').classList.add('open'); setTimeout(() => $('dcAmount').focus(), 30);
  }
  async function save() {
    const b = { direction: dirn, kind: $('dcKind').value, date: $('dcDate').value, amount: $('dcAmount').value, currency: $('dcCur').value, truck: $('dcTruck').value, note: $('dcNote').value };
    if (!(parseFloat(b.amount) > 0)) return alert('Укажите сумму');
    localStorage.setItem('gl_dc_cur', b.currency);
    const r = editId ? await api('/' + editId, 'PUT', b) : await api('', 'POST', b);
    if (r && r.error) return alert(r.error);
    $('dcModal').classList.remove('open'); await load();
  }

  function setTab(t) {
    localStorage.setItem('gl_dispatch_tab', t);
    document.querySelectorAll('.dc-tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    ['.stats-row', '.toolbar', '.table-wrap'].forEach(s => { const el = document.querySelector(s); if (el) el.style.display = t === 'cash' ? 'none' : ''; });
    $('dcSection').hidden = t !== 'cash';
    if (t === 'cash') load();
  }

  function init() {
    const stats = document.querySelector('.stats-row'); if (!stats) return;
    const tabs = document.createElement('div'); tabs.className = 'dc-tabs';
    tabs.innerHTML = '<button type="button" class="dc-tab on" data-t="trucks">Машины</button><button type="button" class="dc-tab" data-t="cash">Касса: T1 и страховки</button>';
    stats.parentNode.insertBefore(tabs, stats);
    const sec = document.createElement('section'); sec.id = 'dcSection'; sec.hidden = true; sec.setAttribute('aria-label', 'Касса');
    sec.innerHTML = `
      <div class="dc-cards">
        <div class="dc-card main" id="dcCardT1"></div>
        <div class="dc-card main" id="dcCardIns"></div>
        <div class="dc-card" id="dcCardOther" hidden></div>
      </div>
      <div class="dc-bar"><input type="date" id="dcFrom" aria-label="С"><span>—</span><input type="date" id="dcTo" aria-label="По">
        <span class="dc-sp"></span><button type="button" class="dc-btn in" id="dcAddIn">+ Приход</button><button type="button" class="dc-btn out" id="dcAddOut">− Расход / выдача</button></div>
      <div class="dc-wrap"><table class="dc-table"><thead><tr><th>Дата</th><th>Копилка</th><th>Машина</th><th>Примечание</th><th class="r">Приход</th><th class="r">Расход</th><th></th></tr></thead><tbody id="dcBody"></tbody></table></div>
      <div class="dc-hint">«Накоплено» — за всё время: приход минус расход из этой копилки, всё переведено в драмы по курсу ЦБ. Операции в списке показаны в той валюте, в которой внесены (наведите на сумму — увидите в драмах).</div>`;
    const anchor = document.querySelector('.table-wrap'); anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    const m = document.createElement('div'); m.className = 'dc-modal'; m.id = 'dcModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="dc-box"><h2 id="dcTitle">Приход</h2>
      <div class="dc-row"><label id="dcKindLbl">В копилку<select id="dcKind"></select></label><label>Дата<input type="date" id="dcDate"></label></div>
      <div class="dc-row"><label>Сумма<input type="number" id="dcAmount" step="0.01" min="0"></label><label>Валюта<select id="dcCur"><option>EUR</option><option>USD</option><option>AMD</option><option>RUB</option><option>GEL</option></select></label></div>
      <label>Машина (необязательно)<input id="dcTruck" list="dcTrucks" autocomplete="off" placeholder="002 HG 01"><datalist id="dcTrucks"></datalist></label>
      <label>Примечание<input id="dcNote" placeholder="Например: T1 на Капыкуле, водитель Հրաչ"></label>
      <div class="dc-foot"><button type="button" class="dc-btn" id="dcCancel">Отмена</button><button type="button" class="dc-btn in" id="dcSave">Сохранить</button></div></div>`;
    document.body.appendChild(m);
    const st = document.createElement('style');
    st.textContent = `
      .dc-tabs { display: flex; gap: 6px; margin: 4px 0 14px; } .dc-tab { border: 1px solid #D5DADF; background: #fff; border-radius: 6px; padding: 7px 14px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; color: #14202B; }
      .dc-tab.on { background: #146C72; border-color: #146C72; color: #fff; }
      #dcSection { display: flex; flex-direction: column; gap: 12px; } #dcSection[hidden] { display: none; }
      .dc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
      .dc-card { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 12px 14px; } .dc-card.main { border-color: #9CC5C8; background: #F2F8F8; }
      .dc-lbl { font-size: 12.5px; color: #5B6670; font-weight: 500; } .dc-num { margin-top: 4px; font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.35; }
      .dc-num.neg { color: #A3241B; } .dc-cards .dc-card[hidden] { display: none; }
      .dc-card.main .dc-num { font-size: 26px; } .dc-eur { font-size: 14px; font-weight: 500; color: #5B6670; margin-left: 6px; }
      .dc-per { margin-top: 6px; font-size: 12.5px; color: #5B6670; } .dc-per .pos { color: #1B6B3F; font-weight: 600; } .dc-per .neg { color: #A3241B; font-weight: 600; } .dc-per.warn { color: #8A4B00; }
      .dc-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .dc-bar input { height: 36px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 8px; font: inherit; font-size: 14px; } .dc-sp { flex: 1; }
      .dc-btn { height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; color: #14202B; }
      .dc-btn.in { background: #146C72; border-color: #146C72; color: #fff; } .dc-btn.out { border-color: #E8B4AF; color: #A3241B; }
      .dc-wrap { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; overflow-x: auto; }
      .dc-table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 720px; } .dc-table th { text-align: left; padding: 9px 12px; font-size: 12px; font-weight: 600; color: #5B6670; background: #FAFBFB; border-bottom: 1px solid #E4E7EA; }
      .dc-table td { padding: 9px 12px; border-top: 1px solid #EEF0F2; vertical-align: top; } .dc-table .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .dc-table td.in { color: #1B6B3F; font-weight: 600; } .dc-table td.out { color: #A3241B; font-weight: 600; } .dc-note { color: #3D4852; max-width: 340px; }
      .dc-kind { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; } .dc-kind.in { background: #E7F4EC; color: #1B6B3F; } .dc-kind.out { background: #FBE9E7; color: #A3241B; }
      .dc-ic { border: none; background: none; cursor: pointer; color: #8A949C; font-size: 14px; padding: 2px 6px; border-radius: 6px; } .dc-ic:hover { background: #EEF0F2; color: #14202B; } .dc-ic.del:hover { color: #A3241B; }
      .dc-empty { text-align: center; color: #5B6670; padding: 24px; } .dc-hint { font-size: 12.5px; color: #5B6670; }
      .dc-modal { display: none; position: fixed; inset: 0; background: rgba(16,38,42,.45); z-index: 1100; align-items: flex-start; justify-content: center; padding: 60px 12px; overflow-y: auto; }
      .dc-modal.open { display: flex; } .dc-box { background: #fff; border-radius: 10px; width: 100%; max-width: 460px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
      .dc-box h2 { margin: 0 0 4px; font-size: 18px; font-weight: 600; } .dc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .dc-box label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #5B6670; }
      .dc-box input, .dc-box select { height: 38px; border: 1px solid #D5DADF; border-radius: 6px; padding: 0 10px; font: inherit; font-size: 14px; color: #14202B; }
      .dc-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }`;
    document.head.appendChild(st);
    $('dcFrom').value = monthStart(); $('dcTo').value = today();
    tabs.addEventListener('click', e => { const b = e.target.closest('.dc-tab'); if (b) setTab(b.dataset.t); });
    ['dcFrom', 'dcTo'].forEach(id => $(id).addEventListener('change', render));
    $('dcAddIn').addEventListener('click', () => openModal('in'));
    $('dcAddOut').addEventListener('click', () => openModal('out'));
    $('dcSave').addEventListener('click', save);
    $('dcCancel').addEventListener('click', () => $('dcModal').classList.remove('open'));
    $('dcModal').addEventListener('click', e => { if (e.target.id === 'dcModal') $('dcModal').classList.remove('open'); });
    $('dcModal').addEventListener('keydown', e => { if (e.key === 'Escape') $('dcModal').classList.remove('open'); if (e.key === 'Enter' && e.target.tagName === 'INPUT') save(); });
    $('dcBody').addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]'); if (ed) { openModal(null, ops.find(o => o.id == ed.dataset.edit)); return; }
      const dl = e.target.closest('[data-del]'); if (dl && confirm('Удалить эту операцию из кассы?')) { await api('/' + dl.dataset.del, 'DELETE'); await load(); }
    });
    if (localStorage.getItem('gl_dispatch_tab') === 'cash') setTab('cash');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
