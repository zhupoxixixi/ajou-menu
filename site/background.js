(function (root, factory) {
  const runtime = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = runtime.helpers;
  } else if (root && root.document && root.document.documentElement) {
    runtime.start(root, root.document);
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  const MAX_IMAGE_EDGE = 2048;
  const QUALITY = 0.86;
  const DATABASE_NAME = 'ajou-menu-background';
  const STORE_NAME = 'preferences';
  const RECORD_KEY = 'custom';
  const BACKGROUND_PROPERTY = '--menu-background-image';
  const PRESET_STORAGE_KEY = 'menuBackgroundStyle';

  const COPY = {
    ko: {
      title: '배경 이미지',
      hint: '기기에서 이미지를 선택하면 이 브라우저에 저장됩니다. 이미지는 서버로 전송되지 않습니다.',
      choose: '이미지 선택',
      reset: '기본 배경으로 복원',
      white: '흰색 배경',
      busy: '이미지를 처리하고 있습니다…',
      saved: '이 기기에 저장된 배경을 불러왔습니다.',
      applied: '배경을 적용하고 이 기기에 저장했습니다.',
      temporary: '배경을 적용했습니다. 브라우저가 저장하지 못해 페이지를 떠나면 사라집니다.',
      resetDone: '기본 배경으로 복원했습니다.',
      whiteDone: '흰색 배경으로 변경했습니다.',
      presetTemporary: '배경을 변경했지만 이 브라우저에 설정을 저장하지 못했습니다.',
      whiteFailed: '흰색 배경을 적용했지만 저장된 이미지를 지우지 못했습니다.',
      resetFailed: '현재 페이지는 기본 배경으로 복원했지만 저장된 이미지를 지우지 못했습니다.',
      invalid: '사용할 수 있는 이미지 파일을 선택해 주세요.',
      failed: '이미지를 처리하지 못했습니다. 다른 파일을 선택해 주세요.',
      restoreFailed: '저장된 배경을 불러오지 못했습니다. 기본 배경을 표시합니다.',
    },
    zh: {
      title: '背景图片',
      hint: '选择设备中的图片后会保存在此浏览器中。图片不会上传到服务器。',
      choose: '选择图片',
      reset: '恢复默认背景',
      white: '纯白背景',
      busy: '正在处理图片…',
      saved: '已载入此设备保存的背景。',
      applied: '背景已应用并保存在此设备。',
      temporary: '背景已应用，但浏览器无法保存；离开页面后将不会保留。',
      resetDone: '已恢复默认背景。',
      whiteDone: '已切换为纯白背景。',
      presetTemporary: '背景已切换，但此浏览器无法保存设置。',
      whiteFailed: '已切换为纯白背景，但无法删除本机保存的图片。',
      resetFailed: '当前页面已恢复默认背景，但无法删除本机保存的图片。',
      invalid: '请选择可用的图片文件。',
      failed: '无法处理这张图片，请尝试其他文件。',
      restoreFailed: '无法载入已保存的背景，当前显示默认背景。',
    },
  };

  function fitImageSize(width, height, limit = MAX_IMAGE_EDGE) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
        !Number.isFinite(limit) || limit <= 0) return null;
    const scale = Math.min(1, limit / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function localeFromLanguage(language) {
    return typeof language === 'string' && language.toLowerCase().startsWith('zh') ? 'zh' : 'ko';
  }

  function getCopy(language) {
    return COPY[localeFromLanguage(language)];
  }

  function isSupportedImageFile(file) {
    if (!file || typeof file.type !== 'string') return false;
    const mime = file.type.toLowerCase();
    return mime.startsWith('image/') && mime !== 'image/svg+xml';
  }

  function isEncodedImage(blob, mime) {
    return Boolean(blob && blob.size > 0 && blob.type === mime &&
      (mime === 'image/webp' || mime === 'image/jpeg'));
  }

  function start(win, doc) {
    const html = doc.documentElement;
    const input = doc.getElementById('backgroundFile');
    const chooseButton = doc.getElementById('backgroundChoose');
    const resetButton = doc.getElementById('backgroundReset');
    const whiteButton = doc.getElementById('backgroundWhite');
    const title = doc.getElementById('backgroundTitle');
    const hint = doc.getElementById('backgroundHint');
    const status = doc.getElementById('backgroundStatus');
    let activeObjectUrl = null;
    let operation = 0;
    let databasePromise = null;

    function applyPreset(style, persist = false) {
      html.setAttribute('data-background-style', style === 'white' ? 'white' : 'pattern');
      if (persist) {
        try { win.localStorage.setItem(PRESET_STORAGE_KEY, style); }
        catch (_) { return false; }
      }
      return true;
    }
    try { applyPreset(win.localStorage.getItem(PRESET_STORAGE_KEY)); }
    catch (_) { applyPreset('pattern'); }

    function copy() {
      return getCopy(html.getAttribute('lang'));
    }

    function setStatus(key) {
      if (status) status.textContent = copy()[key] || '';
    }

    function updateLanguage() {
      const text = copy();
      if (title) title.textContent = text.title;
      if (hint) hint.textContent = text.hint;
      if (chooseButton) chooseButton.textContent = text.choose;
      if (resetButton) resetButton.textContent = text.reset;
      if (whiteButton) whiteButton.textContent = text.white;
      if (status && status.dataset.statusKey) {
        status.textContent = text[status.dataset.statusKey] || '';
      }
    }

    function showStatus(key) {
      if (!status) return;
      status.dataset.statusKey = key;
      setStatus(key);
    }

    function notifyChange() {
      try {
        win.dispatchEvent(new win.Event('menu-background-change'));
      } catch (_) {
        // A missing event implementation must not interrupt background changes.
      }
    }

    function applyObjectUrl(url) {
      html.style.setProperty(BACKGROUND_PROPERTY, `url("${url}")`);
      html.setAttribute('data-custom-background', 'true');
      const previous = activeObjectUrl;
      activeObjectUrl = url;
      notifyChange();
      if (previous && previous !== url) {
        try { win.URL.revokeObjectURL(previous); } catch (_) {}
      }
    }

    function clearObjectUrl() {
      html.style.removeProperty(BACKGROUND_PROPERTY);
      html.removeAttribute('data-custom-background');
      const previous = activeObjectUrl;
      activeObjectUrl = null;
      notifyChange();
      if (previous) {
        try { win.URL.revokeObjectURL(previous); } catch (_) {}
      }
    }

    function openDatabase() {
      if (!win.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable'));
      if (databasePromise) return databasePromise;

      let request;
      try {
        request = win.indexedDB.open(DATABASE_NAME, 1);
      } catch (error) {
        return Promise.reject(error);
      }

      let settled = false;
      const opened = new Promise((resolve, reject) => {
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onerror = () => {
          if (settled) return;
          settled = true;
          reject(request.error || new Error('Unable to open background storage'));
        };
        request.onblocked = () => {
          if (settled) return;
          settled = true;
          reject(new Error('Background storage is blocked'));
        };
        request.onsuccess = () => {
          const db = request.result;
          if (settled) {
            db.close();
            return;
          }
          settled = true;
          db.onversionchange = () => db.close();
          resolve(db);
        };
      });

      databasePromise = opened.catch(error => {
        databasePromise = null;
        throw error;
      });
      return databasePromise;
    }

    async function runTransaction(mode, action) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        let tx;
        let request;
        let result;
        let settled = false;
        const fail = error => {
          if (settled) return;
          settled = true;
          reject(error || new Error('Background storage operation failed'));
        };
        try {
          tx = db.transaction(STORE_NAME, mode);
          request = action(tx.objectStore(STORE_NAME));
        } catch (error) {
          fail(error);
          return;
        }
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => fail(request.error);
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        tx.onerror = () => fail(tx.error);
        tx.onabort = () => fail(tx.error);
      });
    }

    function saveBlob(blob) {
      return runTransaction('readwrite', store => store.put(blob, RECORD_KEY));
    }

    function readBlob() {
      return runTransaction('readonly', store => store.get(RECORD_KEY));
    }

    function removeSavedBlob() {
      return runTransaction('readwrite', store => store.delete(RECORD_KEY));
    }

    function canvasToBlob(canvas, mime) {
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')), mime, QUALITY);
        } catch (error) {
          reject(error);
        }
      });
    }

    async function encodeCanvas(canvas) {
      try {
        const webp = await canvasToBlob(canvas, 'image/webp');
        if (isEncodedImage(webp, 'image/webp')) return webp;
      } catch (_) {
        // Fall through to JPEG for browsers without WebP canvas encoding.
      }

      let jpegCanvas = canvas;
      try {
        jpegCanvas = doc.createElement('canvas');
        jpegCanvas.width = canvas.width;
        jpegCanvas.height = canvas.height;
        const context = jpegCanvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
        context.drawImage(canvas, 0, 0);
      } catch (_) {
        jpegCanvas = canvas;
      }
      const jpeg = await canvasToBlob(jpegCanvas, 'image/jpeg');
      if (!isEncodedImage(jpeg, 'image/jpeg')) throw new Error('JPEG encoding is unavailable');
      return jpeg;
    }

    async function loadBitmap(file) {
      if (typeof win.createImageBitmap === 'function') {
        try {
          const bitmap = await win.createImageBitmap(file);
          try {
            return await drawResized(bitmap, bitmap.width, bitmap.height);
          } finally {
            if (typeof bitmap.close === 'function') bitmap.close();
          }
        } catch (_) { /* The normal image decoder may support more formats. */ }
      }

      const sourceUrl = win.URL.createObjectURL(file);
      try {
        const image = await new Promise((resolve, reject) => {
          const element = new win.Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error('Image decoding failed'));
          element.src = sourceUrl;
        });
        return await drawResized(image, image.naturalWidth || image.width, image.naturalHeight || image.height);
      } finally {
        win.URL.revokeObjectURL(sourceUrl);
      }
    }

    function drawResized(source, width, height) {
      const dimensions = fitImageSize(width, height);
      if (!dimensions) return Promise.reject(new Error('Invalid image dimensions'));
      const canvas = doc.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext('2d');
      if (!context) return Promise.reject(new Error('Canvas is unavailable'));
      context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
      return encodeCanvas(canvas);
    }

    async function validateStoredImage(blob) {
      if (typeof win.createImageBitmap === 'function') {
        const bitmap = await win.createImageBitmap(blob);
        if (typeof bitmap.close === 'function') bitmap.close();
        return;
      }
      const sourceUrl = win.URL.createObjectURL(blob);
      try {
        await new Promise((resolve, reject) => {
          const image = new win.Image();
          image.onload = resolve;
          image.onerror = () => reject(new Error('Saved background could not be decoded'));
          image.src = sourceUrl;
        });
      } finally {
        win.URL.revokeObjectURL(sourceUrl);
      }
    }

    async function selectFile(file) {
      if (!file) return;
      const version = ++operation;
      if (!isSupportedImageFile(file)) {
        showStatus('invalid');
        return;
      }
      showStatus('busy');

      let candidateUrl;
      try {
        const compressed = await loadBitmap(file);
        if (version !== operation) return;
        candidateUrl = win.URL.createObjectURL(compressed);
        let persisted = true;
        try {
          await saveBlob(compressed);
        } catch (_) {
          persisted = false;
        }
        if (version !== operation) {
          win.URL.revokeObjectURL(candidateUrl);
          return;
        }
        applyObjectUrl(candidateUrl);
        candidateUrl = null;
        showStatus(persisted ? 'applied' : 'temporary');
      } catch (_) {
        if (candidateUrl) {
          try { win.URL.revokeObjectURL(candidateUrl); } catch (_) {}
        }
        if (version === operation) showStatus('failed');
      }
    }

    async function reset(style = 'pattern') {
      style = style === 'white' ? 'white' : 'pattern';
      const version = ++operation;
      const persisted = applyPreset(style, true);
      clearObjectUrl();
      try {
        await removeSavedBlob();
        if (version !== operation) return false;
        showStatus(persisted ? (style === 'white' ? 'whiteDone' : 'resetDone') : 'presetTemporary');
        return true;
      } catch (_) {
        if (version !== operation) return false;
        showStatus(style === 'white' ? 'whiteFailed' : 'resetFailed');
        return false;
      }
    }

    if (input) {
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (file) void selectFile(file);
      });
    }
    if (chooseButton && input) chooseButton.addEventListener('click', () => input.click());
    if (resetButton) resetButton.addEventListener('click', () => { void reset(); });
    if (whiteButton) whiteButton.addEventListener('click', () => { void reset('white'); });
    updateLanguage();

    if (typeof win.MutationObserver === 'function') {
      const observer = new win.MutationObserver(updateLanguage);
      observer.observe(html, { attributes: true, attributeFilter: ['lang'] });
    }

    const ready = (async () => {
      const version = operation;
      try {
        const blob = await readBlob();
        if (version !== operation) return false;
        if (!blob) return true;
        if (!blob.type || !blob.type.startsWith('image/') || blob.size <= 0) {
          showStatus('restoreFailed');
          return false;
        }
        await validateStoredImage(blob);
        if (version !== operation) return false;
        const url = win.URL.createObjectURL(blob);
        if (version !== operation) {
          win.URL.revokeObjectURL(url);
          return false;
        }
        applyObjectUrl(url);
        showStatus('saved');
        return true;
      } catch (_) {
        if (version === operation) showStatus('restoreFailed');
        return false;
      }
    })();

    const controller = { ready, reset, selectFile };
    win.MenuBackground = controller;
    return controller;
  }

  return {
    helpers: {
      MAX_IMAGE_EDGE,
      fitImageSize,
      localeFromLanguage,
      getCopy,
      isSupportedImageFile,
      isEncodedImage,
    },
    start,
  };
});
