// GL Logistics — ассистент Claude на всех страницах (только для администратора)
(function () {
  if (localStorage.getItem('gl_staff_user') !== 'TigranMetspagyan' || document.getElementById('glAsk')) return;
  const API = 'https://gl-api.gltransam.workers.dev/api/assistant';
  const KEY = 'gl_assistant_history';
  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (_) {}
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  const btn = document.createElement('button');
  btn.id = 'glAsk'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ассистент');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>';
  const panel = document.createElement('section');
  panel.id = 'glAskPanel'; panel.setAttribute('aria-label', 'Ассистент');
  panel.innerHTML =
    '<header><div><b>Ассистент</b><span>Отвечает по данным вашей системы</span></div>' +
    '<button type="button" id="glAskClear" title="Новый разговор">Очистить</button><button type="button" id="glAskClose" aria-label="Закрыть">×</button></header>' +
    '<div id="glAskLog"></div>' +
    '<div id="glAskHints"></div>' +
    '<form id="glAskForm"><textarea id="glAskInput" rows="1" placeholder="Спросите, например: кто должен больше 30 дней?"></textarea>' +
    '<button type="submit" id="glAskSend">Спросить</button></form>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  const log = panel.querySelector('#glAskLog'), input = panel.querySelector('#glAskInput'), send = panel.querySelector('#glAskSend');
  const hints = ['Кто из клиентов должен больше 30 дней?', 'Прибыль по сделкам за этот месяц', 'Сколько потратили на топливо в сентябре?', 'Что в автопарке требует внимания?'];
  function render() {
    log.innerHTML = history.length ? history.map(m => '<div class="gl-msg ' + (m.role === 'user' ? 'me' : 'ai') + '">' + fmt(m.content) + '</div>').join('')
      : '<div class="gl-empty-ask">Задайте вопрос о сделках, рейсах, расходах, клиентах или автопарке.</div>';
    panel.querySelector('#glAskHints').innerHTML = history.length ? '' : hints.map(h => '<button type="button" class="gl-hint">' + esc(h) + '</button>').join('');
    log.scrollTop = log.scrollHeight;
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-20))); } catch (_) {} }
  async function ask(q) {
    q = q.trim(); if (!q || send.disabled) return;
    history.push({ role: 'user', content: q }); save(); render();
    input.value = ''; send.disabled = true; send.textContent = 'Думаю…';
    log.insertAdjacentHTML('beforeend', '<div class="gl-msg ai gl-wait">Смотрю данные…</div>'); log.scrollTop = log.scrollHeight;
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) });
      const d = await r.json();
      history.push({ role: 'assistant', content: d.reply || ('Ошибка: ' + (d.error || d.message || r.status)) });
    } catch (e) { history.push({ role: 'assistant', content: 'Нет связи с сервером.' }); }
    save(); render(); send.disabled = false; send.textContent = 'Спросить'; input.focus();
  }
  btn.addEventListener('click', () => { document.body.classList.toggle('gl-ask-open'); render(); if (document.body.classList.contains('gl-ask-open')) input.focus(); });
  panel.querySelector('#glAskClose').addEventListener('click', () => document.body.classList.remove('gl-ask-open'));
  panel.querySelector('#glAskClear').addEventListener('click', () => { history = []; save(); render(); });
  panel.querySelector('#glAskForm').addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  panel.addEventListener('click', e => { const h = e.target.closest('.gl-hint'); if (h) ask(h.textContent); });
})();
