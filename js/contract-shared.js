// Общие хелперы для contract.html и rateconfirmation.html
// Вынесены в отдельный файл, чтобы не дублировать один и тот же код в двух местах
// и чтобы CSP страниц мог разрешать скрипты через 'self' без 'unsafe-inline'.

function sigStamp(sig, st) {
  // Печать отображается в отдельном draggable overlay (#stampOverlay),
  // поэтому здесь рендерим только подпись (st игнорируется намеренно).
  var row = 'display:table;width:100%;border-collapse:separate;border-spacing:10px 0;margin-top:8px;';
  var html = '<div style="' + row + '">';
  html += '<div style="display:table-cell;vertical-align:bottom;width:100%;">';
  if (sig) {
    html += '<img src="' + sig + '" alt="signature" '
          + 'style="display:block;width:auto;height:70px;max-width:220px;'
          + 'object-fit:contain;background:transparent;margin-bottom:4px;">';
  }
  html += '<div style="height:1px;background:#2A5E66;width:100%;"></div>';
  html += '</div>';
  html += '</div>';
  return html;
}

// Водяной знак
function watermark() {
  return '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.12; pointer-events:none; z-index:0;"><img src="images/GL_LOGISTICs_line_-09.jpg.png" style="width:450px;"></div>';
}

// Футер — одна строка в самом низу справа
function docFooter() {
  return '<div class="doc-footer">GL Logistics LLC &nbsp;|&nbsp; VAT: 00521217 &nbsp;|&nbsp; www.gllogistics.org &nbsp;|&nbsp; +374 93 66 14 54</div>';
}
