let currentSegments = [];
const API_URL = 'https://gl-api.gltransam.workers.dev';
const ADMIN_USER = 'TigranMetspagyan';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const INACTIVITY_MS = 30 * 60 * 1000; // 30 минут неактивности → выход
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    alert('Сессия завершена из-за неактивности (30 мин).');
    doLogout();
  }, INACTIVITY_MS);
}
['click','keydown','mousemove','touchstart'].forEach(e =>
  document.addEventListener(e, resetInactivityTimer, { passive: true })
);
resetInactivityTimer();

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
      currentSegments = [];
      document.getElementById('segmentsList').innerHTML = '';
      document.getElementById('segmentsBlock').style.display = 'none';
      if (window.setCarrierType) window.setCarrierType('AM');
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
      carrier_paid: isAdmin ? document.getElementById('fCarrierPaid').checked : false,
      carrier_type: document.getElementById('fCarrierType').value || 'AM'
    };
    if (!cargo.product) return alert('Введите товар');
    let savedId = null;
    if (editId) {
      await updateCargo(editId, cargo);
      savedId = editId;
    } else {
      const newCargo = await addCargo(cargo);
      savedId = newCargo?.id || null;
    }
    if (savedId) {
      await (window.saveSegments||saveSegments)(savedId).catch(()=>{});
    }
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
  // Тип перевозчика
  if (window.setCarrierType) window.setCarrierType(c.carrier_type || 'AM');
  document.getElementById('formTitle').textContent = 'Редактировать сделку';
  toggleForm(true, false);
  // Загружаем сегменты
  currentSegments = [];
  document.getElementById('segmentsList').innerHTML = '';
  document.getElementById('segmentsBlock').style.display = 'none';
  if (window.loadSegments) window.loadSegments(c.id);
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
        fp = document.getElementById('filterPayment').value,
        search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  let list = isAdmin ? [...allCargoData] : allCargoData.filter(c => c.logist === user);
  if (start) list = list.filter(c => c.load_date >= start);
  if (end) list = list.filter(c => c.load_date <= end);
  if (isAdmin && fl !== 'all') list = list.filter(c => c.logist === fl);
  if (fp === 'client_pending') list = list.filter(c => !c.client_paid);
  if (fp === 'client_paid') list = list.filter(c => c.client_paid);
  if (fp === 'carrier_pending') list = list.filter(c => !c.carrier_paid);
  if (fp === 'carrier_paid') list = list.filter(c => c.carrier_paid);
  if (fp === 'gap') list = list.filter(c => c.carrier_paid && !c.client_paid);
  if (search) list = list.filter(c =>
    [c.client_name, c.carrier_name, c.product, c.logist, c.city_load, c.city_unload, c.country_load, c.country_unload]
      .some(v => v && v.toLowerCase().includes(search))
  );

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
    const carrierUSDwSeg = carrierUSD + (c.segments_carrier_usd||0);
    const profitAMD = usdToAMD(clientUSD - carrierUSDwSeg);
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
    const carrierUSD = convertToUSD(parseFloat(c.carrier_price||0), carrierCur) + (c.segments_carrier_usd||0);
    const profitAMD = usdToAMD(clientUSD - carrierUSD);
    const load = [c.city_load, c.country_load].filter(Boolean).join(', ') || '-';
    const unload = [c.city_unload, c.country_unload].filter(Boolean).join(', ') || '-';
    let paymentHTML = '';
    if (isAdmin) {
      paymentHTML = `<button class="btn-pay ${c.client_paid?'paid':''}" onclick="togglePaid(${c.id},'client_paid')">📥 ${c.client_paid?'✓':'✗'}</button>
                     <button class="btn-pay ${c.carrier_paid?'paid':''}" onclick="togglePaid(${c.id},'carrier_paid')">📤 ${c.carrier_paid?'✓':'✗'}</button>`;
    }
    return `<tr>
      <td data-label="#">${idx+1}</td><td data-label="Клиент">${esc(c.client_name)}</td><td data-label="Перевозчик">${esc(c.carrier_name)}</td><td data-label="Товар">${esc(c.product)}</td>
      <td data-label="Откуда">${load}</td><td data-label="Куда">${unload}</td><td data-label="Дата">${c.load_date||'-'}</td>
      <td data-label="Статус"><span class="status-badge ${sc[c.status]||''}">${sl[c.status]||c.status}</span></td>
      <td data-label="Клиент ₴">${currencySymbol(clientCur)}${parseFloat(c.client_price||0).toLocaleString()}</td>
      <td data-label="Перевозчик ₴">${currencySymbol(carrierCur)}${parseFloat(c.carrier_price||0).toLocaleString()}</td>
      <td data-label="Прибыль" class="profit-positive">֏${Math.round(profitAMD).toLocaleString()}</td>
      <td data-label="Оплата">${paymentHTML}</td>
      <td data-label="Логист">${esc(c.logist)}</td>
      <td><button class="btn-edit" onclick="editCargo(${c.id})">✏️</button> ${isAdmin?`<button class="btn-del" onclick="deleteCargo(${c.id})">🗑️</button>`:''}</td>
    </tr>`;
  }).join('');
}

function esc(s) { return (s||'').replace(/</g,'&lt;'); }

function init() {
  document.getElementById('userInfo').textContent = '👤 ' + user;
  if (isAdmin) document.getElementById('adminBadge').style.display = 'inline-block';
  const adminNav = '<a href="/staff-dashboard.html">📊 Главная</a><a href="/staff-cargo.html" class="active">📦 Сделки</a><a href="/rateconfirmation">📋 Заявки</a><a href="/invoice">🧾 Инвойс</a><a href="/trip-report">🚛 Рейсы</a><a href="/clients">👥 Клиенты</a><a href="/files">📁 Файлы</a><a href="/expenses.html">💼 Расходы</a>';
  const logistNav = '<a href="/staff-cargo.html" class="active">📦 Сделки</a><a href="/rateconfirmation">📋 Заявки</a><a href="/invoice">🧾 Инвойс</a><a href="/trip-report">🚛 Рейсы</a>';
  document.getElementById('navLinks').innerHTML = isAdmin ? adminNav : logistNav;
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('newDealBtn').addEventListener('click', () => toggleForm());
  document.getElementById('cancelBtn').addEventListener('click', () => toggleForm(false));

  // Переключатель типа перевозчика
  window.setCarrierType = function(type) {
    document.getElementById('fCarrierType').value = type;
    const btnAM = document.getElementById('btnCarrierAM');
    const btnFR = document.getElementById('btnCarrierFR');
    if (type === 'AM') {
      btnAM.style.background = '#55B7BD'; btnAM.style.color = '#fff'; btnAM.style.borderColor = '#55B7BD';
      btnFR.style.background = '#F5FAFA'; btnFR.style.color = '#5a7a80'; btnFR.style.borderColor = 'rgba(85,183,189,.3)';
    } else {
      btnFR.style.background = '#55B7BD'; btnFR.style.color = '#fff'; btnFR.style.borderColor = '#55B7BD';
      btnAM.style.background = '#F5FAFA'; btnAM.style.color = '#5a7a80'; btnAM.style.borderColor = 'rgba(85,183,189,.3)';
    }
  };
  document.getElementById('saveBtn').addEventListener('click', saveCargo);

  // ── Сегменты (доп перевозчики) ──
   // локальные сегменты в форме

  document.getElementById('toggleSegmentsBtn').addEventListener('click', () => {
    const block = document.getElementById('segmentsBlock');
    const isVisible = block.style.display !== 'none';
    block.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      const existing = document.querySelectorAll('.segment-row');
      if (existing.length === 0) addSegmentRow();
    }
  });

  document.getElementById('addSegmentBtn').addEventListener('click', addSegmentRow);

  function addSegmentRow(seg = {}) {
    const div = document.createElement('div');
    div.className = 'segment-row';
    div.style.cssText = 'background:#F5FAFA;border:1px solid rgba(85,183,189,.2);border-radius:10px;padding:8px;margin-bottom:6px;display:grid;grid-template-columns:1fr 1fr 80px 80px auto;gap:6px;align-items:center';
    div.innerHTML = `
      <input placeholder="Перевозчик" class="seg-carrier" value="${esc(seg.carrier_name||'')}" style="background:#fff;border:1.5px solid rgba(85,183,189,.2);border-radius:8px;padding:6px 10px;font-size:.8rem;outline:none">
      <div style="display:flex;gap:4px">
        <input placeholder="Маршрут от" class="seg-from" value="${esc(seg.city_from||'')}" style="background:#fff;border:1.5px solid rgba(85,183,189,.2);border-radius:8px;padding:6px 8px;font-size:.78rem;outline:none;flex:1">
        <input placeholder="до" class="seg-to" value="${esc(seg.city_to||'')}" style="background:#fff;border:1.5px solid rgba(85,183,189,.2);border-radius:8px;padding:6px 8px;font-size:.78rem;outline:none;flex:1">
      </div>
      <input type="number" placeholder="Цена" class="seg-price" value="${seg.carrier_price||''}" step="0.01" style="background:#fff;border:1.5px solid rgba(85,183,189,.2);border-radius:8px;padding:6px 8px;font-size:.8rem;outline:none">
      <select class="seg-cur" style="background:#fff;border:1.5px solid rgba(85,183,189,.2);border-radius:8px;padding:6px 6px;font-size:.78rem;outline:none">
        <option value="EUR" ${seg.carrier_currency==='EUR'?'selected':''}>EUR</option>
        <option value="AMD" ${seg.carrier_currency==='AMD'?'selected':''}>AMD</option>
        <option value="USD" ${seg.carrier_currency==='USD'?'selected':''}>USD</option>
      </select>
      <button onclick="this.closest('.segment-row').remove()" style="background:#FEF2F2;color:#C62828;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:.8rem">✕</button>`;
    div.dataset.segId = seg.id || '';
    document.getElementById('segmentsList').appendChild(div);
  }

  function getSegmentsFromForm() {
    return Array.from(document.querySelectorAll('.segment-row')).map(row => ({
      id: row.dataset.segId || null,
      carrier_name: row.querySelector('.seg-carrier').value,
      city_from: row.querySelector('.seg-from').value,
      city_to: row.querySelector('.seg-to').value,
      carrier_price: parseFloat(row.querySelector('.seg-price').value) || 0,
      carrier_currency: row.querySelector('.seg-cur').value,
    })).filter(s => s.carrier_name);
  }

  async function loadSegments(cargoId) {
    try {
      const segs = await api('/api/cargo/' + cargoId + '/segments');
      document.getElementById('segmentsList').innerHTML = '';
      currentSegments = segs;
      if (segs.length > 0) {
        document.getElementById('segmentsBlock').style.display = 'block';
        segs.forEach(s => addSegmentRow(s));
      } else {
        document.getElementById('segmentsBlock').style.display = 'none';
      }
    } catch(_) {}
  }

  async function saveSegments(cargoId) {
    const segs = getSegmentsFromForm();
    // Получаем актуальные сегменты с сервера
    const existing = await api('/api/cargo/' + cargoId + '/segments').catch(()=>[]);
    // Удаляем все существующие
    for (const s of (existing||[])) {
      await api('/api/cargo/segments/' + s.id, 'DELETE').catch(()=>{});
    }
    // Создаём новые только если есть данные
    for (const s of segs) {
      if (s.carrier_name) {
        await api('/api/cargo/' + cargoId + '/segments', 'POST', s);
      }
    }
    currentSegments = [];
  }
  window.saveSegments = saveSegments;
  window.addSegmentRow = addSegmentRow;
  window.loadSegments = loadSegments;
  window.getSegmentsFromForm = getSegmentsFromForm;
  document.getElementById('resetFilterBtn').addEventListener('click', clearFilter);
  document.getElementById('filterStart').addEventListener('change', renderAll);
  document.getElementById('filterEnd').addEventListener('change', renderAll);
  document.getElementById('filterLogist').addEventListener('change', renderAll);
  document.getElementById('filterPayment').addEventListener('change', renderAll);
  document.getElementById('searchInput')?.addEventListener('input', renderAll);
  document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
  document.getElementById('fClientPrice').addEventListener('input', calcCommission);
  document.getElementById('fCarrierPrice').addEventListener('input', calcCommission);
  document.getElementById('fClientCurrency').addEventListener('change', calcCommission);
  document.getElementById('fCarrierCurrency').addEventListener('change', calcCommission);

  fetchExchangeRates().then(refreshData);
}

// ── Экспорт в Excel по шаблону ────────────────────────────────────────────────
async function exportToExcel() {
  // Загружаем ExcelJS если не загружен
  if (!window.ExcelJS) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const startF = document.getElementById('filterStart').value;
  const endF   = document.getElementById('filterEnd').value;
  const fl     = document.getElementById('filterLogist').value;
  const fp     = document.getElementById('filterPayment').value;
  const srch   = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  let list = isAdmin ? [...allCargoData] : allCargoData.filter(c => c.logist === user);
  if (startF) list = list.filter(c => c.load_date >= startF);
  if (endF)   list = list.filter(c => c.load_date <= endF);
  if (isAdmin && fl !== 'all') list = list.filter(c => c.logist === fl);
  if (fp === 'client_pending')  list = list.filter(c => !c.client_paid);
  if (fp === 'client_paid')     list = list.filter(c =>  c.client_paid);
  if (fp === 'carrier_pending') list = list.filter(c => !c.carrier_paid);
  if (fp === 'carrier_paid')    list = list.filter(c =>  c.carrier_paid);
  if (fp === 'gap') list = list.filter(c => c.carrier_paid && !c.client_paid);
  if (srch) list = list.filter(c =>
    [c.client_name, c.carrier_name, c.product, c.logist].some(v => v && v.toLowerCase().includes(srch))
  );
  if (!list.length) { alert('Нет данных для экспорта'); return; }

  const rates = exchangeRates || { AMD: 367, EUR: 418, RUB: 4.73 };
  const gr = cur => cur === 'AMD' ? 1 : cur === 'EUR' ? rates.EUR : cur === 'RUB' ? rates.RUB : rates.AMD;
  const year = new Date().getFullYear();

  // Рейсы
  let trips = [];
  try {
    const tr = await api('/api/trips');
    trips = (tr||[]).filter(t => t.client_price > 0).map(t => ({
      date: t.date_start||'', price: t.client_price||0,
      currency: t.client_currency||'EUR', route: `${t.route_from||''} → ${t.route_to||''}`
    }));
  } catch(_) {}

  const getQ = d => {
    if (!d) return 1;
    try { const m = parseInt((d.includes('-')?d.split('-')[1]:d.split('.')[1])||'1'); return Math.ceil(m/3); }
    catch(_) { return 1; }
  };
  const qNames = {1:'I квартал',2:'II квартал',3:'III квартал',4:'IV квартал'};
  list.sort((a,b) => (a.load_date||'') > (b.load_date||'') ? 1 : -1);
  const qs = {1:[],2:[],3:[],4:[]};
  list.forEach(d => qs[getQ(d.load_date||d.unload_date)].push(d));
  const tqs = {1:[],2:[],3:[],4:[]};
  trips.forEach(t => tqs[getQ(t.date)].push(t));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(String(year));

  // Ширины колонок
  ws.columns = [
    {width:24},{width:11},{width:13},{width:8},{width:9},{width:13},
    {width:11},{width:13},{width:8},{width:9},{width:15},
    {width:16},{width:11},{width:11},{width:8},{width:8},{width:9},{width:13}
  ];

  // Стили
  const font = {name:'Sylfaen',size:11};
  const fontB = {name:'Sylfaen',size:11,bold:true};
  const fontRB = {name:'Sylfaen',size:11,bold:true,color:{argb:'FFFF0000'}};
  const fontH = {name:'Sylfaen',size:14,bold:true};
  const fontG = {name:'Sylfaen',size:11,color:{argb:'FF1E6B1E'}};

  const fillY = {type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFF00'}};
  const fillG = {type:'pattern',pattern:'solid',fgColor:{argb:'FFC6EFCE'}};

  const bdr = {
    top:{style:'thin'},bottom:{style:'thin'},
    left:{style:'thin'},right:{style:'thin'}
  };
  const bdrTB = {top:{style:'thin'},bottom:{style:'thin'}};

  const alC = {horizontal:'center',vertical:'middle',wrapText:true};
  const alL = {horizontal:'left',vertical:'middle'};
  const alR = {horizontal:'right',vertical:'middle'};

  const sc = (row, col, val, opts={}) => {
    const cell = ws.getCell(row, col);
    if (typeof val === 'string' && val.startsWith('=')) cell.value = {formula: val.slice(1)};
    else cell.value = val;
    if (opts.font)      cell.font      = opts.font;
    if (opts.fill)      cell.fill      = opts.fill;
    if (opts.border)    cell.border    = opts.border;
    if (opts.alignment) cell.alignment = opts.alignment;
    return cell;
  };

  const dc = (row, col, val, opts={}) => sc(row, col, val, {font, border:bdr, alignment:alL, ...opts});

  // Строка 1 — год
  ws.mergeCells(1,1,1,18);
  sc(1,1,`${year}թ. `,{font:fontH,alignment:alC,border:{bottom:{style:'thin'}}});

  // Строка 3 — группы
  ws.mergeCells(3,2,3,6);
  sc(3,2,'Купленная услуга',{font,border:bdr,alignment:alC});
  ws.mergeCells(3,7,3,11);
  sc(3,7,'Проданная услуга',{font,border:bdr,alignment:alC});
  ws.mergeCells(3,13,3,18);
  sc(3,13,'Нерезидент',{font,border:bdr,alignment:alC});

  // Строка 4 — заголовки
  const h4=['',  'Дата','Сумма','Валюта','Курс ЦБ','Итого AMD',
               'Дата','Сумма','Валюта','Курс ЦБ','Итого AMD',
               'Налоговая база AMD','Комиссия','Дата оплаты','5%','Валюта','Курс ЦБ','Сумма нерезидента'];
  h4.forEach((v,i) => { if(i>0) sc(4,i,v,{font:fontB,border:bdr,alignment:alC}); });

  let row = 5;

  [1,2,3,4].forEach(q => {
    const rq = qs[q]; const tq = tqs[q];
    if (!rq.length && !tq.length) return;

    // Заголовок квартала
    ws.mergeCells(row,1,row,18);
    sc(row,1,`${year}թ. ${qNames[q]}`,{font:fontB,border:bdrTB,alignment:alC});
    ws.getRow(row).height = 18;
    row++; const ds = row;

    rq.forEach(d => {
      const r = row;
      const kcur = d.carrier_currency||d.currency||'EUR';
      const ccur = d.client_currency||d.currency||'AMD';
      const kamt = parseFloat(d.carrier_price)||0;
      const camt = parseFloat(d.client_price)||0;
      const comm = (d.commission!=null&&d.commission!=='') ? parseFloat(d.commission) : null;

      dc(r,2,d.unload_date||'');
      dc(r,3,kamt,{alignment:alC});
      dc(r,4,kcur);
      dc(r,5,gr(kcur));
      dc(r,6,`=C${r}*E${r}`);
      dc(r,7,d.load_date||'');
      dc(r,8,camt,{alignment:alC});
      dc(r,9,ccur,{alignment:alC});
      dc(r,10,gr(ccur),{alignment:alR});
      dc(r,11,`=H${r}*J${r}`);
      dc(r,12,`=K${r}-F${r}`);
      sc(r,13,comm!==null?comm:'ՉԿԱ',{font:fontRB,fill:fillY,border:bdr,alignment:alC});
      dc(r,14,d.client_paid?(d.payment_date||''):'');
      if (comm!==null) {
        dc(r,15,`=M${r}*5/100`);
        dc(r,16,ccur);
      } else {
        dc(r,15,''); dc(r,16,'');
      }
      dc(r,17,'');
      dc(r,18,`=O${r}*Q${r}`);
      row++;
    });

    tq.forEach(t => {
      const r = row;
      const ccur = t.currency||'EUR';
      [2,3,4,5,6].forEach(c => sc(r,c,'-',{font:fontG,fill:fillG,border:bdr,alignment:alC}));
      sc(r,7,t.date||'',{font:fontG,fill:fillG,border:bdr,alignment:alL});
      sc(r,8,parseFloat(t.price)||0,{font:fontG,fill:fillG,border:bdr,alignment:alC});
      sc(r,9,ccur,{font:fontG,fill:fillG,border:bdr,alignment:alC});
      sc(r,10,gr(ccur),{font:fontG,fill:fillG,border:bdr,alignment:alR});
      sc(r,11,`=H${r}*J${r}`,{font:fontG,fill:fillG,border:bdr});
      sc(r,12,`=K${r}-F${r}`,{font:fontG,fill:fillG,border:bdr});
      sc(r,13,'ՉԿԱ',{font:fontRB,fill:fillY,border:bdr,alignment:alC});
      sc(r,14,t.route||'',{font:fontG,fill:fillG,border:bdr});
      [15,16,17,18].forEach(c => sc(r,c,'',{font:fontG,fill:fillG,border:bdr}));
      row++;
    });

    // Итого квартала
    ws.mergeCells(row,1,row,11);
    sc(row,1,`Ընдаmenea ${year}թ. ${qNames[q]}`,{font:fontB,border:bdrTB,alignment:alC});
    sc(row,12,`=SUM(L${ds}:L${row-1})`,{font:fontB,border:bdrTB,alignment:alC});
    row++;
  });

  // Скачиваем
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GL_${year}_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
