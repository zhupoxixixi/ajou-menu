const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceStatus, dataFreshness, isClosedDay, isUnpublishedDay, unavailableMeal, operatingNotices } = require('../menu.js');
const section = { items: [{ ko: '김치', cn: '泡菜', kind: 'dish' }] };
const restaurant = { fetch_status: 'ok', service_hours: { lunch: { start: '11:00', end: '14:00', source: 'daily_menu' } } };
const status = (time, value = restaurant, portion = section, date = '2026-10-16', fresh = true) => serviceStatus(value, 363910, date, 'lunch', portion, new Date(time), fresh);

const emptyDay = () => ({ fetch_status: 'ok', meals: Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snack'].map(meal => [meal, { sections: [] }])) });

test('empty weekends retain the requested closure display, including notice-only days', () => {
  assert.equal(isClosedDay(emptyDay(), '2026-10-17'), true);
  const notices = emptyDay();
  notices.meals.breakfast.sections = [{ items: [{ ko: '* 운영 안내', kind: 'note' }] }];
  assert.equal(isClosedDay(notices, '2026-10-18'), true);
});

test('a future empty weekday is unpublished rather than a holiday, including legacy ok records', () => {
  for (const menu_status of [undefined, 'empty', 'not_published']) {
    const value = { ...emptyDay(), menu_status };
    assert.equal(isClosedDay(value, '2026-10-28'), false);
    assert.equal(isUnpublishedDay(value, '2026-10-28', '2026-10-17'), true);
  }
  assert.equal(isClosedDay(emptyDay(), '2026-10-12'), false);
  assert.equal(isUnpublishedDay({ ...emptyDay(), menu_status: 'unavailable' }, '2026-10-12', '2026-10-17'), false);
});

test('weekday closure requires an explicit daily announcement, not just an empty record', () => {
  const value = { ...emptyDay(), menu_status: 'closed', closure: { source: 'daily_menu', text: '금일 식당 휴무' } };
  assert.equal(isClosedDay(value, '2026-10-28'), true);
  assert.equal(isUnpublishedDay(value, '2026-10-28', '2026-10-17'), false);
  assert.equal(isClosedDay({ ...value, closure: { source: 'weekend_no_menu' } }, '2026-10-28'), false);
  assert.equal(isClosedDay({ ...value, closure: undefined }, '2026-10-28'), false);
  assert.equal(isClosedDay({ ...value, fetch_status: 'stale' }, '2026-10-28'), false);
});

test('a missing meal does not close a day that serves food in another window or meal', () => {
  const value = emptyDay();
  value.meals.lunch.sections = [{ items: [{ ko: '* 운영 안내', kind: 'note' }] }, section];
  assert.equal(isClosedDay(value), false);
});

test('fetch failures, stale backups and incomplete records are not holiday closures', () => {
  for (const fetch_status of ['error', 'stale', undefined]) assert.equal(isClosedDay({ ...emptyDay(), fetch_status }), false);
  assert.equal(isClosedDay(undefined), false);
  assert.equal(isClosedDay({ fetch_status: 'ok' }), false);
  const incomplete = emptyDay();
  delete incomplete.meals.snack;
  assert.equal(isClosedDay(incomplete), false);
});

test('a known unavailable meal stays distinct from a closed day or a fetch failure', () => {
  const value = emptyDay();
  value.meals.lunch.sections = [section];
  assert.equal(unavailableMeal(value, 'breakfast'), true);
  assert.equal(unavailableMeal(value, 'lunch'), false);
  assert.equal(unavailableMeal(emptyDay(), 'breakfast'), false);
  for (const fetch_status of ['stale', 'error', undefined]) assert.equal(unavailableMeal({ ...value, fetch_status }, 'breakfast'), false);
  assert.equal(unavailableMeal(undefined, 'breakfast'), false);
});

test('operating notices from non-serving meals are retained separately and deduplicated', () => {
  const value = emptyDay();
  const note = { ko: '※운영시간 안내※', cn: '营业时间说明', kind: 'note' };
  value.meals.breakfast.sections = [{ items: [note, note] }];
  value.meals.lunch.sections = [{ items: [section.items[0], { ko: '* 메뉴 변경 가능', kind: 'note' }] }];
  assert.deepEqual(operatingNotices(value), [note]);
  assert.deepEqual(operatingNotices(undefined), []);
});

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
