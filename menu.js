// State
let currentLang = localStorage.getItem('menuLang') || 'ko';
let currentRestaurant = parseInt(localStorage.getItem('menuRestaurant') || '0');
let currentMeal = localStorage.getItem('menuMeal') || 'lunch';
let currentDate = localStorage.getItem('menuDate') || null;

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS = {
    breakfast: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    lunch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
    dinner: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    snack: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 00-7.35 16.76C6.23 17.1 8 15.36 8 13.2V8h8v5.2c0 2.16 1.77 3.9 3.35 5.56A10 10 0 0012 2z"/></svg>',
};

function init() {
    if (typeof MENU_DATA === 'undefined') {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }

    if (currentDate !== MENU_DATA.date) {
        currentDate = MENU_DATA.date;
        localStorage.setItem('menuDate', currentDate);
    }

    updateDateDisplay();
    renderRestaurantTabs();
    renderMealTabs();
    render();
    updateFooter();
}

function updateDateDisplay() {
    const d = new Date(MENU_DATA.date + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[d.getDay()];
    document.getElementById('dateDisplay').textContent = `${month}월 ${day}일 ${weekday}`;
}

function renderRestaurantTabs() {
    const container = document.getElementById('restaurantTabs');
    const restaurants = MENU_DATA.restaurants;
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
    const restaurant = MENU_DATA.restaurants[currentRestaurant];
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
    const restaurant = MENU_DATA.restaurants[currentRestaurant];

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

    // Calculate total calories for current meal
    const restaurant = MENU_DATA.restaurants[currentRestaurant];
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
    renderRestaurantTabs();
    renderMealTabs();
    render();
}

function prevDate() {
    // Navigate would require loading different data; for now just show today
}

function nextDate() {
    // Navigate would require loading different data; for now just show today
}

function goToday() {
    // Reset to today
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    if (currentLang === 'cn') {
        document.body.classList.add('lang-cn');
        document.getElementById('langToggle').textContent = '한국어';
    }
    init();
});
