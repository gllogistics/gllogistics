const officeCoords = [40.1559722, 44.5058611];
const map = L.map('map').setView(officeCoords, 17);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
L.marker(officeCoords).addTo(map).bindPopup("<b>GL Logistics</b><br>Երևան, Շենգավիթ, Սևանի 86/2").openPopup();

function setLang(lang) {
  document.querySelectorAll('[data-lang]').forEach(el => {
    el.classList.toggle('lang-active', el.dataset.lang === lang);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
  if (lang === 'am') document.querySelector('.lang-btn[data-setlang="am"]').classList.add('active');
  if (lang === 'ru') document.querySelector('.lang-btn[data-setlang="ru"]').classList.add('active');
  if (lang === 'en') document.querySelector('.lang-btn[data-setlang="en"]').classList.add('active');
  document.documentElement.lang = lang;
  document.body.classList.remove('lang-loading');
}

document.querySelectorAll('.lang-btn[data-setlang]').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.setlang));
});

setLang('en');

const obs = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')), { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
const chatToggle = document.getElementById('chatToggle'), chatOptions = document.getElementById('chatOptions');
chatToggle.addEventListener('click', () => chatOptions.classList.toggle('show-chat'));
document.addEventListener('click', (e) => { if (!chatToggle.contains(e.target) && !chatOptions.contains(e.target)) chatOptions.classList.remove('show-chat'); });

const modal = document.getElementById('priceModal');
const priceBtn = document.getElementById('priceRequestBtn');
const closeModal = document.getElementById('closeModal');
priceBtn.onclick = () => modal.classList.add('active');
closeModal.onclick = () => modal.classList.remove('active');
window.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
