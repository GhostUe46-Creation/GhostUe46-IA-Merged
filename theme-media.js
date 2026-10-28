/* GhostUe46 · Imagen de fondo, icono del sitio propio y set de iconos por tema.
   Todo se guarda SOLO en este navegador (IndexedDB + localStorage). */
(function () {
  const PREF_KEY = 'ghost_media_prefs_v1';
  const ICONS_BY_THEME = { 'default': 'thin', 'liquid-glass': 'thin', 'material-you': 'duo', 'aurora': 'bold', 'frutiger-aero': 'ginger', 'assassins-creed-2': 'animus', 'synthwave': 'neon' };
  const ICON_LABELS = { thin: 'Contorno fino', duo: 'Bicolor', bold: 'Trazo grueso', ginger: 'Android 2.3', animus: 'Animus', neon: 'Neón', none: 'Originales' };
  const ALLOWED = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png', 'image/webp'];
  const EXT_OK = /\.(jpe?g|png|webp)$/i; // algunos sistemas no informan el tipo del archivo: se acepta por extensión
  const MAX_BYTES = 40 * 1024 * 1024;
  const root = document.documentElement;
  let bgUrl = null;

  const defaults = { bgDim: 35, bgBlur: 0, customIcons: 'duo', bgEnabled: true, uiGlass: 45, uiGlassTouched: false, bubbleShape: 'auto', bgName: '' };
  const readPrefs = () => { try { return { ...defaults, ...(JSON.parse(localStorage.getItem(PREF_KEY)) || {}) }; } catch (e) { return { ...defaults }; } };
  let prefs = readPrefs();
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* almacenamiento lleno */ } };
  const $ = id => document.getElementById(id);
  const toast = (msg, type) => { try { typeof showToast === 'function' && showToast(msg, type || 'theme', 'Imagen'); } catch (e) {} };

  /* ---------- IndexedDB ---------- */
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('ghost_media', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('img');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(key) { const d = await db(); return new Promise((res, rej) => { const q = d.transaction('img').objectStore('img').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
  async function idbSet(key, val) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('img', 'readwrite'); t.objectStore('img').put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  async function idbDel(key) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('img', 'readwrite'); t.objectStore('img').delete(key); t.oncomplete = res; t.onerror = () => rej(t.error); }); }

  /* ---------- Procesado de imágenes ---------- */
  function loadImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen (¿archivo dañado?).')); };
      img.src = url;
    });
  }
  function checkFile(file) {
    if (!file) return 'No se eligió ningún archivo.';
    const type = String(file.type || '').toLowerCase();
    const typeOk = ALLOWED.includes(type) || ((!type || type === 'application/octet-stream') && EXT_OK.test(file.name || ''));
    if (!typeOk) return 'Formato no admitido. Usa JPG, PNG o WebP.';
    if (file.size <= 0) return 'El archivo está vacío.';
    if (file.size > MAX_BYTES) return 'La imagen pesa más de 40 MB.';
    return '';
  }
  const toBlob = (canvas, type, q) => new Promise(r => canvas.toBlob(r, type, q));
  async function resizeToBlob(file, maxSide) {
    const img = await loadImage(file);
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return (await toBlob(c, 'image/webp', 0.86)) || (await toBlob(c, 'image/jpeg', 0.86));
  }
  async function squareIconDataUrl(file) {
    const img = await loadImage(file);
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 128, 128);
    return c.toDataURL('image/png');
  }

  /* ---------- Fondo ---------- */
  function ensureLayer() {
    let el = $('user-bg-layer');
    if (!el) { el = document.createElement('div'); el.id = 'user-bg-layer'; el.setAttribute('aria-hidden', 'true'); document.body.insertBefore(el, document.body.firstChild); }
    return el;
  }
  function applyBackground() {
    const layer = ensureLayer();
    const on = !!bgUrl && prefs.bgEnabled;
    root.toggleAttribute('data-user-bg', on);
    layer.style.backgroundImage = on ? `url("${bgUrl}")` : 'none';
    layer.style.setProperty('--ubg-dim', String(Math.max(0, Math.min(85, prefs.bgDim)) / 100));
    layer.style.setProperty('--ubg-blur', Math.max(0, Math.min(24, prefs.bgBlur)) + 'px');
    const prev = $('bg-image-preview');
    if (prev) { prev.style.backgroundImage = bgUrl ? `url("${bgUrl}")` : 'none'; prev.classList.toggle('has-image', !!bgUrl); prev.textContent = bgUrl ? '' : 'Sin imagen'; }
    const info = $('bg-image-info'); if (info) info.textContent = bgUrl ? ('Imagen activa' + (prefs.bgName ? ': ' + prefs.bgName : '') + (prefs.bgEnabled ? '' : ' (oculta)')) : '';
    applyUiGlass();
    const rm = $('bg-image-remove'); if (rm) rm.disabled = !bgUrl;
    const tg = $('bg-image-enabled'); if (tg) { tg.checked = prefs.bgEnabled; tg.disabled = !bgUrl; }
  }
  /* ---------- Transparencia de la interfaz (0 = invisible, 100 = cristal muy borroso) ---------- */
  function applyUiGlass() {
    const active = (!!bgUrl && prefs.bgEnabled) || prefs.uiGlassTouched;
    root.toggleAttribute('data-ui-glass', active);
    const v = Math.max(0, Math.min(100, Number(prefs.uiGlass))); const t = v / 100;
    const light = root.dataset.mode === 'light';
    const set = (k, val) => root.style.setProperty(k, String(val));
    set('--ug-rgb', light ? '236,246,255' : '10,16,34');
    set('--ug-edge', light ? '255,255,255' : '255,255,255');
    set('--ug-a', (0.66 * t).toFixed(3));
    set('--ug-blur', (54 * Math.pow(t, 1.1)).toFixed(1) + 'px');
    set('--ug-sat', (1 + 0.7 * t).toFixed(2));
    set('--ug-border', (0.2 * t).toFixed(3));
    set('--ug-shadow', (0.5 * t).toFixed(3));
    set('--ug-gloss', t.toFixed(2));
    // Las ondas especulares tienen un mínimo para que Liquid Glass siga pareciendo cristal
    // incluso cuando el panel base está casi invisible o el blur es muy alto.
    set('--ug-ripple-opacity', Math.max(0.28, Math.min(0.66, 0.28 + 0.36 * t)).toFixed(3));
    const k = Math.max(0, 1 - v / 45) * 0.8; // con la interfaz casi invisible, una sombra suave mantiene legible el texto
    set('--ug-text-shadow', k > 0.02 ? `0 1px 4px ${light ? 'rgba(255,255,255,' : 'rgba(0,0,0,'}${k.toFixed(2)})` : 'none');
    const r = $('ui-glass-range'); if (r && Number(r.value) !== v) r.value = v;
    const l = $('ui-glass-val'); if (l) l.textContent = v + '%';
    const st = $('ui-glass-state'); if (st) st.textContent = active ? (prefs.uiGlassTouched ? 'Activa (la ajustaste tú)' : 'Activa por tu imagen de fondo') : 'Sin aplicar: se usa el cristal original del tema';
  }

  async function setBackground(file) {
    const err = checkFile(file);
    if (err) return toast(err, 'error');
    let blob;
    try { blob = await resizeToBlob(file, 1920); } catch (e) { blob = null; }
    // Si no se pudo reducir (formato raro del navegador), se usa el archivo tal cual mientras no sea enorme.
    if (!blob) { if (file.size <= 15 * 1024 * 1024) blob = file; else return toast('No se pudo leer esa imagen. Prueba con otra o con una más pequeña.', 'error'); }
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    bgUrl = URL.createObjectURL(blob);
    prefs.bgEnabled = true; prefs.bgName = String(file.name || '').slice(0, 60); savePrefs(); applyBackground();
    toast('Imagen de fondo aplicada. Si no la ves, sube la «Transparencia de la interfaz» hacia 0 %.');
    try { await idbSet('bg', blob); }
    catch (e) { console.warn('IndexedDB no disponible:', e); toast('La imagen se aplicó, pero tu navegador no la pudo guardar: al recargar se perderá.', 'error'); }
  }
  async function removeBackground() {
    try { await idbDel('bg'); } catch (e) {}
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    bgUrl = null; prefs.bgName = ''; savePrefs(); applyBackground(); toast('Imagen de fondo quitada.');
  }

  /* ---------- Icono del sitio ---------- */
  function setFavicon(href) {
    const link = $('site-icon-link'); if (!link) return;
    link.type = href ? 'image/png' : 'image/svg+xml';
    link.href = href || 'assets/site-icon.svg';
    document.querySelectorAll('link[rel="icon"][sizes]').forEach(l => { l.disabled = !!href; });
    const prev = $('site-icon-preview'); if (prev) prev.src = href || 'assets/site-icon.svg';
    const rm = $('site-icon-remove'); if (rm) rm.disabled = !href;
  }
  async function setSiteIcon(file) {
    const err = checkFile(file);
    if (err) return toast(err, 'error');
    try { const url = await squareIconDataUrl(file); await idbSet('favicon', url); setFavicon(url); toast('Icono del sitio cambiado.'); }
    catch (e) { console.error(e); toast('No se pudo usar esa imagen como icono.', 'error'); }
  }
  async function removeSiteIcon() { try { await idbDel('favicon'); } catch (e) {} setFavicon(null); toast('Icono del sitio restaurado.'); }

  /* ---------- Iconos por tema ---------- */
  function applyIcons() {
    const theme = root.dataset.theme || 'default';
    const set = theme === 'custom' ? (prefs.customIcons || 'duo') : (ICONS_BY_THEME[theme] || 'thin');
    root.dataset.icons = set;
    const lab = $('icon-set-current'); if (lab) lab.textContent = ICON_LABELS[set] || set;
    root.dataset.bubbleShape = ['round', 'cut', 'square'].includes(prefs.bubbleShape) ? prefs.bubbleShape : 'auto';
    if (root.dataset.bubbleShape === 'auto') root.removeAttribute('data-bubble-shape');
    else root.setAttribute('data-bubble-shape', root.dataset.bubbleShape);
    document.querySelectorAll('[data-bubble-shape-chip]').forEach(b => { const a = b.dataset.bubbleShapeChip === (prefs.bubbleShape || 'auto'); b.classList.toggle('selected', a); b.setAttribute('aria-pressed', String(a)); });
    document.querySelectorAll('[data-icon-set]').forEach(b => { const a = b.dataset.iconSet === prefs.customIcons; b.classList.toggle('selected', a); b.setAttribute('aria-pressed', String(a)); });
  }

  function wire() {
    const pick = (id, fn) => { const el = $(id); if (el) el.addEventListener('change', () => { const f = el.files && el.files[0]; el.value = ''; if (f) fn(f); }); };
    pick('bg-image-file', setBackground);
    pick('site-icon-file', setSiteIcon);
    $('bg-image-remove')?.addEventListener('click', removeBackground);
    $('site-icon-remove')?.addEventListener('click', removeSiteIcon);
    $('bg-image-enabled')?.addEventListener('change', e => { prefs.bgEnabled = e.target.checked; savePrefs(); applyBackground(); });
    const dim = $('bg-image-dim'), blur = $('bg-image-blur');
    const sync = () => { prefs.bgDim = Number(dim.value); prefs.bgBlur = Number(blur.value); $('bg-image-dim-val').textContent = prefs.bgDim + '%'; $('bg-image-blur-val').textContent = prefs.bgBlur + 'px'; savePrefs(); applyBackground(); };
    if (dim && blur) { dim.value = prefs.bgDim; blur.value = prefs.bgBlur; $('bg-image-dim-val').textContent = prefs.bgDim + '%'; $('bg-image-blur-val').textContent = prefs.bgBlur + 'px'; dim.addEventListener('input', sync); blur.addEventListener('input', sync); }
    const glass = $('ui-glass-range');
    if (glass) glass.addEventListener('input', () => { prefs.uiGlass = Number(glass.value); prefs.uiGlassTouched = true; savePrefs(); applyUiGlass(); });
    $('ui-glass-reset')?.addEventListener('click', () => { prefs.uiGlass = defaults.uiGlass; prefs.uiGlassTouched = false; savePrefs(); applyUiGlass(); toast('Transparencia restablecida.'); });
    document.querySelectorAll('[data-bubble-shape-chip]').forEach(b => b.addEventListener('click', () => { prefs.bubbleShape = b.dataset.bubbleShapeChip; savePrefs(); applyIcons(); }));
    document.querySelectorAll('[data-icon-set]').forEach(b => b.addEventListener('click', () => { prefs.customIcons = b.dataset.iconSet; savePrefs(); applyIcons(); }));
    // Drag & drop sobre las zonas de subida
    ['bg-image-drop', 'site-icon-drop'].forEach(id => {
      const z = $(id); if (!z) return;
      z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('drag'); });
      z.addEventListener('dragleave', () => z.classList.remove('drag'));
      z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) (id === 'bg-image-drop' ? setBackground : setSiteIcon)(f); });
    });
  }

  /* ---------- API para copias de seguridad y temas guardados ---------- */
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const IMG_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  window.GhostMedia = {
    getCustomIcons: () => prefs.customIcons,
    setCustomIcons(set) { if (!['thin', 'duo', 'bold', 'ginger', 'animus', 'neon', 'none'].includes(set)) return; prefs.customIcons = set; savePrefs(); applyIcons(); },
    async exportMedia() {
      const out = { bg: null, favicon: null };
      try { const bg = await idbGet('bg'); if (bg) out.bg = await blobToDataUrl(bg); } catch (e) {}
      try { const fav = await idbGet('favicon'); if (typeof fav === 'string') out.favicon = fav; } catch (e) {}
      return out;
    },
    async importMedia(media) {
      if (!media) return;
      try {
        if (typeof media.bg === 'string' && IMG_DATA_URL.test(media.bg)) await idbSet('bg', await (await fetch(media.bg)).blob());
        if (typeof media.favicon === 'string' && IMG_DATA_URL.test(media.favicon)) await idbSet('favicon', media.favicon);
      } catch (e) { console.warn('No se pudo restaurar la imagen:', e); }
    }
  };

  async function init() {
    wire();
    new MutationObserver(() => { applyIcons(); applyUiGlass(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    applyIcons(); applyBackground(); applyUiGlass();
    try {
      const bg = await idbGet('bg'); if (bg) { bgUrl = URL.createObjectURL(bg); applyBackground(); }
      const fav = await idbGet('favicon'); if (fav) setFavicon(fav);
    } catch (e) { console.warn('IndexedDB no disponible: la imagen no se guardará.', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
