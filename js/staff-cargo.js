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
    if (editId) await updateCargo(editId, cargo);
    else { const newCargo = await addCargo(cargo); if (newCargo?.id) await saveSegments(newCargo.id); }
    if (editId) await saveSegments(editId);
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
  loadSegments(c.id);
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
  document.getElementById('navLinks').innerHTML = isAdmin
    ? '<a href="staff-dashboard.html">📊 Главная</a><a href="staff-cargo.html" class="active">📦 Сделки</a><a href="/rateconfirmation">📋 Заявки</a>'
    : '<a href="staff-cargo.html" class="active">📦 Сделки</a><a href="/rateconfirmation">📋 Заявки</a>';
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
  let currentSegments = []; // локальные сегменты в форме

  document.getElementById('toggleSegmentsBtn').addEventListener('click', () => {
    const block = document.getElementById('segmentsBlock');
    const isVisible = block.style.display !== 'none';
    block.style.display = isVisible ? 'none' : 'block';
    if (!isVisible && currentSegments.length === 0) addSegmentRow();
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
    if (!segs.length) return;
    // Удаляем старые и создаём новые
    for (const s of currentSegments) {
      await api('/api/cargo/segments/' + s.id, 'DELETE').catch(()=>{});
    }
    for (const s of segs) {
      await api('/api/cargo/' + cargoId + '/segments', 'POST', s);
    }
  }
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
  if (!window.XLSX) { alert('SheetJS не загружен'); return; }

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

  // Рейсы собственного автопарка
  let trips = [];
  try {
    const tr = await api('/api/trips');
    trips = (tr || []).filter(t => t.client_price > 0).map(t => ({
      date: t.date_start || '', price: t.client_price || 0,
      currency: t.client_currency || 'EUR', route: `${t.route_from||''} → ${t.route_to||''}`
    }));
  } catch(_) {}

  // Группировка по кварталам
  const getQ = d => {
    if (!d) return 1;
    try { const m = parseInt((d.includes('-') ? d.split('-')[1] : d.split('.')[1]) || '1'); return Math.ceil(m/3); }
    catch(_) { return 1; }
  };
  const qNames = {1:'I квартал', 2:'II квартал', 3:'III квартал', 4:'IV квартал'};

  list.sort((a,b) => (a.load_date||'') > (b.load_date||'') ? 1 : -1);
  const qs = {1:[],2:[],3:[],4:[]};
  list.forEach(d => qs[getQ(d.load_date||d.unload_date)].push(d));
  const tqs = {1:[],2:[],3:[],4:[]};
  trips.forEach(t => tqs[getQ(t.date)].push(t));

  // Стили
  const bdr = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  const btm = { bottom:{style:'thin'} };
  const ttm = { top:{style:'thin'}, bottom:{style:'thin'} };
  const yellowFill = { fgColor:{rgb:'FFFF00'}, patternType:'solid' };
  const greenFill  = { fgColor:{rgb:'C6EFCE'}, patternType:'solid' };
  const grayFill   = { fgColor:{rgb:'D9D9D9'}, patternType:'solid' };

  const fBold   = { bold:true, sz:11 };
  const fNorm   = { sz:11 };
  const fRedB   = { bold:true, sz:11, color:{rgb:'FF0000'} };
  const fH      = { bold:true, sz:14 };
  const fGreen  = { sz:11, color:{rgb:'1E6B1E'} };

  const aC = { horizontal:'center', vertical:'center', wrapText:true };
  const aL = { horizontal:'left',   vertical:'center' };
  const aR = { horizontal:'right',  vertical:'center' };

  const ws = {};

  const sc = (addr, val, formula, font, fill, border, align) => {
    const cell = formula ? {f: formula, t:'n'} : {v: val, t: (typeof val === 'number' ? 'n' : 's')};
    cell.s = {};
    if (font)   cell.s.font   = font;
    if (fill)   cell.s.fill   = fill;
    if (border) cell.s.border = border;
    if (align)  cell.s.alignment = align;
    ws[addr] = cell;
  };

  const dc = (addr, val, formula, align, font, fill) =>
    sc(addr, val, formula, font||fNorm, fill, bdr, align||aL);

  // ── Строка 1: год ──
  sc('A1', `${year}թ. `, null, fH, null, btm, aC);

  // ── Строка 3: группы колонок ──
  sc('B3', 'Купленная услуга (перевозчик)', null, fNorm, null, bdr, aC);
  sc('G3', 'Проданная услуга (клиент)',     null, fNorm, null, bdr, aC);
  sc('M3', 'Нерезидент',                   null, fNorm, null, bdr, aC);

  // ── Строка 4: заголовки ──
  const h4 = {
    B:'Дата', C:'Сумма', D:'Валюта', E:'Курс ЦБ', F:'Итого AMD',
    G:'Дата', H:'Сумма', I:'Валюта', J:'Курс ЦБ', K:'Итого AMD',
    L:'Налоговая база AMD',
    M:'Комиссия', N:'Дата оплаты', O:'5%', P:'Валюта', Q:'Курс ЦБ', R:'Сумма нерезидента'
  };
  Object.entries(h4).forEach(([col,val]) => sc(`${col}4`, val, null, fBold, null, bdr, aC));

  let row = 5;

  [1,2,3,4].forEach(q => {
    const rq = qs[q]; const tq = tqs[q];
    if (!rq.length && !tq.length) return;

    // Заголовок квартала
    sc(`A${row}`, `${year}թ. ${qNames[q]}`, null, fBold, null, ttm, aC);
    row++; const ds = row;

    // Данные сделок
    rq.forEach(d => {
      const r = row;
      const kcur = d.carrier_currency || d.currency || 'EUR';
      const ccur = d.client_currency  || d.currency || 'AMD';
      const kamt = parseFloat(d.carrier_price)||0;
      const camt = parseFloat(d.client_price)||0;
      const comm = (d.commission!=null&&d.commission!=='') ? parseFloat(d.commission) : null;

      dc(`B${r}`, d.unload_date||'');
      dc(`C${r}`, kamt, null, aC);
      dc(`D${r}`, kcur);
      dc(`E${r}`, gr(kcur));
      dc(`F${r}`, null, `C${r}*E${r}`);
      dc(`G${r}`, d.load_date||'');
      dc(`H${r}`, camt, null, aC);
      dc(`I${r}`, ccur, null, aC);
      dc(`J${r}`, gr(ccur), null, aR);
      dc(`K${r}`, null, `H${r}*J${r}`);
      dc(`L${r}`, null, `K${r}-F${r}`);

      // M — комиссия, жёлтая, красный жирный
      sc(`M${r}`, comm!==null?comm:'ՉԿԱ', null, fRedB, yellowFill, bdr, aC);

      dc(`N${r}`, d.client_paid?(d.payment_date||''):'');
      if (comm!==null) {
        dc(`O${r}`, null, `M${r}*5/100`);
        dc(`P${r}`, ccur);
      } else {
        dc(`O${r}`, ''); dc(`P${r}`, '');
      }
      dc(`Q${r}`, '');
      dc(`R${r}`, null, `O${r}*Q${r}`);
      row++;
    });

    // Зелёные строки — собственные рейсы
    tq.forEach(t => {
      const r = row;
      const ccur = t.currency||'EUR';
      ['B','C','D','E','F'].forEach(col => sc(`${col}${r}`, '-', null, fGreen, greenFill, bdr, aC));
      sc(`G${r}`, t.date||'',        null, fGreen, greenFill, bdr, aL);
      sc(`H${r}`, t.price||0,        null, fGreen, greenFill, bdr, aC);
      sc(`I${r}`, ccur,              null, fGreen, greenFill, bdr, aC);
      sc(`J${r}`, gr(ccur),          null, fGreen, greenFill, bdr, aR);
      sc(`K${r}`, null, `H${r}*J${r}`,    fGreen, greenFill, bdr);
      sc(`L${r}`, null, `K${r}-F${r}`,    fGreen, greenFill, bdr);
      sc(`M${r}`, 'ՉԿԱ',            null, fRedB,  yellowFill, bdr, aC);
      sc(`N${r}`, t.route||'',       null, fGreen, greenFill, bdr);
      ['O','P','Q','R'].forEach(col => sc(`${col}${r}`, '', null, fGreen, greenFill, bdr));
      row++;
    });

    // Итого квартала
    const tr = row;
    sc(`A${tr}`, `Итого ${year}թ. ${qNames[q]}`, null, fBold, null, ttm, aC);
    sc(`L${tr}`, null, `SUM(L${ds}:L${tr-1})`, fBold, null, ttm, aC);
    row++;
  });

  ws['!ref'] = `A1:R${row}`;

  ws['!merges'] = [
    {s:{r:0,c:0}, e:{r:0,c:17}},  // A1:R1
    {s:{r:2,c:1}, e:{r:2,c:5}},   // B3:F3
    {s:{r:2,c:6}, e:{r:2,c:10}},  // G3:K3
    {s:{r:2,c:12},e:{r:2,c:17}},  // M3:R3
  ];

  ws['!cols'] = [
    {wch:24},
    {wch:11},{wch:13},{wch:8},{wch:9},{wch:13},
    {wch:11},{wch:13},{wch:8},{wch:9},{wch:15},
    {wch:16},{wch:11},{wch:11},{wch:8},{wch:8},{wch:9},{wch:13},
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(year));
  XLSX.writeFile(wb, `GL_${year}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
