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
    checks.push('offline navigation retains its fallback state before app listeners start');
    await page.screenshot({ path: 'output/fix-audit-20261022/offline-reload.png', animations: 'disabled' });
    await context.setOffline(false);
    await page.reload({ timeout: 15000 });
    await page.waitForFunction(() => navigator.onLine && !offlineFallback);
    checks.push('online reload clears the saved-menu fallback state');
    return { count: checks.length, checks };
  } finally {
    await context.setOffline(false);
    await other.close();
  }
}
