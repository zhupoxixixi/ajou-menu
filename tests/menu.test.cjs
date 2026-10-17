const test = require('node:test');
const assert = require('node:assert/strict');
const { getKstDate, getKstMinutes, buildSchedule, availableMeals, isNotice, validTranslation, resolveSection, stepDate, calendarMonths, stepCalendarMonth, serviceHours, selectDefaultMenu, initialSelection } = require('../menu.js');

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

test('calendar arrows follow the displayed cross-month week while another week is selected for the menu', () => {
  const schedule = { weeks: [{ key: 'this', dates: ['2026-10-26', '2026-10-31', '2026-11-01'] }, { key: 'next', dates: ['2026-11-02', '2026-11-08'] }] };
  assert.deepEqual(calendarMonths(schedule, 'this', 'next'), ['2026-10', '2026-11']);
  assert.equal(stepCalendarMonth(schedule, 'this', 'next', '2026-10', 1), '2026-11');
  assert.equal(stepCalendarMonth(schedule, 'this', 'next', '2026-11', -1), '2026-10');
  assert.deepEqual(calendarMonths(schedule, 'next', 'this'), ['2026-11']);
  assert.equal(stepCalendarMonth(schedule, 'next', 'this', '2026-11', -1), '2026-11');
  assert.deepEqual(calendarMonths({ weeks: [] }, 'this', 'next'), []);
});

test('weekday default selects the current Korean day, including midnight', () => {
  const schedule = buildSchedule({ days: { '2026-10-13': {}, '2026-10-14': {} } }, new Date('2026-10-13T15:30:00Z'));
  assert.equal(schedule.initialDate, '2026-10-14');
});

test('only meals containing dishes are selectable; notices are not breakfast', () => {
  const restaurant = { meals: { breakfast: { sections: [{ items: [{ ko: '※운영시간 안내※', kind: 'note' }] }] }, lunch: { sections: [{ items: [{ ko: '쌀밥' }] }] }, dinner: { sections: [{ items: [{ ko: '* 운영 안내', kind: 'note' }, { ko: '김치' }] }] }, snack: { sections: [] } } };
  assert.deepEqual(availableMeals(restaurant), ['lunch', 'dinner']);
  assert.deepEqual(availableMeals(undefined), []);
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


test('date navigation crosses available weeks without inventing weekend menus', () => {
  const schedule = buildSchedule({ days: { '2026-10-16': {} }, next_week: { days: { '2026-10-19': {} } } });
  assert.equal(stepDate(schedule, '2026-10-16', 1), '2026-10-19');
  assert.equal(stepDate(schedule, '2026-10-19', 1), '2026-10-19');
});

test('window selection defaults to food and preserves a valid requested window', () => {
  const restaurant = { meals: { lunch: { sections: [
    { name_ko: '안내', items: [{ ko: '* 운영 안내' }] },
    { name_ko: 'A', items: [{ ko: '김치' }] },
    { name_ko: 'B', items: [{ ko: '쌀밥' }] },
  ] } } };
  assert.equal(resolveSection(restaurant, 'lunch', null).name_ko, 'A');
  assert.equal(resolveSection(restaurant, 'lunch', 'B').name_ko, 'B');
  assert.equal(resolveSection(restaurant, 'dinner', 'B'), undefined);
});

const atKst = (time, date = '2026-10-15') => new Date(`${date}T${time}:00+09:00`);
const scheduledData = { days: { '2026-10-15': { restaurants: [{ id: 221904, service_hours: { lunch: { start: '11:00', end: '14:00', source: 'daily_menu' }, dinner: { start: '16:30', end: '18:40', source: 'daily_menu' } }, meals: { breakfast: { sections: [{ items: [{ ko: '※운영시간 안내※', kind: 'note' }] }] } } }] }, '2026-10-16': { restaurants: [] } } };

test('default dorm meal switches exactly at the end of each service, including gaps', () => {
  for (const [time, meal, date] of [
    ['00:00', 'breakfast', '2026-10-15'], ['07:59', 'breakfast', '2026-10-15'],
    ['09:49', 'breakfast', '2026-10-15'], ['09:50', 'lunch', '2026-10-15'],
    ['10:30', 'lunch', '2026-10-15'], ['13:59', 'lunch', '2026-10-15'],
    ['14:00', 'dinner', '2026-10-15'], ['16:00', 'dinner', '2026-10-15'],
    ['18:29', 'dinner', '2026-10-15'], ['18:30', 'breakfast', '2026-10-16'],
    ['23:59', 'breakfast', '2026-10-16'],
  ]) {
    const selected = selectDefaultMenu(scheduledData, 363910, atKst(time));
    assert.equal(selected.meal, meal, time);
    assert.equal(selected.date, date, time);
  }
});

test('staff meals use their own deadline and do not treat a notice as breakfast', () => {
  for (const [time, meal, date] of [
    ['07:00', 'lunch', '2026-10-15'], ['13:59', 'lunch', '2026-10-15'],
    ['14:00', 'dinner', '2026-10-15'], ['18:35', 'dinner', '2026-10-15'],
    ['18:40', 'lunch', '2026-10-16'],
  ]) {
    const selected = selectDefaultMenu(scheduledData, 221904, atKst(time));
    assert.equal(selected.meal, meal, time);
    assert.equal(selected.date, date, time);
  }
});

test('daily hours override fallbacks and announced closures skip a service', () => {
  const data = { days: { '2026-10-15': { restaurants: [{ id: 363910, service_hours: { breakfast: { start: '06:00', end: '08:00', source: 'daily_menu' }, lunch: null } }] } } };
  assert.equal(selectDefaultMenu(data, 363910, atKst('07:59')).meal, 'breakfast');
  assert.equal(selectDefaultMenu(data, 363910, atKst('08:00')).meal, 'dinner');
  assert.equal(serviceHours({ service_hours: { breakfast: { start: '08:00', end: '25:00' } } }, 363910).breakfast.end, '09:50');
});

test('unpublished next-day or weekend menus never fall back to an old date', () => {
  assert.equal(selectDefaultMenu(scheduledData, 363910, atKst('18:30', '2026-10-16')).date, '2026-10-17');
  const unavailable = selectDefaultMenu(null, 363910, atKst('19:00', '2026-12-31'));
  assert.equal(unavailable.date, '2027-01-01');
  assert.equal(unavailable.meal, 'breakfast');
  assert.equal(stepDate(buildSchedule(scheduledData), '2026-10-17', -1), '2026-10-16');
  assert.equal(selectDefaultMenu(scheduledData, 363910, atKst('08:00', '2026-10-22')).date, '2026-10-22');
});

test('fresh visits default to dorm and language-only URLs remain automatic', () => {
  const selected = initialSelection(scheduledData, '?lang=cn', atKst('14:00'));
  assert.equal(selected.restaurantId, 363910);
  assert.equal(selected.meal, 'dinner');
  assert.equal(selected.automatic, true);
  assert.equal(selected.linked, false);
  assert.equal(initialSelection(scheduledData, '?restaurant=221904', atKst('18:35')).meal, 'dinner');
  assert.equal(initialSelection(scheduledData, '?restaurant=invalid&date=2026-02-31', atKst('08:00')).automatic, true);
});

test('explicit shared menus keep their date, meal and window at a different time', () => {
  const selected = initialSelection(scheduledData, '?date=2026-10-15&restaurant=221904&meal=lunch&window=B코너', atKst('22:00'));
  assert.equal(selected.date, '2026-10-15');
  assert.equal(selected.meal, 'lunch');
  assert.equal(selected.sectionName, 'B코너');
  assert.equal(selected.automatic, false);
  assert.equal(selected.linked, true);
});

test('A is preferred even when B is listed first, while a requested B is respected', () => {
  const restaurant = { meals: { lunch: { sections: [{ name_ko: 'B코너', items: [{ ko: '쌀밥' }] }, { name_ko: 'A 코너', items: [{ ko: '김치' }] }] } } };
  assert.equal(resolveSection(restaurant, 'lunch', null).name_ko, 'A 코너');
  assert.equal(resolveSection(restaurant, 'lunch', 'B코너').name_ko, 'B코너');
  assert.equal(getKstMinutes(new Date('2026-10-15T00:50:00Z')), 590);
});
