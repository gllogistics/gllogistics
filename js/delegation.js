// GL Logistics — Делегирование водителей (Польша): бланк «Potwierdzenie delegowania»
(function () {
  const WORKER = 'https://gl-api.gltransam.workers.dev';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = (p, m = 'GET', b) => fetch(WORKER + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());

  // ── Латиница: бланк по правилам заполняется только латинскими буквами ──
  const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g' };
  const ARM = ['a', 'b', 'g', 'd', 'e', 'z', 'e', 'y', 't', 'zh', 'i', 'l', 'kh', 'ts', 'k', 'h', 'dz', 'gh', 'ch', 'm', 'y', 'n', 'sh', 'o', 'ch', 'p', 'j', 'r', 's', 'v', 't', 'r', 'ts', 'u', 'p', 'k', 'o', 'f'];
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  function latin(s) {
    return String(s ?? '').replace(/(^|[^\u0531-\u0587])([\u0535\u0565\u0548\u0578])/g, (m, a, ch) => a + ({ '\u0535': 'Ye', '\u0565': 'ye', '\u0548': 'Vo', '\u0578': 'vo' })[ch])
      .replace(/[\u0400-\u04FF\u0531-\u0587]/g, ch => {
      const c = ch.charCodeAt(0);
      if (c >= 0x561 && c <= 0x586) return ARM[c - 0x561];
      if (c >= 0x531 && c <= 0x556) return cap(ARM[c - 0x531]);
      if (c === 0x587) return 'ev';
      const low = ch.toLowerCase();
      if (CYR[low] !== undefined) return low === ch ? CYR[low] : cap(CYR[low]);
      return '';
    });
  }
  const hasNonLatin = s => /[\u0400-\u04FF\u0531-\u0587]/.test(String(s || ''));
  const clean = s => latin(s).replace(/\s+/g, ' ').trim();

  // ── Справочники ──
  const LAWS = {
    AM: ['prawo Republiki Armenii', 'law of the Republic of Armenia', 'Армения'],
    GE: ['prawo Gruzji', 'law of Georgia', 'Грузия'],
    TR: ['prawo Republiki Turcji', 'law of the Republic of Türkiye', 'Турция'],
    BY: ['prawo Republiki Białorusi', 'law of the Republic of Belarus', 'Беларусь'],
    UA: ['prawo Ukrainy', 'law of Ukraine', 'Украина'],
    RU: ['prawo Federacji Rosyjskiej', 'law of the Russian Federation', 'Россия'],
    KZ: ['prawo Republiki Kazachstanu', 'law of the Republic of Kazakhstan', 'Казахстан'],
    UZ: ['prawo Republiki Uzbekistanu', 'law of the Republic of Uzbekistan', 'Узбекистан'],
    AZ: ['prawo Republiki Azerbejdżanu', 'law of the Republic of Azerbaijan', 'Азербайджан'],
    KG: ['prawo Republiki Kirgiskiej', 'law of the Kyrgyz Republic', 'Кыргызстан'],
    MD: ['prawo Republiki Mołdawii', 'law of the Republic of Moldova', 'Молдова']
  };
  const CARRIAGE = {
    goods_int: 'Przewóz rzeczy, przewóz międzynarodowy / Carriage of goods, international carriage',
    goods_cab: 'Przewóz rzeczy, kabotaż / Carriage of goods, cabotage',
    pax_int: 'Przewóz osób, przewóz międzynarodowy / Carriage of passengers, international carriage',
    pax_cab: 'Przewóz osób, kabotaż / Carriage of passengers, cabotage'
  };
  const CARRIAGE_RU = { goods_int: 'Грузы, международная перевозка', goods_cab: 'Грузы, каботаж', pax_int: 'Пассажиры, международная перевозка', pax_cab: 'Пассажиры, каботаж' };
  const dmy = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || ''); };
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const fmtPlate = s => { const t = String(s || '').trim().toUpperCase(); const m = t.replace(/\s+/g, '').match(/^(\d{3})([A-Z]{1,2})(\d{2})$/); return m ? `${m[1]} ${m[2]} ${m[3]}` : t; };

  // ── PDF ──
  const MM = 72 / 25.4, PW = 595.28, PH = 841.89, MARGIN = 15 * MM, CW = PW - 2 * MARGIN;
  let fontsReady = null;
  function loadFonts(doc) {
    const files = [['DejaVuSans.sub.ttf', 'normal'], ['DejaVuSans-Bold.sub.ttf', 'bold'], ['DejaVuSans-Oblique.sub.ttf', 'italic']];
    if (!fontsReady) {
      fontsReady = Promise.all(files.map(async ([f]) => {
        const buf = new Uint8Array(await (await fetch('/fonts/' + f)).arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
        return btoa(bin);
      }));
    }
    return fontsReady.then(b64 => files.forEach(([f, style], i) => { doc.addFileToVFS(f, b64[i]); doc.addFont(f, 'DejaVu', style); }));
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  async function buildPdf(d, stampUrl) {
    const { jsPDF } = window.jspdf;
    let stampImg = null;
    if (d.stamp && stampUrl) { try { stampImg = await loadImg(stampUrl); } catch (e) { stampImg = null; } }
    for (const compact of [false, true]) {
      const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      await loadFonts(doc);
      doc.setProperties({ title: 'Potwierdzenie delegowania - ' + d.driver_name });
      const xL = MARGIN + 3 * MM, wF = CW - 6 * MM;
      let y = 14 * MM;
      const wrapped = (text, style, size, lead, x, w, align) => {
        doc.setFont('DejaVu', style); doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, w);
        lines.forEach((ln, i) => doc.text(ln, align === 'center' ? x + w / 2 : x, y + size * 0.95 + i * lead, align === 'center' ? { align: 'center' } : undefined));
        return lines.length * lead;
      };
      y += wrapped('POTWIERDZENIE DELEGOWANIA KIEROWCY NA TERYTORIUM RZECZYPOSPOLITEJ POLSKIEJ Z PAŃSTWA TRZECIEGO', 'bold', 11, 13.5, MARGIN, CW, 'center') + 2;
      y += wrapped('CONFIRMATION OF A POSTING DECLARATION OF A DRIVER POSTED TO THE REPUBLIC OF POLAND FROM A THIRD COUNTRY', 'bold', 11, 13.5, MARGIN, CW, 'center') + 6;
      y += wrapped('Należy wypełnić na komputerze lub maszynowo łacińskimi znakami i podpisać przed rozpoczęciem podróży / To be filled in on a computer or typewriter in Latin characters and signed before a journey', 'italic', 8.3, 10.5, MARGIN, CW, 'center') + 8;
      const boxTop = y;
      const gap = compact ? 3 : 6;
      const field = (num, label, value, italic) => {
        y += wrapped(`${num}. ${label}`, italic ? 'italic' : 'normal', 8.3, 10.6, xL, wF) + 2;
        doc.setFont('DejaVu', 'bold'); doc.setFontSize(9.7);
        const lines = doc.splitTextToSize(value || '', wF - 4);
        lines.forEach((ln, i) => doc.text(ln, xL + 2, y + 9 + i * 12));
        const ly = y + 11 + (Math.max(1, lines.length) - 1) * 12;
        doc.setLineWidth(0.6); doc.line(xL, ly, xL + wF, ly);
        y = ly + gap;
      };
      field('1', "Nazwa przewoźnika drogowego / Company's name", d.company_name);
      field('2', "Adres siedziby przewoźnika albo jego adres zamieszkania (ulica i numer, kod pocztowy, miejscowość, państwo) / Company's address or carrier address of residence (Street address, postal code, city, country)", d.company_address);
      field('3', "Numer telefonu przewoźnika drogowego (w tym międzynarodowy numer kierunkowy) / Company's telephone number (including international prefix)", d.company_phone);
      field('4', "Adres e-mail przewoźnika drogowego / Company's e-mail address", d.company_email);
      field('5', 'Numer zezwolenia wymaganego w międzynarodowym transporcie drogowym lub formularza jazdy / Number of permit to perform international road transport or number of journey form', d.permit_number);
      field('6', "Imię i nazwisko kierowcy / Driver's first name and surname", d.driver_name);
      field('7', "Adres zamieszkania kierowcy (ulica i numer, kod pocztowy, miejscowość, państwo) / Driver's address of residence (Street address, postal code, city, country)", d.driver_address);
      field('8', "Numer prawa jazdy kierowcy / Driver's driving licence number", d.license_number);
      field('9', "Data rozpoczęcia obowiązywania umowy o pracę kierowcy lub dokumentu równoważnego z taką umową, oraz właściwe dla tej umowy prawo (dzień/miesiąc/rok) / Date of commencement of the driver's employment contract or equivalent document, and the law applicable to it (day/month/year)", d.contract_info, true);
      field('10', 'Numer rejestracyjny pojazdu silnikowego, którym wykonywany jest przewóz objęty delegowaniem / Number plates of the motor vehicle by which the carriage covered by the posting rules is performed', d.vehicle_plates);
      field('11', 'Rodzaj przewozu objętego zasadami delegowania / Type of carriage covered by the posting rules', d.carriage_type);
      field('12', 'Miejscowość / Place', d.place);
      field('13', 'Data (dzień/miesiąc/rok) / Date (day/month/year)', d.date);
      y += 4;
      const sigW = (wF - 10 * MM) / 2, xR = xL + sigW + 10 * MM;
      doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.3);
      const lblY = y + 8;
      doc.text("14. Podpis kierowcy / Driver's signature", xL, lblY);
      doc.text("15. Podpis przewoźnika drogowego / Carrier's signature", xR, lblY);
      const stampBox = (compact ? 32 : 40) * MM;
      const lineY = lblY + (stampImg ? stampBox + 2 * MM : 22);
      doc.setLineWidth(0.6); doc.line(xL, lineY, xL + sigW, lineY); doc.line(xR, lineY, xR + sigW, lineY);
      if (stampImg) {
        const k = Math.min(stampBox / stampImg.naturalWidth, stampBox / stampImg.naturalHeight);
        const w = stampImg.naturalWidth * k, h = stampImg.naturalHeight * k;
        doc.addImage(stampUrl, 'PNG', xR + (sigW - w) / 2, lineY - 1 - h, w, h);
      }
      const noteBase = lineY + 14;
      doc.setFont('DejaVu', 'italic'); doc.setFontSize(7.6);
      doc.text('Objaśnienia / Explanatory notes:', xL, noteBase);
      y = noteBase + 4;
      y += wrapped('¹ Wypełnić jeśli wymagane jest zezwolenie w międzynarodowym transporcie drogowym / To be filled in if permit to perform international road transport is required', 'italic', 7.6, 9.4, xL, wF);
      const boxBottom = y + 4;
      if (boxBottom > PH - 10 * MM && !compact) continue;      // не влезло — пробуем компактнее
      doc.setLineWidth(1); doc.rect(MARGIN, boxTop - 4, CW, boxBottom - (boxTop - 4));
      return doc;
    }
  }

  // ── Состояние ──
  let carriers = [], drivers = [], forms = [], fleet = [], tab = 'new', lastUrl = null, lastName = 'Potwierdzenie_delegowania.pdf';
  const carrierById = id => carriers.find(c => c.id == id);
  const lawOpts = sel => Object.entries(LAWS).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v[2]}</option>`).join('') + `<option value="X"${sel === 'X' ? ' selected' : ''}>Другое…</option>`;

  async function loadAll() {
    const [c, d, f, fl] = await Promise.all([api('/api/deleg/carriers').catch(() => []), api('/api/deleg/drivers').catch(() => []), api('/api/deleg/forms').catch(() => []), api('/api/fleet').catch(() => [])]);
    carriers = Array.isArray(c) ? c : []; drivers = Array.isArray(d) ? d : []; forms = Array.isArray(f) ? f : []; fleet = Array.isArray(fl) ? fl : [];
    renderAll();
  }

  function renderAll() {
    $('carrierSel').innerHTML = '<option value="">— выберите перевозчика —</option>' + carriers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    fillDriverSel(); fillFleetSel();
    $('plateList').innerHTML = [...new Set(forms.map(f => f.plates).filter(Boolean))].map(p => `<option value="${esc(p)}">`).join('');
    $('permitList').innerHTML = [...new Set(forms.map(f => { try { return JSON.parse(f.data).permit_number; } catch (e) { return ''; } }).filter(Boolean))].map(p => `<option value="${esc(p)}">`).join('');
    renderHist(); renderCarriers(); renderDrivers();
  }
  function fillDriverSel() {
    const cid = $('carrierSel').value;
    const list = drivers.filter(d => !cid || !d.carrier_id || d.carrier_id == cid);
    $('driverSel').innerHTML = '<option value="">— выберите водителя —</option>' + list.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  }
  function fillFleetSel() {
    const trucks = fleet.filter(v => v.type === 'truck');
    $('fleetSel').innerHTML = '<option value="">из автопарка…</option>' + trucks.map(v => `<option value="${v.id}">${esc(v.plate)}${v.brand ? ' · ' + esc(v.brand) : ''}</option>`).join('');
    $('fleetRow').style.display = trucks.length ? '' : 'none';
  }

  // ── Форма нового бланка ──
  function onCarrier() {
    const c = carrierById($('carrierSel').value); fillDriverSel();
    if (!c) return;
    $('f1').value = c.name || ''; $('f2').value = c.address || ''; $('f3').value = c.phone || ''; $('f4').value = c.email || '';
    $('f12').value = c.place || 'Yerevan'; $('fLaw').value = c.law || 'AM'; toggleLaw();
    $('fStamp').checked = !!c.stamp; $('fStamp').disabled = !c.stamp; $('stampHint').textContent = c.stamp ? '' : 'У этого перевозчика нет печати: загрузите её во вкладке «Перевозчики».';
  }
  function onDriver() {
    const d = drivers.find(x => x.id == $('driverSel').value); if (!d) return;
    $('f6').value = d.name || ''; $('f7').value = d.address || ''; $('f8').value = d.license || ''; $('fContract').value = d.contract_date || '';
    if (d.carrier_id && !$('carrierSel').value) { $('carrierSel').value = d.carrier_id; onCarrier(); $('driverSel').value = d.id; }
  }
  function toggleLaw() { $('fLawOther').style.display = $('fLaw').value === 'X' ? '' : 'none'; }
  function collect() {
    const law = $('fLaw').value === 'X' ? clean($('fLawOther').value) : (LAWS[$('fLaw').value] || LAWS.AM).slice(0, 2).join(' / ');
    const tractor = clean($('fTractor').value), trailer = clean($('fTrailer').value);
    const plates = $('fPlatesFree').value.trim() ? clean($('fPlatesFree').value) : (trailer ? `${tractor} (ciągnik / tractor) + ${trailer} (naczepa / trailer)` : (tractor ? `${tractor} (ciągnik / tractor)` : ''));
    return {
      company_name: clean($('f1').value), company_address: clean($('f2').value), company_phone: clean($('f3').value), company_email: clean($('f4').value),
      permit_number: clean($('f5').value), driver_name: clean($('f6').value), driver_address: clean($('f7').value), license_number: clean($('f8').value),
      contract_info: ($('fContract').value ? dmy($('fContract').value) : '') + (law ? ' — ' + law : ''),
      vehicle_plates: plates, carriage_type: CARRIAGE[$('fCarriage').value], place: clean($('f12').value), date: dmy($('f13').value),
      stamp: $('fStamp').checked && !$('fStamp').disabled, _tractor: tractor, _trailer: trailer, _contract: $('fContract').value, _law: $('fLaw').value, _lawText: $('fLawOther').value, _carriage: $('fCarriage').value, _date: $('f13').value
    };
  }
  function validate(d) {
    const need = [['company_name', 'название перевозчика'], ['company_address', 'адрес перевозчика'], ['driver_name', 'ФИО водителя'], ['driver_address', 'адрес водителя'], ['license_number', 'номер прав'], ['vehicle_plates', 'номер ТС'], ['place', 'место'], ['date', 'дату']];
    const miss = need.filter(([k]) => !d[k]).map(x => x[1]);
    if (!$('fContract').value) miss.push('дату начала трудового договора');
    return miss;
  }
  async function showPdf(d, stampUrl, label) {
    const btn = $('makeBtn'); btn.disabled = true; btn.textContent = 'Создаю…';
    try {
      if (!window.jspdf) throw new Error('Библиотека PDF не загрузилась. Проверьте интернет и обновите страницу.');
      const doc = await buildPdf(d, stampUrl);
      const blob = doc.output('blob');
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(blob);
      lastName = 'Potwierdzenie_delegowania_' + (d.driver_name || 'driver').replace(/[^A-Za-z0-9]+/g, '_') + '_' + (d.vehicle_plates || '').split(' ')[0].replace(/[^A-Za-z0-9]/g, '') + '.pdf';
      $('pdfFrame').src = lastUrl + '#view=FitH';
      $('pdfBox').hidden = false; $('pdfEmpty').hidden = true;
      $('dlLink').href = lastUrl; $('dlLink').download = lastName;
      $('pdfTitle').textContent = label || 'Готовый бланк';
      setTab('new');
      $('pdfBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally { btn.disabled = false; btn.textContent = 'Создать PDF'; }
  }
  async function make() {
    const d = collect(); const miss = validate(d);
    if (miss.length) { alert('Заполните: ' + miss.join(', ')); return; }
    const c = carrierById($('carrierSel').value);
    try {
      await showPdf(d, c && c.stamp, 'Готовый бланк: ' + d.driver_name);
      const saved = await api('/api/deleg/forms', 'POST', { carrier_id: c ? c.id : null, driver_id: $('driverSel').value || null, carrier_name: d.company_name, driver_name: d.driver_name, plates: d.vehicle_plates, doc_date: $('f13').value, data: JSON.stringify(d) });
      if (saved && saved.id) { const f = await api('/api/deleg/forms').catch(() => null); if (Array.isArray(f)) { forms = f; renderHist(); } }
    } catch (e) { alert('Не удалось создать PDF: ' + e.message); }
  }

  // ── История ──
  function renderHist() {
    $('histBody').innerHTML = forms.length ? forms.map(f => `<tr>
      <td>${esc(dmy(f.doc_date) || (f.created_at || '').slice(0, 10))}</td><td><b>${esc(f.driver_name)}</b><div class="muted">${esc(f.carrier_name)}</div></td><td>${esc(f.plates)}</td>
      <td><label class="chk"><input type="checkbox" data-pip="${f.id}" ${f.pip_notified ? 'checked' : ''}> PIP подано</label><input class="pipref" data-ref="${f.id}" placeholder="№ уведомления" value="${esc(f.pip_ref || '')}"></td>
      <td class="r"><button type="button" class="b sm" data-open="${f.id}">Открыть PDF</button> <button type="button" class="b sm" data-copy="${f.id}">Копия</button> <button type="button" class="b sm danger" data-del="${f.id}">✕</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">Бланков пока нет. Создайте первый на вкладке «Новый бланк».</td></tr>';
  }
  function formData(f) { try { return JSON.parse(f.data); } catch (e) { return null; } }
  function bindHist() {
  $('histBody').addEventListener('click', async e => {
    const o = e.target.closest('[data-open]'), cp = e.target.closest('[data-copy]'), del = e.target.closest('[data-del]');
    if (o || cp) {
      const f = forms.find(x => x.id == (o || cp).dataset[o ? 'open' : 'copy']); const d = f && formData(f); if (!d) return alert('Данные бланка повреждены');
      if (o) { const c = carrierById(f.carrier_id); try { await showPdf(d, c && c.stamp, 'Бланк: ' + d.driver_name); } catch (er) { alert(er.message); } return; }
      loadIntoForm(f, d); return;
    }
    if (del && confirm('Удалить запись из истории?')) { await api('/api/deleg/forms/' + del.dataset.del, 'DELETE'); forms = forms.filter(x => x.id != del.dataset.del); renderHist(); }
  });
  $('histBody').addEventListener('change', async e => {
    const p = e.target.closest('[data-pip]'), r = e.target.closest('[data-ref]'); const id = (p || r) && (p || r).dataset[p ? 'pip' : 'ref']; if (!id) return;
    const f = forms.find(x => x.id == id); if (p) f.pip_notified = p.checked ? 1 : 0; if (r) f.pip_ref = r.value.trim();
    await api('/api/deleg/forms/' + id + '/pip', 'PUT', { pip_notified: f.pip_notified, pip_ref: f.pip_ref });
  });
  }
  function loadIntoForm(f, d) {
    setTab('new'); $('carrierSel').value = f.carrier_id || ''; onCarrier(); $('driverSel').value = f.driver_id || '';
    $('f1').value = d.company_name; $('f2').value = d.company_address; $('f3').value = d.company_phone; $('f4').value = d.company_email; $('f5').value = d.permit_number || '';
    $('f6').value = d.driver_name; $('f7').value = d.driver_address; $('f8').value = d.license_number; $('fContract').value = d._contract || ''; $('fLaw').value = d._law || 'AM'; $('fLawOther').value = d._lawText || ''; toggleLaw();
    $('fTractor').value = d._tractor || ''; $('fTrailer').value = d._trailer || ''; $('fPlatesFree').value = (d._tractor || d._trailer) ? '' : d.vehicle_plates;
    $('fCarriage').value = d._carriage || 'goods_int'; $('f12').value = d.place; $('f13').value = todayIso(); $('fStamp').checked = !!d.stamp && !$('fStamp').disabled;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Перевозчики ──
  function renderCarriers() {
    $('carBody').innerHTML = carriers.length ? carriers.map(c => `<tr><td><b>${esc(c.name)}</b><div class="muted">${esc(c.address)}</div></td><td>${esc(c.phone)}<div class="muted">${esc(c.email)}</div></td>
      <td>${c.stamp ? `<img class="stampPrev" src="${c.stamp}" alt="печать">` : '<span class="muted">нет</span>'}</td><td class="r"><button type="button" class="b sm" data-ec="${c.id}">Изм.</button></td></tr>`).join('')
      : '<tr><td colspan="4" class="empty">Перевозчиков нет.</td></tr>';
  }
  let editCar = null, stampData = null;
  function openCar(c) {
    editCar = c ? c.id : null; stampData = c ? c.stamp : null; $('carTitle').textContent = c ? 'Перевозчик: ' + c.name : 'Новый перевозчик';
    $('cName').value = c ? c.name : ''; $('cAddr').value = c ? c.address : ''; $('cPhone').value = c ? c.phone : ''; $('cEmail').value = c ? c.email : ''; $('cPlace').value = c ? (c.place || '') : 'Yerevan';
    $('cLaw').innerHTML = lawOpts(c ? (c.law || 'AM') : 'AM'); $('cDel').style.display = c ? '' : 'none'; showStamp(); $('carModal').classList.add('open');
  }
  function showStamp() { $('cStampPrev').innerHTML = stampData ? `<img class="stampBig" src="${stampData}" alt="печать"> <button type="button" class="b sm" id="cStampDel">Убрать печать</button>` : '<span class="muted">Печать не загружена</span>'; }
  // Загруженную печать готовим: белый фон становится прозрачным, размер уменьшается
  async function prepStamp(file) {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const img = await loadImg(url); const k = Math.min(1, 500 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
    const im = cx.getImageData(0, 0, cv.width, cv.height), px = im.data;
    for (let i = 0; i < px.length; i += 4) { if (px[i + 3] > 0 && px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) px[i + 3] = 0; }
    cx.putImageData(im, 0, 0); return cv.toDataURL('image/png');
  }

  // ── Водители ──
  function renderDrivers() {
    $('drvBody').innerHTML = drivers.length ? drivers.map(d => `<tr><td><b>${esc(d.name)}</b><div class="muted">${esc(d.address)}</div></td><td>${esc(d.license)}</td><td>${esc(dmy(d.contract_date))}</td>
      <td>${esc((carrierById(d.carrier_id) || {}).name || '')}</td><td class="r"><button type="button" class="b sm" data-ed="${d.id}">Изм.</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">Водителей нет. Добавьте первого кнопкой выше.</td></tr>';
  }
  let editDrv = null;
  function openDrv(d) {
    editDrv = d ? d.id : null; $('drvTitle').textContent = d ? 'Водитель: ' + d.name : 'Новый водитель';
    $('dCar').innerHTML = '<option value="">— любой перевозчик —</option>' + carriers.map(c => `<option value="${c.id}"${d && d.carrier_id == c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    $('dName').value = d ? d.name : ''; $('dAddr').value = d ? d.address : ''; $('dLic').value = d ? d.license : ''; $('dContract').value = d ? (d.contract_date || '') : '';
    $('dDel').style.display = d ? '' : 'none'; $('drvModal').classList.add('open');
  }

  // ── Вкладки и события ──
  function setTab(t) {
    tab = t; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    ['new', 'hist', 'car', 'drv'].forEach(k => { $('tab-' + k).hidden = k !== t; });
  }
  function latinOnBlur(ids) {
    ids.forEach(id => $(id).addEventListener('blur', () => { const el = $(id); if (hasNonLatin(el.value)) { el.value = clean(el.value); el.classList.add('fixed'); setTimeout(() => el.classList.remove('fixed'), 2500); } }));
  }
  function init() {
    $('f13').value = todayIso(); bindHist();
    document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.tab); });
    $('carrierSel').addEventListener('change', onCarrier); $('driverSel').addEventListener('change', onDriver); $('fLaw').addEventListener('change', toggleLaw);
    $('fLaw').innerHTML = lawOpts('AM'); toggleLaw();
    $('fCarriage').innerHTML = Object.keys(CARRIAGE).map(k => `<option value="${k}">${CARRIAGE_RU[k]}</option>`).join('');
    $('fleetSel').addEventListener('change', () => {
      const v = fleet.find(x => x.id == $('fleetSel').value); if (!v) return;
      $('fTractor').value = fmtPlate(v.plate); const tr = v.attached_to ? null : fleet.find(x => x.type === 'trailer' && x.attached_to == v.id); $('fTrailer').value = tr ? fmtPlate(tr.plate) : $('fTrailer').value; $('fPlatesFree').value = '';
    });
    ['fTractor', 'fTrailer'].forEach(id => $(id).addEventListener('blur', () => { $(id).value = fmtPlate($(id).value); }));
    latinOnBlur(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f12', 'fTractor', 'fTrailer', 'fPlatesFree', 'fLawOther']);
    $('makeBtn').addEventListener('click', make);
    $('printBtn').addEventListener('click', () => { try { $('pdfFrame').contentWindow.focus(); $('pdfFrame').contentWindow.print(); } catch (e) { window.open(lastUrl, '_blank'); } });
    $('openBtn').addEventListener('click', () => window.open(lastUrl, '_blank'));
    $('carAdd').addEventListener('click', () => openCar(null)); $('drvAdd').addEventListener('click', () => openDrv(null));
    $('carBody').addEventListener('click', e => { const b = e.target.closest('[data-ec]'); if (b) openCar(carrierById(b.dataset.ec)); });
    $('drvBody').addEventListener('click', e => { const b = e.target.closest('[data-ed]'); if (b) openDrv(drivers.find(x => x.id == b.dataset.ed)); });
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).classList.remove('open')));
    $('cStampFile').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { stampData = await prepStamp(f); showStamp(); } catch (er) { alert('Не удалось прочитать изображение'); } e.target.value = ''; });
    $('cStampPrev').addEventListener('click', e => { if (e.target.id === 'cStampDel') { stampData = null; showStamp(); } });
    $('cSave').addEventListener('click', async () => {
      const b = { name: clean($('cName').value), address: clean($('cAddr').value), phone: clean($('cPhone').value), email: clean($('cEmail').value), place: clean($('cPlace').value), law: $('cLaw').value, stamp: stampData };
      if (!b.name) return alert('Укажите название'); const r = editCar ? await api('/api/deleg/carriers/' + editCar, 'PUT', b) : await api('/api/deleg/carriers', 'POST', b);
      if (r && r.error) return alert(r.error); $('carModal').classList.remove('open'); await loadAll();
    });
    $('cDel').addEventListener('click', async () => { if (!confirm('Удалить перевозчика? Уже созданные бланки останутся в истории.')) return; await api('/api/deleg/carriers/' + editCar, 'DELETE'); $('carModal').classList.remove('open'); await loadAll(); });
    $('dSave').addEventListener('click', async () => {
      const b = { carrier_id: $('dCar').value || null, name: clean($('dName').value), address: clean($('dAddr').value), license: clean($('dLic').value), contract_date: $('dContract').value || null };
      if (!b.name) return alert('Укажите ФИО'); const r = editDrv ? await api('/api/deleg/drivers/' + editDrv, 'PUT', b) : await api('/api/deleg/drivers', 'POST', b);
      if (r && r.error) return alert(r.error); $('drvModal').classList.remove('open'); await loadAll();
    });
    $('dDel').addEventListener('click', async () => { if (!confirm('Удалить водителя?')) return; await api('/api/deleg/drivers/' + editDrv, 'DELETE'); $('drvModal').classList.remove('open'); await loadAll(); });
    ['carModal', 'drvModal'].forEach(id => $(id).addEventListener('click', e => { if (e.target.id === id) $(id).classList.remove('open'); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); });
    loadAll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
