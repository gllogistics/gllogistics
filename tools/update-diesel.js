// Обновление цен на дизель из еженедельного бюллетеня Еврокомиссии (EC Weekly Oil Bulletin).
// Запуск: node update-diesel.js
// Результат: diesel.json рядом с truckcost.html (калькулятор подхватит его сам)
// и обновлённый встроенный блок цен внутри truckcost.html (на случай открытия файла без сервера).
// Зависимостей нет — нужен только Node.js 18+.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Постоянная ссылка «Prices with taxes, latest prices (xlsx)» со страницы
// https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en
const URL = "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en";

const NAMES = {Austria:"AT",Belgium:"BE",Bulgaria:"BG",Croatia:"HR",Cyprus:"CY",Czechia:"CZ",Denmark:"DK",Estonia:"EE",
  Finland:"FI",France:"FR",Germany:"DE",Greece:"GR",Hungary:"HU",Ireland:"IE",Italy:"IT",Latvia:"LV",Lithuania:"LT",
  Luxembourg:"LU",Malta:"MT",Netherlands:"NL",Poland:"PL",Portugal:"PT",Romania:"RO",Slovakia:"SK",Slovenia:"SI",Spain:"ES",Sweden:"SE"};

// Минимальное чтение zip (xlsx — это zip-архив)
function unzip(buf) {
  const files = {};
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Файл не похож на xlsx");
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    p += 46 + nameLen + extraLen + commLen;
  }
  return files;
}

(async () => {
  const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 truckcost-updater" } });
  if (!res.ok) throw new Error("Бюллетень недоступен: HTTP " + res.status);
  const files = unzip(Buffer.from(await res.arrayBuffer()));
  const strings = [...files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, "").trim());
  const sheet = files["xl/worksheets/sheet1.xml"].toString("utf8");

  let date = null;
  const prices = {};
  for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v>/g))
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[+c[3]] : c[3];
    if (!date && /^\d{5}$/.test(cells.A || "")) {
      // дата в формате Excel (дни от 1899-12-30)
      date = new Date(Date.UTC(1899, 11, 30) + (+cells.A) * 864e5).toISOString().slice(0, 10);
    }
    const cc = NAMES[cells.A];
    if (cc && cells.C) prices[cc] = Math.round(+cells.C) / 1000; // столбец C — дизель, € за 1000 л
  }
  if (Object.keys(prices).length < 20) throw new Error("Не удалось разобрать таблицу бюллетеня");

  const out = { date, source: "European Commission, Weekly Oil Bulletin (prices with taxes, automotive gas oil)", prices };
  const dir = path.join(__dirname, "..");   // корень сайта: diesel.json и truckcost.html
  fs.writeFileSync(path.join(dir, "diesel.json"), JSON.stringify(out, null, 2));

  // Обновляем встроенный блок в truckcost.html
  const htmlPath = path.join(dir, "truckcost.html");
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const block = `/*EC_DIESEL*/${JSON.stringify(out)}/*END_EC_DIESEL*/`;
    const next = html.replace(/\/\*EC_DIESEL\*\/[\s\S]*?\/\*END_EC_DIESEL\*\//, block);
    if (next !== html) fs.writeFileSync(htmlPath, next);
  }
  console.log(`Цены на дизель обновлены: неделя ${date}, стран: ${Object.keys(prices).length}`);
})().catch(e => { console.error("Ошибка: " + e.message); process.exit(1); });
