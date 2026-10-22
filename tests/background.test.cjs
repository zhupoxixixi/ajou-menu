const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_IMAGE_EDGE, fitImageSize, localeFromLanguage, getCopy, isSupportedImageFile, isEncodedImage } = require('../background.js');

test('background images are reduced to the 2048 pixel edge while preserving aspect ratio', () => {
  assert.equal(MAX_IMAGE_EDGE, 2048);
  assert.deepEqual(fitImageSize(6000, 3000), { width: 2048, height: 1024 });
  assert.deepEqual(fitImageSize(1200, 2400), { width: 1024, height: 2048 });
  assert.deepEqual(fitImageSize(1600, 900), { width: 1600, height: 900 });
  assert.equal(fitImageSize(0, 900), null);
  assert.equal(fitImageSize(Infinity, 900), null);
});

test('background labels follow Chinese or Korean html language without mixed copy', () => {
  assert.equal(localeFromLanguage('zh-CN'), 'zh');
  assert.equal(localeFromLanguage('zh-Hans'), 'zh');
  assert.equal(localeFromLanguage('ko'), 'ko');
  assert.equal(localeFromLanguage('ko-KR'), 'ko');
  assert.equal(localeFromLanguage('en'), 'ko');
  assert.equal(getCopy('zh-CN').title, '背景图片');
  assert.equal(getCopy('ko').title, '배경 이미지');
  assert.ok(Object.values(getCopy('zh-CN')).every(value => !/[가-힣]/u.test(value)));
});

test('SVG and non-image files are rejected before decoding', () => {
  assert.equal(isSupportedImageFile({ type: 'image/jpeg' }), true);
  assert.equal(isSupportedImageFile({ type: 'IMAGE/WEBP' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/svg+xml' }), false);
  assert.equal(isSupportedImageFile({ type: 'text/html' }), false);
  assert.equal(isSupportedImageFile({}), false);
  assert.equal(isSupportedImageFile(null), false);
});

test('saved canvas output accepts only nonempty WebP or JPEG blobs', () => {
  assert.equal(isEncodedImage({ size: 10, type: 'image/webp' }, 'image/webp'), true);
  assert.equal(isEncodedImage({ size: 10, type: 'image/jpeg' }, 'image/jpeg'), true);
  assert.equal(isEncodedImage({ size: 10, type: 'image/png' }, 'image/webp'), false);
  assert.equal(isEncodedImage({ size: 0, type: 'image/jpeg' }, 'image/jpeg'), false);
});
