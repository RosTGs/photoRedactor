const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const prepareBtn = document.getElementById('prepareBtn');
const printBtn = document.getElementById('printBtn');
const previewGrid = document.getElementById('previewGrid');
const statusEl = document.getElementById('status');
const textAreaInput = document.getElementById('textArea');
const textAreaValue = document.getElementById('textAreaValue');

const files = [];
let preparedImages = [];

const mmToPx = (mm, dpi) => (mm / 25.4) * dpi;

function setStatus(message) {
  statusEl.textContent = message;
}

function clearPreviews() {
  previewGrid.innerHTML = '<p class="muted">Нет подготовленных страниц.</p>';
}

function renderFileList() {
  if (files.length === 0) {
    fileList.innerHTML = '<p class="muted">Пока нет загруженных фото.</p>';
    clearPreviews();
    return;
  }

  fileList.innerHTML = '';
  files.forEach((file) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `<span class="badge">${Math.round(file.size / 1024)} КБ</span>${file.name}`;
    fileList.appendChild(chip);
  });
}

function addFiles(newFiles) {
  const accepted = Array.from(newFiles).filter((f) => f.type.startsWith('image/'));
  if (accepted.length === 0) return;
  files.push(...accepted);
  renderFileList();
}

selectBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  addFiles(e.target.files);
  fileInput.value = '';
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
});

textAreaInput.addEventListener('input', () => {
  textAreaValue.textContent = `${textAreaInput.value}%`;
});

async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function drawToCanvas(img, options) {
  const { albumWidthPx, albumHeightPx, paddingPx, textAreaPercent } = options;

  const canvas = document.createElement('canvas');
  canvas.width = albumWidthPx;
  canvas.height = albumHeightPx;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, albumWidthPx, albumHeightPx);

  const textAreaHeight = Math.round((textAreaPercent / 100) * albumHeightPx);
  const drawWidth = albumWidthPx - paddingPx * 2;
  const drawHeight = albumHeightPx - textAreaHeight - paddingPx * 2;

  const scale = Math.min(drawWidth / img.width, drawHeight / img.height);
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);
  const offsetX = paddingPx + (drawWidth - targetWidth) / 2;
  const offsetY = paddingPx + (drawHeight - targetHeight) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(img, offsetX, offsetY, targetWidth, targetHeight);
  ctx.restore();

  const textTop = albumHeightPx - textAreaHeight;
  ctx.fillStyle = '#f1f4f9';
  ctx.fillRect(0, textTop, albumWidthPx, textAreaHeight);

  ctx.strokeStyle = '#cfd6e5';
  ctx.lineWidth = 2;
  ctx.strokeRect(paddingPx, paddingPx, drawWidth, drawHeight);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    paddingPx,
    textTop + paddingPx,
    albumWidthPx - paddingPx * 2,
    textAreaHeight - paddingPx * 2
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('Место под текст и подписи', paddingPx + 10, textTop + 28);

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Не удалось создать файл изображения.'));
      }
    }, 'image/jpeg', 0.92);
  });
}

async function prepareImages() {
  if (files.length === 0) {
    alert('Сначала загрузите фотографии.');
    return;
  }

  setStatus('Готовим страницы...');
  if (preparedImages.length) {
    preparedImages.forEach(({ dataUrl }) => URL.revokeObjectURL(dataUrl));
  }
  previewGrid.innerHTML = '';
  preparedImages = [];

  const albumWidthPx = Math.round(mmToPx(Number(document.getElementById('albumWidth').value), Number(document.getElementById('dpi').value)));
  const albumHeightPx = Math.round(mmToPx(Number(document.getElementById('albumHeight').value), Number(document.getElementById('dpi').value)));
  const paddingPx = Math.round(mmToPx(Number(document.getElementById('padding').value), Number(document.getElementById('dpi').value)));
  const textAreaPercent = Number(textAreaInput.value);

  const template = document.getElementById('previewCard');

  for (const [index, file] of files.entries()) {
    const img = await loadImage(file);
    const canvas = drawToCanvas(img, { albumWidthPx, albumHeightPx, paddingPx, textAreaPercent });
    const blob = await canvasToBlob(canvas);
    const dataUrl = URL.createObjectURL(blob);

    preparedImages.push({
      name: `prepared-${file.name.replace(/\.[^.]+$/, '')}.jpg`,
      dataUrl,
      blob,
    });

    const clone = template.content.cloneNode(true);
    clone.querySelector('.card__title').textContent = `Страница ${index + 1}`;
    const canvasContainer = clone.querySelector('.card__canvas');
    const previewImg = document.createElement('img');
    previewImg.src = dataUrl;
    previewImg.alt = file.name;
    canvasContainer.appendChild(previewImg);

    const link = clone.querySelector('a');
    link.href = dataUrl;
    link.download = `prepared-${file.name}`;

    previewGrid.appendChild(clone);
  }

  setStatus(`Готово: ${preparedImages.length} стр.`);
}

async function sendToPrint() {
  if (preparedImages.length === 0) {
    alert('Сначала нажмите «Подготовить фото».');
    return;
  }

  const zip = new JSZip();
  preparedImages.forEach((item) => {
    zip.file(item.name, item.blob);
  });

  setStatus('Формируем архив для печати...');
  const zipContent = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipContent);
  link.download = 'album-ready.zip';
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus('Архив готов и скачан.');
}

prepareBtn.addEventListener('click', prepareImages);
printBtn.addEventListener('click', sendToPrint);

renderFileList();
setStatus('Готово к подготовке.');
