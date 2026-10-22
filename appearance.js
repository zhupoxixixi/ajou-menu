(function (win, doc) {
  'use strict';

  if (typeof module === 'object' && module.exports) return;
  if (!win || !doc || !doc.documentElement) return;

  const STORAGE_KEY = 'menuGlassStyle';
  const html = doc.documentElement;
  const title = doc.getElementById('glassStyleTitle');
  const clearButton = doc.getElementById('glassClear');
  const frostedButton = doc.getElementById('glassFrosted');
  const labels = {
    zh: { title: '玻璃效果', clear: '清透', frosted: '磨砂' },
    ko: { title: '유리 효과', clear: '투명', frosted: '반투명' },
  };
  let selectedStyle = 'clear';

  function isStyle(value) {
    return value === 'clear' || value === 'frosted';
  }

  function currentLabels() {
    const language = html.getAttribute('lang') || '';
    return language.toLowerCase().startsWith('zh') ? labels.zh : labels.ko;
  }

  function updateLabels() {
    const copy = currentLabels();
    if (title) title.textContent = copy.title;
    if (clearButton) clearButton.textContent = copy.clear;
    if (frostedButton) frostedButton.textContent = copy.frosted;
  }

  function updatePressedState() {
    if (clearButton) clearButton.setAttribute('aria-pressed', String(selectedStyle === 'clear'));
    if (frostedButton) frostedButton.setAttribute('aria-pressed', String(selectedStyle === 'frosted'));
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
    if (isStyle(savedStyle)) selectedStyle = savedStyle;
  } catch (_) {
    selectedStyle = 'clear';
  }

  html.dataset.glassStyle = selectedStyle;
  updateLabels();
  updatePressedState();

  if (clearButton) clearButton.addEventListener('click', () => applyStyle('clear', true));
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
