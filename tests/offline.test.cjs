const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ROOT = 'https://example.test/ajou-menu/';

function worker(network = async () => new Response('new')) {
  const events = {}, stores = new Map(), messages = [];
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const values = stores.get(name);
    return {
      match: async url => values.get(String(url))?.clone(),
      put: async (url, response) => values.set(String(url), response),
      addAll: async requests => { for (const request of requests) values.set(request.url, new Response('saved')); },
    };
  };
  const storage = { open: async name => cache(name), keys: async () => [...stores.keys()], delete: async name => stores.delete(name) };
  const context = { URL, Request, Response, AbortController, setTimeout, clearTimeout, caches: storage, fetch: network,
    self: { location: { href: ROOT + 'sw.js' }, addEventListener: (name, handler) => events[name] = handler, skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => [{ url: ROOT, postMessage: message => messages.push(message) }] } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'), 'utf8'), context);
  const dispatch = async (name, details = {}) => {
    let task;
    events[name]({ ...details, waitUntil: promise => task = promise, respondWith: promise => task = promise });
    return task;
  };
  return { dispatch, stores, storage, messages };
}

test('offline installation saves the shell and data; activation leaves notice caches alone', async () => {
  const app = worker();
  app.stores.set('ajou-notices-v2', new Map());
  app.stores.set('ajou-menu-old', new Map());
  await app.dispatch('install'); await app.dispatch('activate');
  assert.ok(app.stores.has('ajou-notices-v2'));
  assert.ok(!app.stores.has('ajou-menu-old'));
  const menu = [...app.stores.entries()].find(([key]) => key.startsWith('ajou-menu-'))[1];
  assert.ok(menu.has(ROOT)); assert.ok(menu.has(ROOT + 'menu-data.js'));
  let ready;
  await app.dispatch('message', { data: { type: 'menu-cache-status' }, ports: [{ postMessage: value => ready = value.ready }] });
  assert.equal(ready, true);
});
test('online data replaces the offline copy and supports version query strings', async () => {
  const app = worker(); await app.dispatch('install');
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js?v=new') });
  assert.equal(await response.text(), 'new');
  const menu = [...app.stores.values()][0];
  assert.equal(await menu.get(ROOT + 'menu-data.js').clone().text(), 'new');
});
test('offline shared links and versioned data fall back to cached assets and report the fallback', async () => {
  const app = worker(async () => { throw new Error('Offline'); }); await app.dispatch('install');
  for (const path of ['?date=2026-10-16&meal=lunch', 'menu-data.js?v=new']) {
    const response = await app.dispatch('fetch', { request: new Request(ROOT + path) });
    assert.equal(await response.text(), 'saved');
  }
  assert.equal(app.messages.length, 2);
});
test('temporary server errors use the saved menu while ordinary 404 responses stay 404', async () => {
  const failed = worker(async () => new Response('failed', { status: 503 })); await failed.dispatch('install');
  assert.equal(await (await failed.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') })).text(), 'saved');
  const missing = worker(async () => new Response('missing', { status: 404 })); await missing.dispatch('install');
  assert.equal((await missing.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') })).status, 404);
});
test('storage errors never hide a successful network response', async () => {
  const app = worker(); await app.dispatch('install');
  const open = app.storage.open;
  app.storage.open = async name => ({ ...(await open(name)), put: async () => { throw new Error('Quota exceeded'); } });
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') });
  assert.equal(await response.text(), 'new');
  assert.equal(app.messages.length, 0);
});
test('requests outside the meal app scope are never intercepted', async () => {
  const app = worker();
  for (const url of ['https://example.test/ajou-notices/', 'https://other.test/ajou-menu/menu-data.js', ROOT + 'private.json']) {
    assert.equal(await app.dispatch('fetch', { request: new Request(url) }), undefined);
  }
});
test('cache status reports a connection failure that preceded the page message listener', async () => {
  let online = false;
  const app = worker(async () => { if (!online) throw new Error('Connection failed'); return new Response('new'); });
  await app.dispatch('install');
  await app.dispatch('fetch', { request: new Request(ROOT), resultingClientId: 'new-page' });
  let status;
  const inspect = () => app.dispatch('message', { source: { id: 'new-page' }, data: { type: 'menu-cache-status' }, ports: [{ postMessage: value => status = value }] });
  await inspect(); assert.equal(status.fallback, true);
  online = true;
  await app.dispatch('fetch', { request: new Request(ROOT), resultingClientId: 'new-page' });
  await inspect(); assert.equal(status.fallback, false);
});
