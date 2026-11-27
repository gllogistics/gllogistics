// GL Logistics — правила режима труда и отдыха водителей (тахограф) и планировщик остановок.
// Один модуль для сайта (калькулятор рейса) и приложения GLL drivers assistant (режим водителя).
// Источники: Регламент (ЕС) 561/2006 с изменениями Регламента (ЕС) 2020/1054 (пакет мобильности),
// Европейское соглашение ЕСТР/AETR (для поездок с участием стран вне ЕС — те же нормы времени),
// Директива 2002/15/ЕС (рабочее время), Регламент (ЕС) 165/2014 (тахографы).
(function (root) {
  'use strict';
  const H = 3600e3;

  // ——— нормы (часы) ———
  const N = {
    contDrive: 4.5,          // непрерывное вождение, затем перерыв
    breakFull: 0.75,         // перерыв 45 мин (можно 15 + 30, в этом порядке)
    dayDrive: 9, dayDriveExt: 10, extPerWeek: 2,            // 9 ч в день, дважды в неделю до 10 ч
    weekDrive: 56, fortnightDrive: 90,                       // в календарную неделю и в две подряд
    dailyRest: 11, dailyRestReduced: 9, reducedPerWeek: 3,  // 11 ч; до 3 раз 9 ч между еженедельными
    splitRest: [3, 9],                                       // или 3 + 9 ч (в этом порядке) = обычный
    weeklyRest: 45, weeklyRestReduced: 24, weeklyMaxGap: 144, // 45 ч, сокращённый 24 ч; не позже 6 × 24 ч
    crewRest: 9, crewWindow: 30,                             // экипаж: 9 ч отдыха в каждые 30 ч
    workBreak6: 0.5, workBreak9: 0.75,                       // 2002/15: 30 мин после 6 ч работы, 45 мин после 9 ч
  };

  // ——— правила текстом (для сайта и приложения) ———
  const RULES = [
    { id: 'cont', t: 'Непрерывное вождение', n: 'Не больше 4 ч 30 мин, затем перерыв 45 мин. Перерыв можно разделить: сначала не меньше 15 мин, потом не меньше 30 мин.', s: '561/2006 ст. 7' },
    { id: 'day', t: 'Вождение за день', n: '9 ч между двумя ежедневными отдыхами. Дважды в календарную неделю — до 10 ч.', s: '561/2006 ст. 6(1)' },
    { id: 'week', t: 'Вождение за неделю', n: 'Не больше 56 ч в календарную неделю (пн 00:00 — вс 24:00) и не больше 90 ч в две недели подряд.', s: '561/2006 ст. 6(2), 6(3)' },
    { id: 'drest', t: 'Ежедневный отдых', n: 'Обычный — не меньше 11 ч. Можно разделить на 3 ч + 9 ч (сначала 3 ч). Между двумя еженедельными отдыхами — до 3 раз сокращённый, не меньше 9 ч, без компенсации. Отдых должен закончиться в течение 24 ч после окончания предыдущего: значит, рабочий день — не больше 13 ч (при 9 ч отдыха — 15 ч).', s: '561/2006 ст. 4, 8(1), 8(2), 8(4)' },
    { id: 'wrest', t: 'Еженедельный отдых', n: 'Начинается не позже чем через 6 × 24 ч после конца предыдущего. Обычный — 45 ч, сокращённый — 24 ч. За две недели подряд — два обычных или один обычный и один сокращённый. Недостающее до 45 ч компенсируется одним блоком до конца третьей недели, вместе с другим отдыхом не меньше 9 ч.', s: '561/2006 ст. 8(6), 8(7)' },
    { id: 'wrest2', t: 'Два сокращённых подряд', n: 'При международной перевозке водитель может взять два сокращённых еженедельных отдыха подряд вне страны базы, если за четыре недели у него не меньше четырёх еженедельных отдыхов, из них не меньше двух обычных, и компенсация берётся до следующего еженедельного отдыха.', s: '561/2006 ст. 8(6) (2020/1054)' },
    { id: 'cab', t: 'Где отдыхать', n: 'Ежедневный и сокращённый еженедельный отдых — можно в кабине на стоянке. Обычный еженедельный 45 ч и компенсацию в кабине проводить нельзя: нужно жильё с удобствами, его оплачивает работодатель.', s: '561/2006 ст. 8(8)' },
    { id: 'home', t: 'Возвращение домой', n: 'Работодатель организует возвращение водителя в страну базы или проживания каждые 4 недели (или 3 недели, если два сокращённых еженедельных отдыха подряд).', s: '561/2006 ст. 8(8a)' },
    { id: 'crew', t: 'Сменный экипаж', n: 'Если в машине два водителя, каждый должен получить ежедневный отдых не меньше 9 ч в каждые 30 ч. Перерыв засчитывается, пока ведёт второй водитель. В первый час второй водитель может присоединиться позже.', s: '561/2006 ст. 4(o), 8(5)' },
    { id: 'ferry', t: 'Паром и поезд', n: 'Обычный ежедневный или сокращённый еженедельный отдых на пароме или поезде можно прерывать не больше двух раз, всего не больше 1 ч, если у водителя есть спальное место (каюта или купе). Обычный еженедельный отдых — так же, если поездка длится 8 ч и больше.', s: '561/2006 ст. 9(1)' },
    { id: 'exc', t: 'Исключение, чтобы доехать', n: 'В исключительных случаях, без ущерба безопасности, можно превысить дневное и недельное вождение на 1 ч, чтобы доехать до базы или дома на еженедельный отдых, или на 2 ч — если перед этим был перерыв 30 мин. Причину надо записать на распечатке тахографа. Превышение компенсируется до конца третьей недели.', s: '561/2006 ст. 12' },
    { id: 'wt', t: 'Рабочее время', n: 'Погрузка, выгрузка, таможня, ожидание — «другая работа» или «готовность». Перерыв 30 мин после 6 ч работы, 45 мин после 9 ч. В среднем не больше 48 ч работы в неделю, максимум 60 ч.', s: '2002/15/ЕС ст. 4, 5' },
    { id: 'aetr', t: 'Страны вне ЕС (ЕСТР/AETR)', n: 'В Турции, на Кавказе, в Казахстане, России, Беларуси и на Балканах действует ЕСТР (AETR) с теми же нормами вождения, перерывов и отдыха. Правило о двух сокращённых еженедельных отдыхах подряд в ЕСТР применяется в своей редакции.', s: 'ЕСТР ст. 6–8' },
    { id: 'ban', t: 'Запреты движения', n: 'Во многих странах ЕС грузовикам свыше 7,5 т запрещено ездить в выходные и праздники. Время запрета можно использовать как отдых.', s: 'национальные правила' },
  ];

  // календарная неделя (понедельник 00:00 по местному времени)
  const weekKey = t => { const d = new Date(t); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day); return d.getTime(); };
  const prevWeekKey = k => k - 7 * 24 * H;

  // ——— планировщик ———
  // opts: { mode: 'opt' | 'std', crew: 1 | 2, start: Date, drivenBefore: ч сегодня,
  //         weekDriven: ч на этой неделе до выезда, lastWeekDriven: ч на прошлой неделе,
  //         reducedUsed: сокращённых ежедневных с последнего еженедельного, extUsed: 10-часовых дней на этой неделе,
  //         weeklyEnd: Date конца последнего еженедельного отдыха, lastWeeklyReduced: bool }
  function Planner(o) {
    o = o || {};
    this.opt = o.mode !== 'std';
    this.crew = o.crew === 2 ? 2 : 1;
    const t0 = (o.start ? +o.start : Date.now());
    this.cont = Math.min(o.drivenBefore || 0, N.contDrive);
    this.day = o.drivenBefore || 0;
    this.dayStart = t0 - (o.drivenBefore || 0) * H * 1.2;     // начало рабочего дня (приблизительно)
    this.week = {}; const k = weekKey(t0);
    this.week[k] = Math.max(o.weekDriven || 0, this.day); this.week[prevWeekKey(k)] = o.lastWeekDriven || 0;
    this.ext = {}; this.ext[k] = o.extUsed || 0;
    this.reduced = o.reducedUsed || 0;
    this.weeklyEnd = o.weeklyEnd ? +o.weeklyEnd : t0;
    this.lastWeeklyReduced = !!o.lastWeeklyReduced;
    this.dayExt = false;
    this.owed = 0;                                              // компенсация за сокращённые еженедельные, ч
  }
  Planner.prototype = {
    dayLimit(t) { const k = weekKey(t), canExt = this.opt && (this.ext[k] || 0) < N.extPerWeek;
      return this.crew === 2 ? (canExt ? 2 * N.dayDriveExt : 2 * N.dayDrive) : (canExt ? N.dayDriveExt : N.dayDrive); },
    weekLeft(t) { const k = weekKey(t), m = this.crew;
      return Math.max(0, Math.min(N.weekDrive * m - (this.week[k] || 0), N.fortnightDrive * m - (this.week[k] || 0) - (this.week[prevWeekKey(k)] || 0))); },
    nextDailyRest() { if (this.crew === 2) return N.crewRest; return this.opt && this.reduced < N.reducedPerWeek ? N.dailyRestReduced : N.dailyRest; },
    spreadLimit() { return this.crew === 2 ? N.crewWindow - N.crewRest : 24 - this.nextDailyRest(); },
    // сколько можно ехать от момента t до ближайшей обязательной остановки, и какой она будет
    allowance(t) {
      const out = [];
      if (this.crew === 1) out.push([N.contDrive - this.cont, 'break']);
      out.push([this.dayLimit(t) - this.day, 'daily']);
      out.push([this.weekLeft(t), 'weekly']);
      out.push([this.spreadLimit() - (t - this.dayStart) / H, 'daily']);
      out.push([N.weeklyMaxGap - (t - this.weeklyEnd) / H - this.nextDailyRest() * 0, 'weekly']);
      out.sort((a, b) => a[0] - b[0]);
      return { h: Math.max(0, out[0][0]), stop: out[0][1] };
    },
    drive(t, h) {
      const k = weekKey(t); this.cont += h; this.day += h; this.week[k] = (this.week[k] || 0) + h;
      const base = this.crew === 2 ? 2 * N.dayDrive : N.dayDrive;
      if (!this.dayExt && this.day > base + 1e-6) { this.dayExt = true; this.ext[k] = (this.ext[k] || 0) + 1; }
    },
    // нужен ли еженедельный отдых вместо ежедневного (6 × 24 ч скоро истекут или кончилась недельная норма)
    weeklyDue(t) {
      const sinceWeekly = (t - this.weeklyEnd) / H;
      return this.weekLeft(t) <= 0.25 || sinceWeekly + this.spreadLimit() + this.nextDailyRest() > N.weeklyMaxGap;
    },
    // взять обязательную остановку в момент t; возвращает {type, dur, label, note}
    takeStop(t, kind) {
      if (kind === 'break') { this.cont = 0;
        return { type: 'break', dur: N.breakFull, label: 'Перерыв 45 мин', note: 'после 4 ч 30 мин за рулём (можно 15 + 30 мин)' }; }
      if (kind === 'weekly' || this.weeklyDue(t)) return this.takeWeekly(t);
      const dur = this.nextDailyRest(), wasExt = this.dayExt, reduced = this.crew === 1 && dur < N.dailyRest;
      if (reduced) this.reduced++;
      this.resetDay(t + dur * H);
      const notes = [];
      if (this.crew === 2) notes.push('сменный экипаж: 9 ч в течение 30 ч');
      else if (reduced) notes.push(`сокращённый, ${this.reduced} из 3 до еженедельного отдыха`);
      if (wasExt) notes.push(`перед ним день с 10 ч за рулём (${this.ext[weekKey(t)]} из 2 на неделе)`);
      return { type: 'rest', dur, label: (reduced ? 'Сокращённый ежедневный отдых ' : 'Ежедневный отдых ') + dur + ' ч', note: notes.join('; ') };
    },
    takeWeekly(t) {
      // за две недели подряд — хотя бы один обычный; в режиме «стандарт» всегда 45 ч
      let reduced = this.opt && !this.lastWeeklyReduced;
      let dur = reduced ? N.weeklyRestReduced : N.weeklyRest, wait = '';
      // недельная (или двухнедельная) норма кончилась — отдыхаем до начала новой календарной недели
      if (this.weekLeft(t) <= 0.25) {
        const untilMonday = (weekKey(t) + 7 * 24 * H - t) / H;
        if (untilMonday > dur) { dur = Math.ceil(untilMonday * 4) / 4; wait = 'недельная норма вождения исчерпана — стоим до понедельника'; }
        if (dur >= N.weeklyRest) reduced = false;
      }
      if (reduced) this.owed += N.weeklyRest - N.weeklyRestReduced;
      this.lastWeeklyReduced = reduced; this.reduced = 0;
      this.weeklyEnd = t + dur * H; this.resetDay(this.weeklyEnd);
      const hh = Math.floor(dur), mm = Math.round((dur - hh) * 60);
      return { type: 'weekly', dur, label: (reduced ? 'Сокращённый еженедельный отдых ' : 'Еженедельный отдых ') + hh + ' ч' + (mm ? ' ' + mm + ' мин' : ''),
        note: [wait, reduced ? 'компенсация 21 ч — одним блоком до конца третьей недели, вместе с отдыхом не меньше 9 ч; можно в кабине'
                             : 'обычный еженедельный — не в кабине: нужна гостиница или жильё'].filter(Boolean).join('; ') };
    },
    resetDay(tEnd) { this.cont = 0; this.day = 0; this.dayExt = false; this.dayStart = tEnd; },
    // простой (запрет движения, длинная погрузка) засчитывается как отдых, если достаточно длинный
    idle(t, h) {
      if (h >= N.weeklyRestReduced && (t - this.weeklyEnd) / H > 24) { this.lastWeeklyReduced = h < N.weeklyRest; this.reduced = 0; this.weeklyEnd = t + h * H; this.resetDay(this.weeklyEnd); return 'weekly'; }
      if (h >= N.dailyRest) { this.resetDay(t + h * H); return 'daily'; }
      if (h >= N.dailyRestReduced && this.crew === 1 && this.opt && this.reduced < N.reducedPerWeek) { this.reduced++; this.resetDay(t + h * H); return 'daily'; }
      if (h >= N.breakFull) { this.cont = 0; this.split15 = false; return 'break'; }
      // перерыв по частям: сначала не меньше 15 мин, потом не меньше 30 мин
      if (h >= 0.5 && this.split15) { this.cont = 0; this.split15 = false; return 'break'; }
      if (h >= 0.25) { this.split15 = true; return 'break15'; }
      return null;
    },
    // состояние для сохранения в телефоне (приложение) и восстановления после перезапуска
    save() { const o = {}; for (const k of Object.keys(this)) o[k] = this[k]; return JSON.stringify(o); }
  };
  Planner.load = function (json) { const p = new Planner({}); try { Object.assign(p, JSON.parse(json)); } catch (e) {} return p; };

  root.TACHO = { N, RULES, Planner, weekKey };
})(typeof window !== 'undefined' ? window : globalThis);
