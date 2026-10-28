/* GhostUe46 · Extras: uso por proveedor, copia de seguridad, temas guardados,
   aviso de legibilidad e instalación como app (PWA).
   Todo se guarda SOLO en este navegador. Se apoya en app.js (config, sessions, applyTheme...). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const toast = (m, t, title) => { try { showToast(m, t || 'info', title); } catch (e) { /* sin toast */ } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const readLS = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('El navegador no dejó guardar (almacenamiento lleno o bloqueado).', 'error'); return false; } };
  const today = () => new Date().toISOString().slice(0, 10);
  const download = (name, text) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const readFileText = (file, max) => new Promise((res, rej) => {
    if (!file) return rej(new Error('No se eligió ningún archivo.'));
    if (file.size > max) return rej(new Error('El archivo es demasiado grande.'));
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('No se pudo leer el archivo.')); r.readAsText(file);
  });

  /* =============== 9. Uso por proveedor =============== */
  const USAGE_KEY = 'ghost_usage_providers_v1';
  const WARN_KEY = 'ghost_usage_warned_v1';
  const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' k' : String(n));
  function renderUsage() {
    const box = $('usage-table'); if (!box) return;
    const all = readLS(USAGE_KEY, {});
    const names = (window.CHAT_ENDPOINTS || {});
    const rows = Object.keys(all).sort((a, b) => (all[b].lastAt || 0) - (all[a].lastAt || 0));
    if (!rows.length) { box.innerHTML = '<p class="settings-hint" style="margin:0">Todavía no hay uso registrado. Envía un mensaje y aparecerá aquí.</p>'; return; }
    const t = today();
    box.innerHTML = '<table><thead><tr><th>Proveedor</th><th>Hoy</th><th>Total</th><th>Tokens</th><th>Errores</th></tr></thead><tbody>' + rows.map((p) => {
      const u = all[p], d = (u.days && u.days[t]) || { requests: 0 };
      const tok = (u.inTokens || 0) + (u.outTokens || 0);
      const cur = p === config.provider ? ' class="is-current"' : '';
      return `<tr${cur}><td>${esc((names[p] && names[p].name) || p.toUpperCase())}</td><td>${d.requests}</td><td>${u.requests}</td><td title="Entrada ${u.inTokens || 0} · Salida ${u.outTokens || 0}">${u.estimated ? '≈ ' : ''}${fmtNum(tok)}</td><td>${u.errors || 0}</td></tr>`;
    }).join('') + '</tbody></table>';
  }
  function checkDailyLimit() {
    const limit = Number(config.dailyMessageLimit) || 0; if (limit <= 0) return;
    const all = readLS(USAGE_KEY, {}), t = today();
    const used = Object.values(all).reduce((n, u) => n + ((u.days && u.days[t] && u.days[t].requests) || 0), 0);
    const w = readLS(WARN_KEY, { day: t, level: 0 }); if (w.day !== t) { w.day = t; w.level = 0; }
    const level = used >= limit ? 2 : used >= limit * 0.9 ? 1 : 0;
    if (level > w.level) {
      toast(level === 2 ? `Llegaste a tu límite de ${limit} mensajes de hoy.` : `Llevas ${used} de ${limit} mensajes de hoy (90 %).`, 'info', 'Aviso de uso');
      w.level = level; writeLS(WARN_KEY, w);
    }
  }
  window.addEventListener('ghost-usage-changed', () => { renderUsage(); checkDailyLimit(); });
  $('usage-reset')?.addEventListener('click', () => {
    if (!confirm('¿Reiniciar todos los contadores de uso?')) return;
    try { localStorage.removeItem(USAGE_KEY); localStorage.removeItem(WARN_KEY); } catch (e) { /* nada */ }
    renderUsage(); toast('Contadores reiniciados.');
  });

  /* =============== 3. Copia de seguridad =============== */
  const MEDIA_PREFS = 'ghost_media_prefs_v1', PRESETS_KEY = 'ghost_theme_presets_v1';
  const IMG_OK = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  function cleanSessions(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 500).filter((x) => x && typeof x.id === 'string' && Array.isArray(x.messages)).map((x) => ({
      id: String(x.id).slice(0, 80), title: String(x.title || 'Conversación').slice(0, 80), pinned: !!x.pinned, renamed: !!x.renamed,
      messages: x.messages.slice(0, 5000).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map((m) => ({
        role: m.role, content: m.content.slice(0, 200000), timestamp: Number(m.timestamp) || Date.now(),
        attachments: (Array.isArray(m.attachments) ? m.attachments : []).slice(0, 10)
          .filter((a) => a && typeof a.name === 'string' && typeof a.type === 'string' && typeof a.data === 'string')
          .map((a) => ({ name: a.name.slice(0, 120), type: a.type.slice(0, 60), data: a.type.startsWith('image/') ? (IMG_OK.test(a.data) ? a.data : '') : a.data.slice(0, 400000) }))
      }))
    }));
  }
  async function exportBackup() {
    const withKeys = !!$('backup-include-keys')?.checked;
    const cfg = JSON.parse(JSON.stringify(config));
    if (!withKeys) { delete cfg.apiKey; }
    const media = window.GhostMedia ? await window.GhostMedia.exportMedia() : { bg: null, favicon: null };
    const data = {
      app: 'GhostUe46', type: 'backup', version: 1, exportedAt: new Date().toISOString(), includesKeys: withKeys,
      sessions, currentSessionId, config: cfg,
      mediaPrefs: readLS(MEDIA_PREFS, {}), presets: readLS(PRESETS_KEY, []), usage: readLS(USAGE_KEY, {}), media
    };
    download(`ghostue46-copia-${today()}.json`, JSON.stringify(data));
    toast(withKeys ? 'Copia lista (incluye tus API Keys: guárdala en privado).' : 'Copia lista. No incluye tus API Keys.', 'export', 'Copia de seguridad');
  }
  async function importBackup(file) {
    let data;
    try { data = JSON.parse(await readFileText(file, 80 * 1024 * 1024)); } catch (e) { return toast(e.message || 'El archivo no es un JSON válido.', 'error'); }
    if (!data || data.app !== 'GhostUe46' || data.type !== 'backup' || !Array.isArray(data.sessions)) return toast('Ese archivo no es una copia de GhostUe46.', 'error');
    const list = cleanSessions(data.sessions);
    if (!confirm(`Restaurar la copia (${list.length} conversaciones)?\nSe REEMPLAZARÁN tus chats y ajustes actuales.`)) return;
    try {
      const cfg = {};
      Object.keys(DEFAULT_CONFIG).forEach((k) => { if (data.config && k in data.config) cfg[k] = data.config[k]; });
      if (!data.includesKeys) { cfg.apiKey = config.apiKey; }
      if (cfg.customTheme) cfg.customTheme = sanitizeCustom(cfg.customTheme);
      localStorage.setItem('ghost_sessions', JSON.stringify(list));
      const cur = list.some((s) => s.id === data.currentSessionId) ? data.currentSessionId : (list[0] && list[0].id) || '';
      localStorage.setItem('ghost_current_id', cur);
      localStorage.setItem('ghost_config_v2', JSON.stringify({ ...config, ...cfg }));
      if (data.mediaPrefs && typeof data.mediaPrefs === 'object') localStorage.setItem(MEDIA_PREFS, JSON.stringify(data.mediaPrefs));
      if (Array.isArray(data.presets)) localStorage.setItem(PRESETS_KEY, JSON.stringify(data.presets.map(cleanPreset).filter(Boolean).slice(0, 50)));
      if (data.usage && typeof data.usage === 'object') localStorage.setItem(USAGE_KEY, JSON.stringify(data.usage));
      if (window.GhostMedia) await window.GhostMedia.importMedia(data.media);
    } catch (e) { console.error(e); return toast('No se pudo restaurar la copia.', 'error'); }
    toast('Copia restaurada. Recargando...', 'success', 'Listo');
    setTimeout(() => location.reload(), 900);
  }
  $('backup-export')?.addEventListener('click', exportBackup);
  $('backup-import')?.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });

  /* =============== 4. Temas guardados =============== */
  const COLOR_KEYS = ['accentPrimary', 'accentSecondary', 'bg1', 'bg2', 'panel', 'text', 'msgUser', 'msgAssistant', 'border', 'inputBg'];
  const clamp = (v, lo, hi, fb) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb; };
  function sanitizeCustom(src) {
    const o = { ...DEFAULT_CUSTOM_THEME }; src = src && typeof src === 'object' ? src : {};
    COLOR_KEYS.forEach((k) => { if (typeof src[k] === 'string' && /^#[0-9a-f]{6}$/i.test(src[k])) o[k] = src[k].toLowerCase(); });
    o.glassOpacity = clamp(src.glassOpacity, 10, 95, DEFAULT_CUSTOM_THEME.glassOpacity);
    o.blur = clamp(src.blur, 0, 40, DEFAULT_CUSTOM_THEME.blur);
    o.radius = clamp(src.radius, 8, 40, DEFAULT_CUSTOM_THEME.radius);
    o.fontScale = clamp(src.fontScale, 80, 140, 100);
    const okFont = (v) => (typeof v === 'string' && /^[\p{L}\p{N} \-]{0,60}$/u.test(v)) ? v : '';
    o.fontFamily = okFont(src.fontFamily); o.fontCustom = okFont(src.fontCustom); o.fontCode = !!src.fontCode;
    return o;
  }
  function cleanPreset(p) {
    if (!p || typeof p !== 'object' || typeof p.name !== 'string') return null;
    const icons = ['thin', 'duo', 'bold', 'ginger', 'animus', 'neon', 'none'].includes(p.icons) ? p.icons : 'duo';
    return { id: String(p.id || 'p_' + Math.random().toString(36).slice(2, 9)).replace(/[^\w-]/g, '').slice(0, 40) || 'p_' + Date.now(),
      name: p.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) || 'Tema', customTheme: sanitizeCustom(p.customTheme), icons, savedAt: Number(p.savedAt) || Date.now() };
  }
  const getPresets = () => (readLS(PRESETS_KEY, [])).map(cleanPreset).filter(Boolean);
  function renderPresets() {
    const box = $('preset-list'); if (!box) return;
    const list = getPresets();
    if (!list.length) { box.innerHTML = '<p class="settings-hint" style="margin:6px 0 0">Aún no guardaste ningún tema.</p>'; return; }
    box.innerHTML = list.map((p) => `<div class="preset-item" data-id="${esc(p.id)}">
      <span class="preset-swatch" style="background:linear-gradient(135deg,${p.customTheme.bg1},${p.customTheme.bg2})"><i style="background:${p.customTheme.accentPrimary}"></i><i style="background:${p.customTheme.accentSecondary}"></i></span>
      <span class="preset-name" title="${esc(p.name)}">${esc(p.name)}</span>
      <button type="button" class="preset-btn" data-act="apply" aria-label="Aplicar ${esc(p.name)}"><i class="fa-solid fa-check"></i></button>
      <button type="button" class="preset-btn" data-act="export" aria-label="Exportar ${esc(p.name)}"><i class="fa-solid fa-download"></i></button>
      <button type="button" class="preset-btn" data-act="delete" aria-label="Borrar ${esc(p.name)}"><i class="fa-solid fa-trash-can"></i></button></div>`).join('');
  }
  function applyPreset(p) {
    config.customTheme = sanitizeCustom(p.customTheme);
    if (window.GhostMedia) window.GhostMedia.setCustomIcons(p.icons);
    config.theme = 'custom';
    applyTheme('custom', true);
    try { syncCustomThemeControls(); updateThemeControls(); } catch (e) { /* UI cerrada */ }
    saveStorage(); scheduleContrast();
    toast(`Tema «${p.name}» aplicado.`, 'theme', 'Tema');
  }
  function savePreset() {
    const input = $('preset-name'); const name = (input.value || '').trim();
    if (!name) { input.focus(); return toast('Ponle un nombre a tu tema.', 'error'); }
    const list = getPresets(); if (list.length >= 50) return toast('Máximo 50 temas guardados.', 'error');
    const live = typeof readCustomThemeFromUI === 'function' ? readCustomThemeFromUI() : config.customTheme;
    const existing = list.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const entry = cleanPreset({ id: existing ? existing.id : 'p_' + Date.now().toString(36), name, customTheme: live, icons: window.GhostMedia ? window.GhostMedia.getCustomIcons() : 'duo' });
    writeLS(PRESETS_KEY, existing ? list.map((p) => (p.id === existing.id ? entry : p)) : [entry, ...list]);
    input.value = ''; renderPresets(); toast(existing ? 'Tema actualizado.' : 'Tema guardado.', 'success');
  }
  $('preset-save')?.addEventListener('click', savePreset);
  $('preset-name')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); savePreset(); } });
  $('preset-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn'); if (!btn) return;
    const id = btn.closest('.preset-item').dataset.id; const list = getPresets(); const p = list.find((x) => x.id === id); if (!p) return;
    if (btn.dataset.act === 'apply') applyPreset(p);
    else if (btn.dataset.act === 'export') { download(`ghostue46-tema-${p.name.replace(/[^\w-]+/g, '_')}.json`, JSON.stringify({ app: 'GhostUe46', type: 'themes', version: 1, themes: [p] }, null, 2)); }
    else if (btn.dataset.act === 'delete') { if (confirm(`¿Borrar el tema «${p.name}»?`)) { writeLS(PRESETS_KEY, list.filter((x) => x.id !== id)); renderPresets(); } }
  });
  $('preset-export-all')?.addEventListener('click', () => {
    const list = getPresets(); if (!list.length) return toast('No tienes temas guardados.', 'error');
    download(`ghostue46-mis-temas-${today()}.json`, JSON.stringify({ app: 'GhostUe46', type: 'themes', version: 1, themes: list }, null, 2));
  });
  $('preset-import')?.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = JSON.parse(await readFileText(f, 2 * 1024 * 1024));
      if (!data || data.app !== 'GhostUe46' || !Array.isArray(data.themes)) throw new Error('Ese archivo no es un tema de GhostUe46.');
      const incoming = data.themes.map(cleanPreset).filter(Boolean).slice(0, 50);
      if (!incoming.length) throw new Error('El archivo no contiene temas.');
      const list = getPresets(); const names = new Set(list.map((p) => p.name.toLowerCase()));
      incoming.forEach((p) => { let n = p.name, i = 2; while (names.has(n.toLowerCase())) n = `${p.name} (${i++})`; names.add(n.toLowerCase()); p.name = n.slice(0, 40); p.id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); list.unshift(p); });
      writeLS(PRESETS_KEY, list.slice(0, 50)); renderPresets(); toast(`${incoming.length} tema(s) importado(s).`, 'success');
    } catch (err) { toast(err.message || 'No se pudo importar.', 'error'); }
  });

  /* =============== 10. Aviso de legibilidad =============== */
  const hex2rgb = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const rgb2hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mixRGB = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
  const val = (id) => hex2rgb($(id) && $(id).value);
  function surfaces() {
    const bg1 = val('ct-bg-1'), bg2 = val('ct-bg-2'), panel = val('ct-panel'), mu = val('ct-msg-user'), ma = val('ct-msg-assistant'), inp = val('ct-input-bg');
    if (!bg1 || !bg2 || !panel) return null;
    const alpha = Math.min(0.95, Math.max(0.1, (Number($('ct-glass-opacity') && $('ct-glass-opacity').value) || 62) / 100));
    const bgAvg = mixRGB(bg1, bg2, 0.5);
    return { bg1, bg2, panelEff: mixRGB(panel, bgAvg, alpha), mu, ma, inp };
  }
  function analyze() {
    const text = val('ct-text'), acc = val('ct-accent-primary'), S = surfaces();
    if (!text || !acc || !S) return [];
    const issues = [];
    const check = (label, fg, bgc, min, fix) => { if (!fg || !bgc) return; const r = ratio(fg, bgc); if (r < min) issues.push({ label, r, min, fix }); };
    const worst = (fg, arr) => Math.min(...arr.filter(Boolean).map((b) => ratio(fg, b)));
    const wBg = worst(text, [S.bg1, S.bg2]);
    if (wBg < 4.5) issues.push({ label: 'Texto sobre el fondo', r: wBg, min: 4.5, fix: 'text' });
    check('Texto sobre los paneles', text, S.panelEff, 4.5, 'text');
    check('Texto en tus mensajes', text, S.mu, 4.5, 'text');
    check('Texto en las respuestas', text, S.ma, 4.5, 'text');
    check('Texto al escribir (caja de mensaje)', text, S.inp, 4.5, 'text');
    check('Color principal sobre los paneles (botones e iconos)', acc, S.panelEff, 3, 'accent');
    return issues;
  }
  function bestText() {
    const S = surfaces(); const list = [S.bg1, S.bg2, S.panelEff, S.mu, S.ma, S.inp].filter(Boolean);
    const cand = [[248, 250, 252], [15, 23, 42], [255, 255, 255], [0, 0, 0]];
    let best = cand[0], bs = -1;
    cand.forEach((c) => { const s = Math.min(...list.map((b) => ratio(c, b))); if (s > bs) { bs = s; best = c; } });
    return rgb2hex(best);
  }
  function fixAccent() {
    const S = surfaces(); let c = val('ct-accent-primary');
    const target = lum(S.panelEff) < 0.4 ? [255, 255, 255] : [0, 0, 0]; // sobre fondo oscuro se aclara; sobre claro se oscurece
    for (let i = 0; i < 25 && ratio(c, S.panelEff) < 3.2; i++) c = mixRGB(target, c, 0.12);
    return rgb2hex(c);
  }
  function setColor(id, hex) { const el = $(id); if (!el) return; el.value = hex; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  let contrastTimer = 0;
  function scheduleContrast() { clearTimeout(contrastTimer); contrastTimer = setTimeout(renderContrast, 80); }
  function renderContrast() {
    const box = $('ct-contrast-box'), ok = $('ct-contrast-ok'), list = $('ct-contrast-list');
    if (!box || !ok || !list) return;
    const panel = $('full-custom-theme-panel');
    if (!panel || panel.classList.contains('hidden') || panel.offsetParent === null) { box.classList.add('hidden'); ok.classList.add('hidden'); return; }
    const issues = analyze();
    box.classList.toggle('hidden', issues.length === 0); ok.classList.toggle('hidden', issues.length !== 0);
    list.innerHTML = issues.map((i) => `<li>${esc(i.label)}: <b>${i.r.toFixed(1)}:1</b> <small>(mínimo recomendado ${i.min}:1)</small></li>`).join('');
  }
  $('ct-contrast-fix')?.addEventListener('click', () => {
    const issues = analyze();
    if (issues.some((i) => i.fix === 'text')) setColor('ct-text', bestText());
    if (analyze().some((i) => i.fix === 'accent')) setColor('ct-accent-primary', fixAccent());
    scheduleContrast(); toast(analyze().length ? 'Mejoré lo que pude; prueba también cambiar los fondos.' : 'Colores corregidos para que se lean bien.', 'theme', 'Legibilidad');
  });
  ['input', 'change', 'click'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.target && e.target.closest && e.target.closest('#config-modal')) scheduleContrast(); }, true));
  new MutationObserver(scheduleContrast).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* =============== 8. PWA =============== */
  let deferred = null;
  function pwaStatus(text, canInstall) { const s = $('pwa-status'), b = $('pwa-install'); if (s) s.textContent = text; if (b) b.disabled = !canInstall; }
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) pwaStatus('Ya estás usando GhostUe46 como aplicación.', false);
  else if (!/^https?:$/.test(location.protocol)) pwaStatus('Para instalarla, abre el sitio desde https:// o localhost (no desde un archivo).', false);
  else pwaStatus('Si tu navegador lo permite, aparecerá el botón activo. En iPhone: Compartir > Añadir a pantalla de inicio.', false);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; pwaStatus('Lista para instalar como aplicación.', true); });
  window.addEventListener('appinstalled', () => { deferred = null; pwaStatus('¡Instalada! Búscala en tus aplicaciones.', false); });
  $('pwa-install')?.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* cancelado */ } deferred = null; $('pwa-install').disabled = true; });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker no registrado:', e)));
  }

  /* =============== Inicio =============== */
  renderUsage(); renderPresets(); scheduleContrast();
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-action="openConfigModal"]')) { renderUsage(); renderPresets(); scheduleContrast(); } });
})();
