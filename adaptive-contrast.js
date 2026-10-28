/* GhostUe46 · Contraste de texto automático según el fondo real de cada elemento.
   No modifica bloques de código, editores, SVG ni textos con degradado propio. */
(() => {
  'use strict';
  const root = document.documentElement;
  const attr = 'data-g46-auto-contrast';
  const protectedSelector = [
    'script', 'style', 'noscript', 'svg', 'canvas', 'img', 'video', 'audio', 'iframe',
    'pre', 'code', 'kbd', 'samp', '#code-editor-input', '#editor-console', '#mini-debug-chat',
    '.hljs', '.token', '.typing-dots', '.status-fade', '#typing-indicator-text',
    '[data-no-auto-contrast]', '.g46-code-block', '.code-block'
  ].join(',');
  const colorToken = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[\da-f]{3,8}\b/gi;
  const scratch = document.createElement('canvas');
  const ctx = scratch.getContext('2d', { willReadFrequently: true });

  function parseColor(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (!s || s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const h = s.match(/^#([\da-f]{3,8})$/i);
    if (h) {
      let x = h[1];
      if (x.length === 3 || x.length === 4) x = x.split('').map(c => c + c).join('');
      if (x.length === 6) x += 'ff';
      if (x.length !== 8) return null;
      return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: parseInt(x.slice(6, 8), 16) / 255 };
    }
    const rgb = s.match(/^rgba?\((.*)\)$/);
    if (rgb) {
      const parts = rgb[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
      if (parts.length < 3) return null;
      const channel = v => v.endsWith('%') ? Math.max(0, Math.min(255, parseFloat(v) * 2.55)) : Math.max(0, Math.min(255, parseFloat(v)));
      const alpha = parts[3] == null ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
      return { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1)) };
    }
    const hsl = s.match(/^hsla?\((.*)\)$/);
    if (hsl) {
      const p = hsl[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
      if (p.length < 3) return null;
      let hue = ((parseFloat(p[0]) % 360) + 360) % 360 / 360;
      const sat = Math.max(0, Math.min(1, parseFloat(p[1]) / 100));
      const light = Math.max(0, Math.min(1, parseFloat(p[2]) / 100));
      const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
      let r, g, b;
      if (!sat) r = g = b = light;
      else { const q = light < .5 ? light * (1 + sat) : light + sat - light * sat; const pp = 2 * light - q; r = hue2rgb(pp, q, hue + 1 / 3); g = hue2rgb(pp, q, hue); b = hue2rgb(pp, q, hue - 1 / 3); }
      const aRaw = p[3]; const a = aRaw == null ? 1 : (aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : parseFloat(aRaw));
      return { r: r * 255, g: g * 255, b: b * 255, a: Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1)) };
    }
    // Fallback for named CSS colors supported by the browser.
    if (ctx) {
      ctx.fillStyle = '#010203'; ctx.fillStyle = s;
      const normalized = ctx.fillStyle;
      if (normalized !== '#010203' || s === '#010203') return parseColor(normalized);
    }
    return null;
  }
  function tokenColors(image) {
    if (!image || image === 'none') return [];
    const matches = image.match(colorToken) || [];
    return matches.map(parseColor).filter(c => c && c.a > .015);
  }
  const blend = (top, base) => {
    const a = top.a == null ? 1 : top.a;
    return { r: top.r * a + base.r * (1 - a), g: top.g * a + base.g * (1 - a), b: top.b * a + base.b * (1 - a), a: 1 };
  };
  function average(colors) {
    if (!colors.length) return { r: 7, g: 12, b: 28, a: 1 };
    return colors.reduce((acc, c) => ({ r: acc.r + c.r / colors.length, g: acc.g + c.g / colors.length, b: acc.b + c.b / colors.length, a: 1 }), { r: 0, g: 0, b: 0, a: 1 });
  }
  function luminance(c) {
    const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b);
  }
  function compact(colors) {
    const unique = [];
    for (const c of colors) {
      if (!unique.some(x => Math.abs(x.r - c.r) < 7 && Math.abs(x.g - c.g) < 7 && Math.abs(x.b - c.b) < 7)) unique.push(c);
    }
    if (unique.length <= 32) return unique;
    const reduced = [];
    for (let i = 0; i < 32; i++) reduced.push(unique[Math.round(i * (unique.length - 1) / 31)]);
    return reduced;
  }
  function paintLayer(samples, element) {
    const cs = getComputedStyle(element);
    let out = samples;
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg.a >= .98) out = [{ r: bg.r, g: bg.g, b: bg.b, a: 1 }];
    else if (bg && bg.a > .015) out = out.map(c => blend(bg, c));

    const tokens = tokenColors(cs.backgroundImage);
    if (tokens.length) {
      const base = average(out);
      const painted = tokens.map(c => blend(c, base));
      const hasOpaque = tokens.some(c => c.a >= .9);
      const hasTransparentAreas = /transparent/i.test(cs.backgroundImage) || tokens.some(c => c.a < .9);
      if (hasOpaque) out = hasTransparentAreas ? compact([...painted, ...out]) : compact(painted);
      else out = compact([...out, ...painted]);
    }
    return out;
  }
  function backgroundPalette(element, cache) {
    if (cache.has(element)) return cache.get(element);
    const parent = element.parentElement;
    const theme = root.dataset.theme || 'default';
    const fallback = theme === 'frutiger-aero' ? { r: 175, g: 232, b: 248, a: 1 } : { r: 7, g: 12, b: 28, a: 1 };
    const inherited = parent ? backgroundPalette(parent, cache) : [fallback];
    const palette = element.nodeType === 1 ? paintLayer(inherited, element) : inherited;
    cache.set(element, palette);
    return palette;
  }
  function contrastMode(element, paletteCache) {
    const palette = backgroundPalette(element, paletteCache);
    const mean = palette.reduce((sum, c) => sum + luminance(c), 0) / Math.max(1, palette.length);
    // On mixed/gradient surfaces the opposing outline improves edge clarity without changing the theme itself.
    const luminances = palette.map(luminance);
    const spread = Math.max(...luminances) - Math.min(...luminances);
    return { mode: mean >= .43 ? 'dark' : 'light', colorful: spread >= .32 };
  }
  function hasDirectText(element) {
    for (const node of element.childNodes) if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) return true;
    return false;
  }
  function isProtected(element) {
    if (element.closest(protectedSelector)) return true;
    const cs = getComputedStyle(element);
    if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') return true;
    if (cs.webkitTextFillColor && parseColor(cs.webkitTextFillColor)?.a === 0) return true;
    if (element.classList.contains('g46-tts-message-button')) return true;
    return false;
  }
  function setContrast(element, paletteCache) {
    if (!(hasDirectText(element) || element.matches('input:not([type="file"]), textarea, select'))) return;
    if (isProtected(element)) return;
    const { mode, colorful } = contrastMode(element, paletteCache);
    if (element.getAttribute(attr) === mode && element.dataset.g46AutoColorful === String(colorful)) return;
    element.setAttribute(attr, mode);
    element.dataset.g46AutoColorful = String(colorful);
    const color = mode === 'dark' ? '#101827' : '#f8fafc';
    element.style.setProperty('color', color, 'important');
    if (colorful) {
      const outline = mode === 'dark' ? 'rgba(255,255,255,.42)' : 'rgba(0,0,0,.58)';
      if (element.dataset.g46AutoTextShadow === '1' || !element.style.getPropertyValue('text-shadow')) {
        element.style.setProperty('text-shadow', `0 1px 2px ${outline}, 0 0 1px ${outline}`, 'important');
        element.dataset.g46AutoTextShadow = '1';
      }
    } else if (element.dataset.g46AutoTextShadow === '1') {
      element.style.removeProperty('text-shadow');
      delete element.dataset.g46AutoTextShadow;
    }
  }
  function refresh() {
    try {
      const paletteCache = new WeakMap();
      document.querySelectorAll('body *').forEach(element => setContrast(element, paletteCache));
      root.dataset.g46AdaptiveContrast = 'on';
    } catch (error) { console.warn('[GhostUe46] Contraste adaptativo:', error); }
  }
  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 90); }

  const domObserver = new MutationObserver(schedule);
  function connectObserver() {
    if (!document.body) return;
    domObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-mode', 'data-state', 'data-bubbles', 'data-bubble-shape', 'data-ui-glass'] });
    const themeObserver = new MutationObserver(schedule);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-bubbles', 'data-bubble-shape', 'data-ui-glass', 'style'] });
    document.addEventListener('input', event => { if (event.target && event.target.closest && event.target.closest('#config-modal')) schedule(); }, true);
    document.addEventListener('change', event => { if (event.target && event.target.closest && event.target.closest('#config-modal')) schedule(); }, true);
    window.addEventListener('resize', schedule, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule).catch(() => {});
    refresh();
    window.GhostAdaptiveContrast = { refresh: schedule };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connectObserver, { once: true });
  else connectObserver();
})();
