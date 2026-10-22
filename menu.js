'use strict';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const RESTAURANTS = [
  { id: 363910, name_ko: '기숙사식당', name_cn: '宿舍食堂', location_ko: '기숙사식당 1층', location_cn: '宿舍食堂 1 楼' },
  { id: 221904, name_ko: '교직원식당', name_cn: '教职工食堂', location_ko: '기숙사식당동 2층', location_cn: '宿舍食堂楼 2 层' },
];
const DEFAULT_SERVICE_HOURS = {
  363910: { breakfast: { start: '08:00', end: '09:50' }, lunch: { start: '11:00', end: '14:00' }, dinner: { start: '16:30', end: '18:30' } },
  221904: { lunch: { start: '11:00', end: '14:00' }, dinner: { start: '17:00', end: '18:40' } },
};
const COPY = {
  ko: {
    brand: '아주대학교 식단', restaurant: '식당 선택', meal: '식사 선택', window: '코너 선택',
    tools: '사용 및 업데이트', healthy: '데이터 업데이트됨', delayed: '업데이트 확인 필요', offline: '오프라인 · 저장된 메뉴', automatic: '자동 선택', manual: '직접 선택',
    offlineBanner: '인터넷에 연결되지 않아 저장된 메뉴를 표시합니다. 새 메뉴와 변경 사항은 연결 후 새로고침해 주세요.',
    notices: '중국어 공지 ↗', serving: '운영시간 내', servingReference: '참고 운영시간 내', upcoming: '운영 시작 전', ended: '운영시간 종료', preview: '예정 메뉴', closed: '이 식사는 운영하지 않아요', emptyService: '등록된 메뉴 없음', unconfirmed: '운영 여부 확인 필요', unknownService: '운영시간은 학교 원문 확인',
    breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '분식',
    menu: '식단', today: '현재 식사로', todayLabel: '오늘', tomorrowLabel: '내일', source: '학교 원문', servingHours: '운영시간', fallbackHours: '참고 운영시간',
    thisWeek: '이번 주', nextWeek: '다음 주 미리보기', calendar: '날짜 선택', calendarHint: '회색 날짜에는 메뉴가 없습니다.',
    skip: '메뉴로 바로가기', notice: '비공식 식단 안내입니다. 실제 공급 메뉴는 학교 공지를 확인해 주세요.', dismiss: '안내 닫기',
    empty: '등록된 식단이 없어요', emptyDescription: '다른 날짜나 식사를 선택하거나 학교 원문을 확인해 주세요.', holidayClosed: '주말·공휴일 휴무', operating: '운영 안내', unavailableMeal: meal => `${meal} 미운영`,
    fetchError: '식단을 불러오지 못했습니다. 학교 원문을 확인해 주세요.', missing: '이 식당의 해당 날짜 데이터가 없습니다. 학교 원문을 확인해 주세요.',
    futureMissing: '다음 날짜의 식단 정보가 없습니다. 학교 원문을 확인해 주세요.',
    notPublished: '식단이 아직 게시되지 않았어요', sourceUnavailable: '학교 페이지에 식단 없음', savedMenu: '학교 페이지에 해당 날짜의 메뉴가 없어 이전에 저장된 같은 날짜의 식단을 표시합니다.',
    old: '저장된 식단을 표시하고 있습니다. 최신 메뉴는 학교 원문을 확인해 주세요.',
    staleRestaurant: '수집에 실패해 이전에 저장된 같은 날짜의 메뉴를 표시합니다. 변경 사항은 학교 원문을 확인해 주세요.',
    translationMissing: '일부 중국어 번역이 준비되지 않아 한국어 원문을 표시합니다.', noData: '메뉴 데이터를 불러오지 못했습니다. 잠시 후 새로고침하거나 학교 원문을 확인해 주세요.',
    updated: '업데이트', footer: '아주대학교와 독립적으로 운영되는 오픈소스 식단 안내',
    share: '메뉴 복사', copied: '메뉴를 복사했어요', copyHint: '자동 복사가 불가능합니다. 아래 내용을 선택해 복사해 주세요.',
    close: '닫기', previous: '이전 날짜', next: '다음 날짜', previousMonth: '이전 달', nextMonth: '다음 달',
    dark: '어두운 테마로 전환', light: '밝은 테마로 전환', dishes: n => `${n}개 메뉴`, days: n => `메뉴 날짜: ${n}일`,
  },
  cn: {
    brand: '亚洲大学食堂菜单', restaurant: '选择食堂', meal: '选择餐次', window: '选择窗口',
    tools: '使用与更新', healthy: '数据已更新', delayed: '需要检查更新', offline: '离线 · 已保存菜单', automatic: '自动选餐', manual: '手动查看',
    offlineBanner: '当前连接不可用，显示已保存菜单；新菜单和临时调整需要联网刷新。',
    notices: '中文公告 ↗', serving: '供餐时段内', servingReference: '参考供餐时段内', upcoming: '尚未开始', ended: '本餐已结束', preview: '预告菜单', closed: '该餐次不供应', emptyService: '暂无菜单', unconfirmed: '供餐情况待核实', unknownService: '供餐时间请查看学校原文',
    breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '小吃',
    menu: '菜单', today: '回到当前餐次', todayLabel: '今天', tomorrowLabel: '明天', source: '学校原文', servingHours: '供餐时间', fallbackHours: '参考供餐时间',
    thisWeek: '本周', nextWeek: '下周预告', calendar: '选择日期', calendarHint: '灰色日期暂无菜单。',
    skip: '跳到菜单', notice: '这是非官方食堂菜单助手，实际供应请以学校公告为准。', dismiss: '关闭提示',
    empty: '暂时没有这份菜单', emptyDescription: '可以换个日期或餐次，或查看学校的原始公告。', holidayClosed: '节假日不营业', operating: '营业说明', unavailableMeal: meal => `不供应${meal}`,
    fetchError: '这间食堂的菜单暂时获取失败，请查看学校原文。', missing: '暂时没有这间食堂当天的数据，请查看学校原文。',
    futureMissing: '下一天暂无菜单数据，请查看学校原文。',
    notPublished: '菜单尚未公布', sourceUnavailable: '学校页面暂无菜单', savedMenu: '学校页面已无当天菜单，显示此前保存的同一天菜单。',
    old: '当前显示的是已保存菜单，最新安排请以学校原文为准。',
    staleRestaurant: '本次获取失败，显示此前保存的同一天菜单；如有调整，请以学校原文为准。',
    translationMissing: '部分中文译文暂缺，先保留韩文原名。', noData: '菜单数据加载失败，请稍后刷新或查看学校原文。',
    updated: '更新于', footer: '独立于亚洲大学运营的开源菜单助手',
    share: '复制菜单', copied: '已复制菜单', copyHint: '当前浏览器无法自动复制，请选中下面的内容后复制。',
    close: '关闭', previous: '上一个日期', next: '下一个日期', previousMonth: '上一个月', nextMonth: '下一个月',
    dark: '切换深色主题', light: '切换浅色主题', dishes: n => `${n} 道菜`, days: n => `可用日期：${n} 天`,
  },
};
const ICONS = {
  restaurant: '<path d="M3 10h18M5 10v10h14V10M3 10l2-6h14l2 6M9 20v-6h6v6"/>',
  breakfast: '<path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8ZM17 9h2a3 3 0 0 1 0 6h-2M6 2v3m4-3v3m4-3v3"/>',
  lunch: '<path d="M4 2v6a3 3 0 0 0 6 0V2M7 2v20M20 2c-4 2-5 6-5 10h5M20 2v20"/>',
  dinner: '<path d="M20 15a8 8 0 0 1-11-11A9 9 0 1 0 20 15Z"/>',
  snack: '<path d="m7 3 2 6m8-6-2 6M4 10h16c0 7-3 11-8 11S4 17 4 10ZM3 10h18"/>',
  bowl: '<path d="M3 10h18c0 7-4 11-9 11S3 17 3 10ZM2 10h20M7 2v4m5-5v5m5-4v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 15a8 8 0 0 1-11-11A9 9 0 1 0 20 15Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 2v5m10-5v5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5.5 7a7 7 0 0 1 11.7-2L20 8M4 16l2.8 3A7 7 0 0 0 18.5 17"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3 3 0 0 0-1-2c3-.3 6-1.5 6-6a5 5 0 0 0-1.5-3.5A5 5 0 0 0 18 3s-1.5-.5-4 1a14 14 0 0 0-6 0C5.5 2.5 4 3 4 3a5 5 0 0 0-.5 3.5A5 5 0 0 0 2 10c0 4.5 3 5.7 6 6a3 3 0 0 0-1 2v4"/>',
};

function getKstDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function getKstMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find(part => part.type === 'hour').value) * 60 + Number(parts.find(part => part.type === 'minute').value);
}
function nextDate(date) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
function validDate(date) { return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(new Date(`${date}T12:00:00Z`).getTime()) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date; }
function clockMinutes(clock) { const [hour, minute] = clock.split(':').map(Number); return hour * 60 + minute; }
function serviceHours(restaurant, restaurantId) {
  const hours = Object.fromEntries(Object.entries(DEFAULT_SERVICE_HOURS[restaurantId] || DEFAULT_SERVICE_HOURS[363910]).map(([meal, value]) => [meal, { ...value, source: 'fallback' }]));
  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    const value = restaurant?.service_hours?.[meal];
    if (value === null) hours[meal] = null;
    else if (value && /^[0-2]\d:[0-5]\d$/.test(value.start) && /^[0-2]\d:[0-5]\d$/.test(value.end) && clockMinutes(value.start) < clockMinutes(value.end) && clockMinutes(value.end) < 1440) hours[meal] = { start: value.start, end: value.end, source: ['daily_menu', 'restaurant_notice'].includes(value.source) ? value.source : 'fallback' };
  }
  return hours;
}
function findRestaurant(schedule, date, restaurantId) { return schedule.weeks.find(week => week.days[date])?.days[date]?.restaurants?.find(restaurant => Number(restaurant.id) === restaurantId); }
function dataFreshness(value, now = new Date()) {
  if (!buildSchedule(value, now).weeks.length) return 'missing';
  const age = now.getTime() - new Date(value?.generated_at).getTime();
  if (!Number.isFinite(age) || age < -5 * 60 * 1000) return 'unknown';
  return age > 36 * 60 * 60 * 1000 ? 'old' : 'fresh';
}
function serviceStatus(restaurant, restaurantId, date, meal, section, now = new Date(), fresh = true) {
  if (!restaurant || restaurant.fetch_status === 'error') return 'emptyService';
  if (!fresh || restaurant.fetch_status === 'stale') return 'unconfirmed';
  const hours = serviceHours(restaurant, restaurantId)[meal];
  if (hours === null) return 'closed';
  if (!(section?.items || []).some(item => !isNotice(item))) return 'emptyService';
  if (date > getKstDate(now)) return 'preview';
  if (date < getKstDate(now)) return 'ended';
  if (!hours) return 'unknownService';
  const minutes = getKstMinutes(now);
  if (minutes < clockMinutes(hours.start)) return 'upcoming';
  if (minutes >= clockMinutes(hours.end)) return 'ended';
  return hours.source === 'fallback' ? 'servingReference' : 'serving';
}
function firstServiceMeal(schedule, date, restaurantId) {
  const hours = serviceHours(findRestaurant(schedule, date, restaurantId), restaurantId);
  return ['breakfast', 'lunch', 'dinner'].find(meal => hours[meal]) || Object.keys(DEFAULT_SERVICE_HOURS[restaurantId] || DEFAULT_SERVICE_HOURS[363910])[0];
}
function selectDefaultMenu(data, restaurantId = 363910, now = new Date()) {
  const schedule = buildSchedule(data, now);
  const today = schedule.today;
  const hours = serviceHours(findRestaurant(schedule, today, restaurantId), restaurantId);
  const minutes = getKstMinutes(now);
  const meal = ['breakfast', 'lunch', 'dinner'].find(key => hours[key] && minutes < clockMinutes(hours[key].end));
  const date = meal ? today : nextDate(today);
  return { restaurantId, date, meal: meal || firstServiceMeal(schedule, date, restaurantId), week: schedule.weeks.find(week => week.days[date])?.key || schedule.initialWeek };
}
function initialSelection(data, query = '', now = new Date()) {
  const params = new URLSearchParams(query);
  const requestedId = Number(params.get('restaurant'));
  const restaurantId = RESTAURANTS.some(info => info.id === requestedId) ? requestedId : 363910;
  const automatic = selectDefaultMenu(data, restaurantId, now);
  const date = validDate(params.get('date')) ? params.get('date') : automatic.date;
  const meal = MEAL_ORDER.includes(params.get('meal')) ? params.get('meal') : date === automatic.date ? automatic.meal : firstServiceMeal(buildSchedule(data, now), date, restaurantId);
  const linked = validDate(params.get('date')) || MEAL_ORDER.includes(params.get('meal')) || params.has('window');
  return { restaurantId, date, meal, week: buildSchedule(data, now).weeks.find(week => week.days[date])?.key || automatic.week, sectionName: params.get('window'), automatic: !linked, linked };
}

function buildSchedule(data, now = new Date()) {
  const validDays = days => Object.fromEntries(Object.entries(days || {}).filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort(([a], [b]) => a.localeCompare(b)));
  const weeks = [{ key: 'this', days: validDays(data?.days) }, { key: 'next', days: validDays(data?.next_week?.days) }]
    .map(week => ({ ...week, dates: Object.keys(week.days) })).filter(week => week.dates.length);
  const today = getKstDate(now);
  const day = new Date(`${today}T12:00:00+09:00`).getUTCDay();
  const activeWeek = weeks.find(week => week.dates.includes(today)) || ((day === 0 || day === 6) && weeks.find(week => week.key === 'next')) || weeks[0];
  return { weeks, today, initialWeek: activeWeek?.key || 'this', initialDate: activeWeek?.dates.includes(today) ? today : activeWeek?.dates[0] || '' };
}

function isNotice(item) {
  if (item.kind === 'note') return true;
  return /^(?:\s*[*※]|\s*\()|위 메뉴|시장 상황|운영시간|예약 가능합니다|픽업시간|단일코너.*운영|원하는 토핑|간편식 판매|(?:중식|증식|석식|테이크아웃)\s*\([\d,]+원\)/.test(item.ko || '');
}
function hasEmptyMeals(restaurant) {
  return MEAL_ORDER.every(key => {
    const sections = restaurant.meals?.[key]?.sections;
    return Array.isArray(sections) && !sections.some(section => section.items?.some(item => !isNotice(item)));
  });
}
function isClosedDay(restaurant, date) {
  if (restaurant?.fetch_status !== 'ok' || !hasEmptyMeals(restaurant)) return false;
  if (restaurant.menu_status === 'closed' && restaurant.closure?.source === 'daily_menu' && restaurant.closure.text?.trim()) return true;
  if (restaurant.menu_status && !['empty', 'closed'].includes(restaurant.menu_status)) return false;
  // Keep the requested weekend fallback; empty weekdays need explicit evidence.
  return validDate(date) && [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
}
function isUnpublishedDay(restaurant, date, today = getKstDate()) {
  return restaurant?.fetch_status === 'ok' && hasEmptyMeals(restaurant) && !isClosedDay(restaurant, date)
    && (restaurant.menu_status === 'not_published' || (validDate(date) && date >= today && restaurant.menu_status !== 'unavailable'));
}
function availableMeals(restaurant) { return MEAL_ORDER.filter(key => restaurant?.meals?.[key]?.sections?.some(section => section.items?.some(item => !isNotice(item)))); }
function unavailableMeal(restaurant, meal) { const meals = availableMeals(restaurant); return restaurant?.fetch_status === 'ok' && meals.length > 0 && !meals.includes(meal); }
function operatingNotices(restaurant) {
  const meals = availableMeals(restaurant);
  const seen = new Set();
  return MEAL_ORDER.filter(meal => !meals.includes(meal)).flatMap(meal => restaurant?.meals?.[meal]?.sections || []).flatMap(section => section.items || []).filter(item => {
    if (!isNotice(item) || seen.has(item.ko)) return false;
    seen.add(item.ko); return true;
  });
}
function validTranslation(original, translated) { return typeof translated === 'string' && translated.trim() !== '' && !/[가-힣]/.test(translated) && (translated !== original || !/[가-힣]/.test(original)); }
function menuSections(restaurant, meal) { return (restaurant?.meals?.[meal]?.sections || []).filter(section => section.items?.length); }
function resolveSection(restaurant, meal, preferred) { const sections = menuSections(restaurant, meal); const hasFood = section => section.items.some(item => !isNotice(item)); return sections.find(section => section.name_ko === preferred) || sections.find(section => /^A(?:코너|창구|窗口)?$/i.test(section.name_ko.replace(/\s/g, '')) && hasFood(section)) || sections.find(hasFood) || sections[0]; }
function allDates(schedule) { return [...new Set(schedule.weeks.flatMap(week => week.dates))].sort(); }
function stepDate(schedule, date, direction) { const dates = [...new Set([...allDates(schedule), date].filter(Boolean))].sort(); const index = dates.indexOf(date); return dates[index + direction] || date; }
function calendarMonths(schedule, calendarWeek, menuWeek) {
  const week = schedule.weeks.find(item => item.key === calendarWeek) || schedule.weeks.find(item => item.key === menuWeek);
  return [...new Set((week?.dates || []).map(date => date.slice(0, 7)))];
}
function stepCalendarMonth(schedule, calendarWeek, menuWeek, month, direction) {
  const months = calendarMonths(schedule, calendarWeek, menuWeek);
  return months[months.indexOf(month) + direction] || month;
}
function storageRead(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageWrite(key, value) { try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ } }
let state, data, schedule, toastTimer;
let offlineFallback = false, offlineState = 'cachePending';
const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const copy = () => COPY[state.lang];
const isChinese = () => state.lang === 'cn';
const activeWeek = () => schedule.weeks.find(week => week.key === state.week);
const currentRestaurant = () => activeWeek()?.days[state.date]?.restaurants?.find(restaurant => Number(restaurant.id) === state.restaurantId);
const currentSection = () => availableMeals(currentRestaurant()).includes(state.meal) ? resolveSection(currentRestaurant(), state.meal, state.sectionName) : undefined;
const restaurantInfo = () => RESTAURANTS.find(restaurant => restaurant.id === state.restaurantId) || RESTAURANTS[0];
const localized = (original, translated) => isChinese() && validTranslation(original, translated) ? translated : original || '';

function icon(name) {
  const span = el('span');
  // Markup is limited to these static SVG paths. External menu text always uses textContent.
  span.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.bowl}</svg>`;
  return span.firstChild;
}
function button(className, pressed, action) { const node = el('button', className); node.type = 'button'; node.setAttribute('aria-pressed', String(pressed)); node.addEventListener('click', action); return node; }
function dateText(date, options) { return date ? new Intl.DateTimeFormat(isChinese() ? 'zh-CN' : 'ko-KR', { timeZone: 'Asia/Seoul', ...options }).format(new Date(`${date}T12:00:00+09:00`)) : ''; }
function showStatus(id, text) { $(id).textContent = text || ''; $(id).hidden = !text; }
function closeDialogs() { for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
function openDialog(id) { closeDialogs(); $(id).showModal(); }
function chooseDate(date) { const week = schedule.weeks.find(item => item.dates.includes(date)); if (!week) return; state.automatic = false; state.week = week.key; state.calendarWeek = week.key; state.date = date; state.calendarMonth = date.slice(0, 7); state.sectionName = null; renderAll(); if ($('dateDialog').open) $('dateDialog').close(); }

function refreshAutomaticSelection(force = false) {
  const now = new Date();
  const previousToday = schedule.today;
  schedule = buildSchedule(data, now);
  if (!state.automatic && !force) { if (previousToday !== schedule.today) renderAll(); else { renderMenu(); renderAppStatus(); } return; }
  const selected = selectDefaultMenu(data, state.restaurantId, now);
  const changed = selected.date !== state.date || selected.meal !== state.meal || selected.week !== state.week || previousToday !== schedule.today;
  if (force) {
    state.automatic = true; state.linked = false;
    const url = new URL(window.location.href);
    for (const key of ['date', 'meal', 'window']) url.searchParams.delete(key);
    if (url.searchParams.has('restaurant')) url.searchParams.set('restaurant', state.restaurantId);
    window.history.replaceState(null, '', url);
  }
  if (changed || force) { Object.assign(state, selected); state.sectionName = null; state.calendarMonth = selected.date.slice(0, 7); renderAll(); }
  else { renderMenu(); renderAppStatus(); }
}

function renderDates() {
  const week = schedule.weeks.find(item => item.key === state.calendarWeek) || activeWeek();
  const months = calendarMonths(schedule, state.calendarWeek, state.week);
  if (!months.includes(state.calendarMonth)) state.calendarMonth = months.includes(state.date.slice(0, 7)) ? state.date.slice(0, 7) : months[0];
  $('weekSwitch').hidden = schedule.weeks.length < 2;
  $('weekSwitch').replaceChildren(...schedule.weeks.map(item => {
    const node = button('', week?.key === item.key, () => { state.calendarWeek = item.key; state.calendarMonth = item.dates[0].slice(0, 7); renderDates(); });
    node.textContent = item.key === 'next' ? copy().nextWeek : copy().thisWeek;
    return node;
  }));
  $('todayButton').textContent = copy().today;
  $('todayButton').disabled = !data;
  $('calendarWeekdays').replaceChildren(...(isChinese() ? ['一','二','三','四','五','六','日'] : ['월','화','수','목','금','토','일']).map(day => el('span', '', day)));
  const monthIndex = months.indexOf(state.calendarMonth);
  $('calendarPrev').disabled = monthIndex <= 0;
  $('calendarNext').disabled = monthIndex < 0 || monthIndex >= months.length - 1;
  const cells = [];
  if (state.calendarMonth) {
    const [year, month] = state.calendarMonth.split('-').map(Number);
    const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    $('calendarMonth').textContent = dateText(`${state.calendarMonth}-01`, { year: 'numeric', month: 'long' });
    for (let i = 0; i < offset; i++) cells.push(el('span'));
    for (let number = 1; number <= days; number++) {
      const date = `${state.calendarMonth}-${String(number).padStart(2, '0')}`;
      if (week.dates.includes(date)) {
        const node = button(`date-button${date === schedule.today ? ' is-today' : ''}`, date === state.date, () => chooseDate(date));
        node.textContent = number;
        node.setAttribute('aria-label', dateText(date, { month: 'long', day: 'numeric', weekday: 'long' }));
        cells.push(node);
      } else { const node = el('span', 'calendar-unavailable', number); node.setAttribute('aria-hidden', 'true'); cells.push(node); }
    }
  } else $('calendarMonth').textContent = '—';
  $('weekTabs').replaceChildren(...cells);
  $('navDateDisplay').textContent = dateText(state.date, { month: 'long', day: 'numeric' }) || '—';
  const dates = [...new Set([...allDates(schedule), state.date].filter(Boolean))].sort();
  const index = dates.indexOf(state.date);
  $('prevDate').disabled = index <= 0;
  $('nextDate').disabled = index < 0 || index === dates.length - 1;
}

function renderSelectors() {
  $('restaurantTabs').replaceChildren(...RESTAURANTS.map(info => {
    const node = button('restaurant-button', info.id === state.restaurantId, () => { state.restaurantId = info.id; state.sectionName = null; if (state.automatic) refreshAutomaticSelection(true); else renderAll(); });
    node.append(icon('restaurant'), el('span', '', isChinese() ? info.name_cn : info.name_ko));
    return node;
  }));
  const available = availableMeals(currentRestaurant());
  $('mealTabs').hidden = available.length === 0;
  $('mealTabs').style.setProperty('--meal-count', available.length || 1);
  $('mealTabs').replaceChildren(...available.map(meal => {
    const node = button('meal-button', state.meal === meal, () => { state.automatic = false; state.meal = meal; state.sectionName = null; renderAll(); });
    node.append(icon(meal), el('span', '', copy()[meal])); return node;
  }));
  const sections = available.includes(state.meal) ? menuSections(currentRestaurant(), state.meal) : [];
  const previousScroll = $('windowTabs').scrollLeft;
  $('windowTabs').hidden = sections.length < 2;
  $('windowTabs').replaceChildren(...sections.map(section => {
    const note = section.items.every(isNotice);
    const node = button(`window-button${note ? ' note-window' : ''}`, section.name_ko === state.sectionName, () => { state.automatic = false; state.sectionName = section.name_ko; renderAll(); });
    node.textContent = localized(section.name_ko, section.name_cn); return node;
  }));
  $('windowTabs').scrollLeft = previousScroll;
  const selectedWindow = $('windowTabs').querySelector('[aria-pressed="true"]');
  if (selectedWindow && !$('windowTabs').hidden) {
    const strip = $('windowTabs').getBoundingClientRect();
    const selected = selectedWindow.getBoundingClientRect();
    if (selected.left < strip.left) $('windowTabs').scrollLeft -= strip.left - selected.left;
    else if (selected.right > strip.right) $('windowTabs').scrollLeft += selected.right - strip.right;
  }
}

function renderMenu() {
  const restaurant = currentRestaurant();
  const closedDay = isClosedDay(restaurant, state.date);
  const unpublished = isUnpublishedDay(restaurant, state.date);
  const unavailable = unavailableMeal(restaurant, state.meal);
  const section = closedDay ? undefined : currentSection();
  const items = (section?.items || []).filter(item => !isNotice(item));
  const notices = (section?.items || []).filter(isNotice);
  $('menuHeading').textContent = `${dateText(state.date, { weekday: 'long' })}${isChinese() ? '' : ' '}${copy().menu}`;
  $('dateDisplay').textContent = state.date.replaceAll('-', '.') || '—';
  $('todayMarker').textContent = state.date === schedule.today ? copy().todayLabel : copy().tomorrowLabel;
  $('todayMarker').hidden = state.date !== schedule.today && state.date !== nextDate(schedule.today);
  $('serviceMeta').hidden = !section;
  const hours = serviceHours(restaurant, state.restaurantId)[state.meal];
  $('serviceHours').textContent = hours ? `${hours.source === 'fallback' || !section ? copy().fallbackHours : copy().servingHours} ${hours.start}–${hours.end}` : '';
  $('serviceHours').hidden = !hours;
  const status = serviceStatus(restaurant, state.restaurantId, state.date, state.meal, section, new Date(), dataFreshness(data) === 'fresh' && navigator.onLine && !offlineFallback);
  $('serviceState').textContent = copy()[status];
  $('serviceState').dataset.state = status;
  $('serviceState').hidden = false;
  $('shareButton').disabled = !section;
  $('shareButton').hidden = !section;
  const content = [];
  if (items.length) {
    const table = el('table', 'menu-table');
    table.setAttribute('aria-label', `${copy()[state.meal]} · ${localized(section.name_ko, section.name_cn)}`);
    const body = el('tbody');
    for (const item of items) {
      const row = el('tr', 'dish-row');
      const name = el('td', 'dish-name'); name.append(el('strong', '', localized(item.ko, item.cn)));
      row.append(name); body.append(row);
    }
    table.append(body); content.push(table);
  }
  if (notices.length) { const notice = el('div', 'card-notices'); notice.append(...notices.map(item => el('p', '', localized(item.ko, item.cn)))); content.push(notice); }
  $('menuContent').replaceChildren(...content);
  $('emptyState').hidden = !!section;
  $('emptyTitle').textContent = closedDay ? copy().holidayClosed : unpublished ? copy().notPublished : unavailable ? copy().unavailableMeal(copy()[state.meal]) : copy().empty;
  $('emptyDescription').hidden = closedDay || unpublished || unavailable;
  let message = '';
  if (!restaurant && state.date) message = state.date > schedule.today ? copy().futureMissing : copy().missing;
  else if (restaurant?.fetch_status === 'error') message = copy().fetchError;
  else if (restaurant?.fetch_status === 'stale') message = restaurant.stale_reason === 'source_empty' ? copy().savedMenu : copy().staleRestaurant;
  else if (!section && !closedDay && !unavailable && !unpublished && state.date > schedule.today) message = copy().futureMissing;
  else if (isChinese() && section && (!validTranslation(section.name_ko, section.name_cn) || section.items.some(item => !validTranslation(item.ko, item.cn)))) message = copy().translationMissing;
  showStatus('restaurantStatus', message);
  const freshness = dataFreshness(data);
  showStatus('dataStatus', freshness === 'missing' ? copy().noData : !navigator.onLine || offlineFallback ? copy().offlineBanner : freshness !== 'fresh' ? copy().old : '');
}

function renderAppStatus() {
  const restaurant = currentRestaurant();
  const notes = isClosedDay(restaurant, state.date) ? [] : operatingNotices(restaurant);
  $('operatingSection').hidden = notes.length === 0;
  const info = restaurantInfo();
  $('operatingTitle').textContent = `${copy().operating} · ${localized(info.name_ko, info.name_cn)}`;
  $('operatingDetails').replaceChildren(...notes.map(item => el('p', '', localized(item.ko, item.cn))));
}

function renderText() {
  document.documentElement.lang = isChinese() ? 'zh-CN' : 'ko';
  document.title = `${copy().brand} · Ajou Menu`;
  const text = { brandSubtitle: 'brand', restaurantLabel: 'restaurant', mealLabel: 'meal', windowLabel: 'window', skipLink: 'skip', emptyTitle: 'empty', emptyDescription: 'emptyDescription', calendarTitle: 'calendar', calendarHint: 'calendarHint', datePickerLabel: 'calendar', copyTitle: 'share', copyHint: 'copyHint', toolsTitle: 'tools' };
  for (const [id, key] of Object.entries(text)) $(id).textContent = copy()[key];
  $('languageLabel').textContent = isChinese() ? '한국어' : '中文';
  $('langToggle').setAttribute('aria-label', isChinese() ? '한국어로 전환' : '切换到中文');
  const labels = { dateToggle: 'calendar', navDateLabel: 'calendar', prevDate: 'previous', nextDate: 'next', calendarPrev: 'previousMonth', calendarNext: 'nextMonth', selectionPanel: 'restaurant', dateNavigation: 'calendar', toolsToggle: 'tools', shareButton: 'share' };
  for (const [id, key] of Object.entries(labels)) $(id).setAttribute('aria-label', copy()[key]);
  $('shareButton').title = copy().share;
  for (const node of document.querySelectorAll('[data-close]')) node.setAttribute('aria-label', copy().close);
  renderThemeLabel();
  const generated = new Date(data?.generated_at);
  $('updatedAt').textContent = Number.isFinite(generated.getTime()) ? `${copy().updated} ${new Intl.DateTimeFormat(isChinese() ? 'zh-CN' : 'ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(generated)} · KST` : '';
  $('dateCount').textContent = copy().days(allDates(schedule).length);
}

function renderAll() {
  state.sectionName = currentSection()?.name_ko || null;
  if (!$('dateDialog').open) state.calendarWeek = state.week;
  renderText(); renderDates(); renderSelectors(); renderMenu(); renderAppStatus();
  // Keep shared links aligned with subsequent choices, including a language change.
  if (state.linked) window.history.replaceState(null, '', menuLink());
}
function renderThemeLabel() {
  const dark = document.documentElement.classList.contains('dark');
  $('themeToggle').replaceChildren(icon(dark ? 'sun' : 'moon'));
  $('themeToggle').setAttribute('aria-label', dark ? copy().light : copy().dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14263f' : '#ffffff');
}
function notify(text) { clearTimeout(toastTimer); showStatus('actionStatus', text); toastTimer = setTimeout(() => showStatus('actionStatus', ''), 2400); }

function menuLink() { const url = new URL(window.location.href); url.search = ''; url.hash = ''; for (const [key, value] of Object.entries({ date: state.date, restaurant: state.restaurantId, meal: state.meal, window: state.sectionName, lang: state.lang })) if (value != null) url.searchParams.set(key, value); return url.href; }
async function copyMenu() {
  const section = currentSection(); if (!section) return;
  const info = restaurantInfo();
  const heading = `${copy().brand}\n${dateText(state.date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}\n${localized(info.name_ko, info.name_cn)} · ${copy()[state.meal]} · ${localized(section.name_ko, section.name_cn)}`;
  const text = `${heading}\n\n${section.items.map(item => localized(item.ko, item.cn)).join('\n')}`;
  try { await navigator.clipboard.writeText(text); notify(copy().copied); }
  catch { $('copyText').value = text; openDialog('copyDialog'); $('copyText').focus(); $('copyText').select(); }
}

function init() {
  data = typeof MENU_DATA === 'undefined' ? null : MENU_DATA;
  schedule = buildSchedule(data);
  const params = new URLSearchParams(window.location.search);
  const language = params.get('lang') || storageRead('menuLang');
  state = {
    ...initialSelection(data, params),
    lang: language === 'cn' ? 'cn' : 'ko',
    calendarMonth: null,
  };
  for (const node of document.querySelectorAll('[data-icon]')) node.replaceChildren(icon(node.dataset.icon));
  $('langToggle').addEventListener('click', () => {
    state.lang = isChinese() ? 'ko' : 'cn';
    storageWrite('menuLang', state.lang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', state.lang);
    window.history.replaceState(null, '', url);
    renderAll();
  });
  $('themeToggle').addEventListener('click', () => { const dark = !document.documentElement.classList.contains('dark'); document.documentElement.classList.toggle('dark', dark); storageWrite('menuTheme', dark ? 'dark' : 'light'); renderThemeLabel(); });
  const media = matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', event => { if (!['light','dark'].includes(storageRead('menuTheme'))) { document.documentElement.classList.toggle('dark', event.matches); renderThemeLabel(); } });
  for (const id of ['dateToggle','navDateLabel']) $(id).addEventListener('click', () => { state.calendarWeek = state.week; state.calendarMonth = state.date.slice(0, 7); renderDates(); openDialog('dateDialog'); });
  $('todayButton').addEventListener('click', () => { refreshAutomaticSelection(true); $('dateDialog').close(); });
  $('prevDate').addEventListener('click', () => chooseDate(stepDate(schedule, state.date, -1)));
  $('nextDate').addEventListener('click', () => chooseDate(stepDate(schedule, state.date, 1)));
  for (const [id, direction] of [['calendarPrev',-1],['calendarNext',1]]) $(id).addEventListener('click', () => { state.calendarMonth = stepCalendarMonth(schedule, state.calendarWeek, state.week, state.calendarMonth, direction); renderDates(); });
  $('shareButton').addEventListener('click', copyMenu);
  $('toolsToggle').addEventListener('click', () => { renderAppStatus(); openDialog('toolsDialog'); });
  for (const event of ['online', 'offline']) window.addEventListener(event, () => { offlineFallback = false; renderMenu(); renderAppStatus(); });
  for (const node of document.querySelectorAll('[data-close]')) node.addEventListener('click', () => $(node.dataset.close).close());
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAutomaticSelection(); });
  setInterval(refreshAutomaticSelection, 30000);
  renderAll();
  prepareOffline();
}

async function prepareOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { offlineState = 'cacheUnsupported'; renderAppStatus(); return; }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'menu-offline-fallback') { offlineFallback = true; renderMenu(); renderAppStatus(); }
  });
  try {
    const registration = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
    const inspect = async () => {
      const reply = await new Promise(resolve => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 5000);
        channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
        registration.active?.postMessage({ type: 'menu-cache-status' }, [channel.port2]);
      });
      offlineState = reply?.ready ? 'cacheReady' : 'cacheFailed';
      if (reply?.fallback) { offlineFallback = true; renderMenu(); }
      renderAppStatus();
    };
    if (registration.active) await inspect();
    else navigator.serviceWorker.ready.then(inspect);
    navigator.serviceWorker.addEventListener('controllerchange', inspect);
  } catch { offlineState = 'cacheFailed'; renderAppStatus(); }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
if (typeof module !== 'undefined' && module.exports) module.exports = { getKstDate, getKstMinutes, buildSchedule, isNotice, isClosedDay, isUnpublishedDay, availableMeals, unavailableMeal, operatingNotices, validTranslation, resolveSection, stepDate, calendarMonths, stepCalendarMonth, serviceHours, selectDefaultMenu, initialSelection, dataFreshness, serviceStatus };
