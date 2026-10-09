// GL Logistics — убираем все emoji из текста
(function() {
  const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}-\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}-\u{1F251}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{FE0F}]/gu;

  // Служебные значки кнопок не трогаем: ✓ ✗ (оплата), ✎ ✏ (изменить), ✕ ✖ ✔ (удалить / готово), ☰ (меню)
  const KEEP = new Set(['\u2713', '\u2717', '\u270E', '\u270F', '\u2715', '\u2716', '\u2714', '\u2630']);
  const CLICKABLE = new Set(['BUTTON', 'A', 'LABEL', 'OPTION', 'SUMMARY']);
  function cleanNode(node) {
    if (node.nodeType === 3) { // TEXT_NODE
      const cleaned = node.textContent.replace(EMOJI_RE, ch => KEEP.has(ch) ? ch : '').replace(/\s+/g, ' ').trimStart();
      if (cleaned === node.textContent) return;
      // Никогда не оставляем кнопку или ссылку пустой: если в ней был только значок — оставляем как есть
      const p = node.parentElement;
      if (!cleaned.trim() && p && CLICKABLE.has(p.tagName) && p.textContent.trim() === node.textContent.trim() && !p.querySelector('svg, img')) return;
      node.textContent = cleaned;
    } else if (node.nodeType === 1 && !['SCRIPT','STYLE','SVG','IMG','INPUT','TEXTAREA'].includes(node.tagName)) {
      node.childNodes.forEach(cleanNode);
    }
  }

  function runClean() {
    cleanNode(document.body);
  }

  // Запускаем после загрузки и после каждого изменения DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runClean);
  } else {
    runClean();
  }

  // MutationObserver — убираем emoji из динамически добавляемого контента
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1 || node.nodeType === 3) cleanNode(node);
      });
    });
  });
  // Скрипт подключён в <head>: начинаем следить, когда появилось тело страницы
  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
