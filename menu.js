'use strict';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const RESTAURANTS = [
  { id: 363910, name_ko: '기숙사식당', name_cn: '宿舍食堂', location_ko: '기숙사식당 1층', location_cn: '宿舍食堂 1 楼' },
  { id: 221904, name_ko: '교직원식당', name_cn: '教职工食堂', location_ko: '기숙사식당동 2층', location_cn: '宿舍食堂楼 2 层' },
];
const COPY = {
  ko: {
    brand: '아주대학교 식단', campus: '우리의 캠퍼스, 오늘의 한 끼', title: '오늘, 뭐 먹을까요',
    subtitle: '이번 주 식단을 한눈에. 맛있는 캠퍼스 생활의 시작.', today: '오늘로', todayLabel: '오늘',
    restaurant: '어디에서 먹을까요?', meal: '어떤 식사를 찾으세요?', source: '학교 원문 보기 ↗',
    thisWeek: '이번 주', nextWeek: '다음 주', calendar: '날짜 선택', skip: '메뉴로 바로가기',
    breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '분식', menu: '메뉴',
    count: n => `${n}개 코너`, dishes: n => `${n}개 메뉴`, notice: '안내',
    empty: '아직 등록된 식단이 없어요', emptyDescription: '다른 날짜나 식사를 선택하거나 학교 원문을 확인해 주세요.',
    fetchError: '식단을 불러오지 못했어요. 학교 원문에서 확인해 주세요.',
    missing: '이 식당의 해당 날짜 데이터가 없습니다. 학교 원문을 확인해 주세요.',
    old: '저장된 식단을 표시하고 있습니다. 최신 메뉴는 학교 원문을 확인해 주세요.',
    staleRestaurant: '수집에 실패해 이전에 저장된 같은 날짜의 식단을 표시합니다. 변경 사항은 학교 원문을 확인해 주세요.',
    translationMissing: '일부 중국어 번역이 아직 준비되지 않아 한국어 원문을 표시합니다.',
    noData: '메뉴 데이터를 불러오지 못했습니다. 잠시 후 새로고침하거나 학교 원문을 확인해 주세요.',
    calorie: '≈ kcal는 음식 이름을 바탕으로 한 대략적인 추정치입니다. 공식 영양 정보가 아니며, 코너별 메뉴는 별도 선택입니다.',
    updated: '업데이트', footer: '비공식 식단 안내 · 실제 메뉴는 학교 공지 기준',
  },
  cn: {
    brand: '亚洲大学食堂菜单', campus: '校园里的每一餐', title: '今天，吃点什么',
    subtitle: '一周菜单，一目了然。让每一餐都值得期待。', today: '回到今天', todayLabel: '今天',
    restaurant: '选一间食堂', meal: '想看哪一餐？', source: '查看学校原文 ↗',
    thisWeek: '本周', nextWeek: '下周', calendar: '选择日期', skip: '跳到菜单',
    breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '小吃', menu: '菜单',
    count: n => `${n} 个窗口`, dishes: n => `${n} 道菜`, notice: '须知',
    empty: '这份菜单还没有发布', emptyDescription: '可以换个日期或餐次，或查看学校的原始公告。',
    fetchError: '这间食堂的菜单暂时获取失败，请查看学校原文。',
    missing: '暂时没有这间食堂当天的数据，请查看学校原文。',
    old: '当前显示的是已保存的菜单，最新安排请以学校原文为准。',
    staleRestaurant: '本次获取失败，显示此前保存的同一天菜单；如有调整，请以学校原文为准。',
    translationMissing: '部分中文译文暂缺，先为你保留韩文原名。',
    noData: '菜单数据加载失败，请稍后刷新或查看学校原文。',
    calorie: '≈ kcal 是根据菜名粗略估算的热量，并非官方营养数据。各窗口菜单供分别选择。',
    updated: '更新于', footer: '非官方菜单助手 · 实际供应以学校公告为准',
  },
};
const ICONS = {
  restaurant: '<path d="M3 10h18M5 10v10h14V10M3 10l2-6h14l2 6M9 20v-6h6v6"/>',
  breakfast: '<path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8ZM17 9h2a3 3 0 0 1 0 6h-2M6 2v3m4-3v3m4-3v3"/>',
  lunch: '<path d="M4 2v6a3 3 0 0 0 6 0V2M7 2v20M20 2c-4 2-5 6-5 10h5M20 2v20"/>',
  dinner: '<path d="M20 15a8 8 0 0 1-11-11A9 9 0 1 0 20 15Z"/>',
  snack: '<path d="m7 3 2 6m8-6-2 6M4 10h16c0 7-3 11-8 11S4 17 4 10ZM3 10h18"/>',
};

function getKstDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function buildSchedule(data, now = new Date()) {
  const validDays = days => Object.fromEntries(Object.entries(days || {}).filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort(([a], [b]) => a.localeCompare(b)));
  const weeks = [
    { key: 'this', days: validDays(data?.days) },
    { key: 'next', days: validDays(data?.next_week?.days) },
  ].map(week => ({ ...week, dates: Object.keys(week.days) })).filter(week => week.dates.length);
  const today = getKstDate(now);
  const day = new Date(`${today}T12:00:00+09:00`).getUTCDay();
  const activeWeek = weeks.find(week => week.dates.includes(today)) || ((day === 0 || day === 6) && weeks.find(week => week.key === 'next')) || weeks[0];
  return { weeks, today, initialWeek: activeWeek?.key || 'this', initialDate: activeWeek?.dates.includes(today) ? today : activeWeek?.dates[0] || '' };
}

function isNotice(item) {
  if (item.kind === 'note') return true;
  return /^(?:\s*[*※]|\s*\()|위 메뉴|시장 상황|운영시간|예약 가능합니다|픽업시간|단일코너.*운영|원하는 토핑|간편식 판매|(?:중식|증식|석식|테이크아웃)\s*\([\d,]+원\)/.test(item.ko || '');
}

function availableMeals(restaurant) {
  return MEAL_ORDER.filter(key => restaurant?.meals?.[key]?.sections?.some(section => section.items?.length));
}

function resolveMeal(restaurant, preferred) {
  const meals = availableMeals(restaurant);
  return meals.includes(preferred) ? preferred : meals.includes('lunch') ? 'lunch' : meals[0] || preferred;
}

function validTranslation(original, translated) {
  return typeof translated === 'string' && translated.trim() !== '' && !/[가-힣]/.test(translated) && (translated !== original || !/[가-힣]/.test(original));
}

function storageRead(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageWrite(key, value) { try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ } }
let state;
let data;
let schedule;
const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text != null) element.textContent = text; return element; };
const copy = () => COPY[state.lang];
const activeWeek = () => schedule.weeks.find(week => week.key === state.week);
const currentDay = () => activeWeek()?.days[state.date];
const currentRestaurant = () => currentDay()?.restaurants?.find(restaurant => Number(restaurant.id) === state.restaurantId);
const isChinese = () => state.lang === 'cn';
const localized = (original, translated) => isChinese() && validTranslation(original, translated) ? translated : original || '';

function icon(name) {
  const span = el('span');
  // Only static, trusted SVG constants are inserted as markup. All menu text uses textContent.
  span.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return span.firstChild;
}

function button(className, pressed, action) {
  const element = el('button', className);
  element.type = 'button';
  element.setAttribute('aria-pressed', String(pressed));
  element.addEventListener('click', action);
  return element;
}

function dateText(date, options) {
  if (!date) return '';
  return new Intl.DateTimeFormat(isChinese() ? 'zh-CN' : 'ko-KR', { timeZone: 'Asia/Seoul', ...options }).format(new Date(`${date}T12:00:00+09:00`));
}

function renderDates() {
  const week = activeWeek();
  $('weekLabel').textContent = state.week === 'next' ? 'NEXT WEEK' : 'THIS WEEK';
  const formatShort = date => dateText(date, { month: 'numeric', day: 'numeric' });
  $('weekRange').textContent = week ? `${formatShort(week.dates[0])} — ${formatShort(week.dates.at(-1))}` : '—';
  $('weekSwitch').hidden = schedule.weeks.length < 2;
  $('weekSwitch').replaceChildren(...schedule.weeks.map(item => {
    const element = button('', state.week === item.key, () => { state.week = item.key; state.date = item.dates.includes(schedule.today) ? schedule.today : item.dates[0]; renderAll(); });
    element.textContent = item.key === 'next' ? copy().nextWeek : copy().thisWeek;
    return element;
  }));
  $('weekTabs').replaceChildren(...(week?.dates || []).map(date => {
    const today = date === schedule.today;
    const element = button(`date-button${today ? ' is-today' : ''}`, date === state.date, () => { state.date = date; renderAll(); });
    element.setAttribute('aria-label', `${dateText(date, { month: 'long', day: 'numeric', weekday: 'long' })}${today ? ` · ${copy().todayLabel}` : ''}`);
    element.append(el('span', 'weekday', dateText(date, { weekday: 'short' })), el('span', 'day', Number(date.slice(-2))));
    if (today) element.append(el('span', 'today-dot'));
    return element;
  }));
  $('todayButton').disabled = !schedule.weeks.some(item => item.dates.includes(schedule.today));
  $('todayButton').textContent = copy().today;
  $('heroMonth').textContent = state.date ? dateText(state.date, { month: 'long' }) : '—';
  $('heroDay').textContent = state.date ? Number(state.date.slice(-2)) : '—';
  $('heroWeekday').textContent = state.date ? dateText(state.date, { weekday: 'long' }) : '—';
  $('dateDisplay').textContent = dateText(state.date, { month: 'long', day: 'numeric', weekday: 'long' });
}

function renderSelectors() {
  const restaurant = currentRestaurant();
  $('restaurantTabs').replaceChildren(...RESTAURANTS.map(info => {
    const element = button('restaurant-button', info.id === state.restaurantId, () => { state.restaurantId = info.id; storageWrite('menuRestaurantId', info.id); renderAll(); });
    const mark = el('span', 'restaurant-icon'); mark.append(icon('restaurant'));
    element.append(mark, el('span', '', isChinese() ? info.name_cn : info.name_ko), el('span', 'arrow', '›'));
    return element;
  }));
  const meals = availableMeals(restaurant);
  $('mealTabs').replaceChildren(...MEAL_ORDER.map(meal => {
    const element = button('meal-button', state.meal === meal, () => { state.meal = meal; storageWrite('menuMeal', meal); renderAll(); });
    element.disabled = !meals.includes(meal);
    element.append(icon(meal), el('span', '', copy()[meal]));
    return element;
  }));
  const info = RESTAURANTS.find(item => item.id === state.restaurantId) || RESTAURANTS[0];
  $('restaurantName').textContent = isChinese() ? info.name_cn : info.name_ko;
  $('restaurantLocation').textContent = isChinese() ? info.location_cn : info.location_ko;
  const source = new URL('https://www.ajou.ac.kr/kr/life/food.do');
  source.searchParams.set('mode', 'view'); source.searchParams.set('articleNo', info.id);
  if (state.date) source.searchParams.set('date', state.date);
  $('sourceLink').href = source.href;
}

function renderCard(section, index) {
  const card = el('article', 'menu-card');
  const items = (section.items || []).filter(item => !isNotice(item));
  const notices = (section.items || []).filter(isNotice);
  const title = el('div', 'card-title');
  title.append(el('h3', '', localized(section.name_ko, section.name_cn) || copy().notice));
  if (isChinese() && validTranslation(section.name_ko, section.name_cn)) title.append(el('p', '', section.name_ko));
  const header = el('div', 'card-header');
  header.append(el('span', 'card-number', String(index + 1).padStart(2, '0')), title, el('span', 'item-count', items.length ? copy().dishes(items.length) : copy().notice));
  card.append(header);
  if (items.length) {
    const list = el('ul', 'dish-list');
    for (const item of items) {
      const row = el('li', 'dish-row');
      const name = el('div', 'dish-name');
      name.append(el('strong', '', localized(item.ko, item.cn)));
      if (isChinese() && validTranslation(item.ko, item.cn)) name.append(el('span', 'dish-original', item.ko));
      row.append(name);
      if (Number.isFinite(item.calories) && item.calories > 0) {
        const calories = el('span', 'dish-calories', `≈ ${item.calories}`);
        calories.append(el('small', '', 'kcal')); row.append(calories);
      }
      list.append(row);
    }
    card.append(list);
  }
  if (notices.length) {
    const notice = el('div', 'card-notices');
    notice.append(...notices.map(item => el('p', '', localized(item.ko, item.cn))));
    card.append(notice);
  }
  return card;
}

function showStatus(id, text) { const element = $(id); element.textContent = text || ''; element.hidden = !text; }

function renderMenu() {
  const restaurant = currentRestaurant();
  const sections = (restaurant?.meals?.[state.meal]?.sections || []).filter(section => section.items?.length);
  const corners = sections.filter(section => section.items.some(item => !isNotice(item))).length;
  $('menuHeading').textContent = `${copy()[state.meal]} ${copy().menu}`;
  $('menuCount').textContent = copy().count(corners);
  $('menuCount').hidden = !corners;
  $('menuContent').replaceChildren(...sections.map(renderCard));
  $('emptyState').hidden = sections.length > 0;
  $('calorieNote').hidden = !sections.some(section => section.items.some(item => !isNotice(item) && item.calories > 0));
  let message = '';
  if (!restaurant && state.date) message = copy().missing;
  else if (restaurant?.fetch_status === 'error') message = copy().fetchError;
  else if (restaurant?.fetch_status === 'stale') message = copy().staleRestaurant;
  else if (isChinese() && sections.some(section => !validTranslation(section.name_ko, section.name_cn) || section.items.some(item => !validTranslation(item.ko, item.cn)))) message = copy().translationMissing;
  showStatus('restaurantStatus', message);
  if (!data || !schedule.weeks.length) showStatus('dataStatus', copy().noData);
  else {
    const generated = new Date(data.generated_at);
    const age = Date.now() - generated.getTime();
    showStatus('dataStatus', !Number.isFinite(age) || age > 36 * 60 * 60 * 1000 ? copy().old : '');
  }
}

function renderText() {
  document.documentElement.lang = isChinese() ? 'zh-CN' : 'ko';
  document.title = `${copy().brand} · Ajou Menu`;
  const text = { brandSubtitle: 'brand', campusTag: 'campus', pageSubtitle: 'subtitle', restaurantLabel: 'restaurant', mealLabel: 'meal', sourceLink: 'source', skipLink: 'skip', emptyTitle: 'empty', emptyDescription: 'emptyDescription', calorieNote: 'calorie', footerNote: 'footer' };
  for (const [id, key] of Object.entries(text)) $(id).textContent = copy()[key];
  $('pageTitle').replaceChildren(document.createTextNode(copy().title), el('span', '', '？'));
  $('languageLabel').textContent = isChinese() ? '한국어' : '中文';
  $('langToggle').setAttribute('aria-label', isChinese() ? '한국어로 전환' : '切换到中文');
  $('calendarPanel').setAttribute('aria-label', copy().calendar);
  const generated = new Date(data?.generated_at);
  $('updatedAt').textContent = Number.isFinite(generated.getTime()) ? `${copy().updated} ${new Intl.DateTimeFormat(isChinese() ? 'zh-CN' : 'ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(generated)} · KST` : '';
}

function renderAll() {
  state.meal = resolveMeal(currentRestaurant(), state.meal);
  renderText(); renderDates(); renderSelectors(); renderMenu();
}

function init() {
  data = typeof MENU_DATA === 'undefined' ? null : MENU_DATA;
  schedule = buildSchedule(data);
  const storedLang = storageRead('menuLang');
  const storedId = Number(storageRead('menuRestaurantId'));
  const legacyIndex = Number(storageRead('menuRestaurant'));
  state = {
    lang: storedLang === 'cn' ? 'cn' : 'ko',
    restaurantId: RESTAURANTS.some(info => info.id === storedId) ? storedId : RESTAURANTS[legacyIndex]?.id || RESTAURANTS[0].id,
    meal: MEAL_ORDER.includes(storageRead('menuMeal')) ? storageRead('menuMeal') : 'lunch',
    week: schedule.initialWeek, date: schedule.initialDate,
  };
  $('langToggle').addEventListener('click', () => { state.lang = isChinese() ? 'ko' : 'cn'; storageWrite('menuLang', state.lang); renderAll(); });
  $('todayButton').addEventListener('click', () => { const week = schedule.weeks.find(item => item.dates.includes(schedule.today)); if (week) { state.week = week.key; state.date = schedule.today; renderAll(); } });
  renderAll();
  // An open tab should use the next day's calendar after Korean midnight.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getKstDate() !== schedule.today) { schedule = buildSchedule(data); state.week = schedule.initialWeek; state.date = schedule.initialDate; renderAll(); }
  });
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
if (typeof module !== 'undefined' && module.exports) module.exports = { getKstDate, buildSchedule, isNotice, availableMeals, resolveMeal, validTranslation };
