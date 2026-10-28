/* GhostUe46 UI+ : apariencia (modo, burbujas, círculos, distorsión) y verificación de sintaxis REAL. */
(() => {
const $ = (s) => document.querySelector(s);
const root = document.documentElement;

/* ---------- Apariencia ---------- */
const FILL = {
    dark: { default: 'rgba(2,6,23,.22)', 'liquid-glass': 'rgba(4,19,31,.2)', 'material-you': 'rgba(10,12,28,.22)', aurora: 'rgba(3,8,20,.22)', 'frutiger-aero': 'rgba(213,249,255,.3)', 'assassins-creed-2': 'rgba(10,10,12,.32)', synthwave: 'rgba(11,2,33,.3)', custom: 'rgba(5,8,22,.22)' },
    light: { default: 'rgba(236,243,255,.25)', 'liquid-glass': 'rgba(222,242,255,.22)', 'material-you': 'rgba(244,240,255,.25)', aurora: 'rgba(226,250,246,.25)', 'frutiger-aero': 'rgba(229,252,255,.3)', 'assassins-creed-2': 'rgba(10,10,12,.32)', synthwave: 'rgba(11,2,33,.3)', custom: 'rgba(230,240,255,.22)' }
};
// Assassin's Creed II (Animus) y Synthwave son siempre oscuros, aunque el modo sea claro.
const resolveMode = () => (config.theme === 'assassins-creed-2' || config.theme === 'synthwave') ? 'dark' : config.mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : (config.mode === 'light' ? 'light' : 'dark');

function applyUiPlus() {
    const mode = resolveMode();
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    root.dataset.bubbles = config.bubbleStyle || 'glass';
    root.dataset.uiAnim = config.uiAnimations === false ? 'off' : 'on';
    try { root.dataset.refract = CSS.supports('backdrop-filter', 'url(#ghost-liquid) blur(1px)') ? '1' : '0'; } catch (e) { root.dataset.refract = '0'; }
    window.__canvasFill = (FILL[mode][config.theme] || FILL[mode].default);
    const distortion = Math.max(0, Math.min(70, Number(config.distortion ?? 36)));
    $('#liquid-disp')?.setAttribute('scale', String(distortion));
    // El segundo mapa es el que usa realmente la capa refractiva .water-glass::after.
    $('#ghost-water-disp')?.setAttribute('scale', String(distortion));
    const svg = $('#ghost-svg-defs');
    if (svg) config.liquidAnimated === false ? svg.pauseAnimations?.() : svg.unpauseAnimations?.();
}

let circleTimer;
function circlesLoop() {
    clearInterval(circleTimer);
    const box = $('#fx-circles');
    if (!box) return;
    box.querySelectorAll('.fx-circle').forEach((c) => c.remove());
    if (config.dynamicCircles === false) return;
    const spawn = () => {
        if (document.hidden || box.children.length > 16) return;
        const c = document.createElement('i');
        const s = 40 + Math.random() * 160;
        const palette = (typeof window.getFxColors === 'function')
            ? window.getFxColors()
            : (Array.isArray(config.fxColors) ? config.fxColors : ['#7dd3fc', '#1e3a8a', '#22c55e', '#ffffff']);
        const pick = palette[Math.floor(Math.random() * palette.length)] || '#7dd3fc';
        c.className = 'fx-circle';
        c.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;--dx:${(Math.random() - .5) * 160}px;animation-duration:${9 + Math.random() * 10}s;--c:${pick}`;
        c.addEventListener('animationend', () => c.remove());
        box.appendChild(c);
    };
    for (let i = 0; i < 5; i++) spawn();
    circleTimer = setInterval(spawn, 1100);
}

function syncUiControls() {
    document.querySelectorAll('[data-ui-pref]').forEach((el) => {
        const k = el.dataset.uiPref;
        if (el.type === 'checkbox') el.checked = config[k] !== false;
        else if (el.type === 'range') el.value = config[k] ?? 36;
        else {
            const on = String(config[k] ?? (k === 'mode' ? 'dark' : 'glass')) === el.dataset.value;
            el.classList.toggle('selected', on);
            el.setAttribute('aria-pressed', String(on));
        }
    });
}

function setPref(k, v) {
    config[k] = v;
    saveStorage();
    applyUiPlus();
    syncUiControls();
    if (k === 'dynamicCircles') circlesLoop();
}
document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-ui-pref]');
    if (b) setPref(b.dataset.uiPref, b.dataset.value);
});
document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-ui-pref]');
    if (el && el.tagName !== 'BUTTON') setPref(el.dataset.uiPref, el.type === 'checkbox' ? el.checked : +el.value);
});
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyUiPlus);

const _applyTheme = window.applyTheme;
window.applyTheme = function (...a) { const r = _applyTheme.apply(this, a); applyUiPlus(); return r; };

/* ---------- Verificación de sintaxis REAL ---------- */
const CDN_TS = 'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.20.8/';
const CDN_LANG = 'https://cdn.jsdelivr.net/npm/tree-sitter-wasms@0.1.11/out/tree-sitter-';
const TS_NAME = { java: 'java', c: 'c', cpp: 'cpp', csharp: 'c_sharp', javascript: 'javascript', css: 'css' };
const parsers = {};
let tsBoot;
const loadScript = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('sin conexión con el CDN')); document.head.appendChild(s); });

async function tsParser(lang) {
    tsBoot ||= (async () => { await loadScript(CDN_TS + 'tree-sitter.js'); await TreeSitter.init({ locateFile: (f) => CDN_TS + f }); })();
    await tsBoot;
    if (!parsers[lang]) {
        const p = new TreeSitter();
        p.setLanguage(await TreeSitter.Language.load(CDN_LANG + TS_NAME[lang] + '.wasm'));
        parsers[lang] = p;
    }
    return parsers[lang];
}

function tsErrors(rootNode) {
    const out = [];
    (function walk(n) {
        if (out.length >= 20 || (!n.hasError() && !n.isMissing())) return;
        const at = { line: n.startPosition.row + 1, col: n.startPosition.column + 1 };
        if (n.isMissing()) { out.push({ ...at, msg: `Falta «${n.type}»` }); return; }
        if (n.type === 'ERROR') { out.push({ ...at, msg: `Sintaxis inesperada cerca de «${n.text.slice(0, 24).replace(/\s+/g, ' ')}»` }); return; }
        n.children.forEach(walk);
    })(rootNode);
    if (!out.length && rootNode.hasError()) out.push({ line: 1, col: 1, msg: 'Error de sintaxis en el código' });
    return out;
}

function pyCheck(code) {
    if (typeof pyodideInstance === 'undefined' || !pyodideInstance) return null;
    pyodideInstance.globals.set('__ghost_src', code);
    const r = pyodideInstance.runPython("import ast\ntry:\n    ast.parse(__ghost_src)\n    __r = ''\nexcept SyntaxError as e:\n    __r = f'{e.lineno or 1}|{e.offset or 1}|{e.msg}'\n__r");
    if (!r) return [];
    const [line, col, ...m] = String(r).split('|');
    return [{ line: +line, col: +col, msg: m.join('|') }];
}

function htmlCheck(code) {
    const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
    const OPT = new Set('p li dt dd tr td th thead tbody tfoot option'.split(' '));
    const errs = [], st = [];
    const lineAt = (i) => code.slice(0, i).split('\n').length;
    const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
    let m;
    while ((m = re.exec(code))) {
        if (m[0].startsWith('<!--')) continue;
        const tag = m[2].toLowerCase(), line = lineAt(m.index);
        if (!m[1]) {
            if (VOID.has(tag) || /\/\s*$/.test(m[3])) continue;
            st.push({ tag, line });
            if (tag === 'script' || tag === 'style') { const end = code.toLowerCase().indexOf('</' + tag, re.lastIndex); if (end < 0) break; re.lastIndex = end; }
            continue;
        }
        while (st.length && st[st.length - 1].tag !== tag && OPT.has(st[st.length - 1].tag)) st.pop();
        if (st.length && st[st.length - 1].tag === tag) { st.pop(); continue; }
        if (st.some((s) => s.tag === tag)) {
            const top = st[st.length - 1];
            errs.push({ line, col: 1, msg: `</${tag}> inesperado: primero hay que cerrar <${top.tag}> (línea ${top.line})` });
            while (st.length && st.pop().tag !== tag);
        } else errs.push({ line, col: 1, msg: `Etiqueta de cierre </${tag}> sin apertura` });
    }
    st.filter((s) => !OPT.has(s.tag)).forEach((s) => errs.push({ line: s.line, col: 1, msg: `<${s.tag}> sin cerrar` }));
    return errs.sort((a, b) => a.line - b.line).slice(0, 20);
}

window.ghostSyntaxCheck = async (lang, code, quiet) => {
    try {
        if (lang === 'python') { const e = pyCheck(code); return e && { engine: 'CPython ast', errors: e }; }
        if (lang === 'html') return { engine: 'analizador de etiquetas', errors: htmlCheck(code) };
        if (TS_NAME[lang]) {
            const tree = (await tsParser(lang)).parse(code);
            const errors = tsErrors(tree.rootNode);
            tree.delete();
            return { engine: 'tree-sitter', errors };
        }
    } catch (err) {
        if (!quiet) appendConsole(`⚠️ No se pudo cargar el verificador real (${err.message || err}). Se usa el chequeo básico.`, true);
    }
    return null;
};
window.__ghostCheckers = { htmlCheck };

/* Estado en vivo mientras escribes en el editor */
let liveTimer;
function liveCheck() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(async () => {
        const b = $('#editor-live-status'), ed = $('#code-editor-input');
        if (!b || !ed) return;
        const lang = $('#editor-lang-select').value, set = (t, c) => { b.textContent = t; b.className = 'live-badge font-audiowide ' + c; };
        if (['directx', 'opengl', 'vulkan'].includes(lang)) return set('BETA · solo delimitadores', 'warn');
        const r = await window.ghostSyntaxCheck(lang, ed.value, true);
        if (!r) return set('Verificador cargando…', 'warn');
        r.errors.length ? set(`✕ ${r.errors.length} error(es) · línea ${r.errors[0].line}`, 'bad') : set('✓ Sintaxis válida', 'ok');
    }, 600);
}

/* ---------- Indicador lento (>15 s) ---------- */
const ti = $('#typing-indicator');
let slowTimer;
if (ti) new MutationObserver(() => {
    clearTimeout(slowTimer);
    if (ti.classList.contains('hidden')) { if (ti.classList.contains('is-slow')) ti.classList.remove('is-slow'); }
    else if (!ti.classList.contains('is-slow')) slowTimer = setTimeout(() => ti.classList.add('is-slow'), 15000);
}).observe(ti, { attributes: true, attributeFilter: ['class'] });

/* ---------- Enlaces clicables (solo http/https; el código queda intacto) ---------- */
const _parseMd = window.parseMarkdownAndCode;
window.parseMarkdownAndCode = function (text) {
    const tpl = document.createElement('template');
    tpl.innerHTML = _parseMd.call(this, text);
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n; (n = walker.nextNode());) {
        if (/https?:\/\//.test(n.nodeValue) && !n.parentElement?.closest('a,pre,code,button,script,style')) nodes.push(n);
    }
    const re = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"'`]+/g;
    nodes.forEach((node) => {
        const s = node.nodeValue, frag = document.createDocumentFragment();
        let last = 0, m;
        re.lastIndex = 0;
        while ((m = re.exec(s))) {
            let label = m[1], url = m[2], tail = '';
            if (!url) {
                url = m[0];
                const t = url.match(/[.,;:!?)\]]+$/);
                if (t) { tail = t[0]; url = url.slice(0, -tail.length); }
                label = url;
            }
            frag.append(s.slice(last, m.index));
            const a = document.createElement('a');
            a.href = url; a.textContent = label; a.target = '_blank'; a.rel = 'noopener noreferrer';
            frag.append(a, tail);
            last = m.index + m[0].length;
        }
        frag.append(s.slice(last));
        node.replaceWith(frag);
    });
    return tpl.innerHTML;
};

document.addEventListener('DOMContentLoaded', () => {
    applyUiPlus();
    syncUiControls();
    circlesLoop();
    $('#code-editor-input')?.addEventListener('input', liveCheck);
    $('#editor-lang-select')?.addEventListener('change', liveCheck);
    const modal = $('#editor-modal');
    if (modal) new MutationObserver(liveCheck).observe(modal, { attributes: true, attributeFilter: ['class'] });
});
})();
