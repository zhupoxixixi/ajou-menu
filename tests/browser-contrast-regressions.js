async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const checks = [];
  const root = new URL('./', page.url());

  async function settleContrast() {
    await page.waitForTimeout(140);
    await page.waitForFunction(() => window.MenuContrast?.status === 'applied');
  }

  async function sampleSourceYs(height) {
    await page.setViewportSize({ width: 390, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return page.evaluate(() => {
      const container = document.querySelector('.glass-menu');
      const backdrop = document.getElementById('glassBackdrop');
      const rect = container.getBoundingClientRect();
      const background = backdrop.getBoundingClientRect();
      const left = Math.max(background.left, rect.left);
      const right = Math.min(background.right, rect.right);
      const top = Math.max(background.top, rect.top);
      const bottom = Math.min(background.bottom, rect.bottom);
      const area = right > left && bottom > top
        ? { left, top, width: right - left, height: bottom - top }
        : { left: background.left, top: background.top, width: background.width, height: background.height };
      const scale = Math.max(background.width / 390, background.height / 1400);
      const offsetY = (background.height - 1400 * scale) / 2;
      const ys = [];
      for (let row = 0; row < 5; row++) {
        for (let column = 0; column < 6; column++) {
          const viewportY = area.top + area.height * (row + 0.5) / 5;
          ys.push((viewportY - background.top - offsetY) / scale);
        }
      }
      return ys.sort((a, b) => a - b);
    });
  }

  const median = values => values[Math.floor(values.length / 2)];

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('?lang=cn&contrast-regression=1', root).href);
  await page.locator('#menuHeading').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !!window.MenuContrast && !!window.MenuBackground);
  await page.evaluate(() => window.MenuBackground.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const originalPageState = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      glassStyle: html.dataset.glassStyle,
      customBackground: html.getAttribute('data-custom-background'),
      backgroundImage: html.style.getPropertyValue('--menu-background-image'),
      appearanceStyle: window.MenuAppearance?.style,
      savedGlassStyle: localStorage.getItem('menuGlassStyle'),
    };
  });

  try {
  const baselineYs = await sampleSourceYs(844);
  const largeHeightYs = await sampleSourceYs(1400);
  const thresholdHeight = 844 + Math.max(160, 844 * 0.25);
  const baselineMedian = median(baselineYs);
  const largeHeightMedian = median(largeHeightYs);
  assert(baselineYs.length === 30 && largeHeightYs.length === 30, 'the glass menu yields all 30 contrast sample positions');
  assert(baselineMedian > largeHeightMedian, 'the fixed cover image maps the 844px samples below the 1400px samples');
  const splitY = (baselineMedian + largeHeightMedian) / 2;
  assert(splitY > 0 && splitY < 1400, 'the computed white/black split falls inside the 390x1400 image');
  await sampleSourceYs(844);

  await page.evaluate(async split => {
    const canvas = document.createElement('canvas');
    canvas.width = 390;
    canvas.height = 1400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000';
    context.fillRect(0, split, canvas.width, canvas.height - split);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Unable to create the contrast fixture image');
    const url = URL.createObjectURL(blob);
    window.__contrastFixtureUrls = [url];
    const html = document.documentElement;
    html.dataset.glassStyle = 'transparent';
    html.dataset.customBackground = 'true';
    html.style.setProperty('--menu-background-image', `url("${url}")`);
    window.dispatchEvent(new Event('menu-background-change'));
  }, splitY);

  await page.evaluate(() => {
    const original = Element.prototype.getBoundingClientRect;
    window.__contrastOriginalRect = original;
    window.__contrastMenuRectReads = 0;
    Element.prototype.getBoundingClientRect = function (...args) {
      if (this.matches?.('.glass-menu')) window.__contrastMenuRectReads++;
      return original.apply(this, args);
    };
  });
  await settleContrast();
  const at844 = await page.evaluate(() => ({
    tone: document.getElementById('menuHeading').getAttribute('data-text-tone'),
    reads: window.__contrastMenuRectReads,
  }));
  assert(at844.tone === 'light', 'the white-upper/black-lower photo selects light text at 390x844: ' + JSON.stringify(at844));
  assert(at844.reads > 0, 'the first photo analysis measures the glass menu');
  checks.push('background photo selects a light tone at 390x844');

  const initialReads = at844.reads;
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (maxScroll > 0) {
    await page.evaluate(() => window.scrollTo(0, Math.min(120, document.documentElement.scrollHeight - window.innerHeight)));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const afterScroll = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
    assert(afterScroll.tone === 'light' && afterScroll.reads === initialReads, 'scrolling keeps the cached group tone stable');
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  for (const height of [784, 844, 904]) {
    await page.setViewportSize({ width: 390, height });
    await settleContrast();
    const afterResize = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
    assert(afterResize.tone === 'light' && afterResize.reads === initialReads, `a small viewport-height change to ${height}px keeps the cached tone`);
  }
  checks.push('scroll and +/-60px height changes do not recalculate the tone');

  await page.setViewportSize({ width: 390, height: 1400 });
  await settleContrast();
  let state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.tone === 'dark', 'the same photo selects dark text after the large 390x1400 height change: ' + JSON.stringify(state));
  assert(state.reads > initialReads, 'the large height change recalculates the group tone');
  checks.push('large height change recalculates photo contrast at 390x1400');

  await page.setViewportSize({ width: 390, height: 844 });
  await settleContrast();
  state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.tone === 'light' && state.reads > initialReads + 1, 'a large return-height change recalculates the original light tone');

  for (const height of [904, 964, 1024]) {
    await page.setViewportSize({ width: 390, height });
    await settleContrast();
    state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
    assert(state.tone === 'light' && state.reads === initialReads + 2, `cumulative small height change to ${height}px stays below the original baseline threshold`);
  }
  await page.setViewportSize({ width: 390, height: thresholdHeight });
  await settleContrast();
  state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.reads === initialReads + 3, 'the cumulative 25% height change reaches the threshold and recalculates the tone: ' + JSON.stringify(state));
  checks.push('cumulative small height changes rejudge from the last invalidated baseline');

  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 390;
    canvas.height = 1400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Unable to create the replacement photo fixture');
    const url = URL.createObjectURL(blob);
    window.__contrastFixtureUrls.push(url);
    const html = document.documentElement;
    html.style.setProperty('--menu-background-image', `url("${url}")`);
    window.dispatchEvent(new Event('menu-background-change'));
  });
  await settleContrast();
  state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.tone === 'light' && state.reads === initialReads + 4, 'changing the photo recalculates and selects light text on black: ' + JSON.stringify(state));
  checks.push('changing the background photo recalculates contrast');

  await page.setViewportSize({ width: 390, height: 568 });
  await settleContrast();
  state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.reads === initialReads + 5, 'the large change establishes a new 568px baseline');
  await page.setViewportSize({ width: 390, height: 628 });
  await settleContrast();
  state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.reads === initialReads + 5, 'a 60px change stays below the 160px minimum threshold');
  await page.setViewportSize({ width: 390, height: 728 });
  await settleContrast();
  state = await page.evaluate(() => ({ tone: document.getElementById('menuHeading').getAttribute('data-text-tone'), reads: window.__contrastMenuRectReads }));
  assert(state.reads === initialReads + 6, 'a 160px change reaches the minimum height threshold');
  checks.push('height invalidation honors the 160px minimum threshold');

  await page.locator('#toolsToggle').click();
  await page.locator('#glassTranslucent').click();
  await page.waitForFunction(() => document.documentElement.dataset.glassStyle === 'translucent' &&
    !document.getElementById('menuHeading').hasAttribute('data-text-tone'));
  assert(await page.evaluate(() => window.MenuContrast.status === 'inactive'), 'a nontransparent style deactivates photo contrast');
  checks.push('switching to translucent glass clears photo-derived text tones');

  return { count: checks.length, checks };
  } finally {
    await page.evaluate(original => {
      const html = document.documentElement;
      if (window.__contrastOriginalRect) Element.prototype.getBoundingClientRect = window.__contrastOriginalRect;
      if (original.glassStyle) html.dataset.glassStyle = original.glassStyle;
      else html.removeAttribute('data-glass-style');
      if (original.customBackground === null) html.removeAttribute('data-custom-background');
      else html.setAttribute('data-custom-background', original.customBackground);
      if (original.backgroundImage) html.style.setProperty('--menu-background-image', original.backgroundImage);
      else html.style.removeProperty('--menu-background-image');
      const styleButtons = { transparent: 'glassTransparent', translucent: 'glassTranslucent', frosted: 'glassFrosted' };
      const button = styleButtons[original.appearanceStyle] && document.getElementById(styleButtons[original.appearanceStyle]);
      if (button && window.MenuAppearance?.style !== original.appearanceStyle) button.click();
      if (original.savedGlassStyle === null) localStorage.removeItem('menuGlassStyle');
      else localStorage.setItem('menuGlassStyle', original.savedGlassStyle);
      window.dispatchEvent(new Event('menu-background-change'));
      for (const url of window.__contrastFixtureUrls || []) URL.revokeObjectURL(url);
      delete window.__contrastFixtureUrls;
      delete window.__contrastOriginalRect;
      delete window.__contrastMenuRectReads;
    }, originalPageState);
  }
}
