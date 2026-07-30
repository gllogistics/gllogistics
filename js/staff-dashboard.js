const API_URL = 'https://gl-api.gltransam.workers.dev';
const ADMIN_USER = 'TigranMetspagyan';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const user = localStorage.getItem('gl_staff_user');
const loginTime = parseInt(localStorage.getItem('gl_staff_login_time') || '0', 10);
const sessionValid = !!user && !!loginTime && (Date.now() - loginTime) <= SESSION_MAX_AGE_MS;

if (!sessionValid) {
  localStorage.removeItem('gl_staff_user');
  localStorage.removeItem('gl_staff_login_time');
  localStorage.removeItem('gl_staff_token');
  window.location.href = 'staff.html';
} else if (user !== ADMIN_USER) {
  window.location.href = 'staff-cargo.html';
} else {
  init();
}

function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = localStorage.getItem('gl_staff_token');
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  return fetch(API_URL + path, opts).then(r => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
}

function doLogout() {
  localStorage.removeItem('gl_staff_user');
  localStorage.removeItem('gl_staff_login_time');
  localStorage.removeItem('gl_staff_token');
  window.location.href = 'staff.html';
}

function togglePwd(id) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

let usersList = [], exchangeRates = null, bankBalances = {};

async function fetchBankBalances() {
  try {
    const data = await api('/api/bank-balances');
    bankBalances = {};
    data.forEach(item => { bankBalances[item.currency] = item.balance; });
    if (!bankBalances.overdraft_AMD) bankBalances.overdraft_AMD = 0;
    renderBankAccounts();
  } catch (e) { console.error('Банковские счета не загружены', e); }
}

async function updateBankBalance(currency, balance) {
  try {
    await api('/api/bank-balances', 'PUT', { currency, balance });
    bankBalances[currency] = balance;
    renderBankAccounts();
    loadData();
  } catch (e) { alert('Ошибка сохранения баланса'); }
}

function formatCurrency(amount, currency) {
  const symbols = { USD: '$', EUR: '€', AMD: '֏', RUB: '₽' };
  return (symbols[currency] || currency) + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderBankAccounts() {
  const accounts = [
    { currency: 'USD', flag: '🇺🇸', label: 'Доллар США' },
    { currency: 'EUR', flag: '🇪🇺', label: 'Евро' },
    { currency: 'AMD', flag: '🇦🇲', label: 'Армянский драм' },
    { currency: 'RUB', flag: '🇷🇺', label: 'Российский рубль' }
  ];
  document.getElementById('bankAccounts').innerHTML = accounts.map(acc => {
    const balance = bankBalances[acc.currency] || 0;
    let displayBalance = balance, extraHtml = '';
    if (acc.currency === 'AMD') {
      const overdraft = bankBalances.overdraft_AMD || 0;
      displayBalance = balance - overdraft;
      extraHtml = `<div class="bank-sub">Баланс: ${formatCurrency(balance,'AMD')}<br>Овердрафт: ${formatCurrency(overdraft,'AMD')}</div>
        <input type="number" id="overdraftInput_AMD" placeholder="Овердрафт" value="${overdraft}">
        <span class="overdraft-label">Овердрафт (займ)</span>
        <button class="btn-save-balance" data-action="overdraft">💾 Обновить овердрафт</button>`;
    }
    const cardClass = displayBalance < 0 ? ' bank-card-negative' : '';
    return `<div class="bank-card${cardClass}">
      <div class="bank-header"><span class="bank-currency">${acc.currency}</span><span class="bank-flag">${acc.flag}</span></div>
      <div class="bank-balance">${formatCurrency(displayBalance, acc.currency)}</div>
      <div class="bank-label">${acc.currency === 'AMD' ? 'Доступно' : acc.label}</div>
      <input type="number" id="bankInput_${acc.currency}" placeholder="Баланс" value="${balance}">
      <button class="btn-save-balance" data-currency="${acc.currency}">💾 Обновить баланс</button>
      ${extraHtml}
    </div>`;
  }).join('');

  // Attach listeners after render (dynamic buttons)
  document.querySelectorAll('.btn-save-balance[data-currency]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = btn.dataset.currency;
      const val = parseFloat(document.getElementById('bankInput_' + cur).value) || 0;
      updateBankBalance(cur, val);
    });
  });
  document.querySelectorAll('.btn-save-balance[data-action="overdraft"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(document.getElementById('overdraftInput_AMD').value) || 0;
      updateBankBalance('overdraft_AMD', val);
    });
  });
}

async function fetchExchangeRates() {
  try {
    const data = await api('/api/rates');
    exchangeRates = data;
    document.getElementById('manualRateUSD').value = data.AMD;
    document.getElementById('manualRateEUR').value = data.EUR;
    document.getElementById('manualRateRUB').value = data.RUB;
    updateRateDisplay();
  } catch (e) {
    exchangeRates = { USD: 1, AMD: 400, EUR: 440, RUB: 4.5 };
  }
}

async function saveManualRates() {
  const usd = parseFloat(document.getElementById('manualRateUSD').value);
  const eur = parseFloat(document.getElementById('manualRateEUR').value);
  const rub = parseFloat(document.getElementById('manualRateRUB').value);
  if (!usd || !eur || !rub) return alert('Заполните все курсы');
  try {
    await api('/api/rates', 'PUT', { currency: 'AMD', rate: usd });
    await api('/api/rates', 'PUT', { currency: 'EUR', rate: eur });
    await api('/api/rates', 'PUT', { currency: 'RUB', rate: rub });
    exchangeRates = { USD: 1, AMD: usd, EUR: eur, RUB: rub };
    updateRateDisplay();
    loadData();
    alert('Курсы сохранены!');
  } catch (e) { alert('Ошибка сохранения курсов'); }
}

async function autoFetchRates() {
  try {
    const data = await api('/api/rates/refresh');
    if (data.error) throw new Error(data.error);
    document.getElementById('manualRateUSD').value = data.AMD;
    document.getElementById('manualRateEUR').value = data.EUR;
    document.getElementById('manualRateRUB').value = data.RUB;
    // Сразу применяем — не нужно нажимать Сохранить
    exchangeRates = { USD: 1, AMD: data.AMD, EUR: data.EUR, RUB: data.RUB };
    updateRateDisplay();
    loadData();
    alert(`Курс ЦБ Армении обновлён (${data.source || 'cb.am'}):\n1 USD = ${data.AMD} AMD\n1 EUR = ${data.EUR} AMD\n1 RUB = ${data.RUB} AMD`);
  } catch (e) { alert('Не удалось загрузить курсы ЦБ Армении: ' + e.message); }
}

function updateRateDisplay() {
  if (!exchangeRates) return;
  document.getElementById('rateUSD').textContent = `1 USD = ${exchangeRates.AMD} AMD`;
  document.getElementById('rateEUR').textContent = `1 EUR = ${exchangeRates.EUR} AMD`;
  document.getElementById('rateRUB').textContent = `1 RUB = ${exchangeRates.RUB} AMD`;
}

function convertToUSD(amount, currency) {
  if (!exchangeRates || !amount) return 0;
  if (currency === 'USD') return amount;
  const rate = exchangeRates[currency];
  if (!rate) return 0;
  if (currency === 'AMD') return amount / exchangeRates.AMD;
  return (amount * rate) / exchangeRates.AMD;
}
function usdToAMD(usd) { return usd * (exchangeRates?.AMD || 400); }
function esc(s) { return (s || '').replace(/</g, '&lt;'); }

async function loadUsers() {
  try {
    usersList = await api('/api/users');
    renderLogists();
  } catch (err) { console.error(err); }
}

function renderLogists() {
  document.getElementById('logistListTable').innerHTML = usersList.map((u, i) =>
    `<tr><td>${esc(u.username)}</td><td>${u.role === 'admin' ? '👑 Админ' : '👤 Логист'}</td>
    <td><span id="pwd_${i}">••••••</span> <button class="show-pwd" data-idx="${i}">Показать</button></td>
    <td>${u.role !== 'admin' ? `<button class="btn-sm-del" data-name="${esc(u.username)}">Удалить</button>` : ''}</td></tr>`
  ).join('');

  document.querySelectorAll('.show-pwd').forEach(btn => {
    btn.addEventListener('click', () => toggleShowPwd(parseInt(btn.dataset.idx), btn));
  });
  document.querySelectorAll('.btn-sm-del').forEach(btn => {
    btn.addEventListener('click', () => deleteLogist(btn.dataset.name));
  });
}

let pwdCache = {};
async function toggleShowPwd(i, btn) {
  const el = document.getElementById('pwd_' + i);
  if (el.textContent === '••••••') {
    if (!pwdCache[usersList[i].username]) {
      const data = await api('/api/user-pwd/' + usersList[i].username);
      pwdCache[usersList[i].username] = data.password;
    }
    el.textContent = pwdCache[usersList[i].username];
    btn.textContent = 'Скрыть';
  } else {
    el.textContent = '••••••';
    btn.textContent = 'Показать';
  }
}

async function addLogist() {
  const name = document.getElementById('newLogistName').value.trim();
  const pass = document.getElementById('newLogistPass').value.trim();
  if (!name || !pass) return alert('Введите имя и пароль');
  try {
    await api('/api/users', 'POST', { username: name, password: pass, role: 'logist' });
    pwdCache[name] = pass;
    document.getElementById('newLogistName').value = '';
    document.getElementById('newLogistPass').value = '';
    await loadUsers();
    alert('Логист ' + name + ' добавлен!');
  } catch (err) { alert('Ошибка'); }
}

async function deleteLogist(name) {
  if (name === ADMIN_USER) return alert('Нельзя удалить админа');
  if (!confirm('Удалить ' + name + '?')) return;
  await api('/api/users/' + name, 'DELETE');
  delete pwdCache[name];
  await loadUsers();
}

async function loadData() {
  try {
    const [cargo, contracts] = await Promise.all([
      api('/api/cargo'),
      api('/api/contracts-history').catch(() => []),
    ]);

    // История договоров
    const cTable = document.getElementById('contractsTable');
    if (cTable) {
      if (!contracts.length) {
        cTable.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:1rem">Нет договоров</td></tr>';
      } else {
        cTable.innerHTML = contracts.slice(0, 20).map(c => `<tr>
          <td style="font-weight:700;color:#1E7A80">${c.contract_number||'—'}</td>
          <td style="font-size:.75rem;color:#8fa8ab">${(c.created_at||'').substring(0,10)}</td>
          <td>${c.company||'—'}</td>
          <td>${c.signatory||'—'}</td>
          <td style="font-size:.75rem">${c.customer_email||'—'}</td>
          <td><span style="font-size:.65rem;padding:2px 7px;border-radius:5px;background:#E0F4F5;color:#1E7A80;font-weight:700">${c.contract_type==='carrier'?'Перевозчик':'Клиент'} · ${c.language||''}</span></td>
          <td>${c.pdf_key ? `<a href="https://gl-api.gltransam.workers.dev/api/contract-pdf/${c.pdf_key}" target="_blank" style="color:#1E7A80;font-weight:700;font-size:.75rem">📄 PDF</a>` : '—'}</td>
        </tr>`).join('');
      }
    }

    let totalProfitAMD = 0, waitingClientsAMD = 0, waitingCarriersAMD = 0, receivedAMD = 0, paidAMD = 0;
    cargo.forEach(c => {
      const clientCur = c.client_currency || c.currency || 'USD';
      const carrierCur = c.carrier_currency || c.currency || 'USD';
      const clientUSD = convertToUSD(parseFloat(c.client_price || 0), clientCur);
      const carrierUSD = convertToUSD(parseFloat(c.carrier_price || 0), carrierCur);
      const profitAMD = usdToAMD(clientUSD - carrierUSD);
      totalProfitAMD += profitAMD;
      if (!c.client_paid) waitingClientsAMD += usdToAMD(clientUSD);
      else receivedAMD += usdToAMD(clientUSD);
      if (!c.carrier_paid) waitingCarriersAMD += usdToAMD(carrierUSD);
      else paidAMD += usdToAMD(carrierUSD);
    });

    const cashGapAMD = paidAMD - receivedAMD;
    const amdRate = exchangeRates?.AMD || 400;
    const rubRate = exchangeRates?.RUB || 4.5;
    const eurRate = exchangeRates?.EUR || 440;
    const bankAMD = (bankBalances.USD || 0) * amdRate + (bankBalances.EUR || 0) * eurRate + (bankBalances.RUB || 0) * rubRate + (bankBalances.AMD || 0) - (bankBalances.overdraft_AMD || 0);
    const netBalanceAMD = bankAMD + receivedAMD - paidAMD;

    document.getElementById('statsRowTop').innerHTML = `
      <div class="stat-card"><div class="num">${cargo.length}</div><div class="lbl">Сделок</div></div>
      <div class="stat-card stat-profit"><div class="num">֏${Math.round(totalProfitAMD).toLocaleString()}</div><div class="lbl">Прибыль AMD</div></div>
      <div class="stat-card stat-success"><div class="num">֏${Math.round(receivedAMD).toLocaleString()}</div><div class="lbl">✅ Получено</div></div>
      <div class="stat-card stat-warning"><div class="num">֏${Math.round(paidAMD).toLocaleString()}</div><div class="lbl">📤 Оплачено</div></div>
      <div class="stat-card ${cashGapAMD > 0 ? 'stat-danger' : 'stat-free'}"><div class="num">֏${Math.round(Math.abs(cashGapAMD)).toLocaleString()}</div><div class="lbl">${cashGapAMD > 0 ? '⚠️ Кассовый разрыв' : '💰 Свободные средства'}</div></div>`;

    document.getElementById('statsRowBottom').innerHTML = `
      <div class="stat-card stat-profit" style="border:2px solid rgba(85,183,189,.4)">
        <div class="num">֏${Math.round(bankAMD).toLocaleString()}</div>
        <div class="lbl">🏦 Реальная касса (счёт)</div>
      </div>
      <div class="stat-card ${netBalanceAMD >= 0 ? 'stat-success' : 'stat-netbal'}"><div class="num">֏${Math.round(netBalanceAMD).toLocaleString()}</div><div class="lbl">💎 Чистый баланс</div></div>
      <div class="stat-card stat-debtor"><div class="num">֏${Math.round(waitingClientsAMD).toLocaleString()}</div><div class="lbl">🕐 Ждём от клиентов</div></div>
      <div class="stat-card stat-creditor"><div class="num">֏${Math.round(waitingCarriersAMD).toLocaleString()}</div><div class="lbl">🕐 Должны перевозчикам</div></div>`;

    renderFinanceSummary(Math.round(receivedAMD), Math.round(paidAMD), Math.round(totalProfitAMD), Math.round(waitingClientsAMD), Math.round(waitingCarriersAMD));

    const lm = {};
    cargo.forEach(c => {
      const l = c.logist || '—';
      if (!lm[l]) lm[l] = { count: 0, turnoverAMD: 0, profitAMD: 0 };
      lm[l].count++;
      const cU = convertToUSD(parseFloat(c.client_price || 0), c.client_currency || c.currency || 'USD');
      const rU = convertToUSD(parseFloat(c.carrier_price || 0), c.carrier_currency || c.currency || 'USD');
      lm[l].turnoverAMD += usdToAMD(cU);
      lm[l].profitAMD += usdToAMD(cU - rU);
    });
    document.getElementById('logistTable').innerHTML = Object.entries(lm)
      .sort((a, b) => b[1].profitAMD - a[1].profitAMD)
      .map(([n, d]) => `<tr><td>${esc(n)}</td><td>${d.count}</td><td>֏${Math.round(d.turnoverAMD).toLocaleString()}</td><td class="profit-positive">֏${Math.round(d.profitAMD).toLocaleString()}</td></tr>`).join('');

    const sl = { loading:'На загрузке', onroad:'В пути', loaded:'Загружен', completed:'Завершён' };
    const sc = { loading:'status-loading', onroad:'status-onroad', loaded:'status-loaded', completed:'status-completed' };
    document.getElementById('recentTable').innerHTML = cargo.slice(0, 10).map((c, i) => {
      const cU = convertToUSD(parseFloat(c.client_price || 0), c.client_currency || c.currency || 'USD');
      const rU = convertToUSD(parseFloat(c.carrier_price || 0), c.carrier_currency || c.currency || 'USD');
      const profitAMD = usdToAMD(cU - rU);
      return `<tr><td>${i+1}</td><td>${esc(c.client_name||'—')}</td><td>${esc(c.carrier_name||'—')}</td><td>${esc(c.product||'—')}</td>
        <td><span class="status-badge ${sc[c.status]||''}">${sl[c.status]||c.status}</span></td>
        <td class="profit-positive">֏${Math.round(profitAMD).toLocaleString()}</td>
        <td>${(c.client_currency||'USD')}/${(c.carrier_currency||'USD')}</td><td>${esc(c.logist||'—')}</td></tr>`;
    }).join('');
  } catch (err) { document.getElementById('statsRowTop').innerHTML = '<p>Ошибка загрузки данных</p>'; }
}

function renderFinanceSummary(received, paid, profit, waitingClients, waitingCarriers) {
  const total = received + paid;
  const pct = total > 0 ? Math.round((received / total) * 100) : 50;
  const el = document.getElementById('financeSummary');
  if (!el) return;
  el.innerHTML = `
    <h4>💡 Финансовый срез <span style="font-weight:400;color:#8fa8ab">Получено vs Оплачено</span></h4>
    <div class="fin-bar"><div class="fin-bar-get" style="width:${pct}%">✅ ${pct}%</div><div class="fin-bar-pay" style="width:${100-pct}%">📤 ${100-pct}%</div></div>
    <div class="fin-row"><span><b style="color:#1B7A3E">֏${received.toLocaleString('ru')}</b> получено</span><span style="color:#1E7A80;font-weight:700">Прибыль: <b>֏${profit.toLocaleString('ru')}</b></span><span><b style="color:#BF360C">֏${paid.toLocaleString('ru')}</b> оплачено</span></div>
    <div class="fin-extra"><span>🕐 Ждём: <b style="color:#1565C0">֏${waitingClients.toLocaleString('ru')}</b></span><span>📋 Должны: <b style="color:#7B1FA2">֏${waitingCarriers.toLocaleString('ru')}</b></span></div>`;
}

function init() {
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('saveRatesBtn').addEventListener('click', saveManualRates);
  document.getElementById('autoRatesBtn').addEventListener('click', autoFetchRates);
  document.getElementById('addLogistBtn').addEventListener('click', addLogist);
  document.getElementById('togglePwdBtn').addEventListener('click', () => togglePwd('newLogistPass'));

  fetchExchangeRates().then(() => {
    fetchBankBalances().then(() => {
      updateRateDisplay();
      loadUsers();
      loadData();
    });
  });
}
