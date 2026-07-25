// Логотип: если залогинен — на сделки, иначе на главную
const staffUser = localStorage.getItem('gl_staff_user');
document.getElementById('logoLink').href = staffUser ? 'staff-cargo.html' : '/';

// Раньше эта форма только скачивала PDF локально и никуда не отправлялась —
// в отличие от contract.html. Теперь при скачивании данные заявки также
// уходят на почту компании через Formspree (тот же ящик, что и для договоров).
const FORMSPREE_MAIN = 'https://formspree.io/f/mredrzjr';

// sigStamp / watermark / docFooter теперь приходят из js/contract-shared.js

// ── haytTable: builds the 13-row application table ───────────────────────────
function haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13, lang) {
  var rows = [
    ['1',{am:'Բեռի ընդունման վայրը և ամսաթիվը',ru:'Место и дата приёма груза',en:'Pickup location and date'},f1||'___________________________________  __.__.202_'],
    ['2',{am:'Առաքման նշանակման վայրը',ru:'Место назначения',en:'Delivery destination'},f2||'ՀՀ, ք. Երևան'],
    ['3',{am:'Բեռի նկարագիրը (անվանում, քանակ, ծավալ, փաթեթավորում, վտանգավորության դաս, ջերմաստիճանային ռեժիմ, այլ տվյալներ)',ru:'Описание груза',en:'Cargo description'},f3||'_______________________________'],
    ['4',{am:'Ստացողի անունը և հասցեն',ru:'Имя и адрес получателя',en:'Recipient name and address'},f4||'&nbsp;'],
    ['5',{am:'Տրանսպորտային միջոց(ներ)ի տեսակը, քանակը',ru:'Тип и количество ТС',en:'Vehicle type and quantity'},f5||'<em>_______________________________________</em>'],
    ['6',{am:'Տրանսպորտային միջոցների տրամադրման, բեռնման ու բեռնաթափման աշխատանքների իրականացման պայմաններ',ru:'Условия погрузки/разгрузки',en:'Loading/unloading conditions'},f6||'<em>__________________</em>'],
    ['7',{am:'Բեռը տրանսպորտային փոխադրման նախապատրաստելու պայմաններ',ru:'Подготовка груза',en:'Cargo preparation'},f7||'<em>__________________</em>'],
    ['9',{am:'Մաքսային կամ այլ ձևակերպումների համար պահանջվող հրահանգներ',ru:'Таможенные инструкции',en:'Customs instructions'},f9||'<em>__________________</em>'],
    ['10',{am:'Երթուղի',ru:'Маршрут',en:'Route'},f10||'<em>__________________</em>'],
    ['11',{am:'Գինը և վճարման պայմանները',ru:'Цена и условия оплаты',en:'Price and payment terms'},f11||'<em>__________________</em>'],
    ['12',{am:'Առաքման առավելագույն ժամկետը',ru:'Макс. срок доставки',en:'Maximum delivery time'},f12||'<em>__________________</em>'],
    ['13',{am:'Լրացումներ, այլ պայմաններ',ru:'Дополнения',en:'Additional conditions'},f13||'&nbsp;']
  ];
  var html = '<table class="hayt-tbl">';
  rows.forEach(function(r) {
    html += '<tr><td class="num">'+r[0]+'</td><td class="lbl">'+(r[1][lang]||r[1].ru)+'</td><td class="val">'+r[2]+'</td></tr>';
  });
  html += '</table>';
  return html;
}

// ── Full templates ────────────────────────────────────────────────────────────
var templates = {
  customer: {
    am: function(c,t,a,s,p,d,n,st,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN) {
      var fDate = d || '________';
      return watermark() + docFooter() +
        '<h2>ՊԱՏՎԻՐԱՏՈՒ</h2>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">' +
        '<span>Ք. Երևան</span><span>Հայտ /Nօ.'+haytN+'&nbsp;&nbsp;&nbsp;&nbsp;'+fDate+'</span></div>' +
        '<div style="font-size:10px;text-align:center;color:#3a7a80;margin-bottom:8px;">Հավելված Nօ. 1&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+fDate+'&nbsp;&nbsp;թվականին կնքված № '+contrN+' պայմանագրի</div>' +
        haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,'am') +
        '<table class="party-tbl"><tr>' +
        '<td><strong>Պատվիրատու</strong><br>Շահառուի Բանկ՝ «'+(bk||'_________________')+'» ՓԲԸ<br>Շահառու՝ «'+(c||'___________________')+'»<br>Շահառուի հաշվեհամար՝ '+(ba||'_________________')+'<br>Տնօրեն` '+(p?p+' ':'')+''+(s||'__________________')+'<br>'+sigStamp(st)+'</td>' +
        '<td><strong>Տրանսպորտային առաքող</strong><br>Շահառուի Բանկ՝ «Էվոկաբանկ» ՓԲԸ<br>Շահառու՝ «ՋԻ ԷԼ ԼՈԳԻՍՏԻԿՍ» ՍՊԸ<br>Շահառուի հաշվեհամար՝ 1660030207153200<br>Տնօրեն` Տիգրան Մեծպագյան<br><div style="border-bottom:1px solid #2A5E66;margin-top:50px;"></div></td>' +
        '</tr></table>';
    },
    ru: function(c,t,a,s,p,d,n,st,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN) {
      var fDate = d || '________';
      return watermark() + docFooter() +
        '<h2>ЗАЯВКА</h2>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>г. Ереван</span><span>Заявка № '+haytN+'&nbsp;&nbsp;&nbsp;'+fDate+'</span></div>' +
        '<div style="font-size:10px;text-align:center;color:#3a7a80;margin-bottom:8px;">Приложение №1 к Договору '+contrN+' от '+fDate+'</div>' +
        haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,'ru') +
        '<table class="party-tbl"><tr>' +
        '<td><strong>Заказчик</strong><br>Банк: «'+(bk||'_________________')+'» ЗАО<br>Получатель: «'+(c||'___________________')+'»<br>Р/С: '+(ba||'_________________')+'<br>Директор: '+(p?p+' ':'')+''+(s||'__________________')+'<br>'+sigStamp(st)+'</td>' +
        '<td><strong>Экспедитор</strong><br>Банк: ЗАО «Эвокабанк»<br>Получатель: ООО «Джи Эл Логистикс»<br>Р/С: 1660030207153200<br>Директор: Тигран Мецпагян<br><div style="border-bottom:1px solid #2A5E66;margin-top:50px;"></div></td>' +
        '</tr></table>';
    },
    en: function(c,t,a,s,p,d,n,st,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN) {
      var fDate = d || '________';
      return watermark() + docFooter() +
        '<h2>APPLICATION FORM</h2>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Yerevan</span><span>Application No. '+haytN+'&nbsp;&nbsp;&nbsp;'+fDate+'</span></div>' +
        '<div style="font-size:10px;text-align:center;color:#3a7a80;margin-bottom:8px;">Annex No.1 to Agreement '+contrN+' dated '+fDate+'</div>' +
        haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,'en') +
        '<table class="party-tbl"><tr>' +
        '<td><strong>Customer</strong><br>Bank: «'+(bk||'_________________')+'» OJSC<br>Beneficiary: «'+(c||'___________________')+'»<br>Acc.: '+(ba||'_________________')+'<br>Director: '+(p?p+' ':'')+''+(s||'__________________')+'<br>'+sigStamp(st)+'</td>' +
        '<td><strong>Freight Forwarder</strong><br>Bank: "Evocabank" OJSC<br>Beneficiary: "GL Logistics" LLC<br>Acc.: 1660030207153200<br>Director: Tigran Metspaghyan<br><div style="border-bottom:1px solid #2A5E66;margin-top:50px;"></div></td>' +
        '</tr></table>';
    }
  },
  carrier: {
    am: function(c,t,a,s,p,d,n,st,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN) {
      var fDate = d || '________';
      return watermark() + docFooter() +
        '<h2>ՓՈԽԱԴՐՈՂ</h2>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Ք. Երևան</span><span>Հայտ /Nօ.'+haytN+'&nbsp;&nbsp;&nbsp;&nbsp;'+fDate+'</span></div>' +
        '<div style="font-size:10px;text-align:center;color:#3a7a80;margin-bottom:8px;">Հավելված Nօ. 1&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+fDate+'&nbsp;&nbsp;թվականին կնքված № '+contrN+' պայմանագրի</div>' +
        haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,'am') +
        '<table class="party-tbl"><tr>' +
        '<td><strong>Տրանսպորտային առաքող</strong><br>Շահառուի Բանկ՝ «'+(bk||'_________________')+'» ՓԲԸ<br>Շահառու՝ «'+(c||'___________________')+'»<br>Շահառուի հաշվեհամար՝ '+(ba||'_________________')+'<br>Տնօրեն` '+(p?p+' ':'')+''+(s||'__________________')+'<br>'+sigStamp(st)+'</td>' +
        '<td><strong>Պատվիրատու</strong><br>Շահառուի Բանկ՝ «Էվոկաբանկ» ՓԲԸ<br>Շահառու՝ «ՋԻ ԷԼ ԼՈԳԻՍՏԻԿՍ» ՍՊԸ<br>Շահառուի հաշվեհամար՝ 1660030207153200<br>Տնօրեն` Տիգրան Մեծպագյան<br><div style="border-bottom:1px solid #2A5E66;margin-top:50px;"></div></td>' +
        '</tr></table>';
    },
    ru: function(c,t,a,s,p,d,n,st,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN) {
      var fDate = d || '________';
      return watermark() + docFooter() +
        '<h2>ЗАЯВКА</h2>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>г. Ереван</span><span>Заявка № '+haytN+'&nbsp;&nbsp;&nbsp;'+fDate+'</span></div>' +
        '<div style="font-size:10px;text-align:center;color:#3a7a80;margin-bottom:8px;">Приложение №1 к Договору '+contrN+' от '+fDate+'</div>' +
        haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,'ru') +
        '<table class="party-tbl"><tr>' +
        '<td><strong>Экспедитор</strong><br>Банк: «'+(bk||'_________________')+'» ЗАО<br>Получатель: «'+(c||'___________________')+'»<br>Р/С: '+(ba||'_________________')+'<br>Директор: '+(p?p+' ':'')+''+(s||'__________________')+'<br>'+sigStamp(st)+'</td>' +
        '<td><strong>Заказчик</strong><br>Банк: ЗАО «Эвокабанк»<br>Получатель: ООО «Джи Эл Логистикс»<br>Р/С: 1660030207153200<br>Директор: Тигран Мецпагян<br><div style="border-bottom:1px solid #2A5E66;margin-top:50px;"></div></td>' +
        '</tr></table>';
    },
    en: function(c,t,a,s,p,d,n,st,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN) {
      var fDate = d || '________';
      return watermark() + docFooter() +
        '<h2>APPLICATION FORM</h2>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Yerevan</span><span>Application No. '+haytN+'&nbsp;&nbsp;&nbsp;'+fDate+'</span></div>' +
        '<div style="font-size:10px;text-align:center;color:#3a7a80;margin-bottom:8px;">Annex No.1 to Agreement '+contrN+' dated '+fDate+'</div>' +
        haytTable(f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,'en') +
        '<table class="party-tbl"><tr>' +
        '<td><strong>Freight Forwarder</strong><br>Bank: «'+(bk||'_________________')+'» OJSC<br>Beneficiary: «'+(c||'___________________')+'»<br>Acc.: '+(ba||'_________________')+'<br>Director: '+(p?p+' ':'')+''+(s||'__________________')+'<br>'+sigStamp(st)+'</td>' +
        '<td><strong>Customer</strong><br>Bank: "Evocabank" OJSC<br>Beneficiary: "GL Logistics" LLC<br>Acc.: 1660030207153200<br>Director: Tigran Metspaghyan<br><div style="border-bottom:1px solid #2A5E66;margin-top:50px;"></div></td>' +
        '</tr></table>';
    }
  }
};

var uiLabels = {
  am:{brand_title:'Ջի Էլ Լոգիստիկս • ՀԱՅՏ',btn_customer:'👤 ՊԱՏՎԻՐԱՏՈՒ → ՋԻ ԷԼ',btn_carrier:'🚛 ՋԻ ԷԼ → ՓՈԽԱԴՐՈՂ',form_title:'📋 ԼՐԱՑՆԵԼ ՀԱՅՏԸ',s_company:'🏢 ԸՆԿԵՐՈՒԹՅՈՒՆ',company_label:'ԸՆԿԵՐՈՒԹՅԱՆ ԱՆՎԱՆՈՒՄ *',tax_label:'ՀՎՀՀ',address_label:'ԳՐԱՆՑՄԱՆ ՀԱՍՑԵ',signatory_label:'ՍՏՈՐԱԳՐՈՂ *',position_label:'ՊԱՇՏՈՆ',date_label:'ԱՄՍԱԹԻՎ *',bank_label:'ԲԱՆԿ',acc_label:'Հ/Հ',phone_label:'ՀԵՌԱԽՈՍ',s_cargo:'📦 ԲԵՌ ԵՎ ԵՐԹՈՒՂԻ',l_f1:'1. ԸՆԴՈՒՆՄԱՆ ՎԱՅՐԸ ԵՎ ԱՄՍԱԹԻՎԸ *',l_f2:'2. ՆՇԱՆԱԿՄԱՆ ՎԱՅՐԸ',l_f3:'3. ԲԵՌԻ ՆԿԱՐԱԳԻՐԸ',l_f4:'4. ՍՏԱՑՈՂԻ ԱՆՈՒՆԸ ԵՎ ՀԱՍՑԵՆ',s_transport:'🚛 ՏՐԱՆՍՊՈՐՏ',l_f5:'5. ՏՐԱՆՍՊ. ՄԻՋՈՑՆԵՐ',l_f6:'6. ԲԵՌՆՄԱՆ ՊԱՅՄԱՆՆԵՐ',l_f7:'7. ՆԱԽԱՊԱՏՐԱՍՏՈՒՄ',l_f9:'9. ՄԱՔՍԱՅԻՆ ՀՐԱՀԱՆԳՆԵՐ',l_f10:'10. ԵՐԹՈՒՂԻ',s_rate:'💰 ԳԻՆ',l_f11:'11. ԳԻՆ ԵՎ ՎՃԱՐՄԱՆ ՊԱՅՄԱՆՆԵՐ',l_f12:'12. ԱՌԱՔՄԱՆ ԺԱՄԿԵՏ',l_f13:'13. ԼՐԱՑՈՒՄՆԵՐ',s_sign:'🔏 ԿՆԻՔ',upload_stamp:'ԿՆԻՔ'},
  ru:{brand_title:'Джи Эл Логистикс • ЗАЯВКА',btn_customer:'👤 ЗАКАЗЧИК → ДЖИ ЭЛ',btn_carrier:'🚛 ДЖИ ЭЛ → ПЕРЕВОЗЧИК',form_title:'📋 ЗАПОЛНИТЬ ЗАЯВКУ',s_company:'🏢 КОМПАНИЯ',company_label:'КОМПАНИЯ *',tax_label:'ИНН',address_label:'ЮР. АДРЕС',signatory_label:'ФИО ПОДПИСАНТА *',position_label:'ДОЛЖНОСТЬ',date_label:'ДАТА *',bank_label:'БАНК',acc_label:'Р/С',phone_label:'ТЕЛЕФОН',s_cargo:'📦 ГРУЗ И МАРШРУТ',l_f1:'1. МЕСТО И ДАТА ПРИЁМА ГРУЗА *',l_f2:'2. МЕСТО НАЗНАЧЕНИЯ',l_f3:'3. ОПИСАНИЕ ГРУЗА',l_f4:'4. ИМЯ И АДРЕС ПОЛУЧАТЕЛЯ',s_transport:'🚛 ТРАНСПОРТ',l_f5:'5. ТИП И КОЛ-ВО ТС',l_f6:'6. УСЛОВИЯ ПОГРУЗКИ/РАЗГРУЗКИ',l_f7:'7. ПОДГОТОВКА ГРУЗА',l_f9:'9. ТАМОЖЕННЫЕ ИНСТРУКЦИИ',l_f10:'10. МАРШРУТ',s_rate:'💰 ЦЕНА И ОПЛАТА',l_f11:'11. ЦЕНА И УСЛОВИЯ ОПЛАТЫ',l_f12:'12. МАКС. СРОК ДОСТАВКИ',l_f13:'13. ДОПОЛНЕНИЯ',s_sign:'🔏 ПЕЧАТЬ',upload_stamp:'ПЕЧАТЬ'},
  en:{brand_title:'GL Logistics • APPLICATION',btn_customer:'👤 CUSTOMER → GL',btn_carrier:'🚛 GL → CARRIER',form_title:'📋 FILL APPLICATION',s_company:'🏢 COMPANY',company_label:'COMPANY *',tax_label:'TAX ID',address_label:'LEGAL ADDRESS',signatory_label:'SIGNATORY *',position_label:'POSITION',date_label:'DATE *',bank_label:'BANK',acc_label:'ACCOUNT NO.',phone_label:'PHONE',s_cargo:'📦 CARGO & ROUTE',l_f1:'1. PICKUP LOCATION & DATE *',l_f2:'2. DELIVERY DESTINATION',l_f3:'3. CARGO DESCRIPTION',l_f4:'4. RECIPIENT NAME & ADDRESS',s_transport:'🚛 TRANSPORT',l_f5:'5. VEHICLE TYPE & QTY',l_f6:'6. LOADING/UNLOADING CONDITIONS',l_f7:'7. CARGO PREPARATION',l_f9:'9. CUSTOMS INSTRUCTIONS',l_f10:'10. ROUTE',s_rate:'💰 PRICE & PAYMENT',l_f11:'11. PRICE & PAYMENT TERMS',l_f12:'12. MAX. DELIVERY TIME',l_f13:'13. ADDITIONAL CONDITIONS',s_sign:'🔏 STAMP',upload_stamp:'STAMP'}
};

var currentLang='am', currentType='customer', stampDataUrl=null, contractNumber='';
const previewDiv = document.getElementById('contractPreview');

function generateContractNumber() {
  var y=new Date().getFullYear(), p=currentType==='customer'?'APP-C':'APP-T', r=Math.floor(Math.random()*9000)+1000;
  return p+'-'+y+'-'+r;
}

document.getElementById('stampTrigger').addEventListener('click', function(){document.getElementById('stampInput').click();});
document.getElementById('stampInput').addEventListener('change', function(e) {
  var f=e.target.files[0]; if(!f)return;
  var r=new FileReader(); r.onload=function(ev){stampDataUrl=ev.target.result;document.getElementById('stampPreview').src=stampDataUrl;document.getElementById('stampPreview').style.display='block';renderContract();}; r.readAsDataURL(f);
});

function fv(id, def) { var el=document.getElementById(id); return (el&&el.value.trim())?el.value.trim():(def||''); }

function renderContract() {
  var c=fv('company','[COMPANY]'), t=fv('taxId','________'), a=fv('address','________');
  var s=fv('signatory','[NAME]'), p=fv('position',''), d=fv('signDate',new Date().toISOString().slice(0,10));
  var bk=fv('bankName',''), ba=fv('bankAcc','');
  var haytN=fv('haytNum','__/_______/1'), contrN=fv('contractNum','__/______/__');
  var f1=fv('f1',''), f2=fv('f2','ՀՀ, ք. Երևան'), f3=fv('f3','');
  var f4=fv('f4',''), f5=fv('f5',''), f6=fv('f6',''), f7=fv('f7','');
  var f9=fv('f9',''), f10=fv('f10',''), f11=fv('f11',''), f12=fv('f12',''), f13=fv('f13','');
  if (!contractNumber) contractNumber = generateContractNumber();
  var fn = templates[currentType][currentLang];
  previewDiv.innerHTML = fn(c,t,a,s,p,d,contractNumber,stampDataUrl,bk,ba,f1,f2,f3,f4,f5,f6,f7,f9,f10,f11,f12,f13,haytN,contrN);
}

['haytNum','contractNum','company','taxId','address','signatory','position','signDate','bankName','bankAcc','phone','f1','f2','f3','f4','f5','f6','f7','f9','f10','f11','f12','f13'].forEach(function(id){
  var el=document.getElementById(id);
  if(el) el.addEventListener('input', renderContract);
  if(el && el.type==='date') el.addEventListener('change', renderContract);
});

document.querySelectorAll('.type-btn').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('.type-btn').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active'); currentType=b.dataset.type; contractNumber=generateContractNumber(); renderContract();
  });
});
document.querySelectorAll('.lang-btn').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('.lang-btn').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active'); currentLang=b.dataset.lang; updateUILabels(); renderContract();
  });
});
function updateUILabels(){
  var t=uiLabels[currentLang]; if(!t)return;
  document.querySelectorAll('[data-i18n]').forEach(function(e){var k=e.dataset.i18n;if(t[k])e.innerHTML=t[k];});
}

async function makePdf() {
  var cv = await html2canvas(previewDiv,{scale:2,useCORS:true,backgroundColor:'#FFFEF8',logging:false});
  var {jsPDF}=window.jspdf, pdf=new jsPDF('p','mm','a4');
  var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight(), m=10, uw=pw-m*2;
  var ih=cv.height*uw/cv.width;
  if(ih<=ph-m*2){pdf.addImage(cv.toDataURL('image/jpeg',0.93),'JPEG',m,m,uw,ih);}
  else{var sh=Math.floor(cv.width*(ph-m*2)/uw),yo=0;
    while(yo<cv.height){var sl=document.createElement('canvas');sl.width=cv.width;sl.height=Math.min(sh,cv.height-yo);sl.getContext('2d').drawImage(cv,0,yo,cv.width,sl.height,0,0,cv.width,sl.height);
    if(yo>0)pdf.addPage();pdf.addImage(sl.toDataURL('image/jpeg',0.93),'JPEG',m,m,uw,sl.height*uw/cv.width);yo+=sh;}}
  return pdf;
}

// Отправка данных заявки в почту компании (не сам PDF — только текстовые поля,
// чтобы офис знал, что заявка заполнена, даже если человек не переслал PDF сам).
async function notifyOffice() {
  try {
    var body = {
      _subject: 'GL Logistics — New Application ' + contractNumber,
      application_number: contractNumber,
      contract_type: currentType,
      language: currentLang,
      company: fv('company',''),
      signatory: fv('signatory',''),
      phone: fv('phone',''),
      hayt_number: fv('haytNum',''),
      contract_number_ref: fv('contractNum',''),
      message: [
        'New application №' + contractNumber,
        'Company:   ' + fv('company',''),
        'Signatory: ' + fv('signatory',''),
        'Phone:     ' + fv('phone',''),
        'Route:     ' + fv('f1','') + ' → ' + fv('f2','')
      ].join('\n')
    };
    await fetch(FORMSPREE_MAIN, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
  } catch (_) {
    // Тихо игнорируем — PDF всё равно скачается локально, это лишь уведомление офиса
  }
}

document.getElementById('dlBtn').addEventListener('click', async function(){
  var b=this; b.disabled=true; b.textContent='⏳...'; renderContract();
  try{
    var pdf=await makePdf();
    pdf.save('Application_'+contractNumber+'.pdf');
    notifyOffice();
  }
  catch(e){alert('PDF error: '+e.message);}
  b.disabled=false; b.textContent='⬇ Ներբեռնել PDF';
});

contractNumber = generateContractNumber();
document.getElementById('signDate').valueAsDate = new Date();
document.getElementById('f2').value = 'ՀՀ, ք. Երևան';
updateUILabels();
renderContract();
