// GL Logistics — «Контакты из WhatsApp»: разбор контактов роботом и ручная раскладка
(function () {
  const API = 'https://gl-api.gltransam.workers.dev/api/wa/contacts';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CAT = { carrier: 'Перевозчик', forwarder: 'Экспедитор', client: 'Клиент', driver: 'Водитель', service: 'Услуги', private: 'Личное', unknown: 'Непонятно' };
  const TABS = [['review', 'На проверке'], ['new', 'Не разобраны'], ['auto', 'Разложены роботом'], ['done', 'Готово'], ['ignored', 'Скрытые'], ['all', 'Все']];
  const SECTIONS = ['Украина', 'Европа-СНГ', 'Европа-АМ', 'Турция-СНГ', 'Китай', 'Belorus-AM', 'KZ-AM', 'Негабарит', 'INDIA', 'International Brokers', 'RU-AM', 'IRAN'];
  let tab = localStorage.getItem('gl_wc_tab') || 'review', items = [], counts = {}, openChat = null, modalFor = null, catFilter = '', sel = new Set(), running = false;
  const shown = () => catFilter ? items.filter(c => (c.category || 'none') === catFilter) : items;
  const api = (p, m = 'GET', b) => fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());

  function renderTabs() {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    $('wcTabs').innerHTML = TABS.map(([k, l]) => `<button type="button" class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${l}<span class="n">${k === 'all' ? total : (counts[k] || 0)}</span></button>`).join('');
  }
  function renderFilter() {
    const by = {}; items.forEach(c => { const k = c.category || 'none'; by[k] = (by[k] || 0) + 1; });
    const keys = Object.keys(by).filter(k => k !== 'none' || by[k]);
    $('wcFilter').innerHTML = keys.length > 1 ? `<span class="s" style="margin-right:4px">Подсказка робота:</span><button type="button" class="tab ${!catFilter ? 'on' : ''}" data-cat="">Все<span class="n">${items.length}</span></button>`
      + keys.map(k => `<button type="button" class="tab ${catFilter === k ? 'on' : ''}" data-cat="${k}">${CAT[k] || 'не разобраны'}<span class="n">${by[k]}</span></button>`).join('') : '';
    const n = sel.size;
    $('wcBulk').hidden = !n;
    $('wcBulkN').textContent = 'Отмечено: ' + n;
  }
  function render() {
    renderTabs(); renderFilter();
    const list = shown();
    $('wcAll').checked = list.length > 0 && list.every(c => sel.has(c.phone));
    $('wcBody').innerHTML = list.length ? list.map(c => {
      const cat = c.category || 'none';
      const where = c.carrier_id ? `<a href="/carriers.html">в базе перевозчиков</a>` : c.client_name ? `в клиентах: ${esc(c.client_name)}` : '—';
      const det = [c.company, c.country, c.directions, c.section ? 'раздел: ' + c.section : '', c.trailer].filter(Boolean).map(esc).join(' · ');
      const row = `<tr data-p="${c.phone}">
        <td><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-sel="${c.phone}" ${sel.has(c.phone) ? 'checked' : ''} style="margin-top:3px;width:16px;height:16px;accent-color:#146C72"><span><b style="font-weight:600">${esc(c.name || 'Без имени')}</b><div class="s">+${esc(c.phone)}${c.msg_count ? ' · сообщений: ' + c.msg_count : ''}</div></span></label></td>
        <td><span class="chip c-${cat}">${CAT[c.category] || 'не разобран'}</span>${c.confidence != null && c.category ? `<div class="s">уверенность ${Math.round(c.confidence * 100)}%</div>` : ''}</td>
        <td>${det || '<span class="s">—</span>'}${c.summary ? `<div class="s">${esc(c.summary)}</div>` : ''}</td>
        <td class="where">${where}</td>
        <td><div class="acts">
          <button type="button" class="btn sm" data-a="carrier">Перевозчик</button><button type="button" class="btn sm" data-a="forwarder">Экспедитор</button>
          <button type="button" class="btn sm" data-a="client">Клиент</button><button type="button" class="btn sm" data-a="ignore">Скрыть</button>
          <button type="button" class="btn sm" data-a="private" title="Личный чат: переписка удаляется и больше не сохраняется">Личное</button>
          ${c.category !== 'private' ? `<button type="button" class="btn sm" data-a="chat">${openChat === c.phone ? 'Скрыть переписку' : 'Переписка'}</button>` : ''}
          ${c.status !== 'new' ? '<button type="button" class="btn sm" data-a="reset" title="Отдать роботу на повторный разбор">Разобрать заново</button>' : ''}
        </div></td></tr>`;
      return row + (openChat === c.phone ? `<tr><td colspan="5" class="chat" id="chat-${c.phone}">Загрузка…</td></tr>` : '');
    }).join('') : `<tr><td colspan="5" class="empty">${tab === 'review' ? 'На проверке никого нет.' : 'Здесь пока пусто.'} ${!Object.keys(counts).length ? 'Нажмите «Загрузить контакты из WhatsApp», а потом «Разобрать с Claude».' : ''}</td></tr>`;
    if (openChat) loadChat(openChat);
  }
  async function loadChat(phone) {
    const list = await api('/' + phone + '/chat').catch(() => []);
    const box = $('chat-' + phone); if (!box) return;
    box.innerHTML = list.length ? list.map(m => `<div class="${m.dir}">${m.dir === 'out' ? '<b>Вы:</b> ' : '<b>Он:</b> '}${esc(m.text)}</div>`).join('') : 'Сохранённой переписки нет (появится с новыми сообщениями).';
  }
  async function load() {
    const r = await api('?status=' + tab).catch(() => ({ items: [], counts: {} }));
    items = r.items || []; counts = r.counts || {};
    const ph = new Set(items.map(c => c.phone)); sel = new Set([...sel].filter(p => ph.has(p)));
    if (catFilter && !items.some(c => (c.category || 'none') === catFilter)) catFilter = '';
    render();
  }
  async function act(phone, a, extra) {
    const r = await api('/' + phone, 'PUT', Object.assign({ action: a }, extra || {})).catch(() => ({ error: 'нет связи' }));
    if (r.error) return alert(r.error);
    if (r.existed) $('wcMsg').textContent = 'Этот номер уже был в базе перевозчиков — отметил его.';
    await load();
  }
  function openModal(c, a) {
    modalFor = { phone: c.phone, a };
    $('wcMTitle').textContent = a === 'forwarder' ? 'В базу перевозчиков: экспедитор' : 'В базу перевозчиков';
    $('wcMName').value = c.company || c.name || '';
    $('wcMSec').innerHTML = '<option value="">Без раздела</option>' + SECTIONS.map(s => `<option${s === c.section ? ' selected' : ''}>${esc(s)}</option>`).join('');
    $('wcMTr').value = c.trailer || '';
    $('wcModal').classList.add('open'); setTimeout(() => $('wcMName').focus(), 30);
  }
  $('wcTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; localStorage.setItem('gl_wc_tab', tab); openChat = null; load(); });
  $('wcBody').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const phone = b.closest('tr').dataset.p, c = items.find(x => x.phone === phone), a = b.dataset.a;
    if (a === 'chat') { openChat = openChat === phone ? null : phone; render(); return; }
    if (a === 'carrier' || a === 'forwarder') { openModal(c, a); return; }
    if (a === 'private' && !confirm('Пометить как личный чат? Сохранённая переписка удалится, новая не будет сохраняться.')) return;
    if (a === 'client') { const nm = prompt('Название клиента', c.company || c.name || ''); if (!nm) return; act(phone, 'client', { name: nm }); return; }
    act(phone, a);
  });
  $('wcFilter').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; catFilter = b.dataset.cat; render(); });
  $('wcBody').addEventListener('change', e => { const cb = e.target.closest('[data-sel]'); if (!cb) return; cb.checked ? sel.add(cb.dataset.sel) : sel.delete(cb.dataset.sel); renderFilter(); $('wcAll').checked = shown().every(c => sel.has(c.phone)); });
  $('wcAll').addEventListener('change', () => { const on = $('wcAll').checked; shown().forEach(c => on ? sel.add(c.phone) : sel.delete(c.phone)); render(); });
  $('wcBulk').addEventListener('click', async e => {
    const b = e.target.closest('[data-bulk]'); if (!b || running) return;
    const a = b.dataset.bulk, phones = [...sel];
    const label = { carrier: 'в базу перевозчиков (как перевозчиков)', forwarder: 'в базу перевозчиков (как экспедиторов)', client: 'в клиенты', ignore: 'в скрытые', private: 'в личные (переписка удалится)' }[a];
    if (!confirm(`Отправить ${phones.length} контактов ${label}?` + (a === 'carrier' || a === 'forwarder' ? '\nРаздел и тип прицепа — как предложил робот, их можно поправить потом в «Перевозчиках».' : ''))) return;
    running = true; let ok = 0, fail = 0;
    for (const p of phones) {
      const c = items.find(x => x.phone === p) || {};
      $('wcMsg').textContent = `Раскладываю: ${ok + fail + 1} из ${phones.length}…`;
      const r = await api('/' + p, 'PUT', a === 'client' ? { action: 'client', name: c.company || c.name || '' } : { action: a }).catch(() => ({ error: 1 }));
      r && !r.error ? ok++ : fail++;
    }
    running = false; sel.clear(); $('wcMsg').textContent = `Готово: ${ok}` + (fail ? `, не получилось: ${fail}` : '') + '.'; load();
  });
  $('wcBulkClear').addEventListener('click', () => { sel.clear(); render(); });
  $('wcMCancel').addEventListener('click', () => $('wcModal').classList.remove('open'));
  $('wcModal').addEventListener('click', e => { if (e.target.id === 'wcModal') $('wcModal').classList.remove('open'); });
  $('wcMSave').addEventListener('click', async () => {
    const m = modalFor; $('wcModal').classList.remove('open');
    await act(m.phone, m.a, { name: $('wcMName').value.trim(), section: $('wcMSec').value, trailer: $('wcMTr').value.trim() });
  });
  $('wcImport').addEventListener('click', async () => {
    const b = $('wcImport'); b.disabled = true; $('wcMsg').textContent = 'Загружаю контакты…';
    const r = await api('/import', 'POST').catch(() => ({ error: 'нет связи' }));
    $('wcMsg').textContent = r.error ? 'Не удалось: ' + r.error : `Контактов в WhatsApp: ${r.seen}, новых: ${r.added}. Теперь нажмите «Разобрать с Claude».`;
    b.disabled = false; tab = 'new'; load();
  });
  let stopAll = false;
  $('wcClassify').addEventListener('click', async () => {
    const b = $('wcClassify');
    if (running) { stopAll = true; b.textContent = 'Останавливаю…'; return; }
    running = true; stopAll = false; b.textContent = 'Остановить';
    const total0 = counts.new || 0; let done = 0, auto = 0, review = 0, err = '';
    while (!stopAll) {
      $('wcMsg').textContent = `Робот разбирает… готово ${done} из ${total0} (в базу: ${auto}, на проверку: ${review})`;
      const r = await api('/classify', 'POST', { limit: 20 }).catch(() => ({ error: 'нет связи' }));
      if (r.error) { err = r.error; break; }
      if (!r.done) break;
      done += r.done; auto += r.auto || 0; review += r.review || 0;
    }
    running = false; b.textContent = 'Разобрать всех с Claude';
    $('wcMsg').textContent = (err ? 'Остановлено с ошибкой: ' + err + '. ' : stopAll ? 'Остановлено. ' : 'Готово. ') + `Разобрано: ${done}, разложено в базу автоматически: ${auto}, на проверку: ${review}.`;
    load();
  });
  load();
})();
