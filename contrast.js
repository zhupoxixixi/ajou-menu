(function (win, doc) {
  'use strict';

  if (!win || !doc || !doc.documentElement) return;

  const html = doc.documentElement;
  const backdrop = doc.getElementById('glassBackdrop');
  const MAX_CANVAS_EDGE = 96;
  const DEBOUNCE_MS = 90;
  const TONE_ATTRIBUTE = 'data-text-tone';
  const GROUPS = [
    { key: 'header', root: '.site-header', targets: '.brand strong,.brand small,.header-actions button,.header-actions a' },
    { key: 'date', root: '.glass-date', targets: '#dateNavigation button' },
    { key: 'selection', root: '#selectionPanel', targets: '.control-label,#restaurantTabs button:not([aria-pressed="true"]),#mealTabs button' },
    { key: 'windows', root: '.glass-windows', targets: '#windowTabs button:not([aria-pressed="true"]),.window-scroll-cue' },
    { key: 'menu', root: '.glass-menu', targets: '#menuHeading,#dateDisplay,#serviceHours,#serviceState,.dish-name strong,.card-notices p,#emptyTitle,#emptyDescription,#shareButton' },
    { key: 'metadata', root: '.nav-stats', targets: '#updatedAt,#dateCount' },
  ];
  const DARK_TEXT = [16, 36, 60];
  const LIGHT_TEXT = [247, 250, 255];
  const reducedTransparency = win.matchMedia?.('(prefers-reduced-transparency: reduce)');

  let generation = 0;
  let timer = null;
  let pixelCache = null;
  let pendingPixels = null;
  let tonedElements = new Set();
  let status = 'inactive';
  let toneUrl = null;
  let toneLayout = null;
  const groupTones = new Map();

  function isActive() {
    return html.dataset.glassStyle === 'transparent' && html.dataset.customBackground === 'true' && !reducedTransparency?.matches;
  }

  function backgroundUrl() {
    if (!isActive() || !html.style) return null;
    const value = html.style.getPropertyValue('--menu-background-image').trim();
    const match = value.match(/^url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)$/i);
    if (!match) return null;
    const url = (match[1] || match[2] || match[3] || '').trim();
    if (!url.startsWith('blob:')) return null;
    try {
      const parsed = new win.URL(url);
      if (parsed.protocol !== 'blob:' || parsed.origin !== win.location.origin) return null;
      return url;
    } catch (_) {
      return null;
    }
  }

  function clearTones() {
    for (const element of tonedElements) {
      try { element.removeAttribute(TONE_ATTRIBUTE); } catch (_) {}
    }
    tonedElements.clear();
  }

  function deactivate(nextStatus = 'inactive') {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
    generation++;
    clearTones();
    pixelCache = null;
    pendingPixels = null;
    status = nextStatus;
  }

  function parseColor(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].trim().split(/[\s,\/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const rgb = parts.slice(0, 3).map(part => {
      const parsed = Number.parseFloat(part);
      return part.endsWith('%') ? Math.max(0, Math.min(255, parsed * 2.55)) : Math.max(0, Math.min(255, parsed));
    });
    const alpha = parts.length > 3 ? Math.max(0, Math.min(1, Number.parseFloat(parts[3]))) : 1;
    if (rgb.some(channel => !Number.isFinite(channel)) || !Number.isFinite(alpha)) return null;
    return { rgb, alpha };
  }

  function blend(foreground, background, alpha) {
    return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
  }

  function backdropBaseColor() {
    const fallback = [255, 255, 255];
    try {
      const base = parseColor(win.getComputedStyle(backdrop || html).backgroundColor);
      return base ? blend(base.rgb, fallback, base.alpha) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readPixels(url) {
    return new Promise((resolve, reject) => {
      let image;
      try {
        image = new win.Image();
        image.onload = () => {
          try {
            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;
            if (!(width > 0 && height > 0)) throw new Error('Empty background image');
            const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height));
            const canvasWidth = Math.max(1, Math.round(width * scale));
            const canvasHeight = Math.max(1, Math.round(height * scale));
            const canvas = doc.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) throw new Error('Canvas context unavailable');
            context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
            const pixels = context.getImageData(0, 0, canvasWidth, canvasHeight).data;
            resolve({ url, width, height, canvasWidth, canvasHeight, pixels });
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = () => reject(new Error('Background image could not be decoded'));
        image.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }

  function getPixels(url) {
    if (pixelCache && pixelCache.url === url) return Promise.resolve(pixelCache);
    if (pendingPixels && pendingPixels.url === url) return pendingPixels.promise;

    const record = { url, promise: null };
    record.promise = readPixels(url).then(data => {
      if (pendingPixels === record) pendingPixels = null;
      if (isActive() && backgroundUrl() === url) pixelCache = data;
      return data;
    }, error => {
      if (pendingPixels === record) pendingPixels = null;
      throw error;
    });
    pendingPixels = record;
    return record.promise;
  }

  function layoutChanged(width, height) {
    const breakpoint = width < 640 ? 'phone' : width < 900 ? 'tablet' : 'desktop';
    const orientation = width > height ? 'landscape' : 'portrait';
    if (!toneLayout || breakpoint !== toneLayout.breakpoint || orientation !== toneLayout.orientation || Math.abs(width - toneLayout.width) >= 160) {
      toneLayout = { width, breakpoint, orientation };
      return true;
    }
    return false;
  }

  function groupPoints(container, backgroundRect) {
    const rect = container.getBoundingClientRect();
    // The wallpaper is fixed to the viewport; keep both rectangles in that
    // coordinate space. The cached group tone stays locked during scrolling.
    const left = Math.max(backgroundRect.left, rect.left);
    const right = Math.min(backgroundRect.right, rect.right);
    const top = Math.max(backgroundRect.top, rect.top);
    const bottom = Math.min(backgroundRect.bottom, rect.bottom);
    const area = right > left && bottom > top
      ? { left, top, width: right - left, height: bottom - top }
      : backgroundRect;
    const points = [];
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column < 6; column++) {
        points.push({ x: area.left + area.width * (column + 0.5) / 6, y: area.top + area.height * (row + 0.5) / 5 });
      }
    }
    return points;
  }

  function pixelColor(point, image, backgroundRect, baseColor) {
    const scale = Math.max(backgroundRect.width / image.width, backgroundRect.height / image.height);
    if (!(scale > 0 && Number.isFinite(scale))) return null;
    const offsetX = (backgroundRect.width - image.width * scale) / 2;
    const offsetY = (backgroundRect.height - image.height * scale) / 2;
    const imageX = (point.x - backgroundRect.left - offsetX) / scale;
    const imageY = (point.y - backgroundRect.top - offsetY) / scale;
    if (imageX < 0 || imageY < 0 || imageX >= image.width || imageY >= image.height) return null;

    const x = Math.min(image.canvasWidth - 1, Math.floor(imageX * image.canvasWidth / image.width));
    const y = Math.min(image.canvasHeight - 1, Math.floor(imageY * image.canvasHeight / image.height));
    const offset = (y * image.canvasWidth + x) * 4;
    const rgba = image.pixels;
    const alpha = rgba[offset + 3] / 255;
    return blend([rgba[offset], rgba[offset + 1], rgba[offset + 2]], baseColor, alpha);
  }

  function luminance(rgb) {
    const channels = rgb.map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastRatio(textColor, backgroundColor) {
    const text = luminance(textColor);
    const background = luminance(backgroundColor);
    return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  }

  function toneFor(container, image, backgroundRect, baseColor) {
    const points = groupPoints(container, backgroundRect);
    if (!points.length) return null;
    let darkScore = 0;
    let lightScore = 0;
    let count = 0;
    for (const point of points) {
      const background = pixelColor(point, image, backgroundRect, baseColor);
      if (!background) continue;
      darkScore += contrastRatio(DARK_TEXT, background);
      lightScore += contrastRatio(LIGHT_TEXT, background);
      count++;
    }
    if (!count) return null;
    return lightScore > darkScore ? 'light' : 'dark';
  }

  function applyTones(image) {
    const viewportWidth = win.innerWidth || html.clientWidth;
    const viewportHeight = win.innerHeight || html.clientHeight;
    if (!(viewportWidth > 0 && viewportHeight > 0)) {
      clearTones();
      status = 'unavailable';
      return;
    }
    const baseColor = backdropBaseColor();
    const backgroundRect = backdrop?.getBoundingClientRect() || { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight, width: viewportWidth, height: viewportHeight };
    const changedLayout = layoutChanged(viewportWidth, viewportHeight);
    if (toneUrl !== image.url || changedLayout) {
      groupTones.clear();
      toneUrl = image.url;
    }
    const nextToned = new Set();
    const changes = [];
    for (const group of GROUPS) {
      const container = doc.querySelector(group.root);
      if (!container) continue;
      let tone = groupTones.get(group.key);
      if (!tone) {
        tone = toneFor(container, image, backgroundRect, baseColor);
        if (!tone) continue;
        groupTones.set(group.key, tone);
      }
      for (const element of container.querySelectorAll(group.targets)) {
        changes.push([element, tone]);
        nextToned.add(element);
      }
    }
    // Measure all text first; colour writes must not interrupt the layout reads.
    for (const [element, tone] of changes) {
      if (element.getAttribute(TONE_ATTRIBUTE) !== tone) element.setAttribute(TONE_ATTRIBUTE, tone);
    }
    for (const previous of tonedElements) {
      if (!nextToned.has(previous)) previous.removeAttribute(TONE_ATTRIBUTE);
    }
    tonedElements = nextToned;
    status = 'applied';
  }

  async function refresh(runId) {
    if (runId !== generation) return;
    if (!isActive()) {
      deactivate('inactive');
      return;
    }
    const url = backgroundUrl();
    if (!url) {
      clearTones();
      pixelCache = null;
      pendingPixels = null;
      status = 'unavailable';
      return;
    }

    status = 'loading';
    try {
      const image = await getPixels(url);
      if (runId !== generation) return;
      if (!isActive() || backgroundUrl() !== url) {
        schedule();
        return;
      }
      applyTones(image);
    } catch (_) {
      if (runId === generation) {
        clearTones();
        pixelCache = null;
        pendingPixels = null;
        status = 'error';
      }
    }
  }

  function schedule() {
    generation++;
    const runId = generation;
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
    if (!isActive()) {
      deactivate('inactive');
      return;
    }
    status = 'pending';
    timer = win.setTimeout(() => {
      timer = null;
      void refresh(runId);
    }, DEBOUNCE_MS);
  }

  win.addEventListener('menu-background-change', schedule);
  win.addEventListener('resize', schedule, { passive: true });
  reducedTransparency?.addEventListener?.('change', schedule);

  if (typeof win.MutationObserver === 'function') {
    const rootObserver = new win.MutationObserver(schedule);
    rootObserver.observe(html, {
      attributes: true,
      attributeFilter: ['data-glass-style', 'data-custom-background', 'lang'],
    });

    const contentObserver = new win.MutationObserver(schedule);
    const contentRoots = [
      doc.querySelector('.site-header'),
      doc.getElementById('dateNavigation'),
      doc.getElementById('selectionPanel'),
      doc.getElementById('windowTabs'),
      doc.querySelector('.card-header'),
      doc.getElementById('menuContent'),
      doc.getElementById('emptyState'),
      doc.querySelector('.nav-stats'),
    ].filter(Boolean);
    for (const root of contentRoots) {
      contentObserver.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'hidden', 'class'],
      });
    }
  }

  win.MenuContrast = Object.freeze({
    get status() {
      return status;
    },
  });
  schedule();
})(typeof window === 'undefined' ? null : window, typeof document === 'undefined' ? null : document);
