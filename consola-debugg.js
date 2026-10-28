/*
 * GhostUe46 Console Debugger — diagnóstico exhaustivo del navegador.
 * Captura errores JS, promesas rechazadas, console.*, fetch/XHR (sin cuerpos),
 * CSS/JS cargados, CSSOM, recursos, cambios DOM, eventos de UI y estado Liquid Glass.
 *
 * Privacidad: nunca guarda valores de inputs, texto de mensajes, cuerpos de petición,
 * cookies, localStorage ni valores de encabezados. URLs eliminan query/hash y secretos.
 * En consola: GhostConsoleDebug.help(), .snapshot(), .inspect(selector), .inspectCSS(),
 * .inspectLiquidGlass(), .downloadReport(), .copyReport(), .dumpLogs(), .clear().
 */
(() => {
  'use strict';
  if (window.GhostConsoleDebug && window.GhostConsoleDebug.__installed) return;

  const VERSION = '1.0.0';
  const START = performance.now();
  const MAX_LOGS = 5000;
  const logs = [];
  const counts = { debug: 0, info: 0, warn: 0, error: 0, event: 0, network: 0, resource: 0, mutation: 0 };
  const nativeConsole = {};
  ['log', 'info', 'warn', 'error', 'debug', 'trace', 'group', 'groupCollapsed', 'groupEnd', 'table', 'time', 'timeEnd', 'count', 'assert'].forEach(k => {
    try { nativeConsole[k] = console[k].bind(console); } catch (_) { nativeConsole[k] = () => {}; }
  });
  const config = {
    enabled: true,
    verbose: true,
    captureConsole: true,
    traceEvents: true,
    traceMutations: true,
    traceNetwork: true,
    traceResources: true,
    traceCSS: true,
    maxLogs: MAX_LOGS,
    redactSensitiveData: true,
    logEveryCSSRule: false,
    logPointerMovement: false
  };

  function redactText(value) {
    let s = String(value ?? '');
    if (!config.redactSensitiveData) return s.slice(0, 2000);
    return s
      .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/ig, '$1[REDACTED]')
      .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|client_secret)\s*[=:]\s*)[^\s,;&]+/ig, '$1[REDACTED]')
      .replace(/\b(sk-or-v1-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, '[REDACTED_TOKEN]')
      .replace(/([?&](?:key|token|api_key|apikey|secret|auth|authorization|password)=)[^&#\s]*/ig, '$1[REDACTED]')
      .slice(0, 2000);
  }
  function safeURL(input) {
    try {
      const u = new URL(String(input), location.href);
      // Query/hash are omitted: API keys and prompts sometimes live there.
      return `${u.origin}${u.pathname}${u.search ? '?[query-redacted]' : ''}${u.hash ? '#[hash-omitted]' : ''}`;
    } catch (_) { return redactText(input).split('?')[0].slice(0, 300); }
  }
  function safeValue(value, depth = 0, key = '') {
    if (/^(?:password|passwd|authorization|cookie|set-cookie|api.?key|token|secret|prompt|content|message|messages|input|value|body|requestbody)$/i.test(key.replace(/[-_]/g, ''))) return '[OMITTED_FOR_PRIVACY]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      if (/url|href|src|uri|location/i.test(key)) return safeURL(value);
      return redactText(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    if (value instanceof Error) return { name: value.name, message: redactText(value.message), stack: redactText(value.stack || '').slice(0, 4000) };
    if (typeof Element !== 'undefined' && value instanceof Element) return elementSummary(value);
    if (value instanceof URL) return safeURL(value.href);
    if (typeof Request !== 'undefined' && value instanceof Request) return { type: 'Request', method: value.method, url: safeURL(value.url), mode: value.mode, credentials: value.credentials };
    if (typeof Response !== 'undefined' && value instanceof Response) return { type: 'Response', status: value.status, ok: value.ok, url: safeURL(value.url), type: value.type };
    if (depth > 3) return `[DepthLimit:${Object.prototype.toString.call(value)}]`;
    if (Array.isArray(value)) return value.slice(0, 60).map(v => safeValue(v, depth + 1));
    if (typeof value === 'object') {
      const out = {};
      let entries = [];
      try { entries = Object.entries(value).slice(0, 80); } catch (_) { return `[Unserializable:${Object.prototype.toString.call(value)}]`; }
      for (const [k, v] of entries) {
        if (/password|passwd|authorization|cookie|api.?key|token|secret|prompt|content|messages?|request.?body|response.?body|^value$/i.test(k)) out[k] = '[OMITTED_FOR_PRIVACY]';
        else out[k] = safeValue(v, depth + 1, k);
      }
      return out;
    }
    return redactText(value);
  }
  function elementSummary(el) {
    if (!el || el.nodeType !== 1) return null;
    const summary = { tag: el.tagName.toLowerCase(), id: el.id || '', classes: typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 12) : [], role: el.getAttribute('role') || '', action: el.getAttribute('data-action') || el.getAttribute('data-ui-pref') || '', ariaLabel: redactText(el.getAttribute('aria-label') || ''), title: redactText(el.getAttribute('title') || ''), connected: !!el.isConnected };
    if ((typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) || (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement) || (typeof HTMLSelectElement !== 'undefined' && el instanceof HTMLSelectElement)) {
      summary.inputType = el.type || el.tagName.toLowerCase();
      summary.inputName = el.name || '';
      summary.valueLength = typeof el.value === 'string' ? el.value.length : 0; // value itself is never logged
    }
    return summary;
  }
  function append(level, category, message, details) {
    if (!config.enabled) return null;
    const entry = { id: logs.length ? logs[logs.length - 1].id + 1 : 1, time: new Date().toISOString(), elapsedMs: Math.round(performance.now() - START), level, category, message: redactText(message), details: safeValue(details) };
    logs.push(entry);
    if (logs.length > config.maxLogs) logs.splice(0, logs.length - config.maxLogs);
    counts[level] = (counts[level] || 0) + 1;
    if (level === 'network' || level === 'resource' || level === 'mutation' || level === 'event') counts[level] = (counts[level] || 0) + 0;
    return entry;
  }
  function emit(level, category, message, details) {
    const e = append(level, category, message, details);
    if (!e) return;
    const fn = level === 'error' ? nativeConsole.error : level === 'warn' ? nativeConsole.warn : level === 'debug' ? nativeConsole.debug : nativeConsole.info;
    fn(`[GhostDebug ${e.elapsedMs}ms][${category}][${level.toUpperCase()}] ${e.message}`, e.details === undefined ? '' : e.details);
  }
  function banner() {
    nativeConsole.groupCollapsed('%c GhostUe46 · CONSOLA DEBUGGER ACTIVO ', 'background:#0891b2;color:#00111a;font-weight:900;padding:4px 8px;border-radius:4px');
    nativeConsole.info('Versión:', VERSION, 'URL:', safeURL(location.href));
    nativeConsole.info('Comandos disponibles: GhostConsoleDebug.help()');
    nativeConsole.info('Privacidad: no registra valores de inputs, texto de mensajes, cuerpos de peticiones, cookies ni almacenamiento local.');
    nativeConsole.groupEnd();
  }

  // Captura de los console.* existentes (mantiene salida normal en DevTools).
  if (config.captureConsole) {
    ['log', 'info', 'warn', 'error', 'debug', 'trace'].forEach(method => {
      const original = console[method];
      if (typeof original !== 'function') return;
      console[method] = function (...args) {
        if (config.enabled) append(method === 'trace' ? 'debug' : method, 'console', `console.${method}`, args.map(a => safeValue(a)));
        return original.apply(this, args);
      };
    });
  }

  window.addEventListener('error', event => {
    if (event.target && event.target !== window) {
      const t = event.target;
      emit('error', 'resource-error', 'No se pudo cargar un recurso', { target: elementSummary(t), url: safeURL(t.src || t.href || ''), currentSrc: safeURL(t.currentSrc || ''), readyState: t.readyState || '', naturalWidth: t.naturalWidth || undefined, naturalHeight: t.naturalHeight || undefined });
    } else {
      emit('error', 'javascript-error', event.message || 'Error JavaScript', { file: safeURL(event.filename || ''), line: event.lineno, column: event.colno, error: event.error instanceof Error ? event.error : redactText(event.error || '') });
    }
  }, true);
  window.addEventListener('unhandledrejection', event => emit('error', 'unhandled-rejection', 'Promesa rechazada sin catch', { reason: safeValue(event.reason) }));
  window.addEventListener('rejectionhandled', () => emit('warn', 'promise', 'Una promesa rechazada recibió handler tardío'));
  window.addEventListener('securitypolicyviolation', e => emit('warn', 'csp', 'Violación de Content Security Policy', { directive: e.violatedDirective, blockedURI: safeURL(e.blockedURI || ''), sourceFile: safeURL(e.sourceFile || ''), line: e.lineNumber, disposition: e.disposition }));
  window.addEventListener('online', () => emit('info', 'network-state', 'Conexión restaurada', networkState()));
  window.addEventListener('offline', () => emit('warn', 'network-state', 'Navegador sin conexión', networkState()));
  window.addEventListener('pagehide', e => emit('info', 'lifecycle', 'pagehide', { persisted: e.persisted }));
  window.addEventListener('pageshow', e => emit('info', 'lifecycle', 'pageshow', { persisted: e.persisted }));
  window.addEventListener('visibilitychange', () => emit('info', 'lifecycle', 'Cambio de visibilidad', { state: document.visibilityState }));
  window.addEventListener('hashchange', () => emit('info', 'navigation', 'Cambio de hash', { url: safeURL(location.href) }));
  window.addEventListener('resize', () => { if (config.verbose) emit('debug', 'viewport', 'Viewport cambiado', viewport()); }, { passive: true });

  function networkState() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return { online: navigator.onLine, connectionType: c?.type || null, effectiveType: c?.effectiveType || null, downlinkMbps: c?.downlink ?? null, rttMs: c?.rtt ?? null, saveData: c?.saveData ?? null };
  }
  function viewport() { return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1, screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth }, orientation: screen.orientation?.type || '', visualViewport: window.visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale, offsetTop: visualViewport.offsetTop, offsetLeft: visualViewport.offsetLeft } : null }; }
  function runtime() {
    let memory = null; try { if (performance.memory) memory = { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit }; } catch (_) {}
    return { debuggerVersion: VERSION, timestamp: new Date().toISOString(), elapsedMs: Math.round(performance.now() - START), url: safeURL(location.href), title: document.title, readyState: document.readyState, visibility: document.visibilityState, language: navigator.language, languages: navigator.languages, platform: navigator.platform, userAgent: navigator.userAgent, cookieEnabled: navigator.cookieEnabled, online: navigator.onLine, viewport: viewport(), network: networkState(), memory, theme: document.documentElement.dataset.theme || '', mode: document.documentElement.dataset.mode || '', uiGlass: document.documentElement.hasAttribute('data-ui-glass'), reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, prefersDark: matchMedia('(prefers-color-scheme: dark)').matches };
  }
  function scriptInventory() {
    return Array.from(document.scripts).map((s, i) => ({ index: i, src: s.src ? safeURL(s.src) : '[inline script]', type: s.type || 'classic', async: !!s.async, defer: !!s.defer, noModule: !!s.noModule, connected: s.isConnected, inlineLength: s.src ? 0 : (s.textContent || '').length }));
  }
  function stylesheetInventory() {
    return Array.from(document.querySelectorAll('link[rel~="stylesheet"],style')).map((el, i) => {
      const sheet = el.sheet;
      let rules = null, rulesError = '';
      try { rules = sheet?.cssRules?.length ?? null; } catch (e) { rulesError = `${e.name}: ${e.message}`; }
      return { index: i, type: el.tagName.toLowerCase() === 'style' ? 'inline-style' : 'stylesheet', href: el.href ? safeURL(el.href) : '[inline CSS]', media: el.media || 'all', disabled: !!el.disabled, loaded: el.tagName.toLowerCase() === 'style' ? true : !!sheet, ruleCount: rules, cssTextLength: el.tagName.toLowerCase() === 'style' ? (el.textContent || '').length : undefined, rulesAccessError: rulesError };
    });
  }
  function resourceInventory() {
    return performance.getEntriesByType('resource').map(e => ({ name: safeURL(e.name), initiatorType: e.initiatorType, durationMs: Math.round(e.duration * 100) / 100, transferSize: e.transferSize || 0, encodedBodySize: e.encodedBodySize || 0, decodedBodySize: e.decodedBodySize || 0, startTimeMs: Math.round(e.startTime), protocol: e.nextHopProtocol || '' }));
  }
  function allAssetStatus() {
    return { scripts: scriptInventory(), stylesheets: stylesheetInventory(), resources: resourceInventory() };
  }
  function inspect(selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) { emit('warn', 'style-inspector', `No se encontró elemento para: ${selector}`, {}); return null; }
    const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
    const style = { target: elementSummary(el), bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, display: cs.display, position: cs.position, zIndex: cs.zIndex, color: cs.color, opacity: cs.opacity, visibility: cs.visibility, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter, filter: cs.filter, mixBlendMode: cs.mixBlendMode, border: cs.border, boxShadow: cs.boxShadow, overflow: cs.overflow, isolation: cs.isolation, transform: cs.transform, fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, textShadow: cs.textShadow, pointerEvents: cs.pointerEvents };
    const pseudo = {};
    for (const p of ['::before', '::after']) { const s = getComputedStyle(el, p); pseudo[p] = { content: s.content, display: s.display, opacity: s.opacity, backgroundImage: s.backgroundImage, filter: s.filter, mixBlendMode: s.mixBlendMode, zIndex: s.zIndex, animationName: s.animationName, animationDuration: s.animationDuration }; }
    const result = { ...style, pseudo };
    emit('info', 'style-inspector', 'Estilos calculados del elemento', result);
    return result;
  }
  function inspectCSS() {
    const sheets = [];
    Array.from(document.styleSheets).forEach((sheet, i) => {
      const item = { index: i, href: sheet.href ? safeURL(sheet.href) : '[inline stylesheet]', disabled: sheet.disabled, media: sheet.media?.mediaText || 'all', rules: [] };
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          const r = { type: rule.constructor?.name || 'CSSRule', selector: rule.selectorText || '', condition: rule.conditionText || '', cssText: redactText(rule.cssText || '').slice(0, 3000) };
          item.rules.push(r);
          if (config.logEveryCSSRule) emit('debug', 'css-rule', `${item.href} :: ${r.selector || r.type}`, r);
        }
      } catch (e) { item.error = `${e.name}: ${e.message} (CSS cross-origin: reglas protegidas por el navegador)`; }
      sheets.push(item);
    });
    const summary = sheets.map(s => ({
      ...s,
      rules: s.rules.map(r => ({
        selector: r.selector,
        type: r.type,
        condition: r.condition,
        cssTextLength: r.cssText.length,
        cssText: config.logEveryCSSRule ? r.cssText : undefined
      }))
    }));
    emit('info', 'cssom', `Inspección CSSOM: ${sheets.length} hojas`, summary);
    return sheets;
  }
  function inspectLiquidGlass() {
    const rootStyle = getComputedStyle(document.documentElement);
    const filter = document.getElementById('ghost-water-distortion');
    const disp = document.getElementById('liquid-disp');
    const turb = document.getElementById('liquid-turb');
    const targets = Array.from(document.querySelectorAll('.water-glass')).slice(0, 30).map(el => {
      const s = getComputedStyle(el), after = getComputedStyle(el, '::after');
      const r = el.getBoundingClientRect();
      return { element: elementSummary(el), rect: { width: Math.round(r.width), height: Math.round(r.height) }, background: s.background, backgroundColor: s.backgroundColor, backdropFilter: s.backdropFilter || s.webkitBackdropFilter, opacity: s.opacity, overflow: s.overflow, position: s.position, afterOpacity: after.opacity, afterFilter: after.filter, afterBackground: after.backgroundImage, afterAnimation: after.animationName };
    });
    const result = { theme: rootStyle.getPropertyValue('--theme').trim() || document.documentElement.dataset.theme, themeData: document.documentElement.dataset.theme, uiGlass: document.documentElement.hasAttribute('data-ui-glass'), variables: Object.fromEntries(['--ug-a','--ug-blur','--ug-sat','--ug-border','--ug-gloss','--ug-ripple-opacity','--ug-text-shadow'].map(k => [k, rootStyle.getPropertyValue(k).trim()])), svgFilterPresent: !!filter, turbulencePresent: !!turb, displacementMapPresent: !!disp, displacementScale: disp?.getAttribute('scale') || null, imageBackground: document.getElementById('user-bg-layer') ? getComputedStyle(document.getElementById('user-bg-layer')).backgroundImage : null, targets };
    emit('info', 'liquid-glass', 'Diagnóstico completo de Liquid Glass', result);
    return result;
  }
  function snapshot() {
    const state = { runtime: runtime(), assets: allAssetStatus(), dom: { totalElements: document.getElementsByTagName('*').length, scripts: document.scripts.length, stylesheets: document.styleSheets.length, inlineStyles: document.querySelectorAll('[style]').length, canvases: Array.from(document.querySelectorAll('canvas')).map(c => ({ id: c.id, width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight })), images: Array.from(document.images).map(i => ({ src: safeURL(i.currentSrc || i.src || ''), complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, loading: i.loading })) }, liquidGlass: inspectLiquidGlass(), counts: { ...counts }, logEntries: logs.length };
    emit('info', 'snapshot', 'Snapshot de diagnóstico completo (datos sensibles omitidos)', state);
    return state;
  }
  function redactReport() { return { reportVersion: VERSION, generatedAt: new Date().toISOString(), privacy: { messageContents: 'not captured', inputValues: 'not captured', requestBodies: 'not captured', cookiesAndStorage: 'not captured', queryValues: 'redacted' }, snapshot: snapshot(), logs: logs.slice() }; }
  function downloadReport() {
    const data = JSON.stringify(redactReport(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `GhostUe46-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    emit('info', 'report', 'Reporte JSON preparado para descargar', { bytes: blob.size, entries: logs.length });
    return { bytes: blob.size, entries: logs.length };
  }
  async function copyReport() {
    const text = JSON.stringify(redactReport(), null, 2);
    try { await navigator.clipboard.writeText(text); emit('info', 'report', 'Reporte copiado al portapapeles', { characters: text.length }); return true; }
    catch (e) { emit('warn', 'report', 'No se pudo copiar; usa downloadReport()', { error: e }); return false; }
  }
  function help() {
    const commands = {
      'GhostConsoleDebug.help()': 'Muestra los comandos disponibles',
      'GhostConsoleDebug.snapshot()': 'Resumen de la página, recursos, CSS, imágenes y Liquid Glass',
      'GhostConsoleDebug.inspect(".water-glass")': 'Estilos calculados y pseudo-elementos de un selector',
      'GhostConsoleDebug.inspectLiquidGlass()': 'Diagnóstico del filtro de distorsión, transparencia, blur y paneles',
      'GhostConsoleDebug.inspectCSS()': 'Inventario CSSOM de todas las hojas accesibles',
      'GhostConsoleDebug.config.logEveryCSSRule = true; GhostConsoleDebug.inspectCSS()': 'Imprime el CSS de cada regla accesible',
      'GhostConsoleDebug.dumpLogs()': 'Muestra todas las entradas guardadas',
      'GhostConsoleDebug.downloadReport()': 'Descarga JSON del diagnóstico y logs',
      'await GhostConsoleDebug.copyReport()': 'Copia el JSON si Clipboard API está disponible',
      'GhostConsoleDebug.clear()': 'Limpia el buffer de diagnóstico',
      'GhostConsoleDebug.config.verbose = false': 'Reduce los logs de eventos y viewport',
      'GhostConsoleDebug.config.redactSensitiveData = true': 'Deja activada la redacción de secretos y datos privados'
    };
    nativeConsole.table(commands); return commands;
  }
  function dumpLogs() { nativeConsole.groupCollapsed(`[GhostDebug] Buffer completo: ${logs.length} entradas`); logs.forEach(e => nativeConsole.log(e)); nativeConsole.groupEnd(); return logs.slice(); }
  function clear() { logs.length = 0; Object.keys(counts).forEach(k => counts[k] = 0); emit('info', 'debugger', 'Buffer limpiado'); }
  function cssScriptInventory() {
    emit('info', 'assets', `Scripts detectados: ${document.scripts.length}`, scriptInventory());
    emit('info', 'assets', `Hojas de estilo detectadas: ${document.querySelectorAll('link[rel~="stylesheet"],style').length}`, stylesheetInventory());
    emit('info', 'assets', `Recursos de red: ${performance.getEntriesByType('resource').length}`, resourceInventory());
  }

  // Instrumentación de fetch: solo metadatos, jamás lee ni registra cuerpos.
  if (config.traceNetwork && typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function(input, init = {}) {
      const url = safeURL(input instanceof Request ? input.url : input);
      const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const start = performance.now(); const traceId = `fetch-${Math.random().toString(36).slice(2, 9)}`;
      emit('network', 'fetch-start', `${traceId} ${method} ${url}`, { method, url, mode: init.mode || (input instanceof Request ? input.mode : ''), credentials: init.credentials || (input instanceof Request ? input.credentials : ''), bodyType: init.body == null ? 'none/unknown' : Object.prototype.toString.call(init.body), bodyLength: typeof init.body === 'string' ? init.body.length : undefined, note: 'body content intentionally not captured' });
      try {
        const response = await nativeFetch(input, init);
        emit(response.ok ? 'network' : 'warn', 'fetch-end', `${traceId} ${response.status} ${method} ${url}`, { method, url, status: response.status, ok: response.ok, type: response.type, durationMs: Math.round((performance.now() - start) * 100) / 100, redirected: response.redirected, responseUrl: response.url ? safeURL(response.url) : '', responseHeadersVisible: ['content-type','content-length','cache-control'].reduce((o, k) => { const v = response.headers.get(k); if (v) o[k] = v; return o; }, {}) });
        return response;
      } catch (error) {
        emit(error?.name === 'AbortError' ? 'info' : 'error', 'fetch-failed', `${traceId} ${method} ${url}`, { error, durationMs: Math.round((performance.now() - start) * 100) / 100 });
        throw error;
      }
    };
  }
  // XMLHttpRequest instrumentación compatible con proveedores que no usan fetch.
  if (config.traceNetwork && window.XMLHttpRequest) {
    const xp = XMLHttpRequest.prototype, oldOpen = xp.open, oldSend = xp.send;
    xp.open = function(method, url, ...rest) { this.__gdbg = { method: String(method || 'GET').toUpperCase(), url: safeURL(url), openedAt: performance.now() }; return oldOpen.call(this, method, url, ...rest); };
    xp.send = function(body) {
      const x = this, meta = x.__gdbg || { method: 'UNKNOWN', url: '[unknown]' }; meta.start = performance.now();
      emit('network', 'xhr-start', `${meta.method} ${meta.url}`, { method: meta.method, url: meta.url, bodyType: body == null ? 'none' : Object.prototype.toString.call(body), bodyLength: typeof body === 'string' ? body.length : undefined, bodyContent: '[not captured]' });
      x.addEventListener('loadend', function onEnd() { x.removeEventListener('loadend', onEnd); emit(x.status >= 200 && x.status < 400 ? 'network' : 'warn', 'xhr-end', `${meta.method} ${meta.url}`, { method: meta.method, url: meta.url, status: x.status, readyState: x.readyState, durationMs: Math.round((performance.now() - meta.start) * 100) / 100 }); });
      return oldSend.call(this, body);
    };
  }

  // Captura los eventos de interfaz sin escribir texto/valor introducido.
  if (config.traceEvents) {
    ['click', 'dblclick', 'change', 'input', 'submit', 'focusin', 'focusout', 'pointerdown', 'keydown'].forEach(type => {
      document.addEventListener(type, e => {
        if (type === 'pointerdown' && !config.logPointerMovement) return;
        if (type === 'keydown' && !config.verbose) return;
        const target = e.target && e.target.closest ? (e.target.closest('button,a,input,textarea,select,[role="button"],[data-action],[data-ui-pref],form') || e.target) : e.target;
        emit('event', `ui-${type}`, `Evento ${type}`, { target: elementSummary(target), trusted: e.isTrusted, key: type === 'keydown' ? e.key : undefined, button: type.startsWith('pointer') ? e.button : undefined, defaultPrevented: e.defaultPrevented, modifiers: type === 'keydown' ? { alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey, meta: e.metaKey } : undefined });
      }, true);
    });
  }

  // Mutaciones DOM: resumen por lote para no colgar la app cuando el chat actualiza mensajes.
  if (config.traceMutations && 'MutationObserver' in window && document.documentElement) {
    let mutationQueue = [], flushScheduled = false;
    const flush = () => {
      flushScheduled = false; if (!mutationQueue.length) return;
      const batch = mutationQueue.splice(0, 250), summary = { records: batch.length, added: 0, removed: 0, attributes: {}, targets: [] };
      for (const m of batch) {
        summary.added += m.addedNodes?.length || 0; summary.removed += m.removedNodes?.length || 0;
        if (m.type === 'attributes') summary.attributes[m.attributeName] = (summary.attributes[m.attributeName] || 0) + 1;
        if (summary.targets.length < 16) summary.targets.push({ target: m.target?.nodeType === 1 ? elementSummary(m.target) : { type: m.target?.nodeType === 3 ? 'text-node' : m.target?.nodeType }, type: m.type, addedTags: Array.from(m.addedNodes || []).filter(n => n.nodeType === 1).slice(0, 5).map(n => elementSummary(n)) });
      }
      emit('mutation', 'dom-mutations', 'Lote de mutaciones DOM (texto/valores omitidos)', summary);
      if (mutationQueue.length) scheduleFlush();
    };
    function scheduleFlush() { if (flushScheduled) return; flushScheduled = true; setTimeout(flush, 300); }
    const observer = new MutationObserver(records => { mutationQueue.push(...records); scheduleFlush(); });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  // Resource timing and long tasks help locate slow CSS, fonts, JS and images.
  if (config.traceResources && 'PerformanceObserver' in window) {
    try {
      const ro = new PerformanceObserver(list => list.getEntries().forEach(e => emit('resource', 'resource-timing', 'Recurso cargado', { name: safeURL(e.name), initiatorType: e.initiatorType, durationMs: Math.round(e.duration * 100) / 100, transferSize: e.transferSize || 0, decodedBodySize: e.decodedBodySize || 0, protocol: e.nextHopProtocol || '' })));
      ro.observe({ type: 'resource', buffered: true });
    } catch (e) { emit('debug', 'performance', 'Resource Timing Observer no disponible', { error: e }); }
    try { const lo = new PerformanceObserver(list => list.getEntries().forEach(e => emit('warn', 'long-task', 'Tarea larga detectada', { startTime: e.startTime, durationMs: e.duration }))); lo.observe({ type: 'longtask', buffered: true }); } catch (_) {}
    try { const ls = new PerformanceObserver(list => list.getEntries().forEach(e => emit('debug', 'layout-shift', 'Cambio de layout', { value: e.value, hadRecentInput: e.hadRecentInput }))); ls.observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  }

  const api = {
    __installed: true, version: VERSION, config, logs,
    log: (message, details) => emit('info', 'manual', message, details),
    warn: (message, details) => emit('warn', 'manual', message, details),
    error: (message, details) => emit('error', 'manual', message, details),
    help, snapshot, inspect, inspectCSS, inspectLiquidGlass, dumpLogs, clear, downloadReport, copyReport,
    assets: cssScriptInventory,
    setVerbose(value) { config.verbose = !!value; emit('info', 'debugger', `verbose=${config.verbose}`); },
    enable(value = true) { config.enabled = !!value; if (config.enabled) emit('info', 'debugger', 'Depurador activado'); },
    exportJSON() { return JSON.stringify(redactReport(), null, 2); },
    getSummary() { return { counts: { ...counts }, logEntries: logs.length, runtime: runtime() }; }
  };
  Object.defineProperty(window, 'GhostConsoleDebug', { configurable: false, enumerable: true, writable: false, value: api });

  banner();
  emit('info', 'boot', 'Depurador inicializado antes de la aplicación', runtime());
  emit('info', 'boot', 'Los logs detallados están activados; los cuerpos de texto y secretos se redactan por privacidad');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { cssScriptInventory(); emit('info', 'dom-ready', 'DOMContentLoaded', { runtime: runtime(), elementCount: document.getElementsByTagName('*').length }); inspectLiquidGlass(); }, { once: true });
  else { cssScriptInventory(); inspectLiquidGlass(); }
  window.addEventListener('load', () => { emit('info', 'window-load', 'Carga completa de ventana', { runtime: runtime(), navigation: performance.getEntriesByType('navigation').map(e => ({ domContentLoadedMs: e.domContentLoadedEventEnd, loadMs: e.loadEventEnd, transferSize: e.transferSize })) }); cssScriptInventory(); }, { once: true });
  setTimeout(() => { if (document.body) { emit('info', 'dom-inventory', 'Inventario DOM inicial', { totalElements: document.getElementsByTagName('*').length, forms: document.forms.length, buttons: document.querySelectorAll('button').length, inputs: document.querySelectorAll('input,textarea,select').length, images: document.images.length, canvases: document.querySelectorAll('canvas').length }); } }, 1000);
})();
