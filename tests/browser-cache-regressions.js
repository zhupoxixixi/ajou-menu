async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const checks = [];
  const root = new URL('./', page.url());
  await page.goto(new URL('?lang=cn&tab=A', root).href);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller && offlineState === 'cacheReady');
  const context = page.context();
  const worker = context.serviceWorkers().find(value => value.url() === new URL('sw.js', root).href);
  assert(worker, 'service worker is active');
  const other = await context.newPage();
  try {
    await other.goto(new URL('?lang=cn&tab=B', root).href);
    await other.waitForFunction(() => !!navigator.serviceWorker.controller && offlineState === 'cacheReady');
    await worker.evaluate(() => {
      globalThis.__testOriginalOpen = caches.open.bind(caches);
      caches.open = async () => { throw new Error('Injected CacheStorage failure'); };
    });
    try {
      const status = await page.evaluate(async () => (await fetch('menu-data.js?cache-unavailable=1')).status);
      assert(status === 200, 'a cache-open error must not block a healthy network response');
      assert(await page.evaluate(() => !offlineFallback), 'a cache-open error alone is not an offline fallback');
      checks.push('cache storage failure preserves network menu');
    } finally {
      await worker.evaluate(() => { caches.open = globalThis.__testOriginalOpen; delete globalThis.__testOriginalOpen; });
    }

    await worker.evaluate(() => {
      globalThis.__testOriginalFetch = self.fetch.bind(self);
      self.fetch = (input, init) => String(input.url || input).includes('single-tab-failure=1')
        ? Promise.reject(new Error('Injected network failure for tab A')) : globalThis.__testOriginalFetch(input, init);
    });
    try {
      assert(await page.evaluate(async () => (await fetch('menu-data.js?single-tab-failure=1')).status) === 200, 'tab A uses its saved menu');
      await page.waitForFunction(() => offlineFallback);
      // Allow cross-tab postMessage delivery before checking the unaffected tab.
      await other.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
      const unaffected = await other.evaluate(async () => ({ online: navigator.onLine, fallback: offlineFallback,
        status: (await fetch('menu-data.js?healthy-tab=1')).status }));
      assert(unaffected.online && !unaffected.fallback && unaffected.status === 200, 'tab B remains online when only tab A falls back');
      checks.push('fallback notification stays in the affected tab');
    } finally {
      await worker.evaluate(() => { self.fetch = globalThis.__testOriginalFetch; delete globalThis.__testOriginalFetch; });
    }

    await context.setOffline(true);
    await page.reload({ timeout: 15000 });
    await page.waitForFunction(() => !navigator.onLine && typeof offlineState !== 'undefined' && offlineState !== 'cachePending', null, { timeout: 10000 });
    const savedState = await page.evaluate(() => ({ fallback: offlineFallback, cache: offlineState }));
    assert(savedState.fallback && savedState.cache === 'cacheReady', 'offline reload retains ready cache and fallback: ' + JSON.stringify(savedState));
    assert(await page.locator('#dataStatus').isVisible(), 'an offline reload displays its saved-data banner');
    assert(await page.locator('#dataStatus').innerText() === '当前处于离线状态，显示已保存菜单；联网后可刷新查看最新安排。', 'offline banner explains the saved menu in Chinese');
    checks.push('offline navigation retains its fallback state before app listeners start');

    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('#toolsToggle').click();
    await page.locator('#refreshButton').click();
    const chineseFeedback = await page.evaluate(() => {
      const status = document.getElementById('refreshStatus'), dialog = document.getElementById('toolsDialog');
      const statusRect = status.getBoundingClientRect(), dialogRect = dialog.getBoundingClientRect();
      const buttonRect = document.getElementById('refreshButton').getBoundingClientRect();
      return { text: status.textContent, visible: !status.hidden && statusRect.width > 0 && statusRect.height > 0,
        reachable: statusRect.top >= dialogRect.top && statusRect.bottom <= dialogRect.bottom,
        belowButton: statusRect.top >= buttonRect.bottom,
        describedBy: document.getElementById('refreshButton').getAttribute('aria-describedby') };
    });
    assert(chineseFeedback.visible && chineseFeedback.reachable && chineseFeedback.belowButton, 'offline refresh feedback is visible below its button and reachable in the small-screen dialog');
    assert(chineseFeedback.text === '当前处于离线状态，无法刷新菜单。请联网后重试。', 'offline refresh feedback is localized in Chinese');
    assert(chineseFeedback.describedBy === 'refreshStatus', 'refresh button describes its inline status');
    checks.push('small-screen offline refresh feedback is inline, reachable, and localized');
    await page.screenshot({ path: 'output/repair-glass-20261023/offline-refresh-feedback-mobile.png', animations: 'disabled' });

    await page.locator('[data-close="toolsDialog"]').click();
    await page.locator('#langToggle').click();
    assert(await page.locator('#dataStatus').innerText() === '인터넷에 연결되지 않아 저장된 메뉴를 표시합니다. 새 메뉴와 변경 사항은 연결 후 새로고침해 주세요.', 'offline banner is localized in Korean');
    await page.locator('#toolsToggle').click();
    assert(await page.locator('#refreshStatus').innerText() === '오프라인에서는 메뉴를 새로고침할 수 없습니다. 인터넷에 연결된 후 다시 시도해 주세요.', 'existing offline refresh feedback follows a language change without another click');
    await page.screenshot({ path: 'output/repair-glass-20261023/offline-refresh-feedback-mobile-ko.png', animations: 'disabled' });

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine && offlineFallback
      && document.getElementById('dataStatus').innerText === '저장된 메뉴를 표시하고 있습니다. 최신 메뉴를 보려면 새로고침해 주세요.');
    assert(await page.locator('#dataStatus').innerText() === '저장된 메뉴를 표시하고 있습니다. 최신 메뉴를 보려면 새로고침해 주세요.', 'reconnecting keeps the saved-menu fallback and switches to its online banner');
    assert(await page.locator('#refreshStatus').isHidden(), 'reconnecting clears the offline-only refresh feedback');
    checks.push('reconnection preserves fallback until an online navigation');
    await page.screenshot({ path: 'output/repair-glass-20261023/reconnected-cached-menu.png', animations: 'disabled' });
    await page.reload({ timeout: 15000 });
    await page.waitForFunction(() => navigator.onLine && !offlineFallback);
    assert(await page.locator('#dataStatus').isHidden(), 'online reload clears the saved-menu fallback banner when data is fresh');
    checks.push('online reload clears the saved-menu fallback state');
    return { count: checks.length, checks };
  } finally {
    await context.setOffline(false);
    await other.close();
  }
}
