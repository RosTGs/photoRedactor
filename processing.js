function mmToPx(mm, dpi) {
  return (mm / 25.4) * dpi;
}

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

function buildEditingMetadata(state) {
  return {
    originalFileName: state.file?.name,
    preparedFileName: state.name,
    layout: {
      albumWidthPx: state.layout.albumWidthPx,
      albumHeightPx: state.layout.albumHeightPx,
      paddingPx: state.layout.paddingPx,
      textAreaPercent: state.layout.textAreaPercent,
      drawWidth: state.layout.drawWidth,
      drawHeight: state.layout.drawHeight,
      offsetX: state.layout.offsetX,
      offsetY: state.layout.offsetY,
      scale: state.layout.scale,
      targetWidth: state.layout.targetWidth,
      targetHeight: state.layout.targetHeight,
    },
    generatedAt: new Date().toISOString(),
  };
}

function selectPrintSource(item) {
  return item?.printBlob || item?.file || null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    mmToPx,
    computeLayout,
    clampOffsets,
    applyScale,
    resetLayout,
    buildEditingMetadata,
    selectPrintSource,
  };
}
