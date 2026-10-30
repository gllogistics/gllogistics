// GL Logistics — страница «Маршруты»: вкладки сравнения путей, аналитики, очередей, машин и калькулятора
(function () {
  const show = t => {
    document.querySelectorAll('.tab[data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.getElementById('rcMount').hidden = t !== 'rc';
    document.getElementById('raMount').hidden = t !== 'ra';
    document.getElementById('bdMount').hidden = t !== 'bd';
    document.getElementById('fmMount').hidden = t !== 'fm';
    const tc = document.getElementById('tcMount'); tc.hidden = t !== 'tc';
    if (t === 'tc' && !tc.firstChild) {   // калькулятор ТракКост загружается при первом открытии вкладки
      const f = document.createElement('iframe');
      f.src = '/truckcost.html?embed=1'; f.title = 'Калькулятор стоимости маршрута';
      f.style.cssText = 'width:100%;height:1100px;border:0;background:transparent;display:block';
      tc.appendChild(f);
    }
    localStorage.setItem('gl_routes_tab', t);
    window.dispatchEvent(new CustomEvent('gl-tab', { detail: t }));
  };
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab[data-tab]'); if (b) show(b.dataset.tab); });
  show(location.hash === '#analytics' ? 'ra' : location.hash === '#borders' ? 'bd' : location.hash === '#fleet' ? 'fm' : location.hash === '#calc' ? 'tc' : (localStorage.getItem('gl_routes_tab') || 'rc'));
  // высота калькулятора по его содержимому
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.tcHeight) return;
    const f = document.querySelector('#tcMount iframe'); if (f) f.style.height = Math.max(700, e.data.tcHeight + 4) + 'px';
  });
})();
