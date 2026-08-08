
// ── Универсальный Drag & Drop ──────────────────────────────────────────────
function initDropzone(wrapper, opts = {}) {
  const {
    multiple = true,
    accept = 'image/*,application/pdf',
    onChange = null,
    label = 'Перетащите файлы или нажмите для выбора',
  } = opts;

  // Создаём разметку
  wrapper.className = 'dropzone';
  wrapper.innerHTML = `
    <input type="file" ${multiple ? 'multiple' : ''} accept="${accept}">
    <div class="dropzone-label">
      <span class="icon">📎</span>
      <span>${label}</span><br>
      <strong>JPG, PNG, PDF</strong>
    </div>
    <div class="dropzone-files"></div>`;

  const input = wrapper.querySelector('input[type=file]');
  const filesDiv = wrapper.querySelector('.dropzone-files');
  let files = [];

  function renderFiles() {
    filesDiv.innerHTML = files.map((f, i) => `
      <div class="dropzone-file-chip">
        ${f.type.includes('pdf') ? '📄' : '🖼'} ${f.name}
        <button onclick="removeDropFile(this, ${i})" type="button">✕</button>
      </div>`).join('');
  }

  window.removeDropFile = function(btn, idx) {
    files.splice(idx, 1);
    renderFiles();
    if (onChange) onChange(files);
  };

  function addFiles(newFiles) {
    if (!multiple) files = [];
    for (const f of newFiles) {
      if (!files.find(x => x.name === f.name && x.size === f.size)) files.push(f);
    }
    renderFiles();
    if (onChange) onChange(files);
  }

  input.addEventListener('change', () => addFiles(Array.from(input.files)));

  wrapper.addEventListener('dragover', e => { e.preventDefault(); wrapper.classList.add('drag-over'); });
  wrapper.addEventListener('dragleave', () => wrapper.classList.remove('drag-over'));
  wrapper.addEventListener('drop', e => {
    e.preventDefault();
    wrapper.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files));
  });

  wrapper.getFiles = () => files;
  wrapper.reset = () => { files = []; renderFiles(); };
  return wrapper;
}

// Автоматически инициализируем все data-dropzone элементы
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-dropzone]').forEach(el => {
    initDropzone(el, {
      multiple: el.dataset.multiple !== 'false',
      accept: el.dataset.accept || 'image/*,application/pdf',
      label: el.dataset.label || 'Перетащите файлы или нажмите для выбора',
    });
  });
});
