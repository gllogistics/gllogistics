// GL Logistics — «Полезные сайты» на странице рейсов: маршрутные карты, оплата дорог, заявки на проезд, очереди
(function () {
  const API = 'https://gl-api.gltransam.workers.dev/api/links';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u || ''); } };
  const api = (p, m = 'GET', b) => fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  // Стандартный набор: сайты, с которыми уже работаем (добавляется по кнопке, потом можно править и удалять)
  const DEFAULTS = [
    ['Электронные очереди и брони', 'Казахстан: бронь выезда (CarGoRuqsat)', 'https://cgr.qoldau.kz/ru/start', 'Бронь слота на выезд из Казахстана'],
    ['Электронные очереди и брони', 'Россия: бронь пункта пропуска (ГИС ЭПД)', 'https://public.epd-portal.ru/', 'Забайкальск, Бугристое и др.'],
    ['Электронные очереди и брони', 'Литва: очередь на границе (EVIS)', 'https://www.ltsiena.lt/', ''],
    ['Электронные очереди и брони', 'Латвия: электронная очередь', 'https://lvborder.lv/en/', ''],
    ['Электронные очереди и брони', 'Эстония: очередь на границе (GoSwift)', 'https://www.eestipiir.ee/', ''],
    ['Документы и уведомления', 'Польша: уведомление о водителе в PIP', 'https://www.biznes.gov.pl/', 'Подаёт перевозчик до начала перевозки']
  ];
  let links = [], open = localStorage.getItem('gl_links_open') !== '0', editId = null;

  function render() {
    const n = links.length;
    $('lkCount').textContent = n ? n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'сайт' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'сайта' : 'сайтов') : '';
    $('lkBody').hidden = !open; $('lkToggle').textContent = open ? 'Свернуть' : 'Показать';
    if (!n) {
      $('lkBody').innerHTML = `<div class="lk-empty">Здесь будут ваши важные сайты: маршрутные карты, оплата дорог, заявки на проезд.<br>
        <button type="button" class="lk-btn" id="lkDefaults">Добавить стандартный набор</button> <button type="button" class="lk-btn primary" id="lkAdd2">+ Свой сайт</button></div>`;
      return;
    }
    const groups = {}; links.forEach(l => { (groups[l.category || 'Разное'] = groups[l.category || 'Разное'] || []).push(l); });
    $('lkBody').innerHTML = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ru')).map(cat => `<div class="lk-group"><div class="lk-cat">${esc(cat)}</div><div class="lk-items">` +
      groups[cat].map(l => `<div class="lk-item"><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">
        <span class="lk-ico" aria-hidden="true">${esc((l.title || host(l.url)).trim().charAt(0).toUpperCase())}</span>
        <span class="lk-txt"><b title="${esc(l.title || host(l.url))}">${esc(l.title || host(l.url))}</b><small>${esc(l.note || host(l.url))}</small></span></a>
        <button type="button" class="lk-edit" data-edit="${l.id}" aria-label="Изменить ${esc(l.title)}" title="Изменить">✎</button></div>`).join('') + '</div></div>').join('');
  }
  async function load() {
    const r = await api('').catch(() => null);
    links = Array.isArray(r) ? r : []; render();
  }
  function openModal(l) {
    editId = l ? l.id : null;
    $('lkTitleH').textContent = l ? 'Изменить сайт' : 'Новый сайт';
    $('lkCatIn').value = l ? l.category : ''; $('lkNameIn').value = l ? l.title : ''; $('lkUrlIn').value = l ? l.url : ''; $('lkNoteIn').value = l ? (l.note || '') : '';
    $('lkCats').innerHTML = [...new Set(links.map(x => x.category).concat(['Маршрутные карты', 'Оплата дорог', 'Заявки на проезд', 'Электронные очереди и брони', 'Документы и уведомления']))].map(c => `<option value="${esc(c)}">`).join('');
    $('lkDel').style.display = l ? '' : 'none';
    $('lkModal').classList.add('open'); setTimeout(() => $(l ? 'lkNameIn' : 'lkUrlIn').focus(), 30);
  }
  async function save() {
    const b = { category: $('lkCatIn').value.trim(), title: $('lkNameIn').value.trim(), url: $('lkUrlIn').value.trim(), note: $('lkNoteIn').value.trim() };
    if (!b.url) return alert('Укажите адрес сайта');
    if (!b.title) b.title = host(/^https?:/i.test(b.url) ? b.url : 'https://' + b.url);
    const r = editId ? await api('/' + editId, 'PUT', b) : await api('', 'POST', b);
    if (r && r.error) return alert(r.error);
    $('lkModal').classList.remove('open'); await load();
  }

  function init() {
    const detail = $('tripDetail'); if (!detail) return;
    const anchor = $('bordersCard') ? $('bordersCard').nextSibling : detail;
    const card = document.createElement('section');
    card.id = 'linksCard'; card.setAttribute('aria-label', 'Полезные сайты');
    card.innerHTML = `<div class="lk-top"><div class="lk-titles"><h3>Полезные сайты</h3><span class="lk-muted" id="lkCount"></span></div>
      <div class="lk-actions"><button type="button" class="lk-btn" id="lkAdd">+ Сайт</button><button type="button" class="lk-btn primary" id="lkToggle">Свернуть</button></div></div>
      <div id="lkBody"></div>`;
    (anchor && anchor.parentNode ? anchor.parentNode : detail.parentNode).insertBefore(card, anchor || detail);
    const m = document.createElement('div');
    m.className = 'lk-modal'; m.id = 'lkModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'lkTitleH');
    m.innerHTML = `<div class="lk-box"><h2 id="lkTitleH">Новый сайт</h2>
      <label>Адрес сайта<input id="lkUrlIn" placeholder="https://…" autocomplete="off"></label>
      <label>Название<input id="lkNameIn" placeholder="Например: Транзитная карта Грузии"></label>
      <label>Группа<input id="lkCatIn" list="lkCats" placeholder="Например: Маршрутные карты"><datalist id="lkCats"></datalist></label>
      <label>Заметка<input id="lkNoteIn" placeholder="Например: логин у Армена, оплата картой фирмы"></label>
      <div class="lk-warn">Пароли сюда не записывайте: эта страница — не хранилище паролей.</div>
      <div class="lk-foot"><button type="button" class="lk-btn danger" id="lkDel">Удалить</button><span></span>
        <button type="button" class="lk-btn" id="lkCancel">Отмена</button><button type="button" class="lk-btn primary" id="lkSave">Сохранить</button></div></div>`;
    document.body.appendChild(m);
    const st = document.createElement('style');
    st.textContent = `
      #linksCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .lk-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
      .lk-titles { display: flex; align-items: baseline; gap: 10px; } .lk-titles h3 { margin: 0; font-size: 15px; font-weight: 600; color: #14202B; }
      .lk-muted { font-size: 12.5px; color: #5B6670; } .lk-actions { display: flex; gap: 6px; }
      .lk-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; color: #14202B; font: inherit; font-size: 13px; cursor: pointer; }
      .lk-btn.primary { background: #146C72; border-color: #146C72; color: #fff; font-weight: 600; } .lk-btn.danger { border-color: #E8B4AF; color: #A3241B; }
      #lkBody[hidden] { display: none; } #lkBody { display: flex; flex-direction: column; gap: 12px; }
      .lk-empty { font-size: 13.5px; color: #5B6670; line-height: 1.6; } .lk-empty .lk-btn { margin-top: 8px; }
      .lk-cat { font-size: 12px; font-weight: 600; color: #5B6670; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 6px; }
      .lk-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
      .lk-item { display: flex; align-items: center; border: 1px solid #E4E7EA; border-radius: 8px; background: #FAFBFB; transition: border-color .15s; }
      .lk-item:hover { border-color: #9CC5C8; background: #fff; }
      .lk-item a { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 9px 10px; text-decoration: none; color: inherit; }
      .lk-ico { flex-shrink: 0; width: 30px; height: 30px; border-radius: 6px; background: #E8F1F2; color: #0F5A60; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
      .lk-txt { min-width: 0; display: flex; flex-direction: column; } .lk-txt b { font-size: 13.5px; font-weight: 600; color: #14202B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .lk-txt small { font-size: 12px; color: #5B6670; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .lk-edit { flex-shrink: 0; width: 32px; height: 32px; margin-right: 4px; border: none; background: none; color: #8A949C; border-radius: 6px; cursor: pointer; font-size: 15px; }
      .lk-edit:hover { background: #EEF0F2; color: #14202B; }
      .lk-modal { display: none; position: fixed; inset: 0; background: rgba(16,38,42,.45); z-index: 1100; align-items: flex-start; justify-content: center; padding: 60px 12px; overflow-y: auto; }
      .lk-modal.open { display: flex; } .lk-box { background: #fff; border-radius: 10px; width: 100%; max-width: 480px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
      .lk-box h2 { margin: 0 0 4px; font-size: 18px; font-weight: 600; } .lk-box label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #5B6670; }
      .lk-box input { border: 1px solid #D5DADF; border-radius: 6px; padding: 9px 10px; font: inherit; font-size: 14px; color: #14202B; }
      .lk-warn { font-size: 12px; color: #8A4B00; background: #FFF8E6; border-radius: 6px; padding: 6px 10px; }
      .lk-foot { display: flex; gap: 8px; align-items: center; margin-top: 4px; } .lk-foot span { flex: 1; }`;
    document.head.appendChild(st);
    $('lkToggle').addEventListener('click', () => { open = !open; localStorage.setItem('gl_links_open', open ? '1' : '0'); render(); });
    $('lkAdd').addEventListener('click', () => openModal(null));
    $('lkSave').addEventListener('click', save);
    $('lkCancel').addEventListener('click', () => $('lkModal').classList.remove('open'));
    $('lkModal').addEventListener('click', e => { if (e.target.id === 'lkModal') $('lkModal').classList.remove('open'); });
    $('lkModal').addEventListener('keydown', e => { if (e.key === 'Escape') $('lkModal').classList.remove('open'); if (e.key === 'Enter' && e.target.tagName === 'INPUT') save(); });
    $('lkDel').addEventListener('click', async () => { if (!confirm('Удалить этот сайт из списка?')) return; await api('/' + editId, 'DELETE'); $('lkModal').classList.remove('open'); await load(); });
    $('lkBody').addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]'); if (ed) { openModal(links.find(l => l.id == ed.dataset.edit)); return; }
      if (e.target.id === 'lkAdd2') { openModal(null); return; }
      if (e.target.id === 'lkDefaults') {
        e.target.disabled = true;
        for (const [category, title, url, note] of DEFAULTS) await api('', 'POST', { category, title, url, note });
        await load();
      }
    });
    load();
  }
  // borders.js строит правую колонку при загрузке страницы — встаём после блока очередей
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
})();
