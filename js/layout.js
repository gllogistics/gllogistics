// GL Logistics — тёмное боковое меню (вариант B) для всех страниц персонала
(function () {
  const user = localStorage.getItem('gl_staff_user');
  if (!user) return;
  const isAdmin = user === 'TigranMetspagyan';
  const P = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    deals: '<path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3l-4 4-4-4"/>',
    req: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    inv: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    trip: '<rect x="1" y="4" width="14" height="12" rx="2"/><path d="M15 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
    disp: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>',
    clients: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    fleet: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    exp: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    files: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  };
  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const work = [['/staff-dashboard.html', 'Главная', 'home', true], ['/staff-cargo.html', 'Сделки', 'deals'], ['/carriers.html', 'Перевозчики', 'book'], ['/rateconfirmation', 'Заявки', 'req'],
                ['/invoice', 'Инвойсы', 'inv'], ['/trip-report', 'Рейсы', 'trip', true], ['/dispatch.html', 'Диспатчинг', 'disp', true]];
  const company = [['/clients', 'Клиенты', 'clients'], ['/fleet.html', 'Автопарк', 'fleet'], ['/expenses.html', 'Расходы', 'exp'], ['/files', 'Файлы', 'files']];
  const path = location.pathname.replace(/\.html$/, '');
  const link = ([href, label, ic]) => {
    const active = path === href.replace(/\.html$/, '') ? ' class="active" aria-current="page"' : '';
    const badge = href === '/fleet.html' ? '<b class="gl-badge" id="glFleetBadge" style="display:none"></b>' : '';
    return '<a href="' + href + '"' + active + '>' + svg(P[ic]) + '<span>' + label + '</span>' + badge + '</a>';
  };
  const items = isAdmin ? work : work.filter(w => !w[3]);
  let navHtml = (isAdmin ? '<div class="gl-group">Работа</div>' : '') + items.map(link).join('');
  if (isAdmin) navHtml += '<div class="gl-group">Компания</div>' + company.map(link).join('');
  const initials = user.replace(/[^A-Za-zА-Яа-я]/g, ' ').trim().split(/\s+|(?=[A-ZА-Я])/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'GL';

  function build() {
    if (document.getElementById('glSide')) return;
    document.body.classList.add('gl-shell');
    const side = document.createElement('aside');
    side.id = 'glSide';
    side.innerHTML = '<a class="gl-brand" href="' + (isAdmin ? '/staff-dashboard.html' : '/staff-cargo.html') + '"><img class="gl-logo" src="/images/GL_LOGISTICs_line_-09.jpg.png" alt=""><span>GL Logistics</span></a>' +
      '<nav aria-label="Основное меню">' + navHtml + '</nav>' +
      '<div class="gl-user"><div class="gl-ava">' + initials + '</div><div style="min-width:0"><div class="gl-uname">' + user.replace(/[<>&"]/g, '') + '</div>' +
      '<div class="gl-urole">' + (isAdmin ? 'Администратор' : 'Логист') + '</div></div><button type="button" class="gl-logout" id="glLogout">Выйти</button></div>';
    document.body.appendChild(side);
    const top = document.createElement('div');
    top.id = 'glTop';
    top.innerHTML = '<button type="button" id="glMenuBtn" aria-label="Меню">' + svg(P.menu) + '</button><span>GL Logistics</span>';
    document.body.appendChild(top);
    const shade = document.createElement('div');
    shade.id = 'glShade';
    document.body.appendChild(shade);
    document.getElementById('glMenuBtn').addEventListener('click', () => document.body.classList.toggle('gl-menu-open'));
    shade.addEventListener('click', () => document.body.classList.remove('gl-menu-open'));
    document.getElementById('glLogout').addEventListener('click', () => {
      ['gl_staff_user', 'gl_staff_login_time', 'gl_staff_token', 'gl_staff_last_active', 'gl_staff_role'].forEach(k => localStorage.removeItem(k));
      location.href = '/staff.html';
    });
    // старая шапка: прячем, если в ней не осталось полезных элементов
    document.querySelectorAll('.top-bar').forEach(tb => {
      const useful = [...tb.children].some(ch => !ch.matches('.brand, .btn-logout, .nav-links, #navLinks') &&
        !ch.querySelector('#logoutBtn') && ch.textContent.trim() !== '' && !ch.matches(':empty'));
      if (!useful) tb.classList.add('gl-empty');
    });
    if (isAdmin) {
      fetch('https://gl-api.gltransam.workers.dev/api/fleet/alerts').then(r => r.json()).then(a => {
        if (!Array.isArray(a) || !a.length) return;
        const b = document.getElementById('glFleetBadge');
        b.textContent = a.length; b.style.display = 'inline-block';
        if (a.some(x => x.status === 'overdue')) b.classList.add('red');
      }).catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
