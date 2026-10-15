const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceStatus, dataFreshness } = require('../menu.js');
const section = { items: [{ ko: '김치', cn: '泡菜', kind: 'dish' }] };
const restaurant = { fetch_status: 'ok', service_hours: { lunch: { start: '11:00', end: '14:00', source: 'daily_menu' } } };
const status = (time, value = restaurant, portion = section, date = '2026-10-16', fresh = true) => serviceStatus(value, 363910, date, 'lunch', portion, new Date(time), fresh);

test('service status observes KST start and end, including a pinned past menu', () => {
  assert.equal(status('2026-10-16T01:59:59Z'), 'upcoming');
  assert.equal(status('2026-10-16T02:00:00Z'), 'serving');
  assert.equal(status('2026-10-16T04:59:59Z'), 'serving');
  assert.equal(status('2026-10-16T05:00:00Z'), 'ended');
  assert.equal(status('2026-10-16T03:00:00Z', restaurant, section, '2026-10-15'), 'ended');
  assert.equal(status('2026-10-16T03:00:00Z', restaurant, section, '2026-10-17'), 'preview');
});
test('closed, notice-only, failed, stale and fallback menus never claim confirmed serving', () => {
  assert.equal(status('2026-10-16T03:00:00Z', { ...restaurant, service_hours: { lunch: null } }), 'closed');
  assert.equal(status('2026-10-16T03:00:00Z', restaurant, { items: [{ ko: '* 운영 안내', kind: 'note' }] }), 'emptyService');
  assert.equal(status('2026-10-16T03:00:00Z', { fetch_status: 'error' }), 'emptyService');
  assert.equal(status('2026-10-16T03:00:00Z', { ...restaurant, fetch_status: 'stale' }), 'unconfirmed');
  assert.equal(status('2026-10-16T03:00:00Z', restaurant, section, '2026-10-16', false), 'unconfirmed');
  assert.equal(status('2026-10-16T03:00:00Z', { fetch_status: 'ok' }), 'servingReference');
});
test('freshness depends on the published timestamp rather than when the page was opened', () => {
  const data = { generated_at: '2026-10-14T15:00:00Z', days: { '2026-10-16': {} } };
  assert.equal(dataFreshness(data, new Date('2026-10-16T03:00:00Z')), 'fresh');
  assert.equal(dataFreshness(data, new Date('2026-10-16T03:00:01Z')), 'old');
  assert.equal(dataFreshness({ ...data, generated_at: 'invalid' }), 'unknown');
  assert.equal(dataFreshness(data, new Date('2026-10-14T14:54:00Z')), 'unknown');
  assert.equal(dataFreshness(null), 'missing');
});
