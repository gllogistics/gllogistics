function setLang(lang) {
  document.querySelectorAll('[data-lang]').forEach(el => {
    el.classList.toggle('lang-active', el.dataset.lang === lang);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector('.lang-btn[data-setlang="' + lang + '"]');
  if (btn) btn.classList.add('active');
  document.documentElement.lang = lang;
  document.body.classList.remove('lang-loading');
}

document.querySelectorAll('.lang-btn[data-setlang]').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.setlang));
});

setLang('en');

const obs = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')), { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// Chat toggle
const chatToggle = document.getElementById('chatToggle');
const chatOptions = document.getElementById('chatOptions');
if (chatToggle && chatOptions) {
  chatToggle.addEventListener('click', () => chatOptions.classList.toggle('show-chat'));
  document.addEventListener('click', (e) => {
    if (!chatToggle.contains(e.target) && !chatOptions.contains(e.target))
      chatOptions.classList.remove('show-chat');
  });
}

// Price modal
const modal = document.getElementById('priceModal');
const priceBtn = document.getElementById('priceRequestBtn');
const closeModal = document.getElementById('closeModal');
if (modal && priceBtn && closeModal) {
  priceBtn.onclick = () => modal.classList.add('active');
  closeModal.onclick = () => modal.classList.remove('active');
  window.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
}

// Карта — инициализируем только после загрузки Leaflet
function initMap() {
  try {
    if (typeof L === 'undefined') return;
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    const officeCoords = [40.1559722, 44.5058611];
    const map = L.map('map').setView(officeCoords, 17);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
      subdomains: 'abcd', maxZoom: 19
    }).addTo(map);
    L.marker(officeCoords).addTo(map)
      .bindPopup('<b>GL Logistics</b><br>Երևան, Շengavit, Sevan 86/2').openPopup();
  } catch(e) { console.warn('Map init failed:', e); }
}

if (typeof L !== 'undefined') {
  initMap();
} else {
  window.addEventListener('load', () => setTimeout(initMap, 500));
}
