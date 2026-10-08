// GL Logistics — карта очередей на границах (страница «Рейсы»)
(function () {
  const API = 'https://gl-api.gltransam.workers.dev/api/borders';
  const TR_LINK = 'https://uygulamalar.gumruk.gov.tr/websahaozet/';
  const RS_LINK = 'https://www.rs.ge/TirPark-en?cat=1&tab=1';
  const BG_LINK = 'https://www.mvr.bg/gdgp/';
  const GTI_LINK = p => 'https://tirparklari.com.tr/bekleme?park=' + p + '&lang=en';
  // Координаты примерные (у пунктов пропуска)
  const POINTS = [
    { key: 'Сарпи', title: 'Сарпи / Сарп', border: 'Грузия — Турция', lat: 41.5221, lng: 41.5475, src: 'ge', link2: [TR_LINK, 'Турецкая сторона (Мин. торговли)'] },
    { key: 'Вале', title: 'Вале / Тюркгёзю', border: 'Грузия — Турция', lat: 41.5788, lng: 42.8327, src: 'ge' },
    { key: 'Карцахи', title: 'Карцахи / Акташ', border: 'Грузия — Турция', lat: 41.2420, lng: 43.2563, src: 'ge' },
    { key: 'Ниноцминда', title: 'Ниноцминда / Бавра', border: 'Грузия — Армения', lat: 41.2545, lng: 43.6297, src: 'ge' },
    { key: 'Гугути', title: 'Гугути', border: 'Грузия — Армения', lat: 41.1300, lng: 44.4640, src: 'ge' },
    { key: 'Садахло', title: 'Садахло / Баграташен', border: 'Грузия — Армения', lat: 41.2436, lng: 44.8017, src: 'ge' },
    { key: 'Красный мост', title: 'Красный мост', border: 'Грузия — Азербайджан', lat: 41.3365, lng: 45.0968, src: 'ge' },
    { key: 'Лагодехи', title: 'Лагодехи', border: 'Грузия — Азербайджан', lat: 41.7555, lng: 46.2949, src: 'ge' },
    { key: 'Казбеги', title: 'Казбеги / Верхний Ларс', border: 'Грузия — Россия', lat: 42.7444, lng: 44.6261, src: 'ge', link2: ['https://zitic.ru/eo/vl/', 'Российская сторона (электронная очередь)'] },
    { key: 'Капитан Андреево', title: 'Капитан Андреево / Капыкуле', border: 'Болгария — Турция', lat: 41.7181, lng: 26.3226, src: 'bg', tr: 'kapikule', link2: [GTI_LINK('kapikule'), 'TIR-парк Капыкуле (GTI)'] },
    { key: 'Лесово', title: 'Лесово / Хамзабейли', border: 'Болгария — Турция', lat: 41.9719, lng: 26.5652, src: 'bg', tr: 'hamzabeyli', link2: [GTI_LINK('hamzabeyli'), 'TIR-парк Хамзабейли (GTI)'] },
    { key: 'Джилвегёзю', title: 'Джилвегёзю', border: 'Турция — Сирия', lat: 36.2267, lng: 36.6638, src: 'tr', tr: 'cilvegozu', link2: [GTI_LINK('cilvegozu'), 'TIR-парк Джилвегёзю (GTI)'] },
    { key: 'Кулата', title: 'Кулата / Промахон', border: 'Болгария — Греция', lat: 41.3940, lng: 23.3643, src: 'bg' },
    { key: 'Калотина', title: 'Калотина / Градина', border: 'Болгария — Сербия', lat: 42.9946, lng: 22.8683, src: 'bg' },
    { key: 'Видин', title: 'Видин — Калафат', border: 'Болгария — Румыния', lat: 43.9662, lng: 22.9133, src: 'bg' },
    { key: 'Русе', title: 'Русе — Джурджу', border: 'Болгария — Румыния', lat: 43.8916, lng: 25.9690, src: 'bg' },
  ];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('ru');
  const ago = iso => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : Math.round(m / 60) + ' ч назад'; };
  let map = null, layer = null, data = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Карта не загрузилась')); document.head.appendChild(s);
    });
  }

  // Состояние точки: число на пине, цвет, текст
  function stateOf(p) {
    if (p.src === 'ge') {
      const g = (data?.georgia?.data || []).find(x => x.name === p.key);
      if (!g) return { label: '?', cls: 'na', text: 'Нет данных' };
      const total = g.used + g.free, load = total ? g.used / total : 0;
      return { label: fmt(g.used), cls: load >= 0.85 ? 'bad' : load >= 0.6 ? 'mid' : 'ok', g,
        text: `На стоянках перед границей: <b>${fmt(g.used)}</b> машин · свободно мест: ${fmt(g.free)}`, at: data.georgia.at };
    }
    const t = p.tr ? data?.turkey?.data?.[p.tr] : null;
    let trText = '', trCls = null, trLabel = null;
    if (t) {
      const total = (t.outer || 0) + (t.inner || 0);
      const maxWait = Math.max(0, ...t.cats.map(x => x.total_wait_h || 0));
      trCls = maxWait >= 48 ? 'bad' : maxWait >= 12 ? 'mid' : 'ok'; trLabel = fmt(total);
      trText = `Турецкий TIR-парк: <b>${fmt(total)}</b> машин (внешний ${fmt(t.outer)}, внутренний ${fmt(t.inner)})`
        + (t.cats.length ? '<div class="bd-parks">' + t.cats.filter(x => x.queue || x.total_wait_h).map(x =>
            `<div><span>${esc(x.name)}</span><span>${fmt(x.queue)} маш. · ${x.total_wait_h != null ? x.total_wait_h + ' ч' : '—'}</span></div>`).join('') + '</div>' : '');
    }
    if (p.src === 'tr') return t ? { label: trLabel, cls: trCls, text: trText, at: data.turkey.at } : { label: '?', cls: 'na', text: 'Нет данных' };
    const b = data?.bulgaria?.data?.points?.[p.key];
    if (!b && !t) return { label: '?', cls: 'na', text: 'Нет данных' };
    if (!b) return { label: trLabel, cls: trCls, text: trText, at: data.turkey.at };
    const out = b.trucks_out === 'intense', inn = b.trucks_in === 'intense';
    const bgCls = out || inn ? 'bad' : 'ok';
    const rank = { ok: 0, mid: 1, bad: 2 };
    const cls = trCls && rank[trCls] > rank[bgCls] ? trCls : bgCls;
    const bgText = 'Болгария, грузовики: выезд — <b>' + (out ? 'интенсивно' : 'нормально') + '</b>, въезд — <b>' + (inn ? 'интенсивно' : 'нормально') + '</b>'
      + (b.cars === 'intense' ? '<br>Легковые: интенсивно' : '');
    return { label: trLabel || (out || inn ? '!' : 'OK'), cls, b, text: (trText ? trText + '<div style="margin-top:6px">' + bgText + '</div>' : bgText),
      at: data.bulgaria.at, asOf: data.bulgaria.data.as_of };
  }

  function popup(p, st) {
    const parks = st.g && st.g.parks && st.g.parks.length
      ? '<div class="bd-parks">' + st.g.parks.map(x => `<div><span>${esc(x.name)}</span><span>${fmt(x.busy)} / своб. ${fmt(x.free)}</span></div>`).join('') + '</div>' : '';
    const src = p.src === 'ge' ? [RS_LINK, 'Налоговая служба Грузии'] : p.src === 'tr' ? [GTI_LINK(p.tr), 'GTI, TIR-парки Турции'] : [BG_LINK, 'Гранична полиция Болгарии'];
    return `<div class="bd-pop"><b>${esc(p.title)}</b><div class="bd-muted">${esc(p.border)}</div>
      <div style="margin:6px 0">${st.text}</div>${parks}
      <div class="bd-muted">Обновлено: ${ago(st.at)}${st.asOf ? ' · сводка на ' + esc(st.asOf) : ''}</div>
      <div class="bd-links"><a href="${src[0]}" target="_blank" rel="noopener">${src[1]}</a>${p.link2 ? `<a href="${p.link2[0]}" target="_blank" rel="noopener">${p.link2[1]}</a>` : ''}</div></div>`;
  }

  function render() {
    const L = window.L;
    if (layer) layer.remove();
    layer = L.layerGroup().addTo(map);
    const rows = [];
    POINTS.forEach(p => {
      const st = stateOf(p);
      const icon = L.divIcon({ className: '', html: `<div class="bd-pin ${st.cls}"><span>${st.label}</span></div>`, iconSize: [44, 30], iconAnchor: [22, 30], popupAnchor: [0, -28] });
      L.marker([p.lat, p.lng], { icon, title: p.title }).bindPopup(popup(p, st), { maxWidth: 300 }).addTo(layer);
      rows.push(`<tr><td><b>${esc(p.title)}</b><div class="bd-muted">${esc(p.border)}</div></td><td>${st.text}</td><td><span class="bd-dot ${st.cls}"></span></td></tr>`);
    });
    const tp = data?.tpcentral?.data;
    if (tp) rows.push(`<tr><td><b>TPCentral</b><div class="bd-muted">Стоянка (Грузия)</div></td><td>Занято мест: <b>${fmt(tp.busy)}</b> · свободно: ${fmt(tp.free)} · на обслуживании: ${fmt(tp.in_service)}${tp.suspended ? '<br><b style="color:#A3241B">Вызов на границу временно приостановлен</b>' : ''}</td><td><span class="bd-dot ${tp.suspended ? 'bad' : 'ok'}"></span></td></tr>`);
    document.getElementById('bdList').innerHTML = rows.join('');
    document.getElementById('bdTime').textContent = 'Обновлено ' + ago(data.updated_at) + (data.errors && data.errors.length ? ' · часть источников недоступна, показаны последние данные' : '');
  }

  async function load(force) {
    const btn = document.getElementById('bdRefresh'); btn.disabled = true; btn.textContent = 'Обновляю…';
    try {
      const r = await fetch(API + (force ? '?refresh=1' : ''));
      data = await r.json();
      if (data.error) throw new Error(data.error);
      render();
    } catch (e) { document.getElementById('bdTime').textContent = 'Не удалось загрузить данные: ' + e.message; }
    btn.disabled = false; btn.textContent = 'Обновить';
  }

  async function open() {
    document.querySelector('.two-col').style.display = 'none';
    document.getElementById('bordersView').hidden = false;
    try { await loadLeaflet(); } catch (e) { document.getElementById('bdTime').textContent = e.message; return; }
    if (!map) {
      map = window.L.map('bdMap', { scrollWheelZoom: true }).setView([42.3, 35.5], 5);
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 50);
    load(false);
  }
  function close() {
    document.getElementById('bordersView').hidden = true;
    document.querySelector('.two-col').style.display = '';
  }

  function init() {
    const two = document.querySelector('.two-col'); if (!two) return;
    const sec = document.createElement('section');
    sec.id = 'bordersView'; sec.hidden = true; sec.setAttribute('aria-label', 'Очереди на границах');
    sec.innerHTML = `<div class="bd-head"><div><h2>Очереди на границах</h2><div class="bd-muted" id="bdTime">Загрузка…</div></div>
      <div class="bd-actions"><button type="button" class="btn btn-ghost btn-sm" id="bdRefresh">Обновить</button><button type="button" class="btn btn-primary btn-sm" id="bdBack">Назад к рейсам</button></div></div>
      <div class="bd-legend"><span><i class="bd-dot ok"></i>свободно</span><span><i class="bd-dot mid"></i>загружено</span><span><i class="bd-dot bad"></i>очередь / интенсивно</span><span>Число на пине — грузовики на стоянках перед границей (Грузия, турецкие TIR-парки). Болгария без турецкого парка: статус OK / !.</span></div>
      <div id="bdMap"></div>
      <div class="bd-card"><table class="bd-table"><thead><tr><th>Пункт</th><th>Состояние</th><th></th></tr></thead><tbody id="bdList"></tbody></table></div>`;
    two.parentNode.insertBefore(sec, two);
    document.getElementById('bdBack').addEventListener('click', close);
    document.getElementById('bdRefresh').addEventListener('click', () => load(true));
    const nb = document.getElementById('newTripBtn');
    if (nb) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost btn-sm'; b.id = 'bordersBtn'; b.textContent = 'Границы';
      b.style.marginRight = '6px'; b.addEventListener('click', open);
      nb.parentNode.insertBefore(b, nb);
    }
    const st = document.createElement('style');
    st.textContent = `
      #bordersView { padding: 24px 28px 40px; max-width: 1400px; display: flex; flex-direction: column; gap: 14px; }
      #bordersView[hidden] { display: none; }
      .bd-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
      .bd-head h2 { margin: 0; font-size: 24px; font-weight: 600; color: #14202B; }
      .bd-actions { display: flex; gap: 8px; }
      .bd-actions .btn-sm { height: 38px; padding: 0 14px !important; font-size: 14px !important; border-radius: 6px !important; }
      .bd-muted { font-size: 12.5px; color: #5B6670; }
      .bd-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: #5B6670; align-items: center; }
      .bd-legend span { display: inline-flex; align-items: center; gap: 6px; }
      #bdMap { height: 560px; border: 1px solid #E4E7EA; border-radius: 8px; z-index: 0; }
      .bd-pin { display: flex; align-items: center; justify-content: center; min-width: 40px; height: 26px; padding: 0 6px; border-radius: 13px; color: #fff; font: 600 13px 'IBM Plex Sans', system-ui, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,.3); border: 2px solid #fff; box-sizing: border-box; }
      .bd-pin.ok { background: #1B7F4B; } .bd-pin.mid { background: #C26A00; } .bd-pin.bad { background: #B3261E; } .bd-pin.na { background: #8A949C; }
      .bd-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #8A949C; }
      .bd-dot.ok { background: #1B7F4B; } .bd-dot.mid { background: #C26A00; } .bd-dot.bad { background: #B3261E; }
      .bd-pop { font: 13px/1.45 'IBM Plex Sans', system-ui, sans-serif; color: #14202B; }
      .bd-parks { border-top: 1px solid #EEF0F2; margin: 6px 0; padding-top: 4px; }
      .bd-parks div { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #3D4852; }
      .bd-links { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
      .bd-links a { color: #146C72; font-size: 12.5px; }
      .bd-card { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; overflow-x: auto; }
      .bd-table { width: 100%; border-collapse: collapse; min-width: 560px; }
      .bd-table th { text-align: left; font-size: 12px; font-weight: 600; color: #5B6670; background: #FAFBFB; padding: 10px 14px; border-bottom: 1px solid #E4E7EA; }
      .bd-table td { padding: 10px 14px; border-top: 1px solid #EEF0F2; font-size: 14px; vertical-align: top; }
      @media (max-width: 960px) { #bordersView { padding: 16px 12px 32px; } #bdMap { height: 420px; } }`;
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
