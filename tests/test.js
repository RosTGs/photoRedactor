const assert = require('assert');
const {
  buildEditingMetadata,
  selectPrintSource,
  computeLayout,
  resetLayout,
  applyScale,
  computePrintLayout,
} = require('../processing.js');

function createLayoutStub() {
  const img = { width: 4000, height: 3000 };
  const layout = computeLayout(img, 2000, 2000, 100, 20);
  return { img, layout };
}

(function testMetadataIncludesLayout() {
  const { layout } = createLayoutStub();
  const state = { file: { name: 'photo.jpg' }, name: 'prepared-photo.jpg', layout };
  const meta = buildEditingMetadata(state);
  assert.strictEqual(meta.originalFileName, 'photo.jpg');
  assert.strictEqual(meta.preparedFileName, 'prepared-photo.jpg');
  assert.ok(meta.generatedAt, 'metadata timestamp is missing');
  assert.deepStrictEqual(
    {
      offsetX: meta.layout.offsetX,
      offsetY: meta.layout.offsetY,
      scale: meta.layout.scale,
    },
    { offsetX: layout.offsetX, offsetY: layout.offsetY, scale: layout.scale },
    'layout offsets should be persisted'
  );
})();

(function testSelectPrintSourcePrefersEditedBlob() {
  const edited = new Blob(['edited'], { type: 'text/plain' });
  const original = new Blob(['original'], { type: 'text/plain' });
  const item = { printBlob: edited, file: original };
  assert.strictEqual(selectPrintSource(item), edited, 'edited blob should be preferred');
})();

(function testSelectPrintSourceFallsBackToOriginal() {
  const original = new Blob(['original'], { type: 'text/plain' });
  const item = { file: original };
  assert.strictEqual(selectPrintSource(item), original, 'original file should be used when no edits');
})();

(function testScalingKeepsOffsetsClamped() {
  const { layout } = createLayoutStub();
  applyScale(layout, 180);
  assert.ok(layout.offsetX <= 0 && layout.offsetY <= 0, 'offsets should stay within drawable area');
  resetLayout(layout);
  assert.strictEqual(layout.scale, 1, 'reset should bring scale back to default');
})();

(function testPrintLayoutChoosesBestOrientation() {
  const layout = computePrintLayout(210, 260, { marginMm: 8, gapMm: 5 });
  assert.ok(['portrait', 'landscape'].includes(layout.orientation), 'orientation should be set');
  assert.strictEqual(layout.marginMm, 8, 'custom margin should be preserved');
  assert.strictEqual(layout.gapMm, 5, 'custom gap should be preserved');
  assert.ok(layout.capacity >= 1, 'capacity should be positive');
})();

console.log('All tests passed.');
