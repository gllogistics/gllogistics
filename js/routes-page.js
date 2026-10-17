// GL Logistics — страница «Маршруты»: вкладки «Сравнить пути» и «Аналитика маршрутов»
(function () {
  const show = t => {
    document.querySelectorAll('.tab[data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.getElementById('rcMount').hidden = t !== 'rc';
    document.getElementById('raMount').hidden = t !== 'ra';
    document.getElementById('bdMount').hidden = t !== 'bd';
    document.getElementById('fmMount').hidden = t !== 'fm';
    localStorage.setItem('gl_routes_tab', t);
    window.dispatchEvent(new CustomEvent('gl-tab', { detail: t }));
  };
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab[data-tab]'); if (b) show(b.dataset.tab); });
  show(location.hash === '#analytics' ? 'ra' : location.hash === '#borders' ? 'bd' : location.hash === '#fleet' ? 'fm' : (localStorage.getItem('gl_routes_tab') || 'rc'));
})();
