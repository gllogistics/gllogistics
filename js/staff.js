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
      if (token) localStorage.setItem('gl_staff_token', token);
      else localStorage.removeItem('gl_staff_token');

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
