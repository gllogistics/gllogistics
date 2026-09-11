const API_URL = 'https://gl-api.gltransam.workers.dev';

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  if (!username || !password) return;

  try {
    const res = await fetch(API_URL + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      // Пытаемся прочитать токен из ответа сервера, если он там есть.
      // Сейчас Worker может ещё не возвращать токен — тогда просто
      // сохраняем логин и время входа, как раньше. Как только на
      // сервере появится выдача токена (см. worker-additions.js),
      // всё заработает без дополнительных правок здесь.
      let token = null;
      try {
        const data = await res.json();
        if (data && data.token) token = data.token;
      } catch (_) { /* ответ мог быть без тела — это нормально */ }

      localStorage.setItem('gl_staff_user', username);
      localStorage.setItem('gl_staff_login_time', Date.now().toString());
      localStorage.setItem('gl_staff_last_active', Date.now().toString());
      if (token) localStorage.setItem('gl_staff_token', token);
      else localStorage.removeItem('gl_staff_token');

      // Логируем вход
      fetch(API_URL + '/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, status: 'ok' })
      }).catch(() => {});

      if (username === 'TigranMetspagyan') {
        window.location.href = 'staff-dashboard.html';
      } else {
        window.location.href = 'staff-cargo.html';
      }
    } else {
      errorMsg.style.display = 'block';
    }
  } catch (err) {
    errorMsg.textContent = 'Ошибка соединения';
    errorMsg.style.display = 'block';
  }
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('password').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') doLogin();
});

// ── Автовыход при неактивности (2 часа) ──────────────────────
const INACTIVE_TIMEOUT = 2 * 60 * 60 * 1000; // 2 часа

function updateActivity() {
  localStorage.setItem('gl_staff_last_active', Date.now().toString());
}

function checkInactivity() {
  const user = localStorage.getItem('gl_staff_user');
  if (!user) return;
  const last = parseInt(localStorage.getItem('gl_staff_last_active') || '0');
  if (last && Date.now() - last > INACTIVE_TIMEOUT) {
    // Логируем автовыход
    fetch(API_URL + '/api/auth/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, status: 'auto_logout' })
    }).catch(() => {});
    ['gl_staff_user','gl_staff_login_time','gl_staff_token','gl_staff_last_active','gl_staff_role']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = '/staff.html';
  }
}

// Обновляем активность при любом действии
['click','keydown','mousemove','touchstart','scroll'].forEach(evt =>
  document.addEventListener(evt, updateActivity, { passive: true })
);

// Проверяем каждые 5 минут
setInterval(checkInactivity, 5 * 60 * 1000);
// Проверяем сразу при загрузке
checkInactivity();
