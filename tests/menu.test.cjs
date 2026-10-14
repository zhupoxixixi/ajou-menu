const test = require('node:test');
const assert = require('node:assert/strict');
const { getKstDate, buildSchedule, resolveMeal, isNotice, validTranslation } = require('../menu.js');

test('Korean midnight is independent of the browser timezone', () => {
  assert.equal(getKstDate(new Date('2026-10-13T15:30:00Z')), '2026-10-14');
  assert.equal(getKstDate(new Date('2026-10-13T14:59:59Z')), '2026-10-13');
});

test('weekend preview reads the next week, rather than intersecting dates', () => {
  const data = { days: { '2026-10-12': {}, '2026-10-13': {} }, next_week: { days: { '2026-10-19': {}, '2026-10-20': {} } } };
  const schedule = buildSchedule(data, new Date('2026-10-17T03:00:00Z'));
  assert.equal(schedule.initialWeek, 'next');
  assert.equal(schedule.initialDate, '2026-10-19');
  assert.deepEqual(schedule.weeks[1].dates, ['2026-10-19', '2026-10-20']);
});

test('a weekend without preview retains the actual week label', () => {
  assert.equal(buildSchedule({ days: { '2026-10-16': {} } }, new Date('2026-10-17T03:00:00Z')).initialWeek, 'this');
});

test('weekday default selects the current Korean day, including midnight', () => {
  const schedule = buildSchedule({ days: { '2026-10-13': {}, '2026-10-14': {} } }, new Date('2026-10-13T15:30:00Z'));
  assert.equal(schedule.initialDate, '2026-10-14');
});

test('restaurant changes recover a valid meal and missing restaurants do not crash', () => {
  const restaurant = { meals: { breakfast: { sections: [] }, lunch: { sections: [{ items: [{ ko: '쌀밥' }] }] } } };
  assert.equal(resolveMeal(restaurant, 'breakfast'), 'lunch');
  assert.equal(resolveMeal(undefined, 'dinner'), 'dinner');
});

test('untranslated Korean is detected and notices do not count as dishes', () => {
  assert.equal(validTranslation('김치', '김치'), false);
  assert.equal(validTranslation('김치', '泡菜'), true);
  assert.equal(isNotice({ ko: '*위 메뉴는 시장 상황에 따라 변경 될 수 있습니다.' }), true);
  assert.equal(isNotice({ ko: '★ 당일 조리 ★ 닭가슴살샐러드 한정수량' }), false);
});

test('missing or invalid dates produce an explicit empty schedule', () => {
  assert.equal(buildSchedule(null).initialDate, '');
  assert.equal(buildSchedule({ days: { undefined: {} } }).weeks.length, 0);
});
