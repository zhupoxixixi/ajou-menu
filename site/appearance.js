(function (win, doc) {
  'use strict';

  if (typeof module === 'object' && module.exports) return;
  if (!win || !doc || !doc.documentElement) return;

  const STORAGE_KEY = 'menuGlassStyle';
  const html = doc.documentElement;
  const title = doc.getElementById('glassStyleTitle');
  const transparentButton = doc.getElementById('glassTransparent');
  const translucentButton = doc.getElementById('glassTranslucent');
  const frostedButton = doc.getElementById('glassFrosted');
  const labels = {
    zh: { title: '玻璃效果', transparent: '透明', translucent: '半透明', frosted: '磨砂' },
    ko: { title: '유리 효과', transparent: '투명', translucent: '반투명', frosted: '블러' },
  };
  const buttons = {
    transparent: transparentButton,
    translucent: translucentButton,
    frosted: frostedButton,
  };
  let selectedStyle = 'transparent';

  function isStyle(value) {
    return value === 'transparent' || value === 'translucent' || value === 'frosted';
  }

  function currentLabels() {
    const language = html.getAttribute('lang') || '';
    return language.toLowerCase().startsWith('zh') ? labels.zh : labels.ko;
  }

  function updateLabels() {
    const copy = currentLabels();
    if (title) title.textContent = copy.title;
    for (const style of Object.keys(buttons)) {
      if (buttons[style]) buttons[style].textContent = copy[style];
    }
  }

  function updatePressedState() {
    for (const [style, button] of Object.entries(buttons)) {
      if (button) button.setAttribute('aria-pressed', String(selectedStyle === style));
    }
  }

  function applyStyle(style, persist) {
    if (!isStyle(style)) return;
    selectedStyle = style;
    html.dataset.glassStyle = style;
    updatePressedState();
    if (persist) {
      try {
        win.localStorage.setItem(STORAGE_KEY, style);
      } catch (_) {
        // The selected appearance remains active for this page if storage is unavailable.
      }
    }
  }

  try {
    const savedStyle = win.localStorage.getItem(STORAGE_KEY);
    if (savedStyle === 'clear') {
      selectedStyle = 'translucent';
      try {
        win.localStorage.setItem(STORAGE_KEY, selectedStyle);
      } catch (_) {
        // Keep the migrated appearance for this page if the value cannot be rewritten.
      }
    } else if (isStyle(savedStyle)) {
      selectedStyle = savedStyle;
    }
  } catch (_) {
    selectedStyle = 'transparent';
  }

  html.dataset.glassStyle = selectedStyle;
  updateLabels();
  updatePressedState();

  if (transparentButton) transparentButton.addEventListener('click', () => applyStyle('transparent', true));
  if (translucentButton) translucentButton.addEventListener('click', () => applyStyle('translucent', true));
  if (frostedButton) frostedButton.addEventListener('click', () => applyStyle('frosted', true));

  if (typeof win.MutationObserver === 'function') {
    const observer = new win.MutationObserver(updateLabels);
    observer.observe(html, { attributes: true, attributeFilter: ['lang'] });
  }

  win.MenuAppearance = Object.freeze({
    get style() {
      return selectedStyle;
    },
  });
})(typeof window === 'undefined' ? null : window, typeof document === 'undefined' ? null : document);
