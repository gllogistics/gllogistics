const WORKER = 'https://gl-api.gltransam.workers.dev';
const ADMIN_USER = 'TigranMetspagyan';
const SESSION_MAX = 12 * 60 * 60 * 1000;
const WIALON_TOKEN = '9a42496eb8cb2922d6d2f97923818f3d8BDC20D911F8EECF1067A0FCC8066BBC06C93EAE';
const WIALON_API = 'https://hst-api.wialon.com/wialon/ajax.html';
const WIALON_UNITS = { '284 HT 61': 28629144, '927 HS 61': 30121499 };
const WIALON_RES_ID = 28629123;
const WIALON_REP_ID = 1;

// ── Auth ─────────────────────────────────────────────────────────────────────
const user = localStorage.getItem('gl_staff_user');
const loginTime = parseInt(localStorage.getItem('gl_staff_login_time') || '0');
if (!user || !loginTime || (Date.now() - loginTime) > SESSION_MAX || user !== ADMIN_USER) {
  localStorage.removeItem('gl_staff_user');
  window.location.href = 'staff.html';
}

function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = localStorage.getItem('gl_staff_token');
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  return fetch(WORKER + path, opts).then(r => r.json());
}

function doLogout() {
  ['gl_staff_user','gl_staff_login_time','gl_staff_token'].forEach(k => localStorage.removeItem(k));
  window.location.href = 'staff.html';
}

// ── State ────────────────────────────────────────────────────────────────────
let trips = [], currentTrip = null, cargoList = [], wialonSid = null, aiOpen = true;
let aiMessages = [], aiTripContext = null;

// ── Wialon ───────────────────────────────────────────────────────────────────
async function wialonLogin() {
  try {
    const r = await fetch(WIALON_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `svc=token/login&params=${encodeURIComponent(JSON.stringify({ token: WIALON_TOKEN, fl: 1, operateAs: '' }))}`
    });
    const d = await r.json();
    if (d.eid) { wialonSid = d.eid; return true; }
    return false;
  } catch { return false; }
}

async function wialonCall(svc, params) {
  if (!wialonSid) await wialonLogin();
  const r = await fetch(WIALON_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `svc=${svc}&params=${encodeURIComponent(JSON.stringify(params))}&sid=${wialonSid}`
  });
  return r.json();
}

async function fetchWialonData(trip) {
  if (!trip.date_start || !trip.date_end) return null;
  const unitId = WIALON_UNITS[trip.truck];
  if (!unitId) return null;

  const t1 = Math.floor(new Date(trip.date_start + 'T00:00:00').getTime() / 1000);
  const t2 = Math.floor(new Date(trip.date_end + 'T23:59:59').getTime() / 1000);

  // Запускаем отчёт
  const execR = await wialonCall('report/exec_report', {
    reportResourceId: WIALON_RES_ID,
    reportTemplateId: WIALON_REP_ID,
    reportTemplate: null,
    reportObjectId: unitId,
    reportObjectSecId: 0,
    interval: { from: t1, to: t2, flags: 0 }
  });
  if (execR.error) return null;

  // Читаем сводку (таблица 0)
  const summaryR = await wialonCall('report/get_result_rows', { tableIndex: 0, indexFrom: 0, indexTo: 50 });
  // Читаем заправки (таблица 1)
  const fillingsR = await wialonCall('report/get_result_rows', { tableIndex: 1, indexFrom: 0, indexTo: 50 });

  // Суммируем по всем дням
  let totalMileage = 0, totalFuel = 0;
  (summaryR || []).forEach(row => {
    const cols = row.c || [];
    const km = parseFloat((cols[2] || '0').replace(' km', '').replace(',', '.')) || 0;
    const fuel = parseFloat((cols[4] || '0').replace(' l', '').replace(',', '.')) || 0;
    totalMileage += km;
    totalFuel += fuel;
  });

  const fillings = (fillingsR || []).map(row => {
    const c = row.c || [];
    return {
      time: typeof c[0] === 'object' ? c[0].t : c[0],
      location: typeof c[1] === 'object' ? (c[1].a || '') : c[1],
      before: parseFloat((c[2] || '0').replace(' l', '')) || 0,
      filled: parseFloat((c[3] || '0').replace(' l', '')) || 0,
      after: parseFloat((c[4] || '0').replace(' l', '')) || 0,
    };
  });

  const avgRate = totalMileage > 0 ? (totalFuel / totalMileage * 100) : 0;

  return { mileage: totalMileage, fuelUsed: totalFuel, fuelRate: avgRate, fillings };
}

// ── Render ───────────────────────────────────────────────────────────────────
const catLabel = { fuel:'⛽ Топливо', toll:'🛣 Платная дорога', parking:'🅿️ Стоянка', ferry:'🚢 Паром', advance:'💵 Аванс', salary:'👷 Зарплата', bank:'🏦 Выписка', other:'📦 Прочее' };
const catClass  = { fuel:'cat-fuel', toll:'cat-toll', parking:'cat-parking', ferry:'cat-ferry', advance:'cat-advance', salary:'cat-salary', bank:'cat-bank', other:'cat-other' };

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function fmt(n) { return Number(n || 0).toLocaleString('ru', { maximumFractionDigits: 1 }); }

function renderTripsList() {
  const el = document.getElementById('tripsList');
  if (!trips.length) { el.innerHTML = '<p style="color:#8fa8ab;font-size:.8rem">Нет рейсов. Создайте первый!</p>'; return; }
  el.innerHTML = trips.map(t => `
    <div class="trip-card ${currentTrip?.id === t.id ? 'active' : ''}" data-id="${t.id}">
      <div class="trip-header">
        <div>
          <div class="trip-truck">🚛 ${esc(t.truck)}</div>
          <div class="trip-route">${esc(t.route_from)} → ${esc(t.route_to)}${(t._segments||[]).map(s => s.route_to ? ' → '+esc(s.route_to) : '').join('')}</div>
          <div class="trip-dates">${t.date_start || ''} — ${t.date_end || ''}</div>
        </div>
        <div style="text-align:right">
          <span class="badge ${t.status === 'closed' ? 'badge-closed' : 'badge-open'}">${t.status === 'closed' ? '✓ Закрыт' : '● Открыт'}</span>
          ${t.total_expenses_amd ? `<div style="margin-top:4px;font-size:.72rem;color:#55B7BD;font-weight:700">֏${fmt(t.total_expenses_amd)}</div>` : ''}
        </div>
      </div>
    </div>`).join('');

  document.querySelectorAll('.trip-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      openTrip(trips.find(t => t.id === id));
    });
  });
}

async function openTrip(trip) {
  currentTrip = trip;
  renderTripsList();

  // Загружаем полные данные с расходами
  const full = await api('/api/trips/' + trip.id);
  currentTrip = full;

  // Загружаем промежуточные сегменты
  try {
    tripSegments = await api('/api/trips/' + trip.id + '/segments') || [];
  } catch(_) { tripSegments = []; }

  document.getElementById('tripDetail').style.display = 'block';
  const segRoute = tripSegments.length
    ? ' → ' + tripSegments.map(s => s.route_to).filter(Boolean).join(' → ')
    : '';
  document.getElementById('detailTitle').textContent = `🚛 ${full.truck}: ${full.route_from} → ${full.route_to}${segRoute}`;

  renderTripStats(full);
  renderExpenses(full.expenses || []);

  // Обновляем контекст для AI
  aiTripContext = {
    truck: full.truck,
    route: `${full.route_from} → ${full.route_to}`,
    dates: `${full.date_start} — ${full.date_end}`,
    fuel_start: full.fuel_start_liters,
    fuel_rate_plan: full.fuel_rate_plan,
    wialon_mileage: full.wialon_mileage,
    wialon_fuel_used: full.wialon_fuel_used,
    wialon_fuel_rate: full.wialon_fuel_rate,
    expenses: (full.expenses || []).map(e => ({ cat: e.category, amount: e.amount, currency: e.currency, desc: e.description, receipt_key: e.receipt_key })),
    total_expenses_amd: (full.expenses || []).reduce((s, e) => s + (e.amount_amd || 0), 0),
  };
}

function renderTripStats(trip) {
  const expenses = trip.expenses || [];
  const totalAMD = expenses.reduce((s, e) => s + (e.amount_amd || 0), 0);
  // Курсы из глобального объекта или дефолт
  const EUR_RATE = window._eurRate || 418;
  const USD_RATE = window._usdRate || 367;
  const getRate = cur => cur === 'AMD' ? 1 : cur === 'EUR' ? EUR_RATE : cur === 'USD' ? USD_RATE : EUR_RATE;

  const fuelExpAMD    = expenses.filter(e=>e.category==='fuel').reduce((s,e)=>s+(e.amount_amd||0),0);
  const tollExpAMD    = expenses.filter(e=>e.category==='toll').reduce((s,e)=>s+(e.amount_amd||0),0);
  const parkingExpAMD = expenses.filter(e=>e.category==='parking').reduce((s,e)=>s+(e.amount_amd||0),0);
  const ferryExpAMD   = expenses.filter(e=>e.category==='ferry').reduce((s,e)=>s+(e.amount_amd||0),0);
  const otherExpAMD   = expenses.filter(e=>!['advance','salary','fuel','toll','parking','ferry'].includes(e.category)).reduce((s,e)=>s+(e.amount_amd||0),0);

  const fuelCostAMD = (trip.fuel_cost || 0) * getRate(trip.fuel_cost_currency || 'EUR');
  const advanceAMD = (trip.advance_amount || 0) * getRate(trip.advance_currency || 'AMD');
  const salaryAMD  = (trip.salary_amount  || 0) * getRate(trip.salary_currency  || 'AMD');
  const revenue1AMD = trip.client_price_amd || ((trip.client_price || 0) * getRate(trip.client_currency || 'EUR'));
  const segmentsRevenueAMD = (tripSegments||[]).reduce((s,sg) => s + (sg.client_price_amd||((sg.client_price||0)*getRate(sg.client_currency||'EUR'))), 0);
  const revenueAMD = revenue1AMD + segmentsRevenueAMD;
  const expensesOnlyAMD = fuelExpAMD + tollExpAMD + parkingExpAMD + ferryExpAMD + otherExpAMD;
  const allCostsAMD = expensesOnlyAMD + advanceAMD + salaryAMD + fuelCostAMD;
  const profitAMD  = revenueAMD - allCostsAMD;
  const planFuel = trip.wialon_mileage > 0 ? (trip.wialon_mileage * trip.fuel_rate_plan / 100) : 0;
  const diffFuel = trip.wialon_fuel_used > 0 ? (trip.wialon_fuel_used - planFuel) : 0;
  document.getElementById('tripStats').innerHTML = `
    <div class="stat"><div class="val">${fmt(trip.wialon_mileage)}<span style="font-size:.6rem"> км</span></div><div class="lbl">Пробег GPS</div></div>
    <div class="stat ${trip.wialon_fuel_rate > trip.fuel_rate_plan ? 'red' : 'green'}">
      <div class="val">${fmt(trip.wialon_fuel_rate)}<span style="font-size:.6rem"> л/100</span></div><div class="lbl">Расход факт</div></div>
    <div class="stat ${diffFuel > 5 ? 'red' : 'green'}">
      <div class="val">${diffFuel > 0 ? '+' : ''}${fmt(diffFuel)}<span style="font-size:.6rem"> л</span></div><div class="lbl">Перерасход</div></div>
    <div class="stat green"><div class="val">${trip.client_currency==='AMD'?'֏':'€'}${fmt(trip.client_price)}${(tripSegments||[]).length>0?' + '+(tripSegments.map(sg=>(sg.client_currency==='AMD'?'֏':'€')+fmt(sg.client_price)).join(' + ')):''}</div><div class="lbl">💰 Доход (все плечи)</div></div>
    <div class="stat orange"><div class="val">${trip.advance_currency==='AMD'?'֏':'€'}${fmt(trip.advance_amount)}</div><div class="lbl">💵 Аванс</div></div>
    <div class="stat orange"><div class="val">${trip.salary_currency==='AMD'?'֏':'€'}${fmt(trip.salary_amount)}</div><div class="lbl">👷 Зарплата</div></div>
    ${fuelExpAMD>0?`<div class="stat yellow"><div class="val">֏${fmt(fuelExpAMD)}</div><div class="lbl">⛽ Топливо</div></div>`:''}
    ${tollExpAMD>0?`<div class="stat yellow"><div class="val">֏${fmt(tollExpAMD)}</div><div class="lbl">🛣 Платные дороги</div></div>`:''}
    ${parkingExpAMD>0?`<div class="stat yellow"><div class="val">֏${fmt(parkingExpAMD)}</div><div class="lbl">🅿️ Стоянка</div></div>`:''}
    ${ferryExpAMD>0?`<div class="stat yellow"><div class="val">֏${fmt(ferryExpAMD)}</div><div class="lbl">🚢 Паром</div></div>`:''}
    ${otherExpAMD>0?`<div class="stat yellow"><div class="val">֏${fmt(otherExpAMD)}</div><div class="lbl">📦 Прочие расходы</div></div>`:''}
    <div class="stat ${profitAMD >= 0 ? 'green' : 'red'}"><div class="val">֏${fmt(profitAMD)}</div><div class="lbl">${profitAMD >= 0 ? '✅ Прибыль' : '❌ Убыток'}</div></div>
    <div class="stat"><div class="val">${expenses.length}</div><div class="lbl">Документов</div></div>`;

  // Wialon блок
  if (trip.wialon_mileage > 0) {
    const fillings = trip.wialon_fillings ? JSON.parse(trip.wialon_fillings) : [];
    const fuelPct = Math.min(100, (trip.wialon_fuel_used / (trip.fuel_start_liters || 400)) * 100);
    document.getElementById('wialonBlock').style.display = 'block';
    document.getElementById('wialonData').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.6rem">
        <div class="stat"><div class="val">${fmt(trip.wialon_fuel_used)}<span style="font-size:.6rem"> л</span></div><div class="lbl">Потрачено</div></div>
        <div class="stat"><div class="val">${fillings.length}</div><div class="lbl">Заправок</div></div>
        <div class="stat"><div class="val">${fmt(fillings.reduce((s,f)=>s+f.filled,0))}<span style="font-size:.6rem"> л</span></div><div class="lbl">Заправлено</div></div>
      </div>
      <div style="font-size:.72rem;color:#8fa8ab;margin-bottom:.3rem">Расход топлива:</div>
      <div class="fuel-bar"><div class="fuel-bar-fill" style="width:${fuelPct}%;background:${fuelPct>80?'#ef4444':'#55B7BD'}"></div></div>
      ${fillings.length ? `<div style="margin-top:.6rem;font-size:.72rem;color:#8fa8ab">Заправки:</div>
        ${fillings.map(f=>`<div style="font-size:.75rem;padding:.3rem 0;border-bottom:1px solid #1a3a42;display:flex;justify-content:space-between">
          <span>${f.time || ''} ${f.location ? '· ' + f.location.substring(0,30) : ''}</span>
          <span style="color:#55B7BD;font-weight:700">+${fmt(f.filled)} л</span>
        </div>`).join('')}` : ''}`;
  } else {
    document.getElementById('wialonBlock').style.display = 'none';
  }
}

function renderExpenses(expenses) {
  const el = document.getElementById('expensesList');
  const totEl = document.getElementById('expensesTotals');
  if (!expenses.length) { el.innerHTML = '<p style="color:#8fa8ab;font-size:.75rem">Нет расходов</p>'; totEl.innerHTML = ''; return; }

  el.innerHTML = expenses.map(e => `
    <div class="expense-row" data-id="${e.id}">
      <span class="expense-cat ${catClass[e.category]}">${catLabel[e.category]}</span>
      <span class="expense-desc">${esc(e.description || '')}</span>
      <span class="expense-date">${e.date || ''}</span>
      <span class="expense-amt">${e.currency === 'EUR' ? '€' : '֏'}${fmt(e.amount)}</span>
      ${e.receipt_key ? `<img class="receipt-thumb" src="${WORKER}/api/receipt/${e.receipt_key.replace('receipts/','')}" alt="чек" onclick="window.open(this.src)">` : '<div style="width:32px"></div>'}
      <button class="btn btn-danger btn-sm" onclick="deleteExpense(${e.id})">✕</button>
    </div>`).join('');

  // Итоги по категориям
  const bycat = {};
  let totalAMD = 0;
  expenses.forEach(e => {
    bycat[e.category] = (bycat[e.category] || 0) + (e.amount_amd || 0);
    totalAMD += (e.amount_amd || 0);
  });
  totEl.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center">
    ${Object.entries(bycat).map(([cat,amt]) => `<span style="font-size:.72rem;color:#8fa8ab">${catLabel[cat]}: <b style="color:#c8dfe3">֏${fmt(amt)}</b></span>`).join('<span style="color:#2a4a50">·</span>')}
    <span style="margin-left:auto;font-weight:800;color:#55B7BD">Итого: ֏${fmt(totalAMD)}</span>
  </div>`;
}

// ── Actions ──────────────────────────────────────────────────────────────────
let editingTripId = null;

function openTripModal(trip = null) {
  editingTripId = trip?.id || null;
  document.getElementById('tripModalTitle').textContent = trip ? 'Редактировать рейс' : 'Новый рейс';
  document.getElementById('fTruck').value = trip?.truck || '284 HT 61';
  document.getElementById('fCargoId').value = trip?.cargo_id || '';
  document.getElementById('fFrom').value = trip?.route_from || '';
  document.getElementById('fTo').value = trip?.route_to || '';
  document.getElementById('fDateStart').value = trip?.date_start || '';
  document.getElementById('fDateEnd').value = trip?.date_end || '';
  document.getElementById('fClientPrice').value = trip?.client_price || '';
  document.getElementById('fClientCurrency').value = trip?.client_currency || 'EUR';
  // Загружаем промежуточные сегменты
  currentTripId = trip?.id || null;
  tripSegments = [];
  resetSegForms();
  if (trip?.id) loadTripSegments(trip.id);
  document.getElementById('fFuelStart').value = trip?.fuel_start_liters || '';
  document.getElementById('fFuelRate').value = trip?.fuel_rate_plan || 30;
  document.getElementById('fFuelCost').value = trip?.fuel_cost || '';
  document.getElementById('fFuelCostCur').value = trip?.fuel_cost_currency || 'EUR';
  document.getElementById('fAdvance').value = trip?.advance_amount || '';
  document.getElementById('fAdvanceCur').value = trip?.advance_currency || 'AMD';
  document.getElementById('fSalary').value = trip?.salary_amount || '';
  document.getElementById('fSalaryCur').value = trip?.salary_currency || 'AMD';
  document.getElementById('fNotes').value = trip?.notes || '';
  document.getElementById('tripModal').classList.add('open');
}

async function saveTrip() {
  const truckSel = document.getElementById('fTruck');
  const truck = truckSel.value;
  const wialon_unit_id = WIALON_UNITS[truck];
  const body = {
    client_price: parseFloat(document.getElementById('fClientPrice').value) || 0,
    client_currency: document.getElementById('fClientCurrency').value,
    is_roundtrip: 0,
    route2_from: '', route2_to: '',
    client2_price: 0, client2_currency: 'EUR',
    truck, wialon_unit_id,
    cargo_id: document.getElementById('fCargoId').value || null,
    route_from: document.getElementById('fFrom').value,
    route_to: document.getElementById('fTo').value,
    date_start: document.getElementById('fDateStart').value,
    date_end: document.getElementById('fDateEnd').value,
    fuel_start_liters: parseFloat(document.getElementById('fFuelStart').value) || 0,
    fuel_rate_plan: parseFloat(document.getElementById('fFuelRate').value) || 30,
    notes: document.getElementById('fNotes').value,
    status: 'open',
    fuel_cost: parseFloat(document.getElementById('fFuelCost').value) || 0,
    fuel_cost_currency: document.getElementById('fFuelCostCur').value,
    advance_amount: parseFloat(document.getElementById('fAdvance').value) || 0,
    advance_currency: document.getElementById('fAdvanceCur').value,
    salary_amount: parseFloat(document.getElementById('fSalary').value) || 0,
    salary_currency: document.getElementById('fSalaryCur').value,
  };
  if (editingTripId) {
    const existing = trips.find(t => t.id === editingTripId);
    await api('/api/trips/' + editingTripId, 'PUT', { ...existing, ...body });
    await saveTripSegments(editingTripId);
  } else {
    const result = await api('/api/trips', 'POST', body);
    if (result?.id) { currentTripId = result.id; await saveTripSegments(result.id); }
  }
  document.getElementById('tripModal').classList.remove('open');
  await loadTrips();
}

async function deleteTrip() {
  if (!currentTrip || !confirm('Удалить рейс и все расходы?')) return;
  await api('/api/trips/' + currentTrip.id, 'DELETE');
  currentTrip = null;
  document.getElementById('tripDetail').style.display = 'none';
  await loadTrips();
}

async function syncWialon() {
  if (!currentTrip) return;
  const btn = document.getElementById('wialonSyncBtn');
  btn.textContent = '⏳ Загрузка...'; btn.disabled = true;
  try {
    const data = await api('/api/trips/' + currentTrip.id + '/wialon-sync', 'POST');
    if (data.error) { alert('Ошибка Wialon: ' + data.error); return; }
    await openTrip({ id: currentTrip.id });
    await loadTrips();
    alert(`✅ Данные Wialon загружены!\nПробег: ${fmt(data.mileage)} км\nРасход: ${fmt(data.fuelUsed)} л\nЗаправок: ${data.fillings?.length || 0}`);
  } catch (e) {
    alert('Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🛰 Wialon'; btn.disabled = false;
  }
}

async function addExpense() {
  if (!currentTrip) return;
  const receiptDZ = document.getElementById('eReceiptDropzone');
  const receiptFiles = receiptDZ?.getFiles?.() || [];
  const receiptFile = receiptFiles[0] || null;
  let receipt_key = null;

  // Загружаем чек если есть
  if (receiptFile) {
    const uploadR = await fetch(WORKER + '/api/trips/upload-receipt', {
      method: 'POST',
      headers: { 'Content-Type': receiptFile.type || 'image/jpeg' },
      body: receiptFile,
    });
    const uploadD = await uploadR.json();
    receipt_key = uploadD.key;
  }

  await api('/api/trips/' + currentTrip.id + '/expenses', 'POST', {
    category: document.getElementById('eCat').value,
    amount: parseFloat(document.getElementById('eAmount').value) || 0,
    currency: document.getElementById('eCurrency').value,
    date: document.getElementById('eDate').value,
    description: document.getElementById('eDesc').value,
    receipt_key,
  });

  document.getElementById('expenseModal').classList.remove('open');
  document.getElementById('eAmount').value = '';
  document.getElementById('eDesc').value = '';
  document.getElementById('eReceiptDropzone')?.reset?.();
  await openTrip({ id: currentTrip.id });
  await loadTrips();
}

async function deleteExpense(id) {
  if (!confirm('Удалить расход?')) return;
  await api('/api/trips/expenses/' + id, 'DELETE');
  await openTrip({ id: currentTrip.id });
  await loadTrips();
}

// ── AI Chat ──────────────────────────────────────────────────────────────────
async function sendAI() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const aiBody = document.getElementById('aiBody');

  if (!aiTripContext) {
    aiBody.innerHTML += `<div class="ai-msg assistant" style="color:#ef4444">⚠️ Сначала выберите рейс слева!</div>`;
    aiBody.scrollTop = aiBody.scrollHeight;
    return;
  }

  const hasBankDocs = aiTripContext.expenses?.some(e => e.cat === 'bank' && e.receipt_key);

  const body = document.getElementById('aiBody');

  // Добавляем сообщение пользователя
  aiMessages.push({ role: 'user', content: text });
  aiBody.innerHTML += `<div class="ai-msg user">${esc(text)}</div>`;

  const loadId = 'ai-load-' + Date.now();
  aiBody.innerHTML += `<div class="ai-msg loading" id="${loadId}">...</div>`;
  aiBody.scrollTop = aiBody.scrollHeight;

  try {
    const r = await api('/api/trips/ai', 'POST', {
      messages: aiMessages.slice(-10),
      tripContext: aiTripContext,
    });

    document.getElementById(loadId)?.remove();
    const reply = r.content || r.error || 'Нет ответа';
    aiMessages.push({ role: 'assistant', content: reply });
    aiBody.innerHTML += `<div class="ai-msg assistant">${esc(reply)}</div>`;
  } catch (e) {
    document.getElementById(loadId)?.remove();
    aiBody.innerHTML += `<div class="ai-msg assistant" style="color:#ef4444">Ошибка: ${e.message}</div>`;
  }
  aiBody.scrollTop = aiBody.scrollHeight;
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function loadTrips() {
  trips = await api('/api/trips');
  // Загружаем сегменты для всех рейсов
  await Promise.all(trips.map(async t => {
    try {
      t._segments = await api('/api/trips/' + t.id + '/segments') || [];
    } catch(_) { t._segments = []; }
  }));
  renderTripsList();
}

async function loadCargo() {
  try {
    cargoList = await api('/api/cargo');
    const sel = document.getElementById('fCargoId');
    sel.innerHTML = '<option value="">— Без сделки —</option>' +
      cargoList.map(c => `<option value="${c.id}">${c.client_name || 'Сделка'} #${c.id}</option>`).join('');
  } catch {}
}

// Events
document.getElementById('uploadBankBtn').addEventListener('click', () => document.getElementById('bankFileInput').click());
document.getElementById('bankFileInput').addEventListener('change', async (e) => {
  if (!currentTrip || !e.target.files[0]) return;
  const file = e.target.files[0];
  const btn = document.getElementById('uploadBankBtn');
  btn.textContent = '⏳...'; btn.disabled = true;
  try {
    const uploadR = await fetch(WORKER + '/api/trips/upload-receipt', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/pdf' },
      body: file,
    });
    const uploadD = await uploadR.json();
    await api('/api/trips/' + currentTrip.id + '/expenses', 'POST', {
      category: 'bank',
      amount: 0,
      currency: 'AMD',
      date: new Date().toISOString().slice(0,10),
      description: 'Банковская выписка: ' + file.name,
      receipt_key: uploadD.key,
    });
    await openTrip({ id: currentTrip.id });
    e.target.value = '';
    alert('✅ Выписка загружена!');
  } catch(err) {
    alert('Ошибка: ' + err.message);
  } finally {
    btn.textContent = '🏦 Выписка'; btn.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.getElementById('newTripBtn').addEventListener('click', () => openTripModal());
document.getElementById('saveTripBtn').addEventListener('click', saveTrip);
document.getElementById('cancelTripModal').addEventListener('click', () => document.getElementById('tripModal').classList.remove('open'));
document.getElementById('editTripBtn').addEventListener('click', () => currentTrip && openTripModal(currentTrip));
document.getElementById('wialonSyncBtn').addEventListener('click', syncWialon);
document.getElementById('deleteTripBtn').addEventListener('click', deleteTrip);

// ── Распознавание скана чека через Claude ──────────────────────────────────
document.getElementById('btnScanReceipt')?.addEventListener('click', async () => {
  const scanDZ = document.getElementById('eScanDropzone');
  const file = scanDZ?.getFiles?.()[0] || document.getElementById('eScanFile')?.files?.[0];
  if (!file) { alert('Выберите файл'); return; }

  const btn = document.getElementById('btnScanReceipt');
  const status = document.getElementById('scanStatus');
  btn.disabled = true;
  btn.textContent = '⏳ Распознаю...';
  status.textContent = 'Claude читает документ...';
  status.style.color = '#55B7BD';

  try {
    // Конвертируем файл в base64
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    const mediaType = file.type || 'image/jpeg';
    const isPdf = file.type === 'application/pdf';

    // Запрос к Claude API
    const response = await fetch(WORKER + '/api/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            isPdf ? {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 }
            } : {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: `Это чек или счёт за расход. Извлеки данные и верни ТОЛЬКО JSON без markdown:
{
  "amount": число (только цифры, без валюты),
  "currency": "EUR" или "AMD" или "USD" или "GEL" или "TRY" или "RUB",
  "date": "YYYY-MM-DD",
  "category": "fuel" или "toll" или "parking" или "other",
  "description": "краткое описание на русском (название места, тип расхода)"
}
Категории: fuel=топливо/заправка, toll=платная дорога/toll, parking=парковка/стоянка, other=всё остальное.
Если не можешь определить поле — используй null.`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    // Проверяем ошибки от Claude
    if (data.type === 'error') {
      throw new Error(data.error?.message || 'Ошибка Claude API');
    }

    const text = data.content?.[0]?.text || '';
    if (!text) throw new Error('Claude не вернул ответ');

    // Парсим JSON из ответа — ищем {} в тексте
    let parsed;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON не найден');
      parsed = JSON.parse(match[0]);
    } catch(_) {
      // Если не JSON — пробуем извлечь данные из текста
      const amountMatch = text.match(/(\d+[.,]?\d*)\s*(EUR|AMD|USD|GEL|TRY|RUB)?/i);
      if (amountMatch) {
        parsed = {
          amount: parseFloat(amountMatch[1].replace(',','.')),
          currency: amountMatch[2] || 'AMD',
          date: null, category: 'other',
          description: text.slice(0, 100)
        };
      } else {
        throw new Error('Не удалось распознать документ');
      }
    }

    // Заполняем поля формы
    if (parsed.amount) document.getElementById('eAmount').value = parsed.amount;
    if (parsed.currency) document.getElementById('eCurrency').value = parsed.currency;
    if (parsed.date) document.getElementById('eDate').value = parsed.date;
    if (parsed.category) document.getElementById('eCat').value = parsed.category;
    if (parsed.description) document.getElementById('eDesc').value = parsed.description;

    // Копируем файл в dropzone чека
    const receiptDZ = document.getElementById('eReceiptDropzone');
    if (receiptDZ?.getFiles && !receiptDZ.getFiles().find(f => f.name === file.name)) {
      receiptDZ.getFiles().push(file);
      receiptDZ.querySelector('.dropzone-files').innerHTML += `
        <div class="dropzone-chip">🖼 ${file.name}</div>`;
    }

    status.textContent = '✅ Распознано! Проверьте и сохраните.';
    status.style.color = '#1a6b3c';

  } catch(e) {
    status.textContent = '❌ Ошибка: ' + e.message;
    status.style.color = '#C62828';
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Распознать';
  }
});

document.getElementById('addExpenseBtn').addEventListener('click', () => {
  document.getElementById('eDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('expenseModal').classList.add('open');
});
document.getElementById('cancelExpenseModal').addEventListener('click', () => document.getElementById('expenseModal').classList.remove('open'));
document.getElementById('saveExpenseBtn').addEventListener('click', addExpense);

// AI
document.getElementById('aiToggle').addEventListener('click', () => {
  aiOpen = !aiOpen;
  document.getElementById('aiBody').classList.toggle('hidden', !aiOpen);
  document.getElementById('aiInputRow').classList.toggle('hidden', !aiOpen);
  document.getElementById('aiToggleIcon').textContent = aiOpen ? '▼' : '▲';
});
document.getElementById('aiSendBtn').addEventListener('click', sendAI);
document.getElementById('aiInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI(); }
});

// ── Промежуточные плечи рейса (фиксированные: промежуточный + обратный) ────
let tripSegments = [];
let currentTripId = null;

// Переключатели блоков
// Переключение типа сегмента (промежуточный ↔ обратный)
window.toggleSegType = function() {
  const cur = parseInt(document.getElementById('fSeg1Type').value);
  const next = cur === 1 ? 2 : 1;
  document.getElementById('fSeg1Type').value = next;
  document.getElementById('seg1Label').textContent = next === 1 ? '🔀 Промежуточный рейс' : '🔄 Обратный рейс';
  document.getElementById('segTypeBtn').textContent = next === 1 ? '→ Сделать обратным' : '→ Сделать промежуточным';
  document.getElementById('seg1Block').style.backgroundColor = next === 2 ? '#F0F5FA' : '#F0F9F9';
};

window.closeSeg = async function(n) {
  document.getElementById('seg1Block').style.display = 'none';
  document.getElementById('toggleSeg1').textContent = '🔀 + Промежуточный / Обратный рейс';
  document.getElementById('fSeg1Type').value = '1';
  document.getElementById('seg1Label').textContent = '🔀 Промежуточный рейс';
  ['Client','Price','From','To'].forEach(f => { const el=document.getElementById(`fSeg1${f}`); if(el) el.value=''; });
  // Удаляем все сегменты из БД
  for (const seg of tripSegments) {
    await api('/api/trips/segments/' + seg.id, 'DELETE').catch(()=>{});
  }
  tripSegments = [];
  if (currentTrip) {
    document.getElementById('detailTitle').textContent = `🚛 ${currentTrip.truck}: ${currentTrip.route_from} → ${currentTrip.route_to}`;
  }
};

document.getElementById('toggleSeg1')?.addEventListener('click', () => {
  const b = document.getElementById('seg1Block');
  const isOpen = b.style.display !== 'none';
  b.style.display = isOpen ? 'none' : 'block';
  document.getElementById('toggleSeg1').textContent = isOpen ? '🔀 + Промежуточный / Обратный рейс' : '🔀 − Промежуточный / Обратный рейс';
  if (isOpen) { ['Client','Price','From','To'].forEach(f => { const el=document.getElementById(`fSeg1${f}`); if(el) el.value=''; }); }
});

function getSegFromForm(n) {
  const price = parseFloat(document.getElementById('fSeg1Price').value) || 0;
  const from  = document.getElementById('fSeg1From').value.trim();
  const to    = document.getElementById('fSeg1To').value.trim();
  const client= document.getElementById('fSeg1Client').value.trim();
  const cur   = document.getElementById('fSeg1Currency').value;
  const open  = document.getElementById('seg1Block').style.display !== 'none';
  const segNum = parseInt(document.getElementById('fSeg1Type')?.value || '1');
  if (!open || (!price && !from && !to && !client)) return null;
  return { segment_num: segNum, route_from: from, route_to: to, client_name: client, client_price: price, client_currency: cur };
}

function fillSegForm(n, seg) {
  if (!seg) return;
  const segNum = seg.segment_num || 1;
  document.getElementById('seg1Block').style.display = 'block';
  document.getElementById('toggleSeg1').textContent = '🔀 − Промежуточный / Обратный рейс';
  document.getElementById('fSeg1Type').value = segNum;
  document.getElementById('seg1Label').textContent = segNum === 2 ? '🔄 Обратный рейс' : '🔀 Промежуточный рейс';
  document.getElementById('segTypeBtn').textContent = segNum === 2 ? '→ Сделать промежуточным' : '→ Сделать обратным';
  document.getElementById('seg1Client').value   = seg.client_name || '';
  document.getElementById('fSeg1Price').value    = seg.client_price || '';
  document.getElementById('fSeg1Currency').value = seg.client_currency || 'EUR';
  document.getElementById('fSeg1From').value     = seg.route_from || '';
  document.getElementById('fSeg1To').value       = seg.route_to || '';
}

function resetSegForms() {
  document.getElementById('seg1Block').style.display = 'none';
  document.getElementById('toggleSeg1').textContent = '🔀 + Промежуточный / Обратный рейс';
  document.getElementById('fSeg1Type').value = '1';
  document.getElementById('seg1Label').textContent = '🔀 Промежуточный рейс';
  ['Client','Price','From','To'].forEach(f => { const el=document.getElementById(`fSeg1${f}`); if(el) el.value=''; });
}

async function loadTripSegments(tripId) {
  try {
    const segs = await api('/api/trips/' + tripId + '/segments') || [];
    tripSegments = segs;
    resetSegForms();
    segs.forEach(s => fillSegForm(s.segment_num <= 1 ? 1 : 2, s));
  } catch(_) { tripSegments = []; }
}

async function saveTripSegments(tripId) {
  // Удаляем старые сегменты
  for (const s of tripSegments) {
    await api('/api/trips/segments/' + s.id, 'DELETE').catch(()=>{});
  }
  tripSegments = [];
  // Сохраняем один сегмент
  const seg = getSegFromForm(1);
  if (seg) await api('/api/trips/' + tripId + '/segments', 'POST', seg);
}

// Загружаем курсы валют
fetch(WORKER + '/api/rates').then(r=>r.json()).then(d=>{
  window._eurRate = d.EUR || 418;
  window._usdRate = d.AMD || 367;
}).catch(()=>{ window._eurRate = 418; window._usdRate = 367; });

// Wialon логин в фоне
wialonLogin().then(ok => console.log('Wialon:', ok ? 'connected' : 'failed'));

// Загрузка данных
Promise.all([loadTrips(), loadCargo()]);
