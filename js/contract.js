// Логотип: если залогинен — на сделки, иначе на главную
const staffUserForContract = localStorage.getItem('gl_staff_user');
// (страница не требует логина, это просто для будущего использования при желании)

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/drp98zkka/upload';
// ВАЖНО: unsigned upload_preset убран из фронтенда — теперь подпись выдаёт наш Worker,
// см. worker-additions.js (эндпоинт /api/cloudinary-sign). Пока вы не добавите этот
// эндпоинт на сервере, загрузка PDF в Cloudinary будет тихо пропускаться (см. try/catch ниже),
// PDF всё равно скачается локально и данные всё равно уйдут в Formspree.
const WORKER_URL = 'https://gl-api.gltransam.workers.dev';
const FORMSPREE_MAIN = 'https://formspree.io/f/mredrzjr';
const FORMSPREE_CLIENT = 'https://formspree.io/f/mlgqowjp';

// sigStamp / watermark / docFooter теперь приходят из js/contract-shared.js

// ── shared body sections ──────────────────────────────────────────────────────
function bodyAM() {
  return `
<h3>1. ՊԱՅՄԱՆԱԳՐԻ ԱՌԱՐԿԱՆ</h3>
<p>1.1. Սույն Պայմանագիրը կարգավորում է Կողմերի հարաբերությունները Տրանսպորտային առաքողի կողմից Պատվիրատուի բեռների փոխադրումների և տրանսպորտային առաքման ծառայության (ՏԱԾ) հետ կապված Պատվիրատուի հանձնարարությունները կատարելիս:</p>
<p>1.2. Պատվիրատուն հանձնարարում է, իսկ Տրանսպորտային առաքողը կազմակերպում և կատարում է տրանսպորտի բոլոր տեսակներով արտահանվող և ներմուծվող բեռների փոխադրումը, դրանց ՏԱԾ-ի իրականացումը նավահանգիստներում, բազաներում և Տրանսպորտային առաքողի տրանսպորտային առաքման կենտրոններում, սահմանային երկաթուղային կայարաններում և ավտոմոբիլային անցակետերում ինչպես ԱՊՀ-ի, այնպես էլ այլ պետությունների տարածքում։</p>
<p>1.3. Սույն պայմանագրով Տրանսպորտային առաքողը պարտավորվում է իրեն վստահված բեռը հասցնել սույն պայմանագրի 1.4 կետում նշված վայր, իսկ Պատվիրատուն պարտավորվում է վճարել բեռի փոխադրման համար սահմանված գինը։</p>
<p>1.4. Յուրաքանչյուր անգամ փոխադրվող բեռը, դրա քանակը և այլ բնութագրիչները սահմանվում են Հավելված 1-ով նախատեսված Տրանսպորտային առաքողին ներկայացված հայտով։</p>
<p>1.5. Սույն պայմանագրով նշանակման վայր է համարվում «________», իսկ հանձման վայր է համարվում «_________» հասցեն ըստ հավելված մեկի՝ «Հանձնման վայր», եթե այլ բան նախատեսված չէ Տրանսպորտային առաքողին ներկայացված հայտով։</p>
<p>1.6. Տրանսպորտային առաքողը պատասխանատվություն չի կրում բեռի պարունակության որակի, համապատասխանության կամ փաստացի բնութագրերի համար:</p>

<h3>2. ՏՐԱՆՍՊՈՐՏԱՅԻՆ ԱՌԱՔՄԱՆ ԵՎ ԲԵՌՆԵՐԻ ՓՈԽԱԴՐՄԱՆ ՀԱՅՏԻ, ԳՆԱՅԻՆ ԱՌԱՋԱՐԿԻ ՆԵՐԿԱՅԱՑՄԱՆ ԵՎ ՀԱՍՏԱՏՄԱՆ ԿԱՐԳԸ</h3>
<p>2.1. Յուրաքանչյուր դեպքում բեռների փոխադրումը և տրանսպորտային առաքումն իրականացվում է Պատվիրատուի կողմից Տրանսպորտային առաքողին ներկայացված հայտի (այսուհետ նաև՝ «Հայտ») հիման վրա։</p>
<p>2.2. Հայտի ձևը սահմանվում է Պայմանագրի անբաժանելի մաս հանդիսացող Հավելված 1-ով։</p>
<p>2.3. Պատվիրատուն Հայտը ներկայացնում է ոչ ուշ, քան Բեռի բարձումից 1 (մեկ) աշխատանքային օր առաջ:</p>
<p>2.4. Տրանսպորտային առաքողը պարտավոր է Պատվիրատուի կողմից Հայտը ներկայացնելուց հետո 1 աշխատանքային օրվա ընթացքում հաստատել այն և Պատվիրատուին ներկայացնել գնառաջարկ կամ մերժել այն։</p>
<p>2.5. Պայմանագրի 2.4 կետով նախատեսված ժամկետում Տրանսպորտային առաքողի կողմից Հայտը չընդունելու և մերժման մասին Պատվիրատուին չծանուցելու դեպքում Հայտը համարվում է մերժված։</p>
<p>2.6. Տրանսպորտային առաքողը Պայմանագրի 2.4 կետով նախատեսված ժամկետում Պատվիրատուին ներկայացնում է Հայտով սահմանված բեռների փոխադրման և տրանսպորտային առաքման գնառաջարկ (այսուհետ՝ «Գնառաջարկ»):</p>
<p>2.7. Պատվիրատուն պարտավոր է Տրանսպորտային առաքողից Գնառաջարկը ստանալուց հետո 3-օրյա ժամկետում ընդունել կամ մերժել այն:</p>
<p>2.8. Պատվիրատուի կողմից Տրանսպորտային առաքողի ներկայացրած Գնառաջարկի մերժումը չի համարվում Պայմանագրի կատարումից հրաժարում և Պատվիրատուի համար չի առաջացնում որևէ պարտավորություն և/կամ պատասխանատվություն:</p>
<p>2.9. Բեռի փոխադրման և տրանսպորտային առաքման արժեքի 100 (հարյուր) տոկոսը վճարվում է Տրանսպորտային առաքողին բեռը ստացողին հանձնելուց հետո, Տրանսպորտային առաքողի կողմից դուրս գրված հաշվարկային փաստաթղթի հիման վրա՝ այն ստանալուց հետո 7 (յոթ) աշխատանքային օրվա ընթացքում:</p>
<p>2.10. Գնառաջարկում չներառված և Պատվիրատուի կողմից չհաստատված լրացուցիչ ծախսերը Տրանսպորտային առաքողն իրականացնում է Պատվիրատուի հետ համաձայնեցնելուց հետո, բացառությամբ այն դեպքերի, երբ անհնարին է Պատվիրատուի հաստատումը ստանալը և նման ծախսերը անհապաղ չկատարելը կարող է հանգեցնել բեռի վնասման, ոչնչացման և/կամ Պատվիրատուի համար այլ վնասների:</p>
<p>2.11. Լրացուցիչ ծախսեր կատարելու անհրաժեշտության մասին Տրանսպորտային առաքողը պարտավորվում է Պատվիրատուին ծանուցել նման անհրաժեշտություն առաջանալուց հետո անհապաղ:</p>
<p>2.12–2.15. Լրացուցիչ ծախսերի հատուցումը Պատվիրատուն կատարում է Տրանսպորտային առաքողի կողմից կազմված հաշվարկային փաստաթղթերի հիման վրա։ Պատվիրատուն իրավունք ունի առարկություններ ներկայացնել կատարված ծախսերի վերաբերյալ։ Լրացուցիչ ծախսերը չհատուցելը Պատվիրատուի համար չի առաջացնում որևէ պատասխանատվություն:</p>

<h3>3. ԲԵՌՆԵՐԻ ԱՌԱՔՄԱՆ ԵՎ ՏՐԱՆՍՊՈՐՏԱՅԻՆ ԱՌԱՔՄԱՆ ՊԱՅՄԱՆՆԵՐԸ</h3>
<p>3.1. Բեռի բեռնման և բեռնաթափման աշխատանքները կազմակերպում և իրականացնում է Պատվիրատուն իր սեփական միջոցներով և ռիսկով, եթե այլ բան ուղղակիորեն նախատեսված չէ Հայտով:</p>
<p>3.2. Տրանսպորտային առաքողը պարտավոր է բեռը հասցնել Հանձնման վայր, ոչ ուշ, քան բեռը Նշանակման վայրից վերցնելուց հետո 15 օրվա ընթացքում, եթե այլ ժամկետ նախատեսված չէ Հայտով:</p>

<h3>4. ԿՈՂՄԵՐԻ ՊԱՏԱՍԽԱՆԱՏՎՈՒԹՅՈՒՆԸ</h3>
<p>4.1. Կողմերը պատասխանատվություն են կրում սույն Պայմանագրով իրենց պարտավորությունների չկատարման կամ ոչ պատշաճ կատարման համար՝ գործող օրենսդրությանը համապատասխան:</p>
<p>4.2. Կողմերից յուրաքանչյուրը պետք է պատշաճ ձևով կատարի իր պարտականությունները, հնարավորինս աջակցելով մյուս Կողմին:</p>
<p>4.3. Պատվիրատուի կողմից առաքման գումարը 2.9 կետով նախատեսված ժամկետում չվճարելու դեպքում Տրանսպորտային առաքողն իրավունք ունի պահանջելու տույժի վճարում յուրաքանչյուր կետանցված օրվա համար վճարման ենթակա գումարի 0.1%-ի չափով:</p>
<p>4.4. Տրանսպորտային առաքողի կողմից բեռը հանձնման վայր չհասցնելու դեպքում Պատվիրատուն իրավունք ունի պահանջելու տույժի վճարում 0.05%-ի (0.05%) չափով յուրաքանչյուր կետանցված օրի համար, բայց ոչ ավելի, քան ընդհանուր փոխադրավարձի 5%-ը:</p>
<p>4.5–4.6. Բեռի վնասման, ոչնչացման և/կամ ժամկետների խախտման դեպքում Տրանսպորտային առաքողը պարտավորվում է հատուցել Պատվիրատուի կրած վնասները, ներառյալ՝ բաց թողնված օգուտը:</p>
<p>4.7. Կողմերը ազատվում են պատասխանատվությունից, եթե չկատարումն անհաղթահարելի ուժի ազդեցության արդյունք է:</p>
<p>4.8.1–4.8.4. Տրանսպորտային առաքողը պատասխանատու է Պատվիրատուին հասցված վնասների համար ՀՀ ՕԳ 873-րդ հոդվածով սահմանված հիմքերով։ Բեռների փոխադրումն իրականացվում է CMR կոնվենցիայի պայմաններով։ Բեռի վնասման/կորստի դեպքում Տրանսպորտային առաքողը հատուցում է բեռի ձեռքբերման արժեքը, բայց ոչ ավելի, քան CMR-ով սահմանված սահմանաչափը:</p>
<p>4.9.1. Պատվիրատուն պատասխանատվություն է կրում Տրանսպորտային առաքողին հասցված վնասների համար&#96; Պայմանագրի պայմանների ոչ պատշաճ կատարման դեպքում, ինչպես նաև Տրանսպորտային առաքողի հաշիվների հիման վրա վճարումից անհիմն հրաժարվելու կամ ուշացնելու դեպքում:</p>

<h3>5. ՊԱՀԱՆՋՆԵՐԻ ԵՎ ՎԵՃԵՐԻ ԼՈՒԾՄԱՆ ԿԱՐԳԸ</h3>
<p>5.1. Սույն Պայմանագրով ծագած պահանջները պետք է ներկայացվեն գրավոր ողջամիտ ժամկետում՝ ըստ նրանց ներկայացման համար հիմքի ծագման:</p>
<p>5.2. Պահանջի ներկայացման ամսաթիվ է համարվում նամակը ընդունած փոստային կազմակերպության կողմից դրոշմի վրա նշված ամսաթիվը:</p>
<p>5.3. Պահանջ ստացած Կողմը պարտավոր է քննարկել այն և պատասխանել պահանջը ստանալուց հետո 5 աշխատանքային օրվա ընթացքում:</p>
<p>5.4. Սույն Պայմանագրով ծագած բոլոր վեճերը, որոնք չեն կարգավորվում բանակցությունների ճանապարհով, ենթակա են լուծման դատական կարգով՝ ՀՀ օրենսդրությանը համապատասխան:</p>
<p>5.5. Մինչև դատարան դիմելը, պահանջ ներկայացնող Կողմը պարտավոր է պահանջ ուղարկել մյուս Կողմին և ստանալ պատասխան:</p>

<h3>6. ՖՈՐՍ-ՄԱԺՈՐ</h3>
<p>6.1. Կողմերը պատասխանատվություն չեն կրում իրենց պարտականությունների թերի կատարման կամ ընդհանրապես անկատար թողնելու համար, եթե դրանք հետևանքն են հրդեհի, տարերային աղետի, պատերազմի, քաղաքական հուզումների, պաշարման, գործադուլի, նավահանգիստների ղեկավար մարմինների որոշումների, ճանապարհների խաթարման կամ վատ եղանակային պայմանների (Ֆորս-մաժորային պայմաններ)։ Եթե այդ հանգամանքները կշարունակվեն ավելի քան 60 (վաթսուն) օր, Կողմերից յուրաքանչյուրն իրավունք ունի հրաժարվել պարտավորությունների կատարումից, ընդ որում կողմերից ոչ մեկն իրավունք չի ունենա պահանջել վնասների փոխատուցում:</p>

<h3>7. ԵԶՐԱՓԱԿԻՉ ԴՐՈՒՅԹՆԵՐ</h3>
<p>7.1. Սույն պայմանագիրը ուժի մեջ է մտնում ստորագրման պահից և գործում է 1 (մեկ) տարի ժամկետով։ Ժամկետը լրանալուց 30 (երեսուն) օր առաջ չծանուցելու դեպքում Պայմանագրի գործողության ժամկետն ավտոմատ կերպով երկարաձգվում է 1 (մեկ) տարով։ Երկարաձգումների քանակը սահմանափակված չէ:</p>
<p>7.2. Կողմերից յուրաքանչյուրն իրավունք ունի հրաժարվել Պայմանագրի կատարումից՝ 30 օր առաջ գրավոր նախազգուշացնելով մյուս Կողմին:</p>
<p>7.3–7.6. Ծանուցումները Կողմերն ուղարկում են ք. Երևան, Էրեբունի, Նոր-Արեշ 12փ 99/1 18 հասցեին կամ էլ. փոստով։ Ծանուցման եղանակի ընտրությունն իրականացվում է Կողմերի հայեցողությամբ:</p>
<p>7.7–7.8. Պայմանագրի բոլոր փոփոխությունները, հավելվածներն ու լրացումները վավերական են միայն եթե ձևակերպվել են գրավոր և ստորագրվել Կողմերի լիազոր ներկայացուցիչների կողմից:</p>
<p>7.9. Մի կողմից ստորագրված և էլ. փոստով փոխանակված փաստաթղթերն ունեն բնօրինակ փաստաթղթերի իրավական ուժ:</p>
<p>7.10. Պայմանագրով չկարգավորված հարցերը կարգավորվում են ՀՀ օրենսդրությամբ:</p>
<p>7.11. Սույն Պայմանագիրը բաղկացած է 6 (վեց) էջից և կազմված է 2 օրինակից, որոնք ունեն հավասար իրավաբանական ուժ:</p>`;
}

function bodyRU() {
  return `
<h3>1. ПРЕДМЕТ ДОГОВОРА</h3>
<p>1.1. Настоящий Договор регулирует отношения Сторон при выполнении Экспедитором поручений Заказчика, связанных с перевозкой грузов и оказанием транспортно-экспедиционных услуг (ТЭУ) по поручению Заказчика.</p>
<p>1.2. Заказчик поручает, а Экспедитор организует и выполняет перевозку экспортируемых и импортируемых грузов всеми видами транспорта, а также оказание ТЭУ в портах, на базах и в транспортно-экспедиционных центрах Экспедитора, на пограничных железнодорожных станциях и автомобильных пунктах пропуска как на территории СНГ, так и других государств.</p>
<p>1.3. По настоящему Договору Экспедитор обязуется доставить вверенный ему груз в место, указанное в п. 1.4 настоящего Договора, а Заказчик обязуется оплатить установленную стоимость перевозки груза.</p>
<p>1.4. В каждом конкретном случае перевозимый груз, его количество и иные характеристики определяются заявкой, представленной Экспедитору в соответствии с Приложением 1.</p>
<p>1.5. Местом назначения по настоящему Договору считается «________», а местом сдачи груза считается адрес «________» согласно Приложению 1, если иное не предусмотрено заявкой, представленной Экспедитору.</p>
<p>1.6. Экспедитор не несёт ответственности за качество, соответствие или фактические характеристики содержимого груза.</p>

<h3>2. ПОРЯДОК ПОДАЧИ И СОГЛАСОВАНИЯ ЗАЯВКИ И ЦЕНОВОГО ПРЕДЛОЖЕНИЯ</h3>
<p>2.1. В каждом конкретном случае перевозка и ТЭО грузов осуществляются на основании заявки («Заявка»), представленной Заказчиком Экспедитору.</p>
<p>2.2. Форма Заявки устанавливается Приложением 1, являющимся неотъемлемой частью Договора.</p>
<p>2.3. Заказчик представляет Заявку не позднее чем за 1 (один) рабочий день до погрузки Груза.</p>
<p>2.4. Экспедитор обязан в течение 1 рабочего дня с момента получения Заявки подтвердить её и представить ценовое предложение либо отказать в её принятии.</p>
<p>2.5. В случае если Экспедитор в указанный срок не принял Заявку и не уведомил Заказчика об отказе, Заявка считается отклонённой.</p>
<p>2.6. Экспедитор представляет Заказчику ценовое предложение на перевозку и ТЭО («Ценовое предложение») в срок, предусмотренный п. 2.4.</p>
<p>2.7. Заказчик обязан принять или отклонить Ценовое предложение в течение 3 дней с момента его получения.</p>
<p>2.8. Отказ Заказчика от Ценового предложения не считается отказом от исполнения Договора и не влечёт для Заказчика никаких обязательств и/или ответственности.</p>
<p>2.9. В каждом конкретном случае 100 (сто) процентов стоимости перевозки и ТЭО выплачивается Экспедитору после передачи груза Получателю, на основании расчётного документа, выставленного Экспедитором, в течение 7 (семь) рабочих дней с момента его получения.</p>
<p>2.10. Дополнительные расходы, не включённые в Ценовое предложение и не согласованные Заказчиком, Экспедитор осуществляет только после согласования с Заказчиком, за исключением случаев, когда получить его согласие невозможно.</p>
<p>2.11–2.13. О необходимости дополнительных расходов Экспедитор обязан незамедлительно уведомить Заказчика. Возмещение производится на основании расчётных документов, представляемых в течение двух дней с момента получения подтверждающих документов.</p>
<p>2.14–2.15. Заказчик вправе представить возражения относительно дополнительных расходов. Невозмещение в случае, предусмотренном настоящим пунктом, не влечёт для Заказчика никакой ответственности.</p>

<h3>3. УСЛОВИЯ ДОСТАВКИ ГРУЗОВ И ТЭО</h3>
<p>3.1. Погрузочно-разгрузочные работы организуются и выполняются Заказчиком за его счёт и на его риск, если иное прямо не предусмотрено Заявкой.</p>
<p>3.2. Экспедитор обязан доставить груз в Место сдачи не позднее 15 дней с момента забора груза с Место назначения, если иной срок не предусмотрен Заявкой.</p>

<h3>4. ОТВЕТСТВЕННОСТЬ СТОРОН</h3>
<p>4.1. Стороны несут ответственность за неисполнение или ненадлежащее исполнение своих обязательств по настоящему Договору в соответствии с действующим законодательством.</p>
<p>4.2. Каждая из Сторон должна надлежащим образом исполнять свои обязанности, оказывая другой Стороне максимальное содействие.</p>
<p>4.3. В случае неоплаты Заказчиком суммы фрахта в срок, предусмотренный п. 2.9, Экспедитор вправе потребовать уплаты неустойки в размере 0,1% от подлежащей оплате суммы за каждый день просрочки.</p>
<p>4.4. В случае непоставки Экспедитором груза в место сдачи в установленный срок, Заказчик вправе потребовать неустойки в размере 0,05% от подлежащей оплате суммы за каждый день просрочки, но не более 5% от общей суммы фрахта.</p>
<p>4.5–4.6. В случае повреждения, уничтожения груза и/или нарушения сроков ТЭО Экспедитор обязуется возместить Заказчику понесённые убытки, включая упущенную выгоду.</p>
<p>4.7. Стороны освобождаются от ответственности за неисполнение обязательств, если такое неисполнение является следствием обстоятельств непреодолимой силы.</p>
<p>4.8.1–4.8.4. Экспедитор несёт ответственность за убытки, причинённые Заказчику, по основаниям и в размере, установленных ст. 873 ГК РА. Перевозка осуществляется согласно Конвенции CMR. В случае повреждения/утраты груза Экспедитор возмещает его фактическую стоимость, но не выше предела, установленного Конвенцией CMR.</p>
<p>4.9.1. Заказчик несёт ответственность за убытки, причинённые Экспедитору, при ненадлежащем исполнении условий Договора либо необоснованном отказе или задержке в оплате счетов Экспедитора.</p>

<h3>5. ПОРЯДОК РАССМОТРЕНИЯ ПРЕТЕНЗИЙ И РАЗРЕШЕНИЯ СПОРОВ</h3>
<p>5.1. Претензии, возникшие по настоящему Договору, должны быть представлены в письменной форме в разумный срок с момента возникновения основания для их предъявления.</p>
<p>5.2. Датой предъявления претензии считается дата, указанная на штемпеле почтовой организации, принявшей письмо.</p>
<p>5.3. Сторона, получившая претензию, обязана рассмотреть её и дать ответ в течение 5 рабочих дней с момента получения.</p>
<p>5.4. Все споры, не урегулированные путём переговоров, подлежат разрешению в судебном порядке в соответствии с законодательством Республики Армения.</p>
<p>5.5. До обращения в суд Сторона, предъявляющая претензию, обязана направить её другой Стороне и получить ответ в установленные сроки.</p>

<h3>6. ФОРС-МАЖОР</h3>
<p>6.1. Стороны не несут ответственности за неисполнение обязательств вследствие обстоятельств, которые не могли предвидеть или предотвратить: пожар, стихийное бедствие, война, гражданские волнения, осада, забастовка, решения портовых властей, нарушение дорожной инфраструктуры (Форс-мажорные обстоятельства). Если такие обстоятельства продолжаются более 60 (шестидесяти) дней, каждая из Сторон вправе отказаться от исполнения обязательств по настоящему Договору без требования возмещения убытков.</p>

<h3>7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</h3>
<p>7.1. Настоящий Договор вступает в силу с момента подписания и действует в течение 1 (одного) года. Если ни одна из Сторон не уведомит другую в письменной форме о расторжении не позднее чем за 30 (тридцать) дней до истечения срока, Договор автоматически продлевается на 1 (один) год. Количество продлений не ограничено.</p>
<p>7.2. Каждая из Сторон вправе отказаться от исполнения настоящего Договора, письменно уведомив другую Сторону за 30 дней. Отказывающаяся Сторона обязана возместить прямые и фактически понесённые расходы, связанные с расторжением.</p>
<p>7.3–7.6. Уведомления направляются по адресу: г. Ереван, Эребуни, Нор-Ареш, 12-й пер., 99/1, кв. 18 либо на электронный адрес. Уведомление в любой предусмотренной форме считается надлежащим.</p>
<p>7.7–7.8. Все изменения, приложения и дополнения к Договору действительны только в письменной форме, подписанные уполномоченными представителями Сторон.</p>
<p>7.9. Документы, подписанные одной Стороной и обменянные по электронной почте, имеют юридическую силу оригинальных документов.</p>
<p>7.10. Вопросы, не урегулированные Договором, регулируются законодательством Республики Армения.</p>
<p>7.11. Настоящий Договор состоит из 6 (шести) страниц и составлен в 2 экземплярах, имеющих равную юридическую силу.</p>`;
}

function bodyEN() {
  return `
<h3>1. SUBJECT OF THE AGREEMENT</h3>
<p>1.1. This Agreement governs the relationship between the Parties regarding the performance by the Freight Forwarder of the Customer's instructions related to the transportation of cargo and transport forwarding services (TFS) on behalf of the Customer.</p>
<p>1.2. The Customer instructs, and the Freight Forwarder organizes and performs the transportation of export and import cargo by all types of transport, as well as TFS at ports, bases, and the Freight Forwarder's transport forwarding centers, border railway stations, and motor vehicle checkpoints both in the CIS and other states.</p>
<p>1.3. Under this Agreement, the Freight Forwarder undertakes to deliver the cargo entrusted to it to the place specified in clause 1.4, and the Customer undertakes to pay the established price for cargo transportation.</p>
<p>1.4. Each time the cargo to be transported, its quantity and other characteristics are determined by the application submitted to the Freight Forwarder as provided in Annex 1.</p>
<p>1.5. The destination under this Agreement is "________" and the place of delivery is "________" according to Annex 1, unless otherwise provided in the application submitted to the Freight Forwarder.</p>
<p>1.6. The Freight Forwarder bears no responsibility for the quality, compliance, or actual characteristics of the cargo contents.</p>

<h3>2. PROCEDURE FOR SUBMISSION AND APPROVAL OF APPLICATIONS AND PRICE OFFERS</h3>
<p>2.1. In each case, cargo transportation and TFS are carried out on the basis of an application ("Application") submitted by the Customer to the Freight Forwarder.</p>
<p>2.2. The form of the Application is established by Annex 1, which is an integral part of the Agreement.</p>
<p>2.3. The Customer submits the Application no later than 1 (one) business day before the loading of the Cargo.</p>
<p>2.4. The Freight Forwarder is obliged to confirm the Application and submit a price offer to the Customer or reject it within 1 business day after receipt.</p>
<p>2.5. If the Freight Forwarder fails to accept the Application and notify the Customer of its rejection within the stipulated period, the Application is deemed rejected.</p>
<p>2.6. The Freight Forwarder submits to the Customer a price offer for cargo transportation and TFS as defined in the Application ("Price Offer") within the period stipulated in clause 2.4.</p>
<p>2.7. The Customer is obliged to accept or reject the Price Offer within 3 days of receiving it from the Freight Forwarder.</p>
<p>2.8. The rejection by the Customer of the Price Offer shall not be considered a waiver of performance of the Agreement and shall not entail any obligation and/or liability for the Customer.</p>
<p>2.9. 100 (one hundred) percent of the cost of cargo transportation and TFS is paid to the Freight Forwarder after the cargo is handed over to the receiver, on the basis of the accounting document issued by the Freight Forwarder, within 7 (seven) business days from its receipt.</p>
<p>2.10. Additional expenses not included in the Price Offer and not approved by the Customer shall be incurred by the Freight Forwarder only after agreement with the Customer, except where it is impossible to obtain the Customer's approval.</p>
<p>2.11–2.13. The Freight Forwarder undertakes to notify the Customer immediately upon the occurrence of the need for additional expenses. Reimbursement shall be made on the basis of accounting documents submitted within two days of receipt of confirming documents.</p>
<p>2.14–2.15. The Customer has the right to raise objections regarding additional expenses. Failure to reimburse such expenses shall not entail any liability for the Customer.</p>

<h3>3. CONDITIONS OF CARGO DELIVERY AND TFS</h3>
<p>3.1. Loading and unloading operations shall be organized and performed by the Customer at its own expense and risk, unless otherwise expressly provided for in the Application.</p>
<p>3.2. The Freight Forwarder is obliged to deliver the cargo to the Place of Delivery no later than 15 days after receiving from shipper, unless a different period is provided for in the Application.</p>

<h3>4. LIABILITY OF THE PARTIES</h3>
<p>4.1. The Parties shall be liable for non-performance or improper performance of their obligations under this Agreement in accordance with applicable legislation.</p>
<p>4.2. Each Party shall properly perform its duties, assisting the other Party as much as possible.</p>
<p>4.3. In case of failure by the Customer to pay the freight amount within the period stipulated in clause 2.9, the Freight Forwarder has the right to demand a penalty of 0.1% of the outstanding amount for each day of delay.</p>
<p>4.4. In case of failure by the Freight Forwarder to deliver the cargo to the place of delivery within the stipulated period, the Customer has the right to demand a penalty of 0.05% of the outstanding amount for each day of delay, but not more than 5% of the total freight charge.</p>
<p>4.5–4.6. In case of damage, destruction, and/or violation of deadlines for TFS, the Freight Forwarder undertakes to compensate the Customer for damages incurred, including lost profits.</p>
<p>4.7. The Parties are released from liability for non-performance of obligations if such non-performance is the result of force majeure.</p>
<p>4.8.1–4.8.4. The Freight Forwarder shall be liable for damages caused to the Customer on the grounds established by Article 873 of the Civil Code of the Republic of Armenia. The Freight Forwarder performs cargo transportation in accordance with the CMR Convention. In case of damage or loss of cargo, the Freight Forwarder shall compensate the Customer for the actual value at acquisition cost, but not exceeding the CMR limit.</p>
<p>4.9.1. The Customer shall be liable for damages caused to the Freight Forwarder in cases of improper performance of this Agreement or unjustified refusal or delay in payment of the Freight Forwarder's invoices.</p>

<h3>5. PROCEDURE FOR FILING CLAIMS AND RESOLVING DISPUTES</h3>
<p>5.1. Claims arising under this Agreement shall be submitted in writing within a reasonable time from the date on which the basis for their submission arose.</p>
<p>5.2. The date of submission of a claim shall be the date indicated on the stamp of the postal organization that received the letter.</p>
<p>5.3. The Party receiving a claim is obliged to review it and respond within 5 business days of receipt.</p>
<p>5.4. All disputes not resolved through negotiations shall be subject to resolution in court in accordance with the legislation of the Republic of Armenia.</p>
<p>5.5. Before filing a claim with the court, the claiming Party is obliged to send a claim to the other Party and receive a response within the established periods.</p>

<h3>6. FORCE MAJEURE</h3>
<p>6.1. The Parties shall not be liable for non-performance of their obligations if such non-performance results from circumstances they could not foresee or prevent: fire, natural disaster, war, civil unrest, siege, strike, decisions of port authorities, disruption of highway infrastructure due to adverse weather conditions (Force Majeure Conditions). If such circumstances continue for more than 60 (sixty) days, each Party has the right to waive performance of obligations under this Agreement without demand for compensation of possible damages.</p>

<h3>7. FINAL PROVISIONS</h3>
<p>7.1. This Agreement enters into force upon signing and is valid for 1 (one) year. If neither Party notifies the other in writing of termination no later than 30 (thirty) days before the expiry, the Agreement is automatically extended for another 1 (one) year each time. The number of extensions is unlimited.</p>
<p>7.2. Each Party has the right to withdraw from this Agreement by giving 30 days' written notice. The withdrawing Party is obliged to compensate the other Party for direct and actually incurred costs related to the termination.</p>
<p>7.3–7.6. Notifications are sent to: Yerevan, Erebuni, Nor-Aresh 12 lane 99/1 18 or to the electronic address. Notification in any form stipulated in clauses 7.3 and 7.4 constitutes proper notification.</p>
<p>7.7–7.8. All amendments, annexes, and additions to this Agreement are valid only if made in writing and signed by the authorized representatives of the Parties.</p>
<p>7.9. Documents signed by one party and exchanged by email have the legal force of original documents upon confirmation of receipt.</p>
<p>7.10. Matters not regulated by the Agreement shall be governed by the legislation of the Republic of Armenia.</p>
<p>7.11. This Agreement consists of 6 (six) pages and is drawn up in 2 copies of equal legal force.</p>`;
}

// ── CONTRACT GENERATORS ───────────────────────────────────────────────────────
const contracts = {

  customer: {

    am: (c,t,a,s,p,d,n,sig,st,bk,ba) => `
      <h2>ՄԻՋԱԶԳԱՅԻՆ ՏՐԱՆՍՊՈՐՏԱՅԻՆ ԱՌԱՔՄԱՆ ՊԱՅՄԱՆԱԳԻՐ</h2>
      <p class="center">Թիվ ${n}</p>
      <p class="center">Ք. Երևան &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${d}</p>
      <br>
      <p>«${c}» ՍՊ Ընկերությունը / ԱՁ ՀՎՀՀ ${t} գրանցման հասցե՝ ${a}, ի դեմս ${p} ${s}, որը գործում է Կանոնադրության հիման վրա, այսուհետ՝ <strong>«Պատվիրատու»</strong>, մի կողմից, և</p>
      <p>«Ջի Էլ Լոգիստիկս» ՍՊԸ-ն ՀՎՀՀ 00521217 Գրանցման հասցե՝ ք. Երևան Նոր-Արեշ 12փ. 99/1 18, որը գործում է իրավաբանական անձանց պետական ռեգիստրի հիման վրա, այսուհետ՝ <strong>«Տրանսպորտային առաքող»</strong>, մյուս կողմից (այսուհետ՝ «Կողմեր»), կնքեցին սույն Պայմանագիրը հետևյալի մասին՝</p>
      ${bodyAM()}
      <h3>8. ԿՈՂՄԵՐԻ ՀԱՍՑԵՆԵՐԸ ՈՒ ՎԱՎԵՐԱՊԱՅՄԱՆՆԵՐԸ</h3>
      <div class="parties-row">
        <div class="party-col">
          <p><strong>Տրանսպորտային առաքող</strong></p>
          <p>Շահառուի Բանկ՝ «Էվոկաբանկ» ՓԲԸ</p>
          <p>Շահառու՝ «Ջի Էլ Լոգիստիկս» ՍՊԸ</p>
          <p>Հ/Հ՝ 1660030207153200 (դրամ)</p>
          <br><p>Տնօրեն՝ Տիգրան Մեծպագյան</p>
          <div class="line"></div>
        </div>
        <div class="party-col">
          <p><strong>Պատվիրատու</strong></p>
          <p>Շահառուի Բանկ՝ ${bk}</p>
          <p>Շահառու՝ «${c}» ՍՊԸ</p>
          <p>Հ/Հ՝ ${ba}</p>
          <br><p>${p}՝ ${s}</p>
          ${sigStamp(sig,st)}
        </div>
      </div>`,

    ru: (c,t,a,s,p,d,n,sig,st,bk,ba) => `
      <h2>ДОГОВОР МЕЖДУНАРОДНОЙ ТРАНСПОРТНОЙ ЭКСПЕДИЦИИ</h2>
      <p class="center">№ ${n}</p>
      <p class="center">г. Ереван &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${d}</p>
      <br>
      <p>ООО / ИП «${c}», ИНН ${t}, юридический адрес: ${a}, в лице ${p} ${s}, действующего на основании Устава, именуемое в дальнейшем <strong>«Заказчик»</strong>, с одной стороны, и</p>
      <p>ООО «Джи Эл Логистикс», ИНН 00521217, юридический адрес: г. Ереван, Нор-Ареш, 12-й пер., 99/1, кв. 18, действующее на основании государственного реестра юридических лиц, именуемое в дальнейшем <strong>«Экспедитор»</strong>, с другой стороны (далее — «Стороны»), заключили настоящий Договор о нижеследующем:</p>
      ${bodyRU()}
      <h3>8. АДРЕСА И РЕКВИЗИТЫ СТОРОН</h3>
      <div class="parties-row">
        <div class="party-col">
          <p><strong>Экспедитор</strong></p>
          <p>Банк получателя: ЗАО «Эвокабанк»</p>
          <p>Получатель: ООО «Джи Эл Логистикс»</p>
          <p>Р/С: 1660030207153200 (драм)</p>
          <br><p>Директор: Тигран Мецпагян</p>
          <div class="line"></div>
        </div>
        <div class="party-col">
          <p><strong>Заказчик</strong></p>
          <p>Банк получателя: ${bk}</p>
          <p>Получатель: «${c}» ООО</p>
          <p>Р/С: ${ba}</p>
          <br><p>${p}: ${s}</p>
          ${sigStamp(sig,st)}
        </div>
      </div>`,

    en: (c,t,a,s,p,d,n,sig,st,bk,ba) => `
      <h2>INTERNATIONAL TRANSPORT FORWARDING AGREEMENT</h2>
      <p class="center">No. ${n}</p>
      <p class="center">Yerevan &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${d}</p>
      <br>
      <p>"${c}" LLC / IE, TIN ${t}, registered address: ${a}, represented by ${p} ${s}, acting on the basis of the Charter, hereinafter referred to as the <strong>"Customer"</strong>, on the one hand, and</p>
      <p>"GL Logistics" LLC, TIN 00521217, registered address: Yerevan, Nor-Aresh 12 lane 99/1 18, acting on the basis of the State Register of Legal Entities, hereinafter referred to as the <strong>"Freight Forwarder"</strong>, on the other hand (hereinafter the "Parties"), have concluded this Agreement as follows:</p>
      ${bodyEN()}
      <h3>8. ADDRESSES AND DETAILS OF THE PARTIES</h3>
      <div class="parties-row">
        <div class="party-col">
          <p><strong>Freight Forwarder</strong></p>
          <p>Beneficiary's Bank: "Evocabank" OJSC</p>
          <p>Beneficiary: "GL Logistics" LLC</p>
          <p>Account No.: 1660030207153200 (AMD)</p>
          <br><p>Director: Tigran Metspaghyan</p>
          <div class="line"></div>
        </div>
        <div class="party-col">
          <p><strong>Customer</strong></p>
          <p>Beneficiary's Bank: ${bk}</p>
          <p>Beneficiary: "${c}" LLC</p>
          <p>Account No.: ${ba}</p>
          <br><p>${p}: ${s}</p>
          ${sigStamp(sig,st)}
        </div>
      </div>`
  },

  carrier: {

    am: (c,t,a,s,p,d,n,sig,st,bk,ba) => `
      <h2>ՄԻՋԱԶԳԱՅԻՆ ՏՐԱՆՍՊՈՐՏԱՅԻՆ ԱՌԱՔՄԱՆ ՊԱՅՄԱՆԱԳԻՐ</h2>
      <p class="center">Թիվ ${n}</p>
      <p class="center">Ք. Երևան &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${d}</p>
      <br>
      <p>«Ջի Էլ Լոգիստիկս» ՍՊԸ-ն ՀՎՀՀ 00521217 Գրանցման հասցե՝ ք. Երևան Նոր-Արեշ 12փ. 99/1 18, որը գործում է իրավաբանական անձանց պետական ռեգիստրի հիման վրա, այսուհետ՝ <strong>«Պատվիրատու»</strong>, մի կողմից, և</p>
      <p>«${c}» ՍՊ Ընկերությունը / ԱՁ ՀՎՀՀ ${t} գրանցման հասցե՝ ${a}, ի դեմս ${p} ${s}, որը գործում է Կանոնադրության հիման վրա, այսուհետ՝ <strong>«Տրանսպորտային առաքող»</strong>, մյուս կողմից (այսուհետ՝ «Կողմեր»), կնքեցին սույն Պայմանագիրը հետևյալի մասին՝</p>
      ${bodyAM()}
      <h3>8. ԿՈՂՄԵՐԻ ՀԱՍՑԵՆԵՐԸ ՈՒ ՎԱՎԵՐԱՊԱՅՄԱՆՆԵՐԸ</h3>
      <div class="parties-row">
        <div class="party-col">
          <p><strong>Պատվիրատու</strong></p>
          <p>Շահառուի Բանկ՝ «Էվոկաբանկ» ՓԲԸ</p>
          <p>Շահառու՝ «Ջի Էլ Լոգիստիկս» ՍՊԸ</p>
          <p>Հ/Հ՝ 1660030207153200 (դրամ)</p>
          <br><p>Տնօրեն՝ Տիգրան Մեծպագյան</p>
          <div class="line"></div>
        </div>
        <div class="party-col">
          <p><strong>Տրանսպորտային առաքող</strong></p>
          <p>Շահառուի Բանկ՝ ${bk}</p>
          <p>Շահառու՝ «${c}» ՍՊԸ</p>
          <p>Հ/Հ՝ ${ba}</p>
          <br><p>${p}՝ ${s}</p>
          ${sigStamp(sig,st)}
        </div>
      </div>`,

    ru: (c,t,a,s,p,d,n,sig,st,bk,ba) => `
      <h2>ДОГОВОР МЕЖДУНАРОДНОЙ ТРАНСПОРТНОЙ ЭКСПЕДИЦИИ</h2>
      <p class="center">№ ${n}</p>
      <p class="center">г. Ереван &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${d}</p>
      <br>
      <p>ООО «Джи Эл Логистикс», ИНН 00521217, юридический адрес: г. Ереван, Нор-Ареш, 12-й пер., 99/1, кв. 18, действующее на основании государственного реестра юридических лиц, именуемое в дальнейшем <strong>«Заказчик»</strong>, с одной стороны, и</p>
      <p>ООО / ИП «${c}», ИНН ${t}, юридический адрес: ${a}, в лице ${p} ${s}, действующего на основании Устава, именуемое в дальнейшем <strong>«Экспедитор»</strong>, с другой стороны (далее — «Стороны»), заключили настоящий Договор о нижеследующем:</p>
      ${bodyRU()}
      <h3>8. АДРЕСА И РЕКВИЗИТЫ СТОРОН</h3>
      <div class="parties-row">
        <div class="party-col">
          <p><strong>Заказчик</strong></p>
          <p>Банк получателя: ЗАО «Эвокабанк»</p>
          <p>Получатель: ООО «Джи Эл Логистикс»</p>
          <p>Р/С: 1660030207153200 (драм)</p>
          <br><p>Директор: Тигран Мецпагян</p>
          <div class="line"></div>
        </div>
        <div class="party-col">
          <p><strong>Экспедитор</strong></p>
          <p>Банк получателя: ${bk}</p>
          <p>Получатель: «${c}» ООО</p>
          <p>Р/С: ${ba}</p>
          <br><p>${p}: ${s}</p>
          ${sigStamp(sig,st)}
        </div>
      </div>`,

    en: (c,t,a,s,p,d,n,sig,st,bk,ba) => `
      <h2>INTERNATIONAL TRANSPORT FORWARDING AGREEMENT</h2>
      <p class="center">No. ${n}</p>
      <p class="center">Yerevan &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${d}</p>
      <br>
      <p>"GL Logistics" LLC, TIN 00521217, registered address: Yerevan, Nor-Aresh 12 lane 99/1 18, acting on the basis of the State Register of Legal Entities, hereinafter referred to as the <strong>"Customer"</strong>, on the one hand, and</p>
      <p>"${c}" LLC / IE, TIN ${t}, registered address: ${a}, represented by ${p} ${s}, acting on the basis of the Charter, hereinafter referred to as the <strong>"Freight Forwarder"</strong>, on the other hand (hereinafter the "Parties"), have concluded this Agreement as follows:</p>
      ${bodyEN()}
      <h3>8. ADDRESSES AND DETAILS OF THE PARTIES</h3>
      <div class="parties-row">
        <div class="party-col">
          <p><strong>Customer</strong></p>
          <p>Beneficiary's Bank: "Evocabank" OJSC</p>
          <p>Beneficiary: "GL Logistics" LLC</p>
          <p>Account No.: 1660030207153200 (AMD)</p>
          <br><p>Director: Tigran Metspaghyan</p>
          <div class="line"></div>
        </div>
        <div class="party-col">
          <p><strong>Freight Forwarder</strong></p>
          <p>Beneficiary's Bank: ${bk}</p>
          <p>Beneficiary: "${c}" LLC</p>
          <p>Account No.: ${ba}</p>
          <br><p>${p}: ${s}</p>
          ${sigStamp(sig,st)}
        </div>
      </div>`
  }
};

// ── UI labels ─────────────────────────────────────────────────────────────────
const uiLabels={am:{contract_number_label:"ՊԱՅՄԱՆԱԳՐԻ ՀԱՄԱՐ (ԹԻՎ)",brand_title:"Ջի Էլ Լոգիստիկս • ՊԱՅՄԱՆԱԳՐԻ ՍՏՈՐԱԳՐՈՒՄ",btn_customer:"👤 ՊԱՏՎԻՐԱՏՈՒ → ՋԻ ԷԼ",btn_carrier:"🚛 ՋԻ ԷԼ → ՓՈԽԱԴՐՈՂ",form_title:"📄 ՍՏՈՐԱԳՐԵԼ ՊԱՅՄԱՆԱԳԻՐԸ",company_label:"ԸՆԿԵՐՈՒԹՅԱՆ ԱՆՎԱՆՈՒՄ *",tax_label:"ՀՎՀՀ",address_label:"ՀԱՍՑԵ",signatory_label:"ՍՏՈՐԱԳՐՈՂԻ ԱՆՈՒՆ *",position_label:"ՊԱՇՏՈՆ",date_label:"ԱՄՍԱԹԻՎ *",email_label:"ԷԼ. ՓՈՍՏ *",phone_label:"ՀԵՌԱԽՈՍ",upload_stamp:"ԿՆԻՔ",upload_signature:"ՍՏՈՐԱԳՐՈՒԹՅՈՒՆ",agree_text:"Ես կարդացել և ընդունում եմ պայմանագրի բոլոր պայմանները:",submit_btn:"✍️ ՍՏՈՐԱԳՐԵԼ ԵՎ ՈՒՂԱՐԿԵԼ",success_title:"Պայմանագիրը հաջողությամբ ստորագրված է:",success_msg:"PDF հղումը ուղարկվել է Ձեր էլ. փոստին:"},ru:{contract_number_label:"НОМЕР ДОГОВОРА",brand_title:"Джи Эл Логистикс • Подписание контракта",btn_customer:"👤 ЗАКАЗЧИК → ДЖИ ЭЛ",btn_carrier:"🚛 ДЖИ ЭЛ → ПЕРЕВОЗЧИК",form_title:"📄 ПОДПИСАТЬ ДОГОВОР",company_label:"КОМПАНИЯ *",tax_label:"ИНН",address_label:"АДРЕС",signatory_label:"ФИО ПОДПИСАНТА *",position_label:"ДОЛЖНОСТЬ",date_label:"ДАТА *",email_label:"EMAIL *",phone_label:"ТЕЛЕФОН",upload_stamp:"ПЕЧАТЬ",upload_signature:"ПОДПИСЬ",agree_text:"Принимаю условия договора.",submit_btn:"✍️ ПОДПИСАТЬ И ОТПРАВИТЬ",success_title:"Договор подписан!",success_msg:"Ссылка на PDF отправлена на ваш email."},en:{contract_number_label:"CONTRACT NUMBER",brand_title:"GL Logistics • Contract Signing",btn_customer:"👤 CUSTOMER → GL",btn_carrier:"🚛 GL → CARRIER",form_title:"📄 SIGN CONTRACT",company_label:"COMPANY NAME *",tax_label:"TAX ID / VAT",address_label:"LEGAL ADDRESS",signatory_label:"SIGNATORY FULL NAME *",position_label:"POSITION",date_label:"DATE *",email_label:"EMAIL *",phone_label:"PHONE",upload_stamp:"COMPANY STAMP",upload_signature:"DRAW SIGNATURE",agree_text:"I accept all terms of this Agreement.",submit_btn:"✍️ SIGN & SUBMIT",success_title:"Contract Signed!",success_msg:"PDF link sent to your email."}};

// ── State & core logic ────────────────────────────────────────────────────────
let currentLang='am', currentType='customer', stampDataUrl=null, signatureDataUrl=null, signaturePad;
const previewDiv=document.getElementById('contractPreview'), canvas=document.getElementById('signatureCanvas');

function captureSignature(){
  if(signaturePad && !signaturePad.isEmpty()){
    signatureDataUrl=signaturePad.toDataURL('image/png');
    document.getElementById('signaturePreview').src=signatureDataUrl;
    document.getElementById('signaturePreview').style.display='block';
    renderContract();
  }
}
function initSignaturePad(){
  canvas.width=canvas.offsetWidth||300;
  canvas.height=canvas.offsetHeight||80;
  signaturePad=new SignaturePad(canvas,{
    backgroundColor:'rgba(255,255,255,0)',
    penColor:'rgb(10,10,10)',
    minWidth:1,maxWidth:3,
    onEnd: captureSignature
  });
}
initSignaturePad();
window.addEventListener('resize',()=>{const d=signaturePad.toData();initSignaturePad();if(d&&d.length>0){signaturePad.fromData(d);captureSignature();}});

document.getElementById('clearSignature').addEventListener('click',()=>{signaturePad.clear();signatureDataUrl=null;document.getElementById('signaturePreview').style.display='none';renderContract();});

document.getElementById('stampTrigger').addEventListener('click',()=>document.getElementById('stampInput').click());
document.getElementById('stampInput').addEventListener('change',(e)=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=(ev)=>{stampDataUrl=ev.target.result;document.getElementById('stampPreview').src=stampDataUrl;document.getElementById('stampPreview').style.display='block';renderContract();};r.readAsDataURL(f);}});

function renderContract(){
  const c=document.getElementById('company').value.trim()||'[COMPANY]',
        t=document.getElementById('taxId').value.trim()||'________',
        a=document.getElementById('address').value.trim()||'________',
        s=document.getElementById('signatory').value.trim()||'[NAME]',
        p=document.getElementById('position').value.trim()||'Տնօրեն',
        d=document.getElementById('signDate').value||new Date().toISOString().slice(0,10),
        bk=document.getElementById('bankName').value.trim()||'_______________',
        ba=document.getElementById('bankAccount').value.trim()||'________________________',
        // Номер из ручного поля
        manualNumber=document.getElementById('contractNumberInput').value.trim();
  const contractNumber = manualNumber || generateContractNumber();
  document.getElementById('contractNumberDisplay').textContent=contractNumber;
  const fn=contracts[currentType][currentLang];
  previewDiv.innerHTML=watermark() + docFooter() + fn(c,t,a,s,p,d,contractNumber,signatureDataUrl,stampDataUrl,bk,ba);
}

function generateContractNumber(){const y=new Date().getFullYear(),p=currentType==='customer'?'GL-C':'GL-T',r=Math.floor(Math.random()*9000)+1000;return`${p}-${y}-${r}`;}

document.querySelectorAll('.type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.type-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');currentType=b.dataset.type;renderContract();
}));
document.querySelectorAll('.lang-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.lang-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');currentLang=b.dataset.lang;updateUILabels();renderContract();
}));

function updateUILabels(){const t=uiLabels[currentLang];if(!t)return;document.querySelectorAll('[data-i18n]').forEach(e=>{const k=e.dataset.i18n;if(t[k])e.innerHTML=t[k];});}

['contractNumberInput','company','taxId','address','signatory','position','signDate','bankName','bankAccount'].forEach(id=>{document.getElementById(id)?.addEventListener('input',renderContract);});
document.getElementById('signDate').valueAsDate=new Date();

// ── Подписанная загрузка в Cloudinary ─────────────────────────────────────────
// Раньше здесь стоял открытый unsigned upload_preset — им мог воспользоваться
// кто угодно, зная его название (оно видно в исходнике страницы), и заливать
// свои файлы в ваш Cloudinary-аккаунт от вашего имени.
// Теперь подпись для загрузки выдаёт Worker (эндпоинт /api/cloudinary-sign,
// см. worker-additions.js). Если этот эндпоинт ещё не добавлен на сервере,
// функция просто вернёт пустую строку и PDF всё равно скачается локально +
// уйдёт в Formspree — сайт не сломается, просто ссылка на PDF не появится в письме.
async function uploadPdfToR2(pdfBlob, fileName) {
  try {
    const res = await fetch(WORKER_URL + '/api/upload-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBlob,
    });
    if (!res.ok) return { url: '', key: '' };
    const data = await res.json();
    return { url: data.url || '', key: data.key || '' };
  } catch (_) {
    return { url: '', key: '' };
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────
document.getElementById('contractForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!document.getElementById('agree').checked) { alert(uiLabels[currentLang]?.agree_text); return; }

  const btn = this.querySelector('.btn-submit');
  btn.disabled = true;
  btn.innerHTML = '⏳ Ստեղծվում է PDF...';

  const customerEmail  = document.getElementById('email').value.trim();
  const companyName    = document.getElementById('company').value.trim();
  const signatoryName  = document.getElementById('signatory').value.trim();
  const contractNumber = document.getElementById('contractNumberInput').value.trim() || generateContractNumber();
  const fileName       = 'contract_' + contractNumber + '.pdf';

  try {
    const canvasEl = await html2canvas(previewDiv, {
      scale: 2, useCORS: true, backgroundColor: '#FFFFFF', logging: false
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageW - margin * 2;
    const imgRatio = canvasEl.height / canvasEl.width;
    const imgH = usableW * imgRatio;

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(canvasEl.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, imgH);
    } else {
      let yOffset = 0;
      const sliceH = Math.floor(canvasEl.width * (pageH - margin * 2) / usableW);
      while (yOffset < canvasEl.height) {
        const slice = document.createElement('canvas');
        slice.width  = canvasEl.width;
        slice.height = Math.min(sliceH, canvasEl.height - yOffset);
        slice.getContext('2d').drawImage(canvasEl, 0, yOffset, canvasEl.width, slice.height, 0, 0, canvasEl.width, slice.height);
        if (yOffset > 0) pdf.addPage();
        const sliceImgH = slice.height * usableW / canvasEl.width;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, sliceImgH);
        yOffset += sliceH;
      }
    }

    const pdfBlob = pdf.output('blob');

    // Local download
    const localUrl = URL.createObjectURL(pdfBlob);
    const dlLink = document.createElement('a');
    dlLink.href = localUrl; dlLink.download = fileName;
    document.body.appendChild(dlLink); dlLink.click();
    document.body.removeChild(dlLink);
    setTimeout(() => URL.revokeObjectURL(localUrl), 5000);

    btn.innerHTML = '📤 Ուղարկվում է...';

    const { url: cloudinaryUrl, key: pdfKey } = await uploadPdfToR2(pdfBlob, fileName);

    // Уведомление в офис GL Logistics
    try {
      await fetch(WORKER_URL + '/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'info@gllogistics.org',
          subject: 'GL Logistics — New Contract ' + contractNumber,
          pdfKey: pdfKey || null,
          pdfName: 'contract-' + contractNumber + '.pdf',
          html: `<h2>Новый подписанный договор №${contractNumber}</h2>
<p><b>Компания:</b> ${companyName}</p>
<p><b>Подписант:</b> ${signatoryName}</p>
<p><b>Email клиента:</b> ${customerEmail}</p>
<p><b>Тип:</b> ${currentType} / ${currentLang}</p>
<p><b>PDF прикреплён к письму.</b></p>`
        })
      });
    } catch (_) {}

    // Письмо клиенту с PDF во вложении
    try {
      await fetch(WORKER_URL + '/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerEmail,
          subject: 'GL Logistics — Ваш договор №' + contractNumber + ' подписан',
          pdfKey: pdfKey || null,
          pdfName: 'contract-' + contractNumber + '.pdf',
          html: `<p>Уважаемый(ая) ${signatoryName},</p>
<p>Ваш договор №<b>${contractNumber}</b> успешно подписан и отправлен в GL Logistics.</p>
<p>Договор прикреплён к этому письму в виде PDF-файла.</p>
<p>Спасибо за выбор GL Logistics!</p>
<hr>
<p style="color:#888;font-size:12px">GL Logistics LLC · +374 93 66 14 54 · info@gllogistics.org · gllogistics.org</p>`
        })
      });
    } catch (_) {}

    document.getElementById('contractForm').style.display = 'none';
    document.getElementById('successMsg').style.display  = 'block';

  } catch (err) {
    console.error('Submit error:', err);
    alert('Սխալ: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = uiLabels[currentLang]?.submit_btn || '✍️ SUBMIT';
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
updateUILabels();
document.getElementById('contractNumberDisplay').textContent = generateContractNumber();
renderContract();
