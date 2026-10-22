const test = require('node:test');
const assert = require('node:assert/strict');
const { needsGlassFallback } = require('../glass.js');

test('WebKit fallback includes Safari, iOS Chrome and standalone apps without a Safari token', () => {
  const webkit = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  for (const suffix of [' Version/18.0 Mobile/15E148 Safari/604.1', ' CriOS/140.0 Mobile/15E148 Safari/604.1', ' Mobile/15E148']) {
    assert.equal(needsGlassFallback(webkit + suffix), true);
  }
  assert.equal(needsGlassFallback('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'), true);
});

test('Chromium keeps refraction while unsupported filters and Firefox fall back', () => {
  for (const browser of ['Chrome/140.0.0.0', 'Edg/140.0.0.0', 'SamsungBrowser/29.0']) {
    const ua = `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) ${browser} Safari/537.36`;
    assert.equal(needsGlassFallback(ua), false);
    assert.equal(needsGlassFallback(ua, false), true);
  }
  assert.equal(needsGlassFallback('Mozilla/5.0 Gecko/20100101 Firefox/140.0'), true);
});
