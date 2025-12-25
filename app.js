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

function computeLayout(img, albumWidthPx, albumHeightPx, paddingPx, textAreaPercent) {
  const textAreaHeight = Math.round((textAreaPercent / 100) * albumHeightPx);
  const drawWidth = albumWidthPx - paddingPx * 2;
  const drawHeight = albumHeightPx - textAreaHeight - paddingPx * 2;

  const scale = Math.max(drawWidth / img.width, drawHeight / img.height);
  const baseTargetWidth = Math.round(img.width * scale);
  const baseTargetHeight = Math.round(img.height * scale);
  const baseOffsetX = (drawWidth - baseTargetWidth) / 2;
  const baseOffsetY = (drawHeight - baseTargetHeight) / 2;

  return {
    albumWidthPx,
    albumHeightPx,
    paddingPx,
    textAreaPercent,
    textAreaHeight,
    drawWidth,
    drawHeight,
    baseTargetWidth,
    baseTargetHeight,
    targetWidth: baseTargetWidth,
    targetHeight: baseTargetHeight,
    baseOffsetX,
    baseOffsetY,
    offsetX: baseOffsetX,
    offsetY: baseOffsetY,
    scale: 1,
  };
}

function clampOffsets(layout) {
  const minX = layout.drawWidth - layout.targetWidth;
  const minY = layout.drawHeight - layout.targetHeight;
  layout.offsetX = Math.min(0, Math.max(minX, layout.offsetX));
  layout.offsetY = Math.min(0, Math.max(minY, layout.offsetY));
}

function applyScale(layout, scalePercent) {
  const newScale = Math.min(1.8, Math.max(0.6, scalePercent / 100));
  const centerX = layout.offsetX + layout.targetWidth / 2;
  const centerY = layout.offsetY + layout.targetHeight / 2;

  layout.scale = newScale;
  layout.targetWidth = Math.round(layout.baseTargetWidth * newScale);
  layout.targetHeight = Math.round(layout.baseTargetHeight * newScale);
  layout.offsetX = centerX - layout.targetWidth / 2;
  layout.offsetY = centerY - layout.targetHeight / 2;
  clampOffsets(layout);
}

function resetLayout(layout) {
  layout.scale = 1;
  layout.targetWidth = layout.baseTargetWidth;
  layout.targetHeight = layout.baseTargetHeight;
  layout.offsetX = layout.baseOffsetX;
  layout.offsetY = layout.baseOffsetY;
  clampOffsets(layout);
}

function updatePreviewPosition(imgEl, layout) {
  imgEl.style.width = `${(layout.targetWidth / layout.drawWidth) * 100}%`;
  imgEl.style.height = `${(layout.targetHeight / layout.drawHeight) * 100}%`;
  imgEl.style.left = `${(layout.offsetX / layout.drawWidth) * 100}%`;
  imgEl.style.top = `${(layout.offsetY / layout.drawHeight) * 100}%`;
}

async function updatePreparedAsset(state) {
  const canvas = drawToCanvas(state.img, state.layout);
  const blob = await canvasToBlob(canvas);
  const dataUrl = URL.createObjectURL(blob);

  state.dataUrl && URL.revokeObjectURL(state.dataUrl);
  state.dataUrl = dataUrl;
  state.blob = blob;

  state.linkEl.href = dataUrl;
  state.previewImg.src = dataUrl;
}

function attachDragging(photoArea, imgEl, state) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  const handlePointerDown = (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    photoArea.setPointerCapture(e.pointerId);
    photoArea.classList.add('is-dragging');
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const rect = photoArea.getBoundingClientRect();
    const dx = (e.clientX - lastX) * (state.layout.drawWidth / rect.width);
    const dy = (e.clientY - lastY) * (state.layout.drawHeight / rect.height);
    state.layout.offsetX += dx;
    state.layout.offsetY += dy;
    clampOffsets(state.layout);
    updatePreviewPosition(imgEl, state.layout);
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    photoArea.classList.remove('is-dragging');
    updatePreparedAsset(state);
  };

  photoArea.addEventListener('pointerdown', handlePointerDown);
  photoArea.addEventListener('pointermove', handlePointerMove);
  photoArea.addEventListener('pointerup', handlePointerUp);
  photoArea.addEventListener('pointerleave', handlePointerUp);
}

function attachEditControls(state, clone, photoArea, imgEl) {
  const editPanel = clone.querySelector('.edit-panel');
  const editBtn = clone.querySelector('.card__edit-btn');
  const scaleInput = clone.querySelector('.edit-scale');
  const scaleValue = clone.querySelector('.edit-scale__value');
  const resetBtn = clone.querySelector('.edit-reset');
  const applyBtn = clone.querySelector('.edit-apply');
  const card = clone.querySelector('.card');

  const setScaleValue = () => {
    scaleValue.textContent = `${Math.round(state.layout.scale * 100)}%`;
  };

  const scheduleAssetUpdate = () => {
    clearTimeout(state.updateTimer);
    state.updateTimer = setTimeout(() => updatePreparedAsset(state), 140);
  };

  const openPanel = () => {
    editPanel.classList.remove('is-collapsed');
    card.classList.add('is-editing');
    editBtn.textContent = 'Закрыть редактор';
  };

  const closePanel = () => {
    editPanel.classList.add('is-collapsed');
    card.classList.remove('is-editing');
    editBtn.textContent = 'Редактировать лист';
  };

  const handleScaleChange = (value) => {
    applyScale(state.layout, Number(value));
    updatePreviewPosition(imgEl, state.layout);
    setScaleValue();
    scheduleAssetUpdate();
  };

  scaleInput.addEventListener('input', (e) => handleScaleChange(e.target.value));

  resetBtn.addEventListener('click', () => {
    resetLayout(state.layout);
    scaleInput.value = 100;
    updatePreviewPosition(imgEl, state.layout);
    setScaleValue();
    updatePreparedAsset(state);
  });

  applyBtn.addEventListener('click', () => {
    closePanel();
    updatePreparedAsset(state);
  });

  editBtn.addEventListener('click', () => {
    if (editPanel.classList.contains('is-collapsed')) {
      openPanel();
    } else {
      closePanel();
    }
  });

  scaleInput.value = Math.round(state.layout.scale * 100);
  setScaleValue();
  closePanel();
}

function buildInteractivePreview(state, clone) {
  const canvasContainer = clone.querySelector('.card__canvas');
  canvasContainer.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-preview';
  page.style.aspectRatio = `${state.layout.albumWidthPx} / ${state.layout.albumHeightPx}`;

  const photoArea = document.createElement('div');
  photoArea.className = 'page-preview__photo';
  photoArea.style.left = `${(state.layout.paddingPx / state.layout.albumWidthPx) * 100}%`;
  photoArea.style.top = `${(state.layout.paddingPx / state.layout.albumHeightPx) * 100}%`;
  photoArea.style.width = `${(state.layout.drawWidth / state.layout.albumWidthPx) * 100}%`;
  photoArea.style.height = `${(state.layout.drawHeight / state.layout.albumHeightPx) * 100}%`;

  const imgEl = document.createElement('img');
  imgEl.src = state.localUrl;
  imgEl.alt = state.file.name;
  imgEl.className = 'page-preview__img';
  imgEl.draggable = false;
  updatePreviewPosition(imgEl, state.layout);

  const textArea = document.createElement('div');
  textArea.className = 'page-preview__text';
  textArea.style.height = `${(state.layout.textAreaHeight / state.layout.albumHeightPx) * 100}%`;
  textArea.innerHTML = '<span>Место под подписи и заметки</span>';

  photoArea.appendChild(imgEl);
  page.appendChild(photoArea);
  page.appendChild(textArea);
  canvasContainer.appendChild(page);

  attachDragging(photoArea, imgEl, state);

  attachEditControls(state, clone, photoArea, imgEl);

  return { photoArea, imgEl };
}

async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function drawToCanvas(img, layout) {
  const {
    albumWidthPx,
    albumHeightPx,
    paddingPx,
    textAreaPercent,
    drawWidth,
    drawHeight,
    targetWidth,
    targetHeight,
    offsetX,
    offsetY,
  } = layout;

  const canvas = document.createElement('canvas');
  canvas.width = albumWidthPx;
  canvas.height = albumHeightPx;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, albumWidthPx, albumHeightPx);

  const textAreaHeight = Math.round((textAreaPercent / 100) * albumHeightPx);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(img, paddingPx + offsetX, paddingPx + offsetY, targetWidth, targetHeight);
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
    preparedImages.forEach(({ dataUrl, localUrl }) => {
      if (dataUrl) URL.revokeObjectURL(dataUrl);
      if (localUrl) URL.revokeObjectURL(localUrl);
    });
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
    const layout = computeLayout(img, albumWidthPx, albumHeightPx, paddingPx, textAreaPercent);
    const dataUrl = URL.createObjectURL(file);
    const clone = template.content.cloneNode(true);
    clone.querySelector('.card__title').textContent = `Страница ${index + 1}`;

    const state = {
      name: `prepared-${file.name.replace(/\.[^.]+$/, '')}.jpg`,
      file,
      img,
      localUrl: dataUrl,
      dataUrl: null,
      blob: null,
      layout,
      linkEl: clone.querySelector('a'),
      previewImg: document.createElement('img'),
      updateTimer: null,
    };

    state.linkEl.download = state.name;
    state.previewImg.alt = file.name;
    state.previewImg.className = 'card__preview-img';

    buildInteractivePreview(state, clone);

    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'card__thumb';
    thumbContainer.appendChild(state.previewImg);
    clone.querySelector('.card').appendChild(thumbContainer);

    previewGrid.appendChild(clone);
    preparedImages.push(state);
    await updatePreparedAsset(state);
  }

  setStatus(`Готово: ${preparedImages.length} стр.`);
}

async function sendToPrint() {
  if (preparedImages.length === 0) {
    alert('Сначала нажмите «Подготовить фото».');
    return;
  }

  for (const item of preparedImages) {
    if (!item.blob) {
      // страхуемся, если пользователь перетаскивал фото и не дождался обновления
      await updatePreparedAsset(item);
    }
  }

  const albumWidthMm = Number(document.getElementById('albumWidth').value);
  const albumHeightMm = Number(document.getElementById('albumHeight').value);

  const marginMm = 10;
  const gapMm = 6;
  const a4Portrait = { width: 210, height: 297, orientation: 'portrait' };
  const a4Landscape = { width: 297, height: 210, orientation: 'landscape' };

  const computePacking = (page) => {
    const innerWidth = page.width - marginMm * 2;
    const innerHeight = page.height - marginMm * 2;
    const columns = Math.max(1, Math.floor((innerWidth + gapMm) / (albumWidthMm + gapMm)));
    const rows = Math.max(1, Math.floor((innerHeight + gapMm) / (albumHeightMm + gapMm)));
    return { ...page, columns, rows, capacity: columns * rows };
  };

  const portraitLayout = computePacking(a4Portrait);
  const landscapeLayout = computePacking(a4Landscape);
  const printLayout = landscapeLayout.capacity > portraitLayout.capacity ? landscapeLayout : portraitLayout;
  const itemsPerSheet = Math.max(1, printLayout.capacity);

  const objectUrls = preparedImages.map((item) => ({
    name: item.name,
    url: URL.createObjectURL(item.blob),
  }));

  setStatus('Формируем макет для печати...');

  const printWindow = window.open('', '_blank');
  const doc = printWindow.document;
  const totalSheets = Math.ceil(objectUrls.length / itemsPerSheet);

  doc.write(`<!doctype html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8" />
      <title>Печать альбома</title>
      <style>
        @page {
          size: A4 ${printLayout.orientation};
          margin: ${marginMm}mm;
        }
        body {
          margin: 0;
          padding: ${marginMm}mm;
          background: #f8fafc;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .sheet {
          width: ${printLayout.width}mm;
          min-height: ${printLayout.height}mm;
          page-break-after: always;
          box-sizing: border-box;
        }
        .sheet:last-child { page-break-after: auto; }
        .grid {
          display: grid;
          grid-template-columns: repeat(${printLayout.columns}, ${albumWidthMm}mm);
          grid-auto-rows: ${albumHeightMm}mm;
          gap: ${gapMm}mm;
        }
        .cell {
          border: 1px solid #d4d4d8;
          border-radius: 6px;
          overflow: hidden;
          background: white;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cell img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
  `);

  for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
    doc.write('<section class="sheet"><div class="grid">');
    objectUrls
      .slice(sheetIndex * itemsPerSheet, (sheetIndex + 1) * itemsPerSheet)
      .forEach((item) => {
        doc.write(`<figure class="cell"><img src="${item.url}" alt="${item.name}" /></figure>`);
      });
    doc.write('</div></section>');
  }

  doc.write(`
      <script>
        const objectUrls = ${JSON.stringify(objectUrls.map((item) => item.url))};
        function revoke() { objectUrls.forEach((url) => URL.revokeObjectURL(url)); }
        window.addEventListener('afterprint', () => { revoke(); window.close(); });
        window.addEventListener('beforeunload', revoke);
        const images = Array.from(document.images);
        Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })))
          .then(() => { window.focus(); window.print(); });
      <\/script>
    </body></html>`);

  doc.close();
  setStatus('Макет отправлен в печать.');
}

prepareBtn.addEventListener('click', prepareImages);
printBtn.addEventListener('click', sendToPrint);

renderFileList();
setStatus('Готово к подготовке.');
