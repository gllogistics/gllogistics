// GL Logistics — карта очередей на границах (страница «Рейсы»)
(function () {
  const API = 'https://gl-api.gltransam.workers.dev/api/borders';
  const TR_LINK = 'https://uygulamalar.gumruk.gov.tr/websahaozet/';
  const RS_LINK = 'https://www.rs.ge/TirPark-en?cat=1&tab=1';
  const BG_LINK = 'https://www.mvr.bg/gdgp/';
  const BY_LINK = 'https://gpk.gov.by/situation-at-the-border/';
  const PL_LINK = 'https://www.granica.gov.pl/';
  const CGR_LINK = 'https://cgr.qoldau.kz/ru/start';
  const EPD_LINK = 'https://public.epd-portal.ru/';
  const RGS_LINK = 'https://www.rosgranstroy.ru/checkpoints';
  const EE_LINK = ['https://www.eestipiir.ee/yphis/borderQueueInfo.action', 'Эстонская очередь (eestipiir.ee)'];
  const LT_LINK = ['https://www.ltsiena.lt/', 'Литовская очередь (ltsiena.lt)'];
  const LV_LINK = ['https://lvborder.lv/en/', 'Латвийская очередь (lvborder.lv)'];
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
    { key: 'Казбеги', title: 'Казбеги / Верхний Ларс', border: 'Грузия — Россия', lat: 42.7444, lng: 44.6261, src: 'ge' },
    { key: 'Натахтари', title: 'Натахтари (TPCentral)', border: 'Грузия: стоянка на трассе к Верхнему Ларсу', lat: 41.9212, lng: 44.7299, src: 'tp' },
    { key: 'Верхний Ларс', title: 'Верхний Ларс (РФ)', border: 'Россия → Грузия, электронная очередь', lat: 42.8050, lng: 44.6380, src: 'ru' },
    { key: 'Капитан Андреево', title: 'Капитан Андреево / Капыкуле', border: 'Болгария — Турция', lat: 41.7181, lng: 26.3226, src: 'bg', tr: 'kapikule', link2: [GTI_LINK('kapikule'), 'TIR-парк Капыкуле (GTI)'] },
    { key: 'Лесово', title: 'Лесово / Хамзабейли', border: 'Болгария — Турция', lat: 41.9719, lng: 26.5652, src: 'bg', tr: 'hamzabeyli', link2: [GTI_LINK('hamzabeyli'), 'TIR-парк Хамзабейли (GTI)'] },
    { key: 'Джилвегёзю', title: 'Джилвегёзю', border: 'Турция — Сирия', lat: 36.2267, lng: 36.6638, src: 'tr', tr: 'cilvegozu', link2: [GTI_LINK('cilvegozu'), 'TIR-парк Джилвегёзю (GTI)'] },
    { key: 'Кулата', title: 'Кулата / Промахон', border: 'Болгария — Греция', lat: 41.3940, lng: 23.3643, src: 'bg' },
    { key: 'Калотина', title: 'Калотина / Градина', border: 'Болгария — Сербия', lat: 42.9946, lng: 22.8683, src: 'bg' },
    { key: 'Видин', title: 'Видин — Калафат', border: 'Болгария — Румыния', lat: 43.9662, lng: 22.9133, src: 'bg' },
    { key: 'Русе', title: 'Русе — Джурджу', border: 'Болгария — Румыния', lat: 43.8916, lng: 25.9690, src: 'bg' },
    // Польша — Беларусь (Беларусь: машины в эл. очереди на выезд; Польша: часы ожидания на выезд)
    { key: 'kuk', title: 'Кукурики / Козловичи', border: 'Польша — Беларусь', lat: 52.0896, lng: 23.6201, src: 'eu', by: 'Козловичи', pl: 'Koroszczyn (Kukuryki)' },
    { key: 'ter', title: 'Тересполь / Брест', border: 'Польша — Беларусь', lat: 52.0790, lng: 23.6550, src: 'eu', by: 'Брест', pl: 'Terespol' },
    { key: 'bob', title: 'Бобровники / Берестовица', border: 'Польша — Беларусь', lat: 53.1380, lng: 23.9420, src: 'eu', by: 'Берестовица', pl: 'Bobrowniki' },
    { key: 'kuz', title: 'Кузница / Брузги', border: 'Польша — Беларусь', lat: 53.5300, lng: 23.6930, src: 'eu', by: 'Брузги', pl: 'Kuźnica' },
    { key: 'pol', title: 'Половце / Песчатка', border: 'Польша — Беларусь', lat: 52.3830, lng: 23.4570, src: 'eu', by: 'Песчатка', pl: 'Połowce' },
    { key: 'sla', title: 'Славатыче / Домачево', border: 'Польша — Беларусь', lat: 51.7500, lng: 23.5900, src: 'eu', by: 'Домачево', pl: 'Sławatycze' },
    // Литва — Беларусь
    { key: 'med', title: 'Мядининкай / Каменный Лог', border: 'Литва — Беларусь', lat: 54.5410, lng: 25.7180, src: 'eu', by: 'Каменный Лог', link2: LT_LINK },
    { key: 'sal', title: 'Шальчининкай / Бенякони', border: 'Литва — Беларусь', lat: 54.2470, lng: 25.3720, src: 'eu', by: 'Бенякони', link2: LT_LINK },
    { key: 'kot', title: 'Лаворишкес / Котловка', border: 'Литва — Беларусь', lat: 54.6800, lng: 26.0700, src: 'eu', by: 'Котловка', link2: LT_LINK },
    { key: 'pri', title: 'Райгардас / Привалка', border: 'Литва — Беларусь', lat: 53.9890, lng: 23.9840, src: 'eu', by: 'Привалка', link2: LT_LINK },
    { key: 'vid', title: 'Тверечюс / Видзы', border: 'Литва — Беларусь', lat: 55.2600, lng: 26.5200, src: 'eu', by: 'Видзы', link2: LT_LINK },
    // Латвия — Беларусь
    { key: 'gri', title: 'Патерниеки / Григоровщина', border: 'Латвия — Беларусь', lat: 55.8700, lng: 26.6200, src: 'eu', by: 'Григоровщина', link2: LV_LINK },
    { key: 'urb', title: 'Силене / Урбаны', border: 'Латвия — Беларусь', lat: 55.6780, lng: 26.7850, src: 'eu', by: 'Урбаны', link2: LV_LINK },
    // Польша — Россия (Калининград)
    { key: 'grz', title: 'Гжехотки / Мамоново', border: 'Польша — Россия', lat: 54.3890, lng: 19.8220, src: 'eu', pl: 'Grzechotki' },
    { key: 'gro', title: 'Гроново / Мамоново', border: 'Польша — Россия', lat: 54.4200, lng: 19.9600, src: 'eu', pl: 'Gronowo' },
    { key: 'bez', title: 'Безледы / Багратионовск', border: 'Польша — Россия', lat: 54.3550, lng: 20.6030, src: 'eu', pl: 'Bezledy' },
    { key: 'gol', title: 'Голдап / Гусев', border: 'Польша — Россия', lat: 54.3150, lng: 22.2890, src: 'eu', pl: 'Gołdap' },
    // Только ссылкой: сайты не разрешают автоматическое чтение или недоступны
    { key: 'kib', title: 'Кибартай / Чернышевское', border: 'Литва — Россия', lat: 54.6450, lng: 22.7600, src: 'link', link2: LT_LINK },
    { key: 'ter2', title: 'Терехова / Убылинка', border: 'Латвия — Россия', lat: 56.1700, lng: 28.1210, src: 'link', link2: LV_LINK },
    { key: 'gre', title: 'Гребнева / Убылинка', border: 'Латвия — Россия', lat: 56.9030, lng: 28.0870, src: 'link', link2: LV_LINK },
    { key: 'nar', title: 'Нарва / Ивангород', border: 'Эстония — Россия', lat: 59.3770, lng: 28.2080, src: 'link', link2: EE_LINK },
    { key: 'koi', title: 'Койдула / Куничина Гора', border: 'Эстония — Россия', lat: 57.8360, lng: 27.6420, src: 'link', link2: EE_LINK },
    { key: 'luh', title: 'Лухамаа / Шумилкино', border: 'Эстония — Россия', lat: 57.6080, lng: 27.3560, src: 'link', link2: EE_LINK },
    // ── Центральная Азия: Казахстан (выезд из РК, электронная очередь CarGoRuqsat) ──
    { key: 'kz-dostyk', reg: 'central', title: 'Достык / Алашанькоу', border: 'Казахстан — Китай', lat: 45.256, lng: 82.493, src: 'kz', kz: 'Достык - Алашанькоу' },
    { key: 'kz-khorgos', reg: 'central', title: 'Нур Жолы / Хоргос', border: 'Казахстан — Китай', lat: 44.224, lng: 80.384, src: 'kz', kz: 'Нур Жолы - Хоргос' },
    { key: 'kz-bakhty', reg: 'central', title: 'Бахты / Покиту', border: 'Казахстан — Китай', lat: 46.659, lng: 82.735, src: 'kz', kz: 'Бахты - Покиту' },
    { key: 'kz-kolzhat', reg: 'central', title: 'Калжат / Дулаты', border: 'Казахстан — Китай', lat: 43.637, lng: 80.607, src: 'kz', kz: 'Калжат - Дулаты' },
    { key: 'kz-maikap', reg: 'central', title: 'Майкапчагай / Зимунай', border: 'Казахстан — Китай', lat: 47.496, lng: 85.604, src: 'kz', kz: 'Майкапчагай - Зимунай' },
    { key: 'kz-ozinki', reg: 'central', title: 'Таскала / Озинки', border: 'Казахстан — Россия', lat: 51.199, lng: 49.727, src: 'kz', kz: 'Таскала - Озинки' },
    { key: 'kz-ilek', reg: 'central', title: 'Аксай / Илек', border: 'Казахстан — Россия', lat: 51.527, lng: 53.383, src: 'kz', kz: 'Аксай - Илек' },
    { key: 'kz-sagarchin', reg: 'central', title: 'Жайсан / Сагарчин', border: 'Казахстан — Россия', lat: 50.902, lng: 55.909, src: 'kz', kz: 'Жайсан - Сагарчин' },
    { key: 'kz-orsk', reg: 'central', title: 'Алимбет / Орск', border: 'Казахстан — Россия', lat: 51.231, lng: 58.474, src: 'kz', kz: 'Алимбет - Орск' },
    { key: 'kz-bugristoe', reg: 'central', title: 'Кайрак / Бугристое', border: 'Казахстан — Россия', lat: 54.007, lng: 61.602, src: 'kz', kz: 'Кайрак - Бугристое' },
    { key: 'kz-zverino', reg: 'central', title: 'Убаган / Звериноголовское', border: 'Казахстан — Россия', lat: 54.459, lng: 64.857, src: 'kz', kz: 'Убаган - Звериноголовское' },
    { key: 'kz-petuhovo', reg: 'central', title: 'Жана Жол / Петухово', border: 'Казахстан — Россия', lat: 55.065, lng: 67.887, src: 'kz', kz: 'Жана Жол - Петухово' },
    { key: 'kz-isilkul', reg: 'central', title: 'Каракога / Исилькуль', border: 'Казахстан — Россия', lat: 54.913, lng: 71.262, src: 'kz', kz: 'Каракога - Исилькуль' },
    { key: 'kz-kulunda', reg: 'central', title: 'Шарбакты / Кулунда', border: 'Казахстан — Россия', lat: 52.567, lng: 78.935, src: 'kz', kz: 'Шарбакты - Кулунда' },
    // ── Китай — Кыргызстан, Китай — Таджикистан: живой очереди нет ──
    { key: 'kg-torugart', reg: 'central', title: 'Торугарт', border: 'Кыргызстан — Китай', lat: 40.592, lng: 75.413, src: 'link',
      note: 'Очередь на этом переходе не публикуется. Пункт закрыт в выходные и праздники КНР, работает по китайскому времени; закрытия объявляет Пограничная служба Кыргызстана. В сентябре 2026 Кыргызстан и Китай договорились ежедневно обмениваться данными о числе ждущих машин, публичного табло пока нет.' },
    { key: 'kg-irkeshtam', reg: 'central', title: 'Иркештам', border: 'Кыргызстан — Китай', lat: 39.679, lng: 73.899, src: 'link',
      note: 'Очередь на этом переходе не публикуется. Пункт закрыт в выходные и праздники КНР, работает по китайскому времени; закрытия объявляет Пограничная служба Кыргызстана. Это путь из Китая в Кыргызстан и дальше в Узбекистан.' },
    { key: 'tj-kulma', reg: 'central', title: 'Кульма / Карасу', border: 'Таджикистан — Китай', lat: 38.149, lng: 74.801, src: 'link',
      note: 'Единственный переход Таджикистан — Китай, горный перевал на высоте около 4360 м. Очередь не публикуется; режим работы и сезон уточняйте у таможни Таджикистана и перевозчиков.' },
    // ── Дальний Восток: Россия — Китай (данные только после входа в ГИС ЭПД) ──
    { key: 'cn-zab', reg: 'far', title: 'Забайкальск / Маньчжурия', border: 'Россия — Китай', lat: 49.645, lng: 117.329, src: 'link', link2: [EPD_LINK, 'ГИС ЭПД: бронирование (Забайкальск)'],
      note: 'Очередь на выезд из России идёт через электронную систему ГИС ЭПД; цифры доступны только после входа в систему. Для Забайкальска бронирование слота обязательно.' },
    { key: 'cn-pogr', reg: 'far', title: 'Пограничный / Суйфэньхэ', border: 'Россия — Китай', lat: 44.411, lng: 131.375, src: 'link', link2: [RGS_LINK, 'Росгранстрой: пункты пропуска'],
      note: 'Публичной очереди для грузовиков нет. Информацию даёт Росгранстрой и перевозчики на пункте.' },
    { key: 'cn-blag', reg: 'far', title: 'Благовещенск / Хэйхэ', border: 'Россия — Китай', lat: 50.260, lng: 127.534, src: 'link', link2: [RGS_LINK, 'Росгранстрой: пункты пропуска'],
      note: 'Публичной очереди для грузовиков нет. Информацию даёт Росгранстрой и перевозчики на пункте.' },
  ];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('ru');
  const ago = iso => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : Math.round(m / 60) + ' ч назад'; };
  let map = null, layer = null, data = null;
  const fmtDay = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] : ''; };

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
    if (p.src === 'tp') {
      const t = data?.tpcentral?.data;
      if (!t || t.busy == null) return { label: '?', cls: 'na', text: 'Нет данных' };
      const load = (t.busy + (t.free || 0)) ? t.busy / (t.busy + (t.free || 0)) : 0;
      const cls = t.suspended ? 'bad' : load >= 0.85 ? 'bad' : load >= 0.6 ? 'mid' : 'ok';
      return { label: fmt(t.busy), cls, at: data.tpcentral.at,
        text: `Стоянка TPCentral: занято мест <b>${fmt(t.busy)}</b>, свободно ${fmt(t.free)}, на обслуживании ${fmt(t.in_service)}`
          + (t.suspended ? '<br><b style="color:#A3241B">Вызов на границу временно приостановлен</b>' : '<br>Вызов машин на границу идёт') };
    }
    if (p.src === 'link') {
      return { label: 'i', cls: 'na', text: p.note || 'Числа этой очереди смотрите на сайте источника: он не разрешает автоматическое чтение или сейчас недоступен.' };
    }
    if (p.src === 'kz') {
      const k = data?.kz?.data?.posts?.[p.kz];
      if (!k) return { label: '?', cls: 'na', text: 'Нет данных' };
      const d = k.first_in_days;
      const cls = d == null ? 'bad' : d <= 1 ? 'ok' : d <= 5 ? 'mid' : 'bad';
      const label = d == null ? '>60д' : d === 0 ? 'сег.' : d + 'д';
      const when = d == null ? 'в ближайшие 2 месяца свободных мест по обычной очереди нет'
        : d === 0 ? 'свободные места есть уже сегодня' : `ближайший свободный слот: <b>${esc(fmtDay(k.first_date))}</b> (через ${d} дн.)`;
      return { label, cls, at: data.kz.at, asOf: data.kz.data.as_of,
        text: `Выезд из Казахстана, электронная очередь: ${when}<br>Свободных мест по обычной очереди: сегодня <b>${fmt(k.today_std)}</b>, завтра <b>${fmt(k.tomorrow_std)}</b>, за 7 дней <b>${fmt(k.free_7d)}</b>`
          + `<div class="bd-note">Приоритетных (внеочередных, 100 МРП) сегодня: ${fmt(k.today_prem)}. Въезд в Казахстан и выезд из России/Китая на этом табло не показываются.</div>` };
    }
    if (p.src === 'eu') {
      const rank = { na: -1, ok: 0, mid: 1, bad: 2 };
      let cls = 'na', label = null; const parts = []; let at = null, asOf = null;
      const b = p.by ? data?.belarus?.data?.points?.[p.by] : null;
      if (b) {
        at = data.belarus.at; asOf = data.belarus.data.time;
        if (b.closed) parts.push('Беларусь, выезд грузовиков: <b>пункт не работает</b>');
        else if (b.out != null) {
          parts.push(`Беларусь, выезд грузовиков: <b>${fmt(b.out)}</b> машин${b.eq ? ' в электронной очереди' : ' в очереди'}`);
          label = fmt(b.out); const k = b.out >= 300 ? 'bad' : b.out >= 100 ? 'mid' : 'ok'; if (rank[k] > rank[cls]) cls = k;
        }
      }
      const q = p.pl ? data?.poland?.data?.points?.[p.pl] : null;
      if (q) {
        at = at || data.poland.at;
        if (q.wait_h != null) {
          parts.push(`Польша, выезд грузовиков: ожидание <b>~${q.wait_h} ч</b>${q.at ? ' (обновлено в ' + esc(q.at) + ')' : ''}`);
          if (!label) label = q.wait_h + 'ч';
          const k = q.wait_h >= 12 ? 'bad' : q.wait_h >= 3 ? 'mid' : 'ok'; if (rank[k] > rank[cls]) cls = k;
        } else parts.push('Польша, выезд грузовиков: нет данных');
      }
      if (!parts.length) {
        // белорусский источник закрыт для зарубежных серверов — даём ссылку, а не «?»
        const byDown = p.by && !(data?.belarus?.data?.points);
        return byDown
          ? { label: 'i', cls: 'na', text: 'Сайт Госпогранкомитета Беларуси не отдаёт данные серверам из-за рубежа. Число фур в очереди на выезд из Беларуси смотрите по ссылке ниже.' }
          : { label: '?', cls: 'na', text: 'Нет данных' };
      }
      if (p.by && !b && !(data?.belarus?.data?.points)) parts.push('Беларусь: смотрите по ссылке ниже (сайт ГПК не отдаёт данные серверам из-за рубежа)');
      if (!label) label = b && b.closed ? 'закр.' : '–';
      return { label, cls, text: parts.join('<br>'), at, asOf };
    }
    if (p.src === 'ru') {
      const l = data?.lars?.data;
      if (!l || l.queue == null) return { label: '?', cls: 'na', text: 'Нет данных' };
      return { label: fmt(l.queue), cls: l.queue >= 400 ? 'bad' : l.queue >= 150 ? 'mid' : 'ok', at: data.lars.at, asOf: l.time ? l.time + ' по Владикавказу' : null,
        text: `Электронная очередь на выезд из РФ: <b>${fmt(l.queue)}</b> машин, в зелёной зоне <b>${fmt(l.green)}</b> (можно ехать к МАПП)`
          + (l.areas && l.areas.length ? '<div class="bd-parks">' + l.areas.map(a => `<div><span>${esc(a.name)}</span><span>свободно ${fmt(a.free)}</span></div>`).join('') + '</div>' : '') };
    }
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
    const src = p.src === 'tp' ? ['https://tpcentral.ge/', 'TPCentral'] : p.src === 'kz' ? [CGR_LINK, 'CarGoRuqsat (КГД Казахстана)'] : p.src === 'link' ? null : p.src === 'eu' ? (p.by ? [BY_LINK, 'Госпогранкомитет Беларуси'] : [PL_LINK, 'Налоговая служба Польши']) : p.src === 'ru' ? ['https://zitic.ru/eo/vl/', 'ЗИТ ЦИ, электронная очередь'] : p.src === 'ge' ? [RS_LINK, 'Налоговая служба Грузии'] : p.src === 'tr' ? [GTI_LINK(p.tr), 'GTI, TIR-парки Турции'] : [BG_LINK, 'Гранична полиция Болгарии'];
    return `<div class="bd-pop"><b>${esc(p.title)}</b><div class="bd-muted">${esc(p.border)}</div>
      <div style="margin:6px 0">${st.text}</div>${parks}
      <div class="bd-muted">Обновлено: ${ago(st.at)}${st.asOf ? ' · сводка на ' + esc(st.asOf) : ''}</div>
      <div class="bd-links">${src ? `<a href="${src[0]}" target="_blank" rel="noopener">${src[1]}</a>` : ''}${p.src === 'eu' && p.by && p.pl ? `<a href="${PL_LINK}" target="_blank" rel="noopener">Налоговая служба Польши</a>` : ''}${p.link2 ? `<a href="${p.link2[0]}" target="_blank" rel="noopener">${p.link2[1]}</a>` : ''}</div></div>`;
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
    document.getElementById('bdList').innerHTML = rows.join('');
    renderKzTable();
  }
  // Все пункты Казахстана (в т.ч. без пина): по странам, самые загруженные сверху
  function renderKzTable() {
    const posts = data?.kz?.data?.posts || {};
    const names = Object.keys(posts);
    const box = document.getElementById('bdKzCard');
    if (!names.length) { box.hidden = true; document.getElementById('bdKzTitle').hidden = true; return; }
    const CC = { cn: 'Китай', ru: 'Россия', kg: 'Кыргызстан', uz: 'Узбекистан', tm: 'Туркменистан' };
    const order = ['cn', 'ru', 'kg', 'uz', 'tm'];
    const rank = k => k.first_in_days == null ? 999 : k.first_in_days;
    let html = '';
    order.concat([...new Set(names.map(n => posts[n].cc))].filter(x => !order.includes(x))).forEach(cc => {
      const list = names.filter(n => posts[n].cc === cc).sort((a, b) => rank(posts[b]) - rank(posts[a]));
      if (!list.length) return;
      html += `<tr class="bd-grp"><td colspan="3">Казахстан — ${esc(CC[cc] || cc.toUpperCase())}</td></tr>` + list.map(n => {
        const k = posts[n], d = k.first_in_days;
        const cls = d == null ? 'bad' : d <= 1 ? 'ok' : d <= 5 ? 'mid' : 'bad';
        const txt = d == null ? 'свободных мест нет 2 месяца' : d === 0 ? 'места есть сегодня' : `ближайший слот ${esc(fmtDay(k.first_date))} (через ${d} дн.)`;
        return `<tr><td><b>${esc(n)}</b></td><td>${txt}<div class="bd-muted">за 7 дней свободно мест: ${fmt(k.free_7d)}</div></td><td><span class="bd-dot ${cls}"></span></td></tr>`;
      }).join('');
    });
    document.getElementById('bdKzList').innerHTML = html;
    box.hidden = false; document.getElementById('bdKzTitle').hidden = false;
  }

  const SUMMARY = [['Сарпи', 'Сарпи'], ['Казбеги', 'Казбеги'], ['Натахтари', 'Натахтари'], ['Верхний Ларс', 'Ларс РФ'], ['Садахло', 'Садахло'], ['Красный мост', 'Кр. мост'],
                   ['Капитан Андреево', 'Капыкуле'], ['Лесово', 'Хамзабейли'], ['kuk', 'Козловичи'], ['bob', 'Бобровники'], ['sal', 'Бенякони'], ['med', 'Кам. Лог'], ['kz-khorgos', 'Хоргос'], ['kz-dostyk', 'Достык'], ['kz-orsk', 'Орск']];
  let expanded = localStorage.getItem('gl_borders_open') === '1';

  function renderSummary() {
    document.getElementById('bdChips').innerHTML = SUMMARY.map(([k, short]) => {
      const p = POINTS.find(x => x.key === k); const st = stateOf(p);
      return `<button type="button" class="bd-chip" data-key="${esc(k)}"><i class="bd-dot ${st.cls}"></i>${esc(short)} <b>${esc(st.label)}</b></button>`;
    }).join('');
  }

  async function load(force) {
    const btn = document.getElementById('bdRefresh'); btn.disabled = true; btn.textContent = 'Обновляю…';
    try {
      const r = await fetch(API + (force ? '?refresh=1' : ''));
      data = await r.json();
      if (data.error) throw new Error(data.error);
      renderSummary();
      document.getElementById('bdTime').textContent = 'Обновлено ' + ago(data.updated_at) + (data.errors && data.errors.length ? ' · часть источников недоступна, показаны последние данные' : '');
      // состояние каждого источника
      const SRC = [['georgia', 'Грузия'], ['tpcentral', 'TPCentral'], ['turkey', 'Турция (GTI)'], ['bulgaria', 'Болгария'], ['lars', 'Верхний Ларс'], ['belarus', 'Беларусь'], ['poland', 'Польша'], ['kz', 'Казахстан']];
      const errs = data.errors || [];
      document.getElementById('bdSources').innerHTML = 'Источники: ' + SRC.map(([k, n]) => {
        const e = errs.find(x => x.startsWith(k + ':'));
        const ok = data[k] && data[k].data && !e;
        return `<span class="${ok ? 'ok' : 'bad'}" title="${esc(e || '')}">${n} ${ok ? '✓' : '✕'}</span>`;
      }).join(' · ') + (errs.length ? '<div class="bd-errs">' + errs.map(esc).join('<br>') + '</div>' : '');
      if (map) render();
    } catch (e) { document.getElementById('bdTime').textContent = 'Не удалось загрузить: ' + e.message; }
    btn.disabled = false; btn.textContent = 'Обновить';
  }

  const REGIONS = { west: 'Европа, Турция, Кавказ', central: 'Казахстан, Китай, Центр. Азия', far: 'Дальний Восток' };
  function fitRegion(r) {
    if (!map) return;
    localStorage.setItem('gl_borders_region', r);
    const pts = POINTS.filter(p => (p.reg || 'west') === r && p.key !== 'Джилвегёзю');
    if (pts.length) map.fitBounds(pts.map(p => [p.lat, p.lng]), { padding: [24, 24], maxZoom: r === 'far' ? 5 : 8 });
    document.querySelectorAll('#bdRegions button').forEach(b => b.classList.toggle('on', b.dataset.reg === r));
  }
  async function setExpanded(v, focusKey) {
    expanded = v; localStorage.setItem('gl_borders_open', v ? '1' : '0');
    document.getElementById('bdBody').hidden = !v;
    const t = document.getElementById('bdToggle'); t.textContent = v ? 'Свернуть' : 'Показать карту'; t.setAttribute('aria-expanded', String(v));
    if (!v) return;
    try { await loadLeaflet(); } catch (e) { document.getElementById('bdTime').textContent = e.message; return; }
    if (!map) {
      map = window.L.map('bdMap', { scrollWheelZoom: true, wheelPxPerZoomLevel: 90, zoomSnap: 0.5 });  // колесо мыши над картой — приближение / отдаление
      map._glFitted = false;
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    }
    setTimeout(() => {
      map.invalidateSize();
      if (!map._glFitted) {   // масштаб считаем, когда карта уже видна и имеет размер
        fitRegion(localStorage.getItem('gl_borders_region') || 'west');
        map._glFitted = true;
      }
      if (data) render();
      if (focusKey) { const p = POINTS.find(x => x.key === focusKey); if (p) { fitRegion(p.reg || 'west'); map.setView([p.lat, p.lng], 8); } }
    }, 60);
  }

  function init() {
    const two = document.querySelector('.two-col'); const detail = document.getElementById('tripDetail');
    if (!two || !detail) return;
    // правая колонка: очереди сверху, выбранный рейс под ними
    const right = document.createElement('div'); right.className = 'right-col';
    detail.parentNode.insertBefore(right, detail); right.appendChild(detail);
    const card = document.createElement('section');
    card.id = 'bordersCard'; card.setAttribute('aria-label', 'Очереди на границах');
    card.innerHTML = `<div class="bd-top">
        <div class="bd-titles"><h3>Очереди на границах</h3><span class="bd-muted" id="bdTime">Загрузка…</span></div>
        <div class="bd-actions"><button type="button" class="bd-btn" id="bdRefresh">Обновить</button><button type="button" class="bd-btn primary" id="bdToggle" aria-expanded="false" aria-controls="bdBody">Показать карту</button></div>
      </div>
      <div class="bd-chips" id="bdChips"></div>
      <div class="bd-src" id="bdSources"></div>
      <div id="bdBody" hidden>
        <div class="bd-legend"><span><i class="bd-dot ok"></i>свободно</span><span><i class="bd-dot mid"></i>загружено</span><span><i class="bd-dot bad"></i>очередь / интенсивно</span><span>Число на пине — грузовики в очереди или на стоянках перед границей; «ч» — часы ожидания (Польша); «д» — дни до ближайшего свободного слота (Казахстан); «i» — только ссылка на источник.</span></div>
        <div class="bd-regions" id="bdRegions" role="group" aria-label="Область карты"></div>
        <div id="bdMap"></div>
        <div class="bd-card"><table class="bd-table"><thead><tr><th>Пункт</th><th>Состояние</th><th></th></tr></thead><tbody id="bdList"></tbody></table></div>
        <h4 class="bd-h4" id="bdKzTitle" hidden>Казахстан: все пункты, выезд из РК (электронная очередь)</h4>
        <div class="bd-card" id="bdKzCard" hidden><table class="bd-table"><thead><tr><th>Пункт</th><th>Ближайший свободный слот</th><th></th></tr></thead><tbody id="bdKzList"></tbody></table></div>
      </div>`;
    right.insertBefore(card, detail);
    document.getElementById('bdRegions').innerHTML = Object.entries(REGIONS).map(([k, l]) => `<button type="button" class="bd-reg" data-reg="${k}">${l}</button>`).join('');
    document.getElementById('bdRegions').addEventListener('click', e => { const b = e.target.closest('[data-reg]'); if (b) fitRegion(b.dataset.reg); });
    document.getElementById('bdRefresh').addEventListener('click', () => load(true));
    document.getElementById('bdToggle').addEventListener('click', () => setExpanded(!expanded));
    document.getElementById('bdChips').addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b) setExpanded(true, b.dataset.key); });
    const st = document.createElement('style');
    st.textContent = `
      .right-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      #bordersCard { background: #fff; border: 1px solid #E4E7EA; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .bd-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
      .bd-titles { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .bd-titles h3 { margin: 0; font-size: 15px; font-weight: 600; color: #14202B; }
      .bd-actions { display: flex; gap: 6px; }
      .bd-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #D5DADF; background: #fff; color: #14202B; font: inherit; font-size: 13px; cursor: pointer; }
      .bd-btn.primary { background: #146C72; border-color: #146C72; color: #fff; font-weight: 600; }
      .bd-btn:disabled { opacity: .6; }
      .bd-src { font-size: 12px; color: #5B6670; } .bd-src .ok { color: #1B6B3F; } .bd-src .bad { color: #A3241B; font-weight: 600; }
      .bd-errs { margin-top: 4px; font-size: 11.5px; color: #A3241B; word-break: break-word; }
      .bd-regions { display: flex; gap: 6px; flex-wrap: wrap; }
      .bd-reg { border: 1px solid #D5DADF; background: #fff; border-radius: 6px; padding: 5px 12px; font: inherit; font-size: 13px; cursor: pointer; color: #14202B; }
      .bd-reg.on { background: #146C72; border-color: #146C72; color: #fff; font-weight: 600; }
      .bd-h4 { margin: 8px 0 0; font-size: 14px; font-weight: 600; color: #14202B; }
      .bd-grp td { background: #F2F6F6; font-size: 12.5px; font-weight: 600; color: #3D4852; padding: 7px 12px; }
      .bd-note { margin-top: 4px; font-size: 12px; color: #5B6670; }
      .bd-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .bd-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #E4E7EA; background: #FAFBFB; border-radius: 14px; padding: 4px 10px; font: inherit; font-size: 13px; color: #3D4852; cursor: pointer; }
      .bd-chip b { color: #14202B; font-weight: 600; font-variant-numeric: tabular-nums; }
      .bd-chip:hover { border-color: #9CC5C8; }
      #bdBody { display: flex; flex-direction: column; gap: 10px; }
      #bdBody[hidden] { display: none; }
      .bd-muted { font-size: 12.5px; color: #5B6670; }
      .bd-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: #5B6670; align-items: center; }
      .bd-legend span { display: inline-flex; align-items: center; gap: 6px; }
      #bdMap { height: 460px; border: 1px solid #E4E7EA; border-radius: 8px; z-index: 0; }
      .bd-pin { display: flex; align-items: center; justify-content: center; min-width: 40px; height: 26px; padding: 0 6px; border-radius: 13px; color: #fff; font: 600 13px 'IBM Plex Sans', system-ui, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,.3); border: 2px solid #fff; box-sizing: border-box; white-space: nowrap; }
      .bd-pin.ok { background: #1B7F4B; } .bd-pin.mid { background: #C26A00; } .bd-pin.bad { background: #B3261E; } .bd-pin.na { background: #8A949C; }
      .bd-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #8A949C; flex-shrink: 0; }
      .bd-dot.ok { background: #1B7F4B; } .bd-dot.mid { background: #C26A00; } .bd-dot.bad { background: #B3261E; }
      .bd-pop { font: 13px/1.45 'IBM Plex Sans', system-ui, sans-serif; color: #14202B; }
      .bd-parks { border-top: 1px solid #EEF0F2; margin: 6px 0; padding-top: 4px; }
      .bd-parks div { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #3D4852; }
      .bd-links { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
      .bd-links a { color: #146C72; font-size: 12.5px; }
      .bd-card { border: 1px solid #E4E7EA; border-radius: 8px; overflow-x: auto; }
      .bd-table { width: 100%; border-collapse: collapse; min-width: 520px; }
      .bd-table th { text-align: left; font-size: 12px; font-weight: 600; color: #5B6670; background: #FAFBFB; padding: 9px 12px; border-bottom: 1px solid #E4E7EA; }
      .bd-table td { padding: 9px 12px; border-top: 1px solid #EEF0F2; font-size: 13.5px; vertical-align: top; }
      @media (max-width: 960px) { #bdMap { height: 360px; } }`;
    document.head.appendChild(st);
    load(false);
    if (expanded) setExpanded(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
