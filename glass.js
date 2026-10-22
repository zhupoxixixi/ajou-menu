/* Deepika adapter: preserve native controls, provide a WebKit/standalone fallback. */
'use strict';

function needsGlassFallback(userAgent = '', supportsFilter = true) {
  const blink = /(?:Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(userAgent);
  const webkit = /AppleWebKit\//.test(userAgent) && !blink;
  return !supportsFilter || webkit || /Firefox|FxiOS/.test(userAgent);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { needsGlassFallback };

if (typeof document !== 'undefined') {
  const startGlass = () => {
    const surfaces = [...document.querySelectorAll('.glass-surface')];
    const handles = [];
    const reduced = matchMedia('(prefers-reduced-transparency: reduce)');
    const cssSupport = typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url(#glass)');
    const fallback = needsGlassFallback(navigator.userAgent, cssSupport);
    let frame = 0;
    let mode = fallback ? 'frosted' : 'refraction';
    for (const surface of surfaces) {
      const layer = document.createElement('span');
      layer.className = 'glass-layer';
      layer.setAttribute('aria-hidden', 'true');
      surface.prepend(layer);
      if (fallback || typeof window.liquidGlass !== 'function') {
        layer.style.backdropFilter = 'blur(8px) saturate(1)';
        layer.style.webkitBackdropFilter = 'blur(8px) saturate(1)';
        layer.classList.add('glass-fallback');
        mode = 'frosted';
      } else {
        const handle = window.liquidGlass(layer, {
          scale: surface.classList.contains('glass-menu') ? -18 : -24,
          chroma: .4, border: .13, mapBlur: 10, blur: 0, saturate: 1, fallbackBlur: 8,
        });
        handles.push(handle);
        if (!handle.supported) mode = 'frosted';
      }
    }
    const refresh = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const handle of handles) handle.refresh();
      });
    };
    document.documentElement.dataset.glassMode = mode;
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('menu-background-change', refresh);
    window.addEventListener('resize', refresh, { passive: true });
    reduced.addEventListener?.('change', refresh);
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      for (const handle of handles) handle.destroy();
    });
    window.MenuGlass = { mode, refresh, ready: Promise.resolve(), get instanceCount() { return surfaces.length; } };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startGlass, { once: true });
  else startGlass();
}
