// GL Logistics — пункт «Автопарк» в меню, счётчик уведомлений и блок на главной
(function () {
  if (localStorage.getItem('gl_staff_user') !== 'TigranMetspagyan') return;
  const WORKER = 'https://gl-api.gltransam.workers.dev';
  const ICON = 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';
  const onFleet = location.pathname.indexOf('fleet') !== -1;
  let alerts = null;

  function badgeHtml() {
    if (!alerts || !alerts.length) return '';
    const red = alerts.some(a => a.status === 'overdue');
    return '<b class="gl-fleet-badge" style="position:absolute;top:2px;right:6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;font-size:10px;line-height:16px;text-align:center;color:#fff;background:' +
      (red ? '#C62828' : '#E65100') + '">' + alerts.length + '</b>';
  }

  function addLink(nav) {
    let a = nav.querySelector('a.gl-fleet-link');
    if (!a) {
      a = document.createElement('a');
      a.href = '/fleet.html';
      a.className = 'gl-fleet-link' + (onFleet ? ' active' : '');
      a.style.position = 'relative';
      nav.appendChild(a);
    }
    const html = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="' + ICON + '"/></svg><span>Автопарк</span>' + badgeHtml();
    if (a.innerHTML !== html) a.innerHTML = html;
  }

  function scan() {
    document.querySelectorAll('.nav-links, #navLinks').forEach(nav => {
      if (nav.children.length > 3) addLink(nav); // только полное меню админа
    });
  }

  function dashboardBlock() {
    if (location.pathname.indexOf('staff-dashboard') === -1 || !alerts || !alerts.length) return;
    if (document.getElementById('glFleetAlerts')) return;
    const anchor = document.getElementById('dashStart');
    const before = anchor ? anchor.closest('div') : document.getElementById('statsRowTop');
    if (!before || !before.parentNode) return;
    const box = document.createElement('a');
    box.id = 'glFleetAlerts';
    box.href = '/fleet.html';
    box.style.cssText = 'display:block;text-decoration:none;color:#1E3B42;background:#fff;border:1.5px solid #f5d0c5;border-radius:16px;padding:12px 16px;margin-bottom:1rem';
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const left = a => {
      const p = [];
      if (a.left_days != null) p.push(a.left_days < 0 ? 'просрочено ' + (-a.left_days) + ' дн.' : a.left_days + ' дн.');
      if (a.left_km != null) p.push(a.left_km <= 0 ? 'перепробег ' + (-a.left_km) + ' км' : a.left_km + ' км');
      return p.join(' / ');
    };
    box.innerHTML = '<div style="font-weight:800;font-size:.85rem;color:#C62828;margin-bottom:6px">Автопарк: требует внимания ' + alerts.length + '</div>' +
      alerts.slice(0, 6).map(a => '<div style="font-size:.8rem;padding:3px 0"><b>' + esc(a.plate) + '</b> · ' + esc(a.label) +
        ' · <span style="color:' + (a.status === 'overdue' ? '#C62828' : '#E65100') + '">' + esc(left(a)) + '</span></div>').join('') +
      (alerts.length > 6 ? '<div style="font-size:.75rem;color:#8fa8ab;margin-top:4px">и ещё ' + (alerts.length - 6) + '...</div>' : '');
    before.parentNode.insertBefore(box, before);
  }

  function start() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    fetch(WORKER + '/api/fleet/alerts').then(r => r.json()).then(d => {
      alerts = Array.isArray(d) ? d : [];
      scan();
      dashboardBlock();
    }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
