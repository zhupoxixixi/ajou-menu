// State
let currentLang = localStorage.getItem('menuLang') || 'ko';
let currentRestaurant = parseInt(localStorage.getItem('menuRestaurant') || '0');
let currentMeal = localStorage.getItem('menuMeal') || 'lunch';
let currentDateIndex = 0;

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS = {
    breakfast: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    lunch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
    dinner: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    snack: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 00-7.35 16.76C6.23 17.1 8 15.36 8 13.2V8h8v5.2c0 2.16 1.77 3.9 3.35 5.56A10 10 0 0012 2z"/></svg>',
};

// 获取所有可用日期（本周 + 下周）
function getAllDates() {
    if (!MENU_DATA) return { thisWeek: [], nextWeek: [] };

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const allDays = MENU_DATA.days || {};
    const dates = Object.keys(allDays).sort();

    // 分离本周和下周数据
    const thisWeekDates = [];
    const nextWeekDates = [];

    dates.forEach(date => {
        if (isWeekend && MENU_DATA.next_week && MENU_DATA.next_week.days && MENU_DATA.next_week.days[date]) {
            nextWeekDates.push(date);
        } else {
            thisWeekDates.push(date);
        }
    });

    return {
        thisWeek: thisWeekDates,
        nextWeek: nextWeekDates,
        isWeekend: isWeekend
    };
}

// 获取当前应该显示的数据
function getCurrentDayData() {
    const { thisWeek, nextWeek, isWeekend } = getAllDates();

    // 如果是周末，优先显示下周预告
    if (isWeekend && nextWeek.length > 0) {
        const date = nextWeek[currentDateIndex] || nextWeek[0];
        return MENU_DATA.next_week.days[date];
    }

    // 否则显示本周数据
    const dates = thisWeek.length > 0 ? thisWeek : Object.keys(MENU_DATA.days || {}).sort();
    if (dates.length === 0) return null;
    const date = dates[currentDateIndex] || dates[0];
    return (MENU_DATA.days || {})[date];
}

// 获取当前显示的日期列表
function getDisplayDates() {
    const { thisWeek, nextWeek, isWeekend } = getAllDates();
    if (isWeekend && nextWeek.length > 0) {
        return nextWeek;
    }
    return thisWeek.length > 0 ? thisWeek : Object.keys(MENU_DATA.days || {}).sort();
}

function init() {
    if (typeof MENU_DATA === 'undefined') {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }

    const dates = getDisplayDates();
    if (dates.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }

    // 设置初始日期为今天（如果在范围内）
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = dates.indexOf(today);
    if (todayIndex >= 0) {
        currentDateIndex = todayIndex;
    } else {
        currentDateIndex = 0;
    }

    renderWeekTabs();
    updateDateDisplay();
    renderRestaurantTabs();
    renderMealTabs();
    render();
    updateFooter();
}

function renderWeekTabs() {
    const container = document.getElementById('weekTabs');
    const dates = getDisplayDates();
    const { isWeekend } = getAllDates();

    // 如果是周末，显示"下周预告"标题
    const headerHtml = isWeekend ? `
        <div class="w-full text-center mb-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                </svg>
                ${currentLang === 'cn' ? '下周预告' : '다음 주 미리보기'}
            </span>
        </div>
    ` : '';

    // 合并相邻两天为一组按钮
    const groups = [];
    for (let i = 0; i < dates.length; i += 2) {
        if (i + 1 < dates.length) {
            groups.push([dates[i], dates[i + 1]]);
        } else {
            groups.push([dates[i]]);
        }
    }

    const buttonsHtml = groups.map((group, groupIndex) => {
        const startDate = group[0];
        const endDate = group[group.length - 1];
        const startD = new Date(startDate + 'T00:00:00');
        const endD = new Date(endDate + 'T00:00:00');

        const startDay = startD.getDate();
        const endDay = endD.getDate();
        const month = startD.getMonth() + 1;

        const startWeekday = currentLang === 'cn'
            ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][startD.getDay()]
            : ['일', '월', '화', '수', '목', '금', '토'][startD.getDay()];
        const endWeekday = currentLang === 'cn'
            ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][endD.getDay()]
            : ['일', '월', '화', '수', '목', '금', '토'][endD.getDay()];

        // 检查是否包含今天
        const today = new Date().toISOString().split('T')[0];
        const containsToday = group.includes(today);
        const isActive = groupIndex === Math.floor(currentDateIndex / 2);

        const dateRange = group.length > 1
            ? `${startWeekday} ${startDay} ~ ${endWeekday} ${endDay}`
            : `${startWeekday} ${startDay}日`;

        return `<button onclick="switchDateGroup(${groupIndex})"
            class="flex-1 flex flex-col items-center py-2.5 px-2 rounded-xl transition-all ${
                isActive
                    ? 'bg-primary-500 text-white shadow-sm'
                    : containsToday
                        ? 'bg-primary-50 text-primary-600 border border-primary-200'
                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
            }">
            <span class="text-[10px] font-medium opacity-80">${month}월</span>
            <span class="text-xs font-bold mt-0.5 leading-tight">${dateRange}</span>
        </button>`;
    }).join('');

    container.innerHTML = headerHtml + `<div class="flex gap-2 w-full">${buttonsHtml}</div>`;
}

function switchDateGroup(groupIndex) {
    currentDateIndex = groupIndex * 2;
    renderWeekTabs();
    updateDateDisplay();
    renderRestaurantTabs();
    renderMealTabs();
    render();
    updateFooter();
}

function updateDateDisplay() {
    const dates = getDisplayDates();
    if (dates.length === 0) return;

    const date = dates[currentDateIndex] || dates[0];
    const d = new Date(date + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = currentLang === 'cn'
        ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        : ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[d.getDay()];
    document.getElementById('dateDisplay').textContent = `${month}월 ${day}일 ${weekday}`;
}

function renderRestaurantTabs() {
    const container = document.getElementById('restaurantTabs');
    const dayData = getCurrentDayData();
    if (!dayData) return;

    const restaurants = dayData.restaurants;
    container.innerHTML = restaurants.map((r, i) => {
        const name = currentLang === 'cn' && r.name_cn ? r.name_cn : r.name_ko;
        const active = i === currentRestaurant ? 'tab-active' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300';
        return `<button onclick="switchRestaurant(${i})"
            class="flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${active}">
            ${name}
        </button>`;
    }).join('');
}

function renderMealTabs() {
    const container = document.getElementById('mealTabs');
    const dayData = getCurrentDayData();
    if (!dayData) return;

    const restaurant = dayData.restaurants[currentRestaurant];
    if (!restaurant) return;

    container.innerHTML = MEAL_ORDER.map(meal => {
        const data = restaurant.meals[meal];
        if (!data) return '';
        const label = currentLang === 'cn' ? data.label_cn : data.label_ko;
        const active = currentMeal === meal ? 'tab-active' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300';
        const hasItems = data.sections && data.sections.length > 0;
        const disabled = !hasItems ? 'opacity-40 cursor-not-allowed' : '';
        return `<button onclick="${hasItems ? `switchMeal('${meal}')` : ''}"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${active} ${disabled}">
            ${MEAL_ICONS[meal] || ''}
            ${label}
        </button>`;
    }).join('');
}

function render() {
    const container = document.getElementById('menuContent');
    const emptyState = document.getElementById('emptyState');
    const dayData = getCurrentDayData();

    if (!dayData) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    const restaurant = dayData.restaurants[currentRestaurant];
    if (!restaurant) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    const meal = restaurant.meals[currentMeal];
    if (!meal || !meal.sections || meal.sections.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    container.innerHTML = meal.sections.map((section, si) => {
        const sectionName = currentLang === 'cn' && section.name_cn ? section.name_cn : section.name_ko;
        const sectionCalories = section.items.reduce((sum, item) => sum + (item.calories || 0), 0);

        return `
        <div class="bg-white rounded-2xl border border-gray-100 p-4 card-enter" style="animation-delay: ${si * 50}ms">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-gray-800">
                    <span class="text-primary-500 mr-1">&lt;</span>${sectionName}<span class="text-primary-500 ml-1">&gt;</span>
                </h3>
                ${sectionCalories > 0 ? `<span class="text-[10px] text-gray-300 font-medium">${sectionCalories} kcal</span>` : ''}
            </div>
            <ul class="space-y-0">
                ${section.items.map((item, ii) => {
                    const name = currentLang === 'cn' && item.cn ? item.cn : item.ko;
                    const cal = item.calories || 0;
                    return `
                <li class="flex items-center justify-between py-2 ${ii < section.items.length - 1 ? 'border-b border-gray-50' : ''}">
                    <span class="text-sm text-gray-700 leading-snug">${name}</span>
                    ${cal > 0 ? `<span class="text-[11px] text-gray-300 tabular-nums ml-3 shrink-0">${cal}</span>` : ''}
                </li>`;
                }).join('')}
            </ul>
        </div>`;
    }).join('');
}

function updateFooter() {
    const el = document.getElementById('updatedAt');
    if (MENU_DATA.generated_at) {
        const d = new Date(MENU_DATA.generated_at);
        el.textContent = `Updated ${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    const dayData = getCurrentDayData();
    if (dayData) {
        const restaurant = dayData.restaurants[currentRestaurant];
        if (restaurant) {
            const meal = restaurant.meals[currentMeal];
            if (meal && meal.sections) {
                const total = meal.sections.reduce((sum, section) =>
                    sum + section.items.reduce((s, item) => s + (item.calories || 0), 0), 0);
                const calEl = document.getElementById('totalCalories');
                calEl.textContent = total > 0 ? `Total: ${total} kcal` : '';
            }
        }
    }
}

function switchRestaurant(index) {
    currentRestaurant = index;
    localStorage.setItem('menuRestaurant', index);
    renderRestaurantTabs();
    renderMealTabs();
    render();
    updateFooter();
}

function switchMeal(meal) {
    currentMeal = meal;
    localStorage.setItem('menuMeal', meal);
    renderMealTabs();
    render();
    updateFooter();
}

function toggleLanguage() {
    currentLang = currentLang === 'ko' ? 'cn' : 'ko';
    localStorage.setItem('menuLang', currentLang);
    document.body.classList.toggle('lang-cn', currentLang === 'cn');
    document.getElementById('langToggle').textContent = currentLang === 'ko' ? '中文' : '한국어';
    renderWeekTabs();
    renderRestaurantTabs();
    renderMealTabs();
    render();
}

function prevDate() {
    if (currentDateIndex > 0) {
        currentDateIndex--;
        renderWeekTabs();
        updateDateDisplay();
        renderRestaurantTabs();
        renderMealTabs();
        render();
        updateFooter();
    }
}

function nextDate() {
    const dates = getDisplayDates();
    if (currentDateIndex < dates.length - 1) {
        currentDateIndex++;
        renderWeekTabs();
        updateDateDisplay();
        renderRestaurantTabs();
        renderMealTabs();
        render();
        updateFooter();
    }
}

function goToday() {
    const today = new Date().toISOString().split('T')[0];
    const dates = getDisplayDates();
    const todayIndex = dates.indexOf(today);
    if (todayIndex >= 0) {
        currentDateIndex = todayIndex;
        renderWeekTabs();
        updateDateDisplay();
        renderRestaurantTabs();
        renderMealTabs();
        render();
        updateFooter();
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    if (currentLang === 'cn') {
        document.body.classList.add('lang-cn');
        document.getElementById('langToggle').textContent = '한국어';
    }
    init();
});
