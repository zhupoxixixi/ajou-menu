async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-17T03:00:00Z') });
  const emptyRestaurant = (id = 363910) => ({ id, fetch_status: 'ok', meals: Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snack'].map(meal => [meal, { sections: [] }])) });
  const withFood = (id = 363910) => {
    const restaurant = emptyRestaurant(id);
    restaurant.menu_status = 'available';
    restaurant.meals.lunch.sections = [{ name_ko: 'A 코너', name_cn: 'A窗口', items: [{ ko: '쌀밥', cn: '白米饭', kind: 'dish' }] }];
    restaurant.meals.dinner.sections = structuredClone(restaurant.meals.lunch.sections);
    return restaurant;
  };
  const weekDays = start => Object.fromEntries(Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + offset);
    return [date.toISOString().slice(0, 10), { restaurants: [] }];
  }));
  const seed = async (dataset, date, restaurantId = 363910, meal = 'lunch', week = 'this') => {
    await page.evaluate(payload => {
      closeDialogs();
      data = { generated_at: '2026-10-17T03:00:00+09:00', ...payload.dataset };
      schedule = buildSchedule(data);
      Object.assign(state, { lang: 'cn', date: payload.date, restaurantId: payload.restaurantId,
        meal: payload.meal, week: payload.week, automatic: false, linked: false, sectionName: null,
        calendarWeek: payload.week, calendarMonth: payload.date.slice(0, 7) });
      renderAll();
    }, { dataset, date, restaurantId, meal, week });
  };
  const oneDay = (date, restaurants) => ({ days: { [date]: { restaurants } } });
  const record = async label => {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': horizontal overflow');
    checks.push(label);
  };

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const menu_status of [undefined, 'not_published']) {
      const restaurant = { ...emptyRestaurant(), menu_status };
      await seed(oneDay('2026-10-28', [restaurant]), '2026-10-28');
      await page.getByRole('heading', { name: '菜单尚未公布', exact: true }).waitFor();
      assert(!(await page.locator('#serviceState').isVisible()), 'no contradictory service badge on unpublished menu');
      assert(!(await page.locator('#shareButton').isVisible()), 'no copy action without a menu');
      assert(!(await page.locator('#restaurantStatus').isVisible()), 'no duplicate missing-menu banner');
      await record('unpublished Wednesday ' + (menu_status || 'legacy') + ' ' + width);
    }
    if (width === 390) await page.screenshot({ path: 'output/bugfix-20261017/unpublished-mobile.png', animations: 'disabled' });
    await seed(oneDay('2026-10-17', [emptyRestaurant()]), '2026-10-17');
    await page.getByRole('heading', { name: '节假日不营业', exact: true }).waitFor();
    assert(!(await page.locator('#mealTabs').isVisible()) && !(await page.locator('#shareButton').isVisible()), 'closed day hides unused controls');
    await record('empty weekend ' + width);
    if (width === 1440) await page.screenshot({ path: 'output/bugfix-20261017/closed-desktop.png', animations: 'disabled' });
    const retained = { ...withFood(), fetch_status: 'stale', stale_reason: 'source_empty', fetched_at: '2026-10-16T03:45:00+09:00' };
    await seed(oneDay('2026-10-12', [retained]), '2026-10-12');
    await page.getByText('学校页面已无当天菜单，显示此前保存的同一天菜单。', { exact: true }).waitFor();
    assert(await page.locator('.dish-row').count() === 1 && await page.locator('#shareButton').isVisible(), 'retained historical dishes remain usable');
    await record('retained history ' + width);
    if (width === 390) await page.screenshot({ path: 'output/bugfix-20261017/retained-mobile.png', animations: 'disabled' });
  }

  const closed = { ...emptyRestaurant(), menu_status: 'closed', closure: { source: 'daily_menu', text: '금일 식당 휴무' } };
  await seed(oneDay('2026-10-28', [closed]), '2026-10-28');
  await page.getByRole('heading', { name: '节假日不营业', exact: true }).waitFor();
  await record('explicit weekday closure');
  await seed(oneDay('2026-10-12', [{ ...emptyRestaurant(), menu_status: 'unavailable' }]), '2026-10-12');
  await page.getByRole('heading', { name: '暂时没有这份菜单', exact: true }).waitFor();
  await record('historical date without a saved menu is unconfirmed');
  await seed(oneDay('2026-10-28', [{ ...emptyRestaurant(), fetch_status: 'error' }]), '2026-10-28');
  await page.getByText('这间食堂的菜单暂时获取失败，请查看学校原文。', { exact: true }).waitFor();
  assert((await page.locator('#emptyTitle').innerText()) !== '节假日不营业', 'fetch error is not a closure');
  await record('fetch failure');

  // Reproduce the original split between selected menu week and displayed calendar week.
  const calendar = { days: weekDays('2026-10-26'), next_week: { days: weekDays('2026-11-02') } };
  await seed(calendar, '2026-11-02', 363910, 'lunch', 'next');
  await page.getByRole('button', { name: '选择日期', exact: true }).last().click();
  await page.getByRole('button', { name: '本周', exact: true }).click();
  assert((await page.locator('#calendarMonth').innerText()) === '2026年10月', 'current-week calendar starts in October');
  await page.getByRole('button', { name: '下一个月', exact: true }).click();
  assert((await page.locator('#calendarMonth').innerText()) === '2026年11月', 'advance into November');
  assert(await page.locator('#weekTabs button').count() === 1, 'November shows only the Sunday in this week');
  await page.getByRole('button', { name: '上一个月', exact: true }).click();
  assert((await page.locator('#calendarMonth').innerText()) === '2026年10月', 'previous arrow returns to October');
  assert(await page.locator('#weekTabs button').count() === 6, 'October grid follows the displayed week');
  await record('cross-month arrows while menu stays on next week');
  await page.getByRole('button', { name: '下周预告', exact: true }).click();
  assert((await page.locator('#calendarMonth').innerText()) === '2026年11月', 'switching to next week selects November');
  assert(!(await page.getByRole('button', { name: '上一个月', exact: true }).isEnabled()), 'single-month week disables previous arrow');
  await page.getByRole('button', { name: '本周', exact: true }).click();
  await page.getByRole('button', { name: '下一个月', exact: true }).click();
  await page.getByRole('button', { name: '上一个月', exact: true }).click();
  assert((await page.locator('#calendarMonth').innerText()) === '2026年10月', 'round trip still works after switching week tabs');
  await record('cross-month arrows after repeated week switches');
  await page.screenshot({ path: 'output/bugfix-20261017/calendar-october.png', animations: 'disabled' });

  const restaurants = [withFood(363910), withFood(221904)];
  await seed(oneDay('2026-10-17', restaurants), '2026-10-17');
  await page.getByRole('button', { name: '教职工食堂', exact: true }).click();
  assert(await page.evaluate(() => state.meal === 'lunch' && state.date === '2026-10-17' && !state.automatic), 'manual selection remains manual');
  assert((await page.locator('#mealTabs').innerText()).includes('午餐') && !(await page.locator('#mealTabs').innerText()).includes('早餐'), 'notice-only or absent meals stay hidden');
  await record('manual selection survives restaurant changes');
  await page.clock.setSystemTime(new Date('2026-10-16T09:35:00Z'));
  await seed({ days: { '2026-10-16': { restaurants }, '2026-10-17': { restaurants: [emptyRestaurant(363910), emptyRestaurant(221904)] } } }, '2026-10-16');
  await page.evaluate(() => refreshAutomaticSelection(true));
  assert(await page.evaluate(() => state.date === '2026-10-17' && state.meal === 'breakfast' && state.automatic), 'dorm advances after 18:30');
  await page.getByRole('button', { name: '教职工食堂', exact: true }).click();
  assert(await page.evaluate(() => state.date === '2026-10-16' && state.meal === 'dinner' && state.automatic), 'staff dinner continues until 18:40');
  await record('automatic restaurant-specific deadlines');

  await seed(oneDay('2026-10-28', [{ ...emptyRestaurant(), menu_status: 'not_published' }]), '2026-10-28');
  await page.getByRole('button', { name: '한국어로 전환', exact: true }).click();
  await page.getByRole('heading', { name: '식단이 아직 게시되지 않았어요', exact: true }).waitFor();
  await record('Korean unpublished message');
  assert(errors.length === 0, 'Browser errors: ' + errors.join(', '));
  return { count: checks.length, checks, browserErrors: errors };
}
