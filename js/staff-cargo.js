const API_URL = 'https://gl-api.gltransam.workers.dev';
const ADMIN_USER = 'TigranMetspagyan';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 часов — считаем сессию истёкшей после этого

const user = localStorage.getItem('gl_staff_user');
const loginTime = parseInt(localStorage.getItem('gl_staff_login_time') || '0', 10);
const sessionValid = !!user && !!loginTime && (Date.now() - loginTime) <= SESSION_MAX_AGE_MS;
const isAdmin = user === ADMIN_USER;

if (!sessionValid) {
  // Раньше здесь просто заменялся document.body.innerHTML, но скрипт продолжал
  // выполняться дальше и падал с ошибкой на следующей же строке (обращение
  // к элементам, которых уже нет). Плюс сессия не истекала никогда.
  // Теперь: чистим localStorage, показываем сообщение и НЕ запускаем остальной код.
  localStorage.removeItem('gl_staff_user');
  localStorage.removeItem('gl_staff_login_time');
  localStorage.removeItem('gl_staff_token');
  document.body.innerHTML = '<div style="text-align:center;padding:100px;">Сессия истекла или вы не вошли. Пожалуйста, <a href="staff.html">войдите</a></div>';
} else {
  init();
}

function doLogout() {
  localStorage.removeItem('gl_staff_user');
  localStorage.removeItem('gl_staff_login_time');
  localStorage.removeItem('gl_staff_token');
  window.location.href = 'staff.html';
}

async function api(path, method='GET', body=null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  // Как только Worker начнёт выдавать и проверять токены (см. worker-additions.js),
  // это заработает само — сейчас, если токена нет, просто не добавляем заголовок.
  const token = localStorage.getItem('gl_staff_token');
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_URL + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadCargo() { return api('/api/cargo'); }
async function addCargo(data) { return api('/api/cargo', 'POST', data); }
async function updateCargo(id, data) { return api('/api/cargo/' + id, 'PUT', data); }
async function removeCargo(id) { return api('/api/cargo/' + id, 'DELETE'); }
async function loadClients() { return api('/api/clients'); }
async function addClient(name) { return api('/api/clients', 'POST', { name }); }
async function loadCarriers() { return api('/api/carriers'); }
async function addCarrier(name) { return api('/api/carriers', 'POST', { name }); }

let allCargoData = [], clientsData = [], carriersData = [], exchangeRates = null;

async function fetchExchangeRates() {
  try {
    const res = await fetch(API_URL + '/api/rates');
    if (!res.ok) throw new Error('Ошибка получения курсов');
    const data = await res.json();
    exchangeRates = data;
    console.log('Курсы загружены с сервера:', exchangeRates);
  } catch (e) {
    console.warn('Не удалось загрузить курсы, резерв');
    exchangeRates = { USD: 1, AMD: 400, EUR: 440, RUB: 4.5, source: 'hardcoded' };
  }
}

function convertToUSD(amount, currency) {
  if (!exchangeRates || !amount) return 0;
  if (currency === 'USD') return amount;
  const rate = exchangeRates[currency];
  if (!rate) return 0;
  if (currency === 'AMD') return amount / exchangeRates.AMD;
  const amdEquivalent = amount * rate;
  return amdEquivalent / exchangeRates.AMD;
}

function usdToAMD(usd) { return usd * (exchangeRates?.AMD || 400); }
function currencySymbol(cur) { if (cur === 'EUR') return '€'; if (cur === 'AMD') return '֏'; return '$'; }

function calcCommission() {
  const cp = parseFloat(document.getElementById('fClientPrice').value) || 0;
  const crp = parseFloat(document.getElementById('fCarrierPrice').value) || 0;
  const ccur = document.getElementById('fClientCurrency').value;
  const rcur = document.getElementById('fCarrierCurrency').value;
  if (!exchangeRates) return;
  const clientUSD = convertToUSD(cp, ccur);
  const carrierUSD = convertToUSD(crp, rcur);
  const profitAMD = usdToAMD(clientUSD - carrierUSD);
  document.getElementById('fCommission').value = '֏ ' + Math.round(profitAMD).toLocaleString();
}

function populateDatalists() {
  document.getElementById('clientList').innerHTML = clientsData.map(c => `<option value="${esc(c.name)}">`).join('');
  document.getElementById('carrierList').innerHTML = carriersData.map(c => `<option value="${esc(c.name)}">`).join('');
}

/* ──────────────────────────────────────────────────────────
   ФИКС БАГА (уже был сделан ранее):
   toggleForm(show, reset) — сброс полей выполняется только
   когда reset === true, чтобы editCargo() могла показать форму
   с уже подставленными данными, не затирая их.
   ────────────────────────────────────────────────────────── */
function toggleForm(show = true, reset = true) {
  const form = document.getElementById('addForm');
  if (show) {
    form.style.display = 'block';
    if (reset) {
      document.getElementById('fLogist').value = user;
      document.getElementById('fClientCurrency').value = 'USD';
      document.getElementById('fCarrierCurrency').value = 'USD';
      document.getElementById('formTitle').textContent = 'Новая сделка';
      document.getElementById('editId').value = '';
      document.getElementById('paymentCheckboxes').style.display = isAdmin ? 'flex' : 'none';
      ['fClient','fCarrier','fProduct','fCityLoad','fCountryLoad','fCityUnload','fCountryUnload','fLoadDate','fUnloadDate','fClientPrice','fCarrierPrice','fCommission'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('fStatus').value = 'loading';
      document.getElementById('fClientPaid').checked = false;
      document.getElementById('fCarrierPaid').checked = false;
    }
  } else {
    form.style.display = 'none';
  }
}

async function togglePaid(cargoId, field) {
  if (!isAdmin) return;
  const cargo = allCargoData.find(c => c.id == cargoId);
  if (!cargo) return;
  const current = cargo[field] || false;
  await updateCargo(cargoId, { [field]: !current });
  await refreshData();
}

async function saveCargo() {
  const editId = document.getElementById('editId').value;
  const cn = f('fClient'), crn = f('fCarrier');
  if (!cn || !crn) return alert('Введите клиента и перевозчика');
  try {
    if (!clientsData.find(c => c.name === cn)) { await addClient(cn); clientsData = await loadClients(); }
    if (!carriersData.find(c => c.name === crn)) { await addCarrier(crn); carriersData = await loadCarriers(); }
    let logistToSave = f('fLogist') || user;
    if (editId && !isAdmin) { const orig = allCargoData.find(c => c.id == editId); if (orig) logistToSave = orig.logist; }
    const clientCur = document.getElementById('fClientCurrency').value;
    const carrierCur = document.getElementById('fCarrierCurrency').value;
    const clientPrice = parseFloat(f('fClientPrice')) || 0;
    const carrierPrice = parseFloat(f('fCarrierPrice')) || 0;
    const clientUSD = convertToUSD(clientPrice, clientCur);
    const carrierUSD = convertToUSD(carrierPrice, carrierCur);
    const commissionUSD = clientUSD - carrierUSD;
    const cargo = {
      product: f('fProduct'), city_load: f('fCityLoad'), country_load: f('fCountryLoad'),
      city_unload: f('fCityUnload'), country_unload: f('fCountryUnload'),
      load_date: f('fLoadDate'), unload_date: f('fUnloadDate'), status: f('fStatus'),
      client_price: clientPrice, carrier_price: carrierPrice,
      commission: commissionUSD.toFixed(2),
      logist: logistToSave, client_name: cn, carrier_name: crn,
      currency: 'MIX', client_currency: clientCur, carrier_currency: carrierCur,
      client_paid: isAdmin ? document.getElementById('fClientPaid').checked : false,
      carrier_paid: isAdmin ? document.getElementById('fCarrierPaid').checked : false
    };
    if (!cargo.product) return alert('Введите товар');
    if (editId) await updateCargo(editId, cargo);
    else await addCargo(cargo);
    await refreshData(); toggleForm(false);
  } catch (err) { alert('Ошибка сохранения: ' + err.message); }
}

function f(id) { return document.getElementById(id).value.trim(); }

async function editCargo(id) {
  const c = allCargoData.find(x => x.id == id);
  if (!c) return;
  if (!isAdmin && c.logist !== user) return alert('Нет доступа');
  populateDatalists();
  document.getElementById('editId').value = c.id;
  document.getElementById('fClient').value = c.client_name || '';
  document.getElementById('fCarrier').value = c.carrier_name || '';
  document.getElementById('fProduct').value = c.product || '';
  document.getElementById('fCityLoad').value = c.city_load || '';
  document.getElementById('fCountryLoad').value = c.country_load || '';
  document.getElementById('fCityUnload').value = c.city_unload || '';
  document.getElementById('fCountryUnload').value = c.country_unload || '';
  document.getElementById('fLoadDate').value = c.load_date || '';
  document.getElementById('fUnloadDate').value = c.unload_date || '';
  document.getElementById('fStatus').value = c.status || 'loading';
  document.getElementById('fClientPrice').value = c.client_price || '';
  document.getElementById('fCarrierPrice').value = c.carrier_price || '';
  document.getElementById('fClientCurrency').value = c.client_currency || c.currency || 'USD';
  document.getElementById('fCarrierCurrency').value = c.carrier_currency || c.currency || 'USD';
  calcCommission();
  document.getElementById('fLogist').value = c.logist || user;
  if (isAdmin) {
    document.getElementById('paymentCheckboxes').style.display = 'flex';
    document.getElementById('fClientPaid').checked = c.client_paid || false;
    document.getElementById('fCarrierPaid').checked = c.carrier_paid || false;
  }
  document.getElementById('formTitle').textContent = 'Редактировать сделку';
  toggleForm(true, false);
}

async function deleteCargo(id) {
  if (!isAdmin) { const c = allCargoData.find(x => x.id == id); if (c && c.logist !== user) return alert('Нет доступа'); }
  if (confirm('Удалить?')) { await removeCargo(id); await refreshData(); }
}

function clearFilter() {
  document.getElementById('filterStart').value = '';
  document.getElementById('filterEnd').value = '';
  document.getElementById('filterLogist').value = 'all';
  document.getElementById('filterPayment').value = 'all';
  renderAll();
}

function setCurrentMonthFilter() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  document.getElementById('filterStart').value = formatDate(startOfMonth);
  document.getElementById('filterEnd').value = formatDate(endOfMonth);
}

async function refreshData() {
  try {
    allCargoData = await loadCargo();
    clientsData = await loadClients();
    carriersData = await loadCarriers();
    populateDatalists();
    if (!exchangeRates) await fetchExchangeRates();
    if (!document.getElementById('filterStart').value && !document.getElementById('filterEnd').value) {
      setCurrentMonthFilter();
    }
    renderAll();
  } catch (err) { document.getElementById('emptyMsg').textContent = 'Ошибка загрузки.'; }
}

function renderAll() {
  const start = document.getElementById('filterStart').value,
        end = document.getElementById('filterEnd').value,
        fl = document.getElementById('filterLogist').value,
        fp = document.getElementById('filterPayment').value;

  let list = isAdmin ? [...allCargoData] : allCargoData.filter(c => c.logist === user);
  if (start) list = list.filter(c => c.load_date >= start);
  if (end) list = list.filter(c => c.load_date <= end);
  if (isAdmin && fl !== 'all') list = list.filter(c => c.logist === fl);
  if (fp === 'client_pending') list = list.filter(c => !c.client_paid);
  if (fp === 'client_paid') list = list.filter(c => c.client_paid);
  if (fp === 'carrier_pending') list = list.filter(c => !c.carrier_paid);
  if (fp === 'carrier_paid') list = list.filter(c => c.carrier_paid);
  if (fp === 'gap') list = list.filter(c => c.carrier_paid && !c.client_paid);

  if (isAdmin) {
    const logists = [...new Set(allCargoData.map(c => c.logist).filter(Boolean))];
    document.getElementById('filterLogist').innerHTML = '<option value="all">Все</option>' + logists.map(l => `<option value="${l}" ${fl===l?'selected':''}>${l}</option>`).join('');
  }

  let totalProfitAMD = 0, waitingClientsAMD = 0, waitingCarriersAMD = 0, receivedAMD = 0, paidAMD = 0;
  list.forEach(c => {
    const clientCur = c.client_currency || c.currency || 'USD';
    const carrierCur = c.carrier_currency || c.currency || 'USD';
    const clientUSD = convertToUSD(parseFloat(c.client_price||0), clientCur);
    const carrierUSD = convertToUSD(parseFloat(c.carrier_price||0), carrierCur);
    const profitAMD = usdToAMD(clientUSD - carrierUSD);
    totalProfitAMD += profitAMD;
    if (!c.client_paid) waitingClientsAMD += usdToAMD(clientUSD);
    else receivedAMD += usdToAMD(clientUSD);
    if (!c.carrier_paid) waitingCarriersAMD += usdToAMD(carrierUSD);
    else paidAMD += usdToAMD(carrierUSD);
  });
  const cashGapAMD = paidAMD - receivedAMD;

  const statsHTML = `
    <div class="stat-card"><div class="num">${list.length}</div><div class="lbl">Сделок</div></div>
    <div class="stat-card stat-profit"><div class="num">֏${Math.round(totalProfitAMD).toLocaleString()}</div><div class="lbl">Прибыль AMD</div></div>
    ${isAdmin ? `
    <div class="stat-card stat-success"><div class="num">֏${Math.round(receivedAMD).toLocaleString()}</div><div class="lbl">✅ Получено</div></div>
    <div class="stat-card stat-warning"><div class="num">֏${Math.round(paidAMD).toLocaleString()}</div><div class="lbl">📤 Оплачено</div></div>
    <div class="stat-card ${cashGapAMD > 0 ? 'stat-danger' : 'stat-success'}"><div class="num">֏${Math.round(Math.abs(cashGapAMD)).toLocaleString()}</div><div class="lbl">${cashGapAMD > 0 ? '⚠️ Кассовый разрыв' : '💰 Свободные средства'}</div></div>
    <div class="stat-card stat-warning"><div class="num">֏${Math.round(waitingClientsAMD).toLocaleString()}</div><div class="lbl">🕐 Ждём от клиентов</div></div>
    <div class="stat-card stat-warning"><div class="num">֏${Math.round(waitingCarriersAMD).toLocaleString()}</div><div class="lbl">🕐 Должны перевозчикам</div></div>
    ` : ''}
  `;
  document.getElementById('statsRow').innerHTML = statsHTML;

  const sl = { loading:'На загрузке', onroad:'В пути', loaded:'Загружен', completed:'Завершён' };
  const sc = { loading:'status-loading', onroad:'status-onroad', loaded:'status-loaded', completed:'status-completed' };
  document.getElementById('emptyMsg').style.display = list.length ? 'none' : 'block';
  document.getElementById('tableBody').innerHTML = list.map((c, idx) => {
    const clientCur = c.client_currency || c.currency || 'USD';
    const carrierCur = c.carrier_currency || c.currency || 'USD';
    const clientUSD = convertToUSD(parseFloat(c.client_price||0), clientCur);
    const carrierUSD = convertToUSD(parseFloat(c.carrier_price||0), carrierCur);
    const profitAMD = usdToAMD(clientUSD - carrierUSD);
    const load = [c.city_load, c.country_load].filter(Boolean).join(', ') || '-';
    const unload = [c.city_unload, c.country_unload].filter(Boolean).join(', ') || '-';
    let paymentHTML = '';
    if (isAdmin) {
      paymentHTML = `<button class="btn-pay ${c.client_paid?'paid':''}" onclick="togglePaid(${c.id},'client_paid')">📥 ${c.client_paid?'✓':'✗'}</button>
                     <button class="btn-pay ${c.carrier_paid?'paid':''}" onclick="togglePaid(${c.id},'carrier_paid')">📤 ${c.carrier_paid?'✓':'✗'}</button>`;
    }
    return `<tr>
      <td>${idx+1}</td><td>${esc(c.client_name)}</td><td>${esc(c.carrier_name)}</td><td>${esc(c.product)}</td>
      <td>${load}</td><td>${unload}</td><td>${c.load_date||'-'}</td>
      <td><span class="status-badge ${sc[c.status]||''}">${sl[c.status]||c.status}</span></td>
      <td>${currencySymbol(clientCur)}${parseFloat(c.client_price||0).toLocaleString()}</td>
      <td>${currencySymbol(carrierCur)}${parseFloat(c.carrier_price||0).toLocaleString()}</td>
      <td class="profit-positive">֏${Math.round(profitAMD).toLocaleString()}</td>
      <td>${paymentHTML}</td>
      <td>${esc(c.logist)}</td>
      <td><button class="btn-edit" onclick="editCargo(${c.id})">✏️</button> ${isAdmin?`<button class="btn-del" onclick="deleteCargo(${c.id})">🗑️</button>`:''}</td>
    </tr>`;
  }).join('');
}

function esc(s) { return (s||'').replace(/</g,'&lt;'); }

function init() {
  document.getElementById('userInfo').textContent = '👤 ' + user;
  if (isAdmin) document.getElementById('adminBadge').style.display = 'inline-block';
  document.getElementById('navLinks').innerHTML = isAdmin
    ? '<a href="staff-dashboard.html">📊 Главная</a><a href="staff-cargo.html" class="active">📦 Сделки</a><a href="/rateconfirmation">📋 Заявки</a>'
    : '<a href="staff-cargo.html" class="active">📦 Сделки</a><a href="/rateconfirmation">📋 Заявки</a>';
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('newDealBtn').addEventListener('click', () => toggleForm());
  document.getElementById('cancelBtn').addEventListener('click', () => toggleForm(false));
  document.getElementById('saveBtn').addEventListener('click', saveCargo);
  document.getElementById('resetFilterBtn').addEventListener('click', clearFilter);
  document.getElementById('filterStart').addEventListener('change', renderAll);
  document.getElementById('filterEnd').addEventListener('change', renderAll);
  document.getElementById('filterLogist').addEventListener('change', renderAll);
  document.getElementById('filterPayment').addEventListener('change', renderAll);
  document.getElementById('fClientPrice').addEventListener('input', calcCommission);
  document.getElementById('fCarrierPrice').addEventListener('input', calcCommission);
  document.getElementById('fClientCurrency').addEventListener('change', calcCommission);
  document.getElementById('fCarrierCurrency').addEventListener('change', calcCommission);

  fetchExchangeRates().then(refreshData);
}
