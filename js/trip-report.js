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
const catLabel = { fuel:'⛽ Топливо', toll:'🛣 Платная дорога', parking:'🅿️ Стоянка', advance:'💵 Аванс', salary:'👷 Зарплата', bank:'🏦 Выписка', other:'📦 Прочее' };
const catClass  = { fuel:'cat-fuel', toll:'cat-toll', parking:'cat-parking', advance:'cat-advance', salary:'cat-salary', bank:'cat-bank', other:'cat-other' };

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
          <div class="trip-route">${esc(t.route_from)} → ${esc(t.route_to)}</div>
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

  document.getElementById('tripDetail').style.display = 'block';
  document.getElementById('detailTitle').textContent = `🚛 ${trip.truck}: ${trip.route_from} → ${trip.route_to}`;

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
    expenses: (full.expenses || []).map(e => ({ cat: e.category, amount: e.amount, currency: e.currency, desc: e.description })),
    total_expenses_amd: (full.expenses || []).reduce((s, e) => s + (e.amount_amd || 0), 0),
  };
}

function renderTripStats(trip) {
  const expenses = trip.expenses || [];
  const totalAMD = expenses.reduce((s, e) => s + (e.amount_amd || 0), 0);
  const advanceAMD = expenses.filter(e=>e.category==='advance').reduce((s,e)=>s+(e.amount_amd||0),0);
  const salaryAMD  = expenses.filter(e=>e.category==='salary').reduce((s,e)=>s+(e.amount_amd||0),0);
  const planFuel = trip.wialon_mileage > 0 ? (trip.wialon_mileage * trip.fuel_rate_plan / 100) : 0;
  const diffFuel = trip.wialon_fuel_used > 0 ? (trip.wialon_fuel_used - planFuel) : 0;

  document.getElementById('tripStats').innerHTML = `
    <div class="stat"><div class="val">${fmt(trip.wialon_mileage)}<span style="font-size:.6rem"> км</span></div><div class="lbl">Пробег GPS</div></div>
    <div class="stat ${trip.wialon_fuel_rate > trip.fuel_rate_plan ? 'red' : 'green'}">
      <div class="val">${fmt(trip.wialon_fuel_rate)}<span style="font-size:.6rem"> л/100</span></div><div class="lbl">Расход факт</div></div>
    <div class="stat"><div class="val">${fmt(trip.fuel_rate_plan)}<span style="font-size:.6rem"> л/100</span></div><div class="lbl">Расход план</div></div>
    <div class="stat ${diffFuel > 5 ? 'red' : 'green'}">
      <div class="val">${diffFuel > 0 ? '+' : ''}${fmt(diffFuel)}<span style="font-size:.6rem"> л</span></div><div class="lbl">Перерасход</div></div>
    <div class="stat orange"><div class="val">֏${fmt(advanceAMD)}</div><div class="lbl">💵 Аванс</div></div>
    <div class="stat orange"><div class="val">֏${fmt(salaryAMD)}</div><div class="lbl">👷 Зарплата</div></div>
    <div class="stat yellow"><div class="val">֏${fmt(totalAMD)}</div><div class="lbl">Итого расходы</div></div>
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
  document.getElementById('fFuelStart').value = trip?.fuel_start_liters || '';
  document.getElementById('fFuelRate').value = trip?.fuel_rate_plan || 30;
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
    advance_amount: parseFloat(document.getElementById('fAdvance').value) || 0,
    advance_currency: document.getElementById('fAdvanceCur').value,
    salary_amount: parseFloat(document.getElementById('fSalary').value) || 0,
    salary_currency: document.getElementById('fSalaryCur').value,
  };
  if (editingTripId) {
    const existing = trips.find(t => t.id === editingTripId);
    await api('/api/trips/' + editingTripId, 'PUT', { ...existing, ...body });
  } else {
    await api('/api/trips', 'POST', body);
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
  btn.textContent = '⏳ Загрузка...';
  btn.disabled = true;
  try {
    const data = await fetchWialonData(currentTrip);
    if (!data) { alert('Не удалось получить данные из Wialon. Проверьте даты рейса.'); return; }
    await api('/api/trips/' + currentTrip.id, 'PUT', {
      ...currentTrip,
      wialon_mileage: data.mileage,
      wialon_fuel_used: data.fuelUsed,
      wialon_fuel_rate: data.fuelRate,
      wialon_fillings: JSON.stringify(data.fillings),
    });
    await openTrip({ id: currentTrip.id });
    await loadTrips();
    alert(`✅ Данные Wialon загружены!\nПробег: ${fmt(data.mileage)} км\nРасход: ${fmt(data.fuelUsed)} л`);
  } catch (e) {
    alert('Ошибка Wialon: ' + e.message);
  } finally {
    btn.textContent = '🛰 Wialon';
    btn.disabled = false;
  }
}

async function addExpense() {
  if (!currentTrip) return;
  const file = document.getElementById('eReceipt').files[0];
  let receipt_key = null;

  // Загружаем чек если есть
  if (file) {
    const uploadR = await fetch(WORKER + '/api/trips/upload-receipt', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: file,
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
  document.getElementById('eReceipt').value = '';
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

  const body = document.getElementById('aiBody');

  // Добавляем сообщение пользователя
  aiMessages.push({ role: 'user', content: text });
  body.innerHTML += `<div class="ai-msg user">${esc(text)}</div>`;

  // Индикатор загрузки
  const loadId = 'ai-load-' + Date.now();
  body.innerHTML += `<div class="ai-msg loading" id="${loadId}">...</div>`;
  body.scrollTop = body.scrollHeight;

  try {
    const r = await api('/api/trips/ai', 'POST', {
      messages: aiMessages.slice(-10), // последние 10 сообщений
      tripContext: aiTripContext,
    });

    document.getElementById(loadId)?.remove();
    const reply = r.content || r.error || 'Нет ответа';
    aiMessages.push({ role: 'assistant', content: reply });
    body.innerHTML += `<div class="ai-msg assistant">${esc(reply)}</div>`;
  } catch (e) {
    document.getElementById(loadId)?.remove();
    body.innerHTML += `<div class="ai-msg assistant" style="color:#ef4444">Ошибка: ${e.message}</div>`;
  }
  body.scrollTop = body.scrollHeight;
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function loadTrips() {
  trips = await api('/api/trips');
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

// Wialon логин в фоне
wialonLogin().then(ok => console.log('Wialon:', ok ? 'connected' : 'failed'));

// Загрузка данных
Promise.all([loadTrips(), loadCargo()]);
