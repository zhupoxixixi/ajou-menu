const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ROOT = 'https://example.test/ajou-menu/';

function worker(network = async () => new Response('new')) {
  const events = {}, stores = new Map(), messages = [], clients = [], lifetimeTasks = [];
  let nextClientId = 0;
  const createClient = (available = true) => {
    const client = {
      id: `test-client-${++nextClientId}`,
      url: ROOT,
      messages: [],
      postMessage(message) { this.messages.push(message); messages.push({ client: this, message }); },
    };
    if (available) clients.push(client);
    return client;
  };
  const registerClient = client => { if (!clients.includes(client)) clients.push(client); };
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
  const clientAPI = {
    claim: async () => {},
    get: async id => clients.find(client => client.id === id),
  };
  const context = { URL, Request, Response, AbortController, setTimeout, clearTimeout, caches: storage, fetch: network,
    self: { location: { href: ROOT + 'sw.js' }, addEventListener: (name, handler) => events[name] = handler, skipWaiting: async () => {}, clients: clientAPI } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'), 'utf8'), context);
  const dispatch = async (name, details = {}) => {
    let responseTask, waitTask;
    events[name]({ ...details,
      waitUntil: promise => { lifetimeTasks.push(promise); waitTask = promise; },
      respondWith: promise => responseTask = promise,
    });
    return responseTask ?? waitTask;
  };
  return { dispatch, stores, storage, messages, clients, clientAPI, lifetimeTasks, createClient, registerClient };
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
  const page = app.createClient();
  for (const path of ['?date=2026-10-16&meal=lunch', 'menu-data.js?v=new']) {
    const client = path.startsWith('?') ? { resultingClientId: page.id } : { clientId: page.id };
    const response = await app.dispatch('fetch', { request: new Request(ROOT + path), ...client });
    assert.equal(await response.text(), 'saved');
  }
  assert.equal(app.messages.length, 2);
  assert.ok(app.messages.every(entry => entry.client === page));
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

test('CacheStorage.open failure does not block a healthy network response', async () => {
  let networkCalls = 0;
  const app = worker(async () => { networkCalls++; return new Response('fresh'); }); await app.dispatch('install');
  app.storage.open = async () => { throw new Error('CacheStorage unavailable'); };
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') });
  assert.equal(await response.text(), 'fresh');
  assert.equal(networkCalls, 1);
});

test('cache match is not consulted when the network response is healthy', async () => {
  const app = worker(); await app.dispatch('install');
  const open = app.storage.open;
  app.storage.open = async name => ({ ...(await open(name)), match: async () => { throw new Error('Cache read failed'); } });
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') });
  assert.equal(await response.text(), 'new');
});

test('cache open failure leaves an offline request as a normal failed response', async () => {
  const app = worker(async () => { throw new Error('Offline'); }); await app.dispatch('install');
  app.storage.open = async () => { throw new Error('CacheStorage unavailable'); };
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') });
  assert.equal(response.type, 'error');
});

test('cache match failure leaves an offline request as a normal failed response', async () => {
  const app = worker(async () => { throw new Error('Offline'); }); await app.dispatch('install');
  const open = app.storage.open;
  app.storage.open = async name => ({ ...(await open(name)), match: async () => { throw new Error('Cache read failed'); } });
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') });
  assert.equal(response.type, 'error');
});

test('an offline request without a saved response fails normally', async () => {
  const app = worker(async () => { throw new Error('Offline'); }); await app.dispatch('install');
  const menuCache = [...app.stores.values()][0];
  menuCache.delete(ROOT + 'menu-data.js');
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js') });
  assert.equal(response.type, 'error');
});
test('requests outside the meal app scope are never intercepted', async () => {
  const app = worker();
  for (const url of ['https://example.test/ajou-notices/', 'https://other.test/ajou-menu/menu-data.js', ROOT + 'private.json']) {
    assert.equal(await app.dispatch('fetch', { request: new Request(url) }), undefined);
  }
});
test('offline fallback messages reach only the requesting client', async () => {
  const app = worker(async () => { throw new Error('Offline'); }); await app.dispatch('install');
  const affected = app.createClient();
  const healthy = app.createClient();
  const response = await app.dispatch('fetch', { request: new Request(ROOT + 'menu-data.js'), clientId: affected.id });
  assert.equal(await response.text(), 'saved');
  assert.equal(affected.messages.length, 1);
  assert.equal(affected.messages[0].type, 'menu-offline-fallback');
  assert.equal(healthy.messages.length, 0);
  const query = async client => {
    let status;
    await app.dispatch('message', { source: client, data: { type: 'menu-cache-status' }, ports: [{ postMessage: value => status = value }] });
    return status;
  };
  assert.equal((await query(affected)).fallback, true);
  assert.equal((await query(healthy)).fallback, false);
});

test('navigation fallback is found by status query when its client is not yet available', async () => {
  let online = false;
  const app = worker(async () => { if (!online) throw new Error('Connection failed'); return new Response('new'); });
  await app.dispatch('install');
  const navigation = app.createClient(false);
  await app.dispatch('fetch', { request: new Request(ROOT), resultingClientId: navigation.id });
  assert.deepEqual(navigation.messages, []);
  app.registerClient(navigation);
  let status;
  const inspect = () => app.dispatch('message', { source: navigation, data: { type: 'menu-cache-status' }, ports: [{ postMessage: value => status = value }] });
  await inspect(); assert.equal(status.fallback, true);
  online = true;
  await app.dispatch('fetch', { request: new Request(ROOT), resultingClientId: navigation.id });
  await inspect(); assert.equal(status.fallback, false);
});

test('a pending navigation client lookup does not block the cached response', async () => {
  const app = worker(async () => { throw new Error('Offline'); }); await app.dispatch('install');
  const navigation = app.createClient(false);
  const get = app.clientAPI.get;
  let resolveClient;
  let lookedUpId;
  const pendingClient = new Promise(resolve => { resolveClient = resolve; });
  app.clientAPI.get = id => {
    lookedUpId = id;
    return id === navigation.id ? pendingClient : get(id);
  };

  let timeout;
  const response = await Promise.race([
    app.dispatch('fetch', { request: new Request(ROOT), resultingClientId: navigation.id }),
    new Promise(resolve => { timeout = setTimeout(() => resolve(null), 1000); }),
  ]);
  clearTimeout(timeout);
  assert.ok(response, 'the saved navigation response should not wait for clients.get()');
  assert.equal(await response.text(), 'saved');
  assert.equal(lookedUpId, navigation.id);
  assert.equal(navigation.messages.length, 0);

  const notificationTask = app.lifetimeTasks.at(-1);
  assert.ok(notificationTask, 'the notification is tracked as an event lifetime task');
  app.registerClient(navigation);
  resolveClient(navigation);
  await notificationTask;
  assert.equal(navigation.messages.length, 1);
  assert.equal(navigation.messages[0].type, 'menu-offline-fallback');
});
