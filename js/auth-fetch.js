// GL Logistics — автоматически прикладывает пропуск (токен) ко всем запросам к серверу
(function () {
  const API = 'https://gl-api.gltransam.workers.dev';
  const origFetch = window.fetch.bind(window);
  function toLogin() {
    ['gl_staff_user', 'gl_staff_login_time', 'gl_staff_token', 'gl_staff_last_active'].forEach(k => localStorage.removeItem(k));
    if (location.pathname.indexOf('staff.html') === -1) location.replace('/staff.html');
  }
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(API) !== 0) return origFetch(input, init);
    init = Object.assign({}, init || {});
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = localStorage.getItem('gl_staff_token');
    if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
    init.headers = headers;
    return origFetch(input, init).then(r => {
      if (r.status === 401) toLogin(); // пропуск истёк или отсутствует — войти заново
      return r;
    });
  };
})();
