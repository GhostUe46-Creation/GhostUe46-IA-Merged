/* GhostUe46 · Inteligencia de GhostUe46
   Cuatro modos: Pensar · Código · ArchFile · Visión.
   Se apoya en app.js (config, requestChat, buildChatMessages, searchDuckDuckGo...) y en ui-plus.js (verificador de sintaxis real). */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ext = (name) => (String(name || '').split('.').pop() || '').toLowerCase();
const isImg = (a) => a && typeof a.type === 'string' && a.type.startsWith('image/');

const MODES = {
    none:     { label: 'Estándar',  icon: 'fa-ghost' },
    think:    { label: 'Pensar',    icon: 'fa-lightbulb' },
    code:     { label: 'Código',    icon: 'fa-code' },
    archfile: { label: 'ArchFile',  icon: 'fa-folder-tree' },
    vision:   { label: 'Visión',    icon: 'fa-eye' }
};

/* ------------------------------------------------------------------ */
/* Instrucciones de cada modo                                          */
/* ------------------------------------------------------------------ */
const PLAN_PROMPT = 'Eres el módulo de planificación de GhostUe46. Dada la pregunta del usuario, responde SOLO con un JSON válido (sin markdown ni texto extra) con esta forma: {"approach":"cómo vas a resolver la pregunta, en 1 o 2 frases","queries":["consulta 1","consulta 2","consulta 3"]}. Las consultas deben ser breves (2 a 7 palabras), distintas entre sí y útiles para un buscador web; usa entre 1 y 3. Si la pregunta no necesita información de internet (por ejemplo, lógica, matemáticas o código), devuelve "queries": [].';

const THINK_PROMPT = `MODO PENSAR ACTIVO. Razona con calma antes de responder: descompón el problema, considera alternativas y posibles errores, y verifica tus conclusiones antes de darlas.
- Si el mensaje incluye [INVESTIGACIÓN WEB], úsala como única evidencia externa: indica la fuente (URL) de cada dato que tomes de ahí. Si la búsqueda no devolvió información útil, dilo claramente y no inventes fuentes ni cifras.
- Estructura: primero la respuesta o conclusión clara; después los puntos clave del razonamiento (breves); al final, lo que no pudiste verificar o las limitaciones.
- Sé preciso y ordenado. No alargues la respuesta con relleno.`;

const CODE_PROMPT = `MODO CÓDIGO ACTIVO. Actúa como un ingeniero de software senior experto en Java, JavaScript, HTML, CSS, C, C++, C#, Python y también DirectX/HLSL, OpenGL/GLSL y Vulkan (estos tres están en fase BETA: avisa si algo puede fallar).
- Entiende el objetivo real antes de escribir. Si falta un dato imprescindible, haz como máximo una pregunta corta; si no, asume lo más razonable y dilo en una línea.
- Entrega código COMPLETO y ejecutable, nunca con "..." ni partes omitidas. Cada bloque en su propio fence con el lenguaje (\`\`\`python, \`\`\`java, \`\`\`cpp, \`\`\`csharp, \`\`\`javascript, \`\`\`html, \`\`\`css).
- Piensa en casos límite, manejo de errores, seguridad y rendimiento. Prefiere soluciones simples y legibles, con nombres claros y comentarios solo donde aporten.
- No inventes APIs, librerías ni funciones: si no estás seguro de que existen, dilo.
- Tu código pasará por un verificador de sintaxis real: revisa llaves, paréntesis, comillas e indentación antes de responder.
- Termina explicando en pocas líneas cómo ejecutarlo y qué decisiones tomaste. Si corriges un error, explica la causa.`;

const ARCH_PROMPT = `MODO ARCHFILE ACTIVO. Creas sitios web y archivos listos para usar o instalar.
FORMATO OBLIGATORIO: cada archivo va en su propio bloque con el nombre en la línea de apertura, así:
\`\`\`html:index.html
(contenido completo)
\`\`\`
Usa \`lenguaje:ruta/nombre.ext\` (por ejemplo \`css:estilos.css\`, \`python:main.py\`, \`bat:instalar.bat\`, \`markdown:LEEME.md\`). Rutas relativas, sin "..", sin barras iniciales. Cada archivo debe ir COMPLETO, nunca con "..." ni "resto igual".
- Sitios web: por defecto entrega UN solo index.html con el CSS y el JavaScript dentro, para que la vista previa funcione al instante. Si el usuario pide archivos separados, enlázalos con rutas relativas (estilos.css, app.js).
- Todo botón, menú, formulario y pestaña debe funcionar de verdad (nada de botones decorativos). Diseño responsive, accesible y con buen aspecto. Evita depender de imágenes o recursos externos: usa CSS, SVG o emojis. No uses servidores ni envíes datos a ningún sitio.
- Programas, scripts, mods o instaladores: incluye todos los archivos necesarios y un LEEME.md con los pasos exactos de instalación y uso. Si hace falta, añade instalar.bat (Windows) y/o instalar.sh (Linux/macOS).
- No crees malware, ni nada que dañe, espíe o engañe a otras personas.
- Después de los archivos, explica en pocas líneas qué hace cada uno y cómo abrirlo o instalarlo. No repitas el código fuera de los bloques.`;

const VISION_PROMPT = `MODO VISIÓN ACTIVO. Puedes ver las imágenes adjuntas y leer los archivos adjuntos (su texto viene incluido en el mensaje).
- Mira con atención: primero describe lo que realmente ves o contiene el archivo y después responde a lo que pide el usuario.
- Transcribe el texto visible cuando sea relevante (OCR) y cita números, nombres y datos tal como aparecen.
- En capturas de pantalla, código, errores, gráficos, tablas, documentos, mapas o diseños: interpreta su contenido y señala problemas o mejoras concretas.
- Si hay varias imágenes o archivos, trátalos por separado y compáralos si procede.
- Distingue lo que es seguro de lo que supones. Si algo es ilegible, está cortado o el archivo fue recortado por ser muy largo, dilo. No inventes contenido que no se vea.
- No identifiques a personas reales por su rostro; sí puedes describir su aspecto, ropa, expresión y el contexto.
- Si el usuario no escribió ninguna instrucción, entrega: Resumen, Detalles importantes, Texto detectado y Observaciones útiles.`;

/* ------------------------------------------------------------------ */
/* Estado y panel                                                      */
/* ------------------------------------------------------------------ */
const getMode = () => (MODES[config.intelligenceMode] ? config.intelligenceMode : 'none');
const setStatus = (text) => { const el = $('#typing-indicator-text'); if (el) el.textContent = text; };

function updateUI() {
    const mode = getMode();
    const dock = $('#intel-dock');
    if (!dock) return;
    dock.dataset.mode = mode;
    const badge = $('#intel-btn-badge');
    if (badge) {
        badge.textContent = mode === 'none' ? '' : MODES[mode].label;
        badge.classList.toggle('is-on', mode !== 'none');
    }
    const warn = mode === 'think' && !config.webSearchEnabled;
    $('#intel-btn')?.classList.toggle('is-warn', warn);
    document.querySelectorAll('[data-intel-mode]').forEach((card) => {
        const on = card.dataset.intelMode === mode;
        card.classList.toggle('is-active', on);
        card.setAttribute('aria-pressed', String(on));
    });
    const foot = $('#intel-pop-foot');
    if (foot) {
        const ddg = config.webSearchEnabled ? 'DuckDuckGo: activado' : 'DuckDuckGo: desactivado';
        foot.textContent = mode === 'none'
            ? `Modo actual: Estándar · ${ddg}`
            : `Modo actual: ${MODES[mode].label} · ${ddg}${warn ? ' (Pensar necesita que lo actives)' : ''}`;
    }
    updateSpeedUI();
}

function openPanel(open) {
    const pop = $('#intel-popover');
    if (!pop) return;
    pop.classList.toggle('is-open', open);
    $('#intel-btn')?.setAttribute('aria-expanded', String(open));
    if (!open) $('#intel-gate')?.classList.remove('is-visible');
}

function setMode(mode, { toggle = true } = {}) {
    if (!MODES[mode]) mode = 'none';
    if (toggle && mode === getMode()) mode = 'none';
    if (mode === 'think' && getSpeed() === 'fast') {
        showGate($('#intel-gate'), '<i class="fa-solid fa-bolt"></i> <strong>Pensar no es compatible con Rápido</strong>: Pensar hace varias consultas y tarda más. ¿Pasar a velocidad Normal y usar Pensar?', 'Pasar a Normal y usar Pensar', () => { commitSpeed('normal', true); setMode('think', { toggle: false }); });
        return;
    }
    if (mode === 'think' && !config.webSearchEnabled) {
        showGate($('#intel-gate'), '<i class="fa-solid fa-globe"></i> <strong>Pensar necesita acceso a DuckDuckGo</strong> para investigar antes de responder. Por eso puede tardar un poco más. ¿Quieres activarlo?', 'Activar DuckDuckGo y usar Pensar', () => { if (!config.webSearchEnabled) toggleWebSearch(); setMode('think', { toggle: false }); });
        return;
    }
    config.intelligenceMode = mode;
    saveStorage();
    updateUI();
    $('#intel-gate')?.classList.remove('is-visible');
    if (mode === 'none') showToast('Modo estándar: GhostUe46 responde como siempre.', 'info', 'Inteligencia');
    else {
        const msg = {
            think: 'Pensar activo: planificará, investigará en DuckDuckGo y razonará antes de responder. Tardará un poco más.',
            code: 'Código activo: más experto en programación y con revisión automática de sintaxis.',
            archfile: 'ArchFile activo: crea sitios web y archivos; los HTML tendrán vista previa.',
            vision: 'Visión activa: adjunta imágenes o archivos (PDF, Word, Excel, ZIP, código…) y los analizará.'
        }[mode];
        showToast(msg, 'info', `Inteligencia · ${MODES[mode].label}`);
    }
}

/* ------------------------------------------------------------------ */
/* Tiempo de respuesta: Rápido · Normal · Lento                        */
/* ------------------------------------------------------------------ */
const SPEEDS = {
    fast:   { label: 'Rápido', icon: 'fa-bolt' },
    normal: { label: 'Normal', icon: 'fa-gauge-high' },
    slow:   { label: 'Lento',  icon: 'fa-hourglass-half' }
};
const getSpeed = () => (SPEEDS[config.responseSpeed] ? config.responseSpeed : 'normal');

const SPEED_PROMPTS = {
    fast: 'VELOCIDAD RÁPIDA: responde de forma muy breve y directa, sin preámbulos, repeticiones ni resúmenes finales. Si hay código o archivos, entrega solo lo necesario pero siempre completo, con una explicación mínima.',
    normal: 'Responde yendo al grano: sin preámbulos largos ni repetir lo que ya se dijo.',
    slow: 'VELOCIDAD LENTA (modo cuidadoso): tómate tu tiempo. Razona paso a paso, considera alternativas, verifica cada dato y cada cálculo, y da una respuesta completa y detallada. Revisa tu respuesta antes de darla.'
};
const speedInstructions = () => SPEED_PROMPTS[getSpeed()];

function showGate(box, html, label, fn) {
    if (!box) return;
    box.querySelector('p').innerHTML = html;
    box.querySelector('.intel-gate-accept').innerHTML = `<i class="fa-solid fa-check"></i> ${label}`;
    box._accept = fn;
    box.classList.add('is-visible');
}

function updateSpeedUI() {
    const sp = getSpeed();
    const btn = $('#speed-btn');
    if (btn) {
        btn.dataset.speedCurrent = sp;
        btn.title = `Tiempo de respuesta de GhostUe46: ${SPEEDS[sp].label}`;
        btn.setAttribute('aria-label', btn.title);
    }
    const icon = $('#speed-btn-icon');
    if (icon) icon.className = `fa-solid ${SPEEDS[sp].icon}`;
    document.querySelectorAll('[data-speed]').forEach((card) => {
        const on = card.dataset.speed === sp;
        card.classList.toggle('is-active', on);
        card.setAttribute('aria-pressed', String(on));
        card.classList.toggle('is-incompatible', card.dataset.speed === 'fast' && getMode() === 'think');
    });
    $('[data-intel-mode="think"]')?.classList.toggle('is-incompatible', sp === 'fast');
    const foot = $('#speed-pop-foot');
    if (foot) foot.textContent = `Velocidad actual: ${SPEEDS[sp].label}`;
}

function commitSpeed(speed, silent) {
    config.responseSpeed = speed;
    saveStorage();
    updateSpeedUI();
    $('#speed-gate')?.classList.remove('is-visible');
    if (silent) return;
    const msg = {
        fast: 'Respuestas breves y directas, sin ronda de corrección automática.',
        normal: 'Respuestas al grano, un poco más rápidas que antes.',
        slow: 'Respuestas más cuidadosas: GhostUe46 revisa su respuesta antes de entregarla.'
    }[speed];
    showToast(msg, 'info', `Tiempo de respuesta · ${SPEEDS[speed].label}`);
}

function setSpeed(speed) {
    if (!SPEEDS[speed] || speed === getSpeed()) return;
    if (speed === 'fast' && getMode() === 'think') {
        showGate($('#speed-gate'), '<i class="fa-solid fa-lightbulb"></i> <strong>Rápido no es compatible con Pensar</strong>: Pensar hace varias consultas y tarda más. ¿Desactivar Pensar y usar Rápido?', 'Desactivar Pensar y usar Rápido', () => { config.intelligenceMode = 'none'; commitSpeed('fast'); updateUI(); });
        return;
    }
    commitSpeed(speed);
}

function openSpeed(open) {
    const pop = $('#speed-popover');
    if (!pop) return;
    pop.classList.toggle('is-open', open);
    $('#speed-btn')?.setAttribute('aria-expanded', String(open));
    if (!open) $('#speed-gate')?.classList.remove('is-visible');
}

async function reviewPass(messages, answer) {
    setStatus('GhostUe46 está revisando su respuesta...');
    try {
        const better = await requestChat([
            ...messages,
            { role: 'assistant', content: answer },
            { role: 'user', content: 'Revisa tu respuesta anterior con ojo crítico: corrige errores o datos dudosos, completa lo que falte y mejora la claridad. Devuelve SOLO la versión final lista para el usuario, sin mencionar esta revisión.' }
        ]);
        return better && better.trim() ? better : answer;
    } catch (e) { return answer; }
}

// Llamada al modelo respetando el tiempo de respuesta (en Lento añade una pasada de revisión).
async function chat(prompt, atts, extra = {}) {
    const messages = buildChatMessages(prompt, atts, extra);
    const answer = await requestChat(messages);
    return getSpeed() === 'slow' ? reviewPass(messages, answer) : answer;
}

function initPanel() {
    $('#intel-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openSpeed(false); openPanel(!$('#intel-popover').classList.contains('is-open')); });
    $('#speed-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openPanel(false); openSpeed(!$('#speed-popover').classList.contains('is-open')); });
    document.addEventListener('click', (e) => {
        const card = e.target.closest('[data-intel-mode]');
        if (card) { setMode(card.dataset.intelMode); return; }
        const speedCard = e.target.closest('[data-speed]');
        if (speedCard) { setSpeed(speedCard.dataset.speed); return; }
        const gate = e.target.closest('[data-intel-gate]');
        if (gate) {
            const box = gate.closest('.intel-gate');
            const fn = gate.dataset.intelGate === 'accept' ? box._accept : null;
            box.classList.remove('is-visible');
            if (typeof fn === 'function') fn();
            return;
        }
        if (e.target.closest('[data-intel-attach]')) { document.getElementById('file-input')?.click(); return; }
        if (!e.target.closest('#intel-dock')) openPanel(false);
        if (!e.target.closest('#speed-wrap')) openSpeed(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openPanel(false); openSpeed(false); } });
    const _uws = window.updateWebSearchUI;
    if (typeof _uws === 'function') window.updateWebSearchUI = function (...a) { const r = _uws.apply(this, a); updateUI(); return r; };
    updateUI();
}

/* Texto del indicador según el modo (conserva el desvanecido y la animación de app.js) */
const _setTyping = window.setTypingIndicator;
if (typeof _setTyping === 'function') {
    window.setTypingIndicator = function (prompt, mode) {
        _setTyping.call(this, prompt, mode);
        if (mode === 'investigating') return;
        const m = getMode();
        const ind = $('#typing-indicator');
        if (m === 'think') setStatus('GhostUe46 está pensando...');
        else if (m === 'archfile') setStatus('GhostUe46 está creando tus archivos...');
        else if (m === 'vision') setStatus('GhostUe46 está analizando...');
        else if (m === 'code' && ind && ind.dataset.mode !== 'code') setStatus('GhostUe46 está creando el código...');
    };
}

/* ------------------------------------------------------------------ */
/* Verificación y autocorrección de código (usa el verificador real)   */
/* ------------------------------------------------------------------ */
const LANG_MAP = { py: 'python', python: 'python', js: 'javascript', javascript: 'javascript', mjs: 'javascript', html: 'html', htm: 'html', css: 'css', java: 'java', c: 'c', h: 'c', cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp', csharp: 'csharp', 'c#': 'csharp' };
const LANG_LABEL = { python: 'Python', javascript: 'JavaScript', html: 'HTML', css: 'CSS', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#' };

function parseInfo(info) {
    info = String(info || '').trim();
    const both = info.match(/^([A-Za-z0-9_+#-]*)\s*[:\s]\s*(?:(?:file|archivo|filename)\s*=\s*)?["']?([^\s"'`]+\.[A-Za-z0-9]{1,10})["']?$/i);
    if (both) return { lang: both[1] || ext(both[2]), file: both[2] };
    const only = info.match(/^["']?([^\s"':`]+\.[A-Za-z0-9]{1,10})["']?$/);
    if (only) return { lang: ext(only[1]), file: only[1] };
    return { lang: info.split(/[\s:]/)[0] || '', file: '' };
}

function extractBlocks(text) {
    const out = [];
    const re = /```([^\n`]*)\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(String(text || '')))) out.push({ ...parseInfo(m[1]), code: m[2], raw: m[0] });
    return out;
}

function shouldCheck(lang, code, hasFile) {
    if (lang === 'html') return hasFile || /<html|<!doctype/i.test(code);
    if (lang === 'java') return /\b(class|interface|enum|record)\b/.test(code);
    if (lang === 'csharp') return /\b(class|struct|namespace|interface)\b/.test(code);
    if (lang === 'c' || lang === 'cpp') return /#include|\b(int|void)\s+\w+\s*\([^)]*\)\s*\{/.test(code);
    if (lang === 'css') return code.includes('{');
    return true;
}

async function checkBlocks(text) {
    const errors = [];
    const checked = new Map();
    if (typeof window.ghostSyntaxCheck !== 'function') return { errors, checked };
    for (const b of extractBlocks(text)) {
        const lang = LANG_MAP[(b.lang || '').toLowerCase()];
        if (!lang || !shouldCheck(lang, b.code, Boolean(b.file))) continue;
        let r = null;
        try { r = await window.ghostSyntaxCheck(lang, b.code, true); } catch (e) { r = null; }
        if (!r) continue;
        checked.set(lang, r.engine);
        r.errors.slice(0, 6).forEach((e) => errors.push({ lang, file: b.file, line: e.line, col: e.col, msg: e.msg }));
    }
    return { errors, checked };
}

const fmtErrors = (errs) => errs.slice(0, 12).map((e) => `- ${LANG_LABEL[e.lang]}${e.file ? ` (${e.file})` : ''}, línea ${e.line}, col. ${e.col}: ${e.msg}`).join('\n');

async function verifyAndRepair(answer, messages, { repair = true } = {}) {
    let current = answer;
    let repaired = false;
    let res = await checkBlocks(current);
    if (res.errors.length && repair) {
        setStatus('GhostUe46 está verificando y corrigiendo el código...');
        try {
            const fixed = await requestChat([
                ...messages,
                { role: 'assistant', content: current },
                { role: 'user', content: `El verificador de sintaxis real detectó estos errores en tu respuesta:\n${fmtErrors(res.errors)}\n\nCorrige TODOS los errores y devuelve de nuevo la respuesta completa, con todos los bloques completos y el mismo formato. Si algún bloque es un fragmento parcial a propósito, déjalo igual. No menciones este mensaje: responde como respuesta final normal.` }
            ]);
            const before = extractBlocks(current).length;
            if (extractBlocks(fixed).length >= before) {
                current = fixed;
                repaired = true;
                res = await checkBlocks(current);
            }
        } catch (e) { /* se conserva la primera respuesta */ }
    }
    if (res.errors.length) {
        return `${current}\n\n⚠️ **El verificador de sintaxis aún detecta ${res.errors.length} problema(s):**\n${fmtErrors(res.errors.slice(0, 5))}\nRevísalos antes de usar el código.`;
    }
    if (res.checked.size) {
        const names = [...res.checked.keys()].map((k) => LANG_LABEL[k]).join(', ');
        return `${current}\n\n✅ **Sintaxis verificada** (${names})${repaired ? ' tras corregir errores automáticamente' : ''}. Se comprueba la sintaxis, no que el programa haga exactamente lo que buscas: pruébalo.`;
    }
    return current;
}

/* ------------------------------------------------------------------ */
/* Ejecución de cada modo                                              */
/* ------------------------------------------------------------------ */
function parseJSONLoose(text) {
    const t = String(text || '').replace(/```json|```/gi, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return {};
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return {}; }
}

const mdUrl = (u) => String(u).replace(/\(/g, '%28').replace(/\)/g, '%29');

async function runThink(prompt, atts) {
    const webOn = Boolean(config.webSearchEnabled);
    if (!webOn) showToast('DuckDuckGo está desactivado: Pensar razonará sin datos de internet.', 'warning', 'Pensar');
    setStatus('GhostUe46 está pensando...');

    let approach = '';
    let queries = null;
    try {
        const plan = parseJSONLoose(await requestChat([
            { role: 'system', content: PLAN_PROMPT },
            { role: 'user', content: String(prompt || '').slice(0, 4000) }
        ]));
        if (typeof plan.approach === 'string') approach = plan.approach.replace(/\s+/g, ' ').slice(0, 500);
        if (Array.isArray(plan.queries)) queries = plan.queries.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.replace(/\s+/g, ' ').trim().slice(0, 140)).slice(0, 3);
    } catch (e) { /* si falla la planificación se sigue con la consulta original */ }
    if (queries === null) queries = [String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 140)].filter(Boolean);

    let research = '';
    const results = [];
    if (webOn && queries.length) {
        setStatus('GhostUe46 está investigando...');
        const found = await Promise.all(queries.map((q) => searchDuckDuckGo(q).catch(() => ({ context: '', searchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(q)}` }))));
        found.forEach((r, i) => {
            const ok = Boolean(r.context) && !/no devolvió un resumen útil|No se pudieron recuperar/.test(r.context);
            results.push({ q: queries[i], url: r.searchUrl, ok });
        });
        research = '\n\n[INVESTIGACIÓN WEB · DuckDuckGo]\n' + found.map((r, i) => `Consulta ${i + 1}: "${queries[i]}"\n${r.context}`).join('\n\n')
            + '\nUsa solo los datos recuperados arriba como evidencia web. Si no son suficientes, dilo claramente.';
        setStatus('GhostUe46 está pensando...');
    }

    const planNote = approach ? `\n\n[PLAN PREVIO]\n${approach}` : '';
    const answer = await chat(`${prompt}${planNote}${research}`, atts, { system: THINK_PROMPT });

    const parts = [];
    if (approach) parts.push(`**Plan:** ${approach}`);
    if (results.length) parts.push('**Consultas en DuckDuckGo:**\n' + results.map((r, i) => `${i + 1}. "${r.q}" — ${r.ok ? 'con resumen' : 'sin resumen útil'} · [ver búsqueda](${mdUrl(r.url)})`).join('\n'));
    else if (!webOn) parts.push('_DuckDuckGo estaba desactivado: se razonó sin datos de internet._');
    return parts.length ? `:::pensando\n${parts.join('\n\n')}\n:::\n${answer}` : answer;
}

async function runCode(prompt, atts) {
    const messages = buildChatMessages(prompt, atts, { system: CODE_PROMPT });
    const answer = await requestChat(messages);
    return verifyAndRepair(answer, messages, { repair: getSpeed() !== 'fast' });
}

async function runArch(prompt, atts) {
    const messages = buildChatMessages(prompt, atts, { system: ARCH_PROMPT });
    const answer = await requestChat(messages);
    return verifyAndRepair(answer, messages, { repair: getSpeed() !== 'fast' });
}

async function runVision(prompt, atts) {
    const imgs = atts.filter(isImg);
    if (!atts.length) showToast('Modo Visión: adjunta una imagen o un archivo con 📎, 🖼️, Ctrl+V o arrastrándolo.', 'info', 'Visión');
    if (imgs.length && /gpt-3\.5/i.test(config.model || '')) showToast(`El modelo «${config.model}» probablemente no puede ver imágenes. Prueba uno con visión (gpt-4o-mini, gemini-2.5-flash…).`, 'warning', 'Visión');
    setStatus(imgs.length ? 'GhostUe46 está mirando tu imagen...' : atts.length ? 'GhostUe46 está analizando tus archivos...' : 'GhostUe46 está respondiendo...');
    const p = prompt || (imgs.length ? 'Analiza en detalle la(s) imagen(es) adjunta(s).' : 'Analiza el/los archivo(s) adjunto(s).');
    return chat(p, atts, { system: VISION_PROMPT });
}

async function run(mode, prompt, atts) {
    atts = atts || [];
    if (mode === 'think') return runThink(prompt, atts);
    if (mode === 'code') return runCode(prompt, atts);
    if (mode === 'archfile') return runArch(prompt, atts);
    if (mode === 'vision') return runVision(prompt, atts);
    return chat(prompt, atts);
}

/* Historial: quita el "proceso de pensamiento" y recuerda imágenes/archivos recientes para preguntas de seguimiento */
const stripTrace = (t) => String(t || '').replace(/^:::pensando\n[\s\S]*?\n:::[ \t]*(?:\n|$)/, '');

function buildHistory(past) {
    const limit = { fast: 6, normal: 20, slow: Infinity }[getSpeed()];
    if (past.length > limit) {
        past = past.slice(-limit);
        if (past[0] && past[0].role === 'assistant') past = past.slice(1);
    }
    let imgBudget = 3, textBudget = 40000;
    const out = past.map((m) => ({ role: m.role, content: stripTrace(m.content), atts: Array.isArray(m.attachments) ? m.attachments : [] }));
    for (let i = out.length - 1; i >= 0; i--) {
        const m = out[i];
        if (m.role !== 'user' || !m.atts.length) continue;
        const next = past[i + 1];
        const failed = next && next.role === 'assistant' && String(next.content || '').startsWith('⚠️ **Error');
        if (failed) continue;
        let extra = '';
        m.atts.filter((a) => !isImg(a)).forEach((a) => {
            const body = String(a.data || '').slice(0, Math.max(0, Math.min(20000, textBudget)));
            if (!body) return;
            textBudget -= body.length;
            extra += `\n\n[Archivo: ${a.name}]\n\`\`\`\n${body}\n\`\`\``;
        });
        const imgs = m.atts.filter((a) => isImg(a) && String(a.data || '').startsWith('data:')).slice(0, imgBudget);
        imgBudget -= imgs.length;
        const text = `${m.content}${extra}`;
        m.content = imgs.length
            ? [{ type: 'text', text: text || 'Imagen adjunta.' }, ...imgs.map((a) => ({ type: 'image_url', image_url: { url: a.data } }))]
            : text;
    }
    return out.map(({ role, content }) => ({ role, content }));
}

/* ------------------------------------------------------------------ */
/* Lectura de archivos adjuntos (Visión)                               */
/* ------------------------------------------------------------------ */
const LIBS = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    docx: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
};
const scriptCache = {};
function loadLib(src) {
    scriptCache[src] ||= new Promise((ok, bad) => {
        const s = document.createElement('script');
        s.src = src; s.onload = ok;
        s.onerror = () => { delete scriptCache[src]; bad(new Error('No se pudo cargar una librería necesaria (¿sin conexión?).')); };
        document.head.appendChild(s);
    });
    return scriptCache[src];
}

const MAX_TEXT = 60000;
const clip = (t, n = MAX_TEXT) => (t.length > n ? `${t.slice(0, n)}\n\n[…recortado: se muestran los primeros ${n.toLocaleString('es')} de ${t.length.toLocaleString('es')} caracteres]` : t);
const readAs = (file, kind) => new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => bad(new Error('No se pudo leer el archivo.'));
    kind === 'dataURL' ? r.readAsDataURL(file) : kind === 'buffer' ? r.readAsArrayBuffer(file) : r.readAsText(file);
});

async function readImage(file) {
    const raw = await readAs(file, 'dataURL');
    if (!/^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.type) || typeof createImageBitmap !== 'function') return { data: raw, type: file.type };
    try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
        if (scale === 1 && file.size < 1.5 * 1024 * 1024) { bmp.close?.(); return { data: raw, type: file.type }; }
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close?.();
        return { data: c.toDataURL('image/jpeg', 0.85), type: 'image/jpeg' };
    } catch (e) { return { data: raw, type: file.type }; }
}

async function readPdf(file, name) {
    await loadLib(LIBS.pdf);
    pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await readAs(file, 'buffer')) }).promise;
    const limit = Math.min(doc.numPages, 40);
    let text = '';
    for (let i = 1; i <= limit && text.length < MAX_TEXT; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += `\n--- Página ${i} ---\n${content.items.map((it) => it.str).join(' ')}`;
    }
    const head = `[PDF · ${doc.numPages} página(s)${doc.numPages > limit ? `, leídas ${limit}` : ''}]`;
    const hasText = text.replace(/--- Página \d+ ---|\s/g, '').length > 40;
    const out = [{ name, type: 'application/pdf', size: file.size, data: `${head}${hasText ? clip(text) : '\nEste PDF no tiene texto seleccionable (probablemente es un escaneo). Se adjuntan sus primeras páginas como imágenes.'}` }];
    if (!hasText) {
        for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
            const page = await doc.getPage(i);
            const vp = page.getViewport({ scale: 1.5 });
            const c = document.createElement('canvas');
            c.width = Math.round(vp.width); c.height = Math.round(vp.height);
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            out.push({ name: `${name.replace(/\.pdf$/i, '')}-pag${i}.jpg`, type: 'image/jpeg', size: 0, data: c.toDataURL('image/jpeg', 0.85) });
        }
    }
    return out;
}

async function readDocx(file, name) {
    await loadLib(LIBS.docx);
    const r = await mammoth.extractRawText({ arrayBuffer: await readAs(file, 'buffer') });
    return [{ name, type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: file.size, data: `[Documento Word]\n${clip(r.value || '')}` }];
}

async function readSheet(file, name) {
    await loadLib(LIBS.xlsx);
    const wb = XLSX.read(await readAs(file, 'buffer'), { type: 'array' });
    let text = '[Hoja de cálculo]';
    wb.SheetNames.slice(0, 8).forEach((sn) => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]).split('\n');
        text += `\n\n--- Hoja: ${sn} (${csv.length} filas) ---\n${csv.slice(0, 200).join('\n')}${csv.length > 200 ? '\n[…más filas omitidas]' : ''}`;
    });
    return [{ name, type: file.type || 'application/vnd.ms-excel', size: file.size, data: clip(text) }];
}

async function readZip(file, name) {
    await loadLib(LIBS.zip);
    const zip = await JSZip.loadAsync(await readAs(file, 'buffer'));
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    let text = `[ZIP · ${entries.length} archivo(s)]\n${entries.slice(0, 200).map((f) => `- ${f.name}`).join('\n')}${entries.length > 200 ? '\n[…más archivos omitidos]' : ''}`;
    const readable = entries.filter((f) => /\.(txt|md|json|js|mjs|ts|jsx|tsx|html?|css|py|java|c|h|cpp|hpp|cs|xml|yml|yaml|toml|ini|cfg|csv|bat|sh|lua|php|rb|go|rs|kt|gradle|properties|mcmeta|svg)$/i.test(f.name) && (f._data?.uncompressedSize ?? 0) < 60000).slice(0, 15);
    let used = 0;
    for (const f of readable) {
        if (used > 120000) break;
        const body = await f.async('string');
        used += body.length;
        text += `\n\n--- ${f.name} ---\n${body.slice(0, 20000)}`;
    }
    return [{ name, type: file.type || 'application/zip', size: file.size, data: clip(text, 160000) }];
}

async function readText(file, name) {
    const raw = await readAs(file, 'text');
    const bad = (raw.slice(0, 4000).match(/\uFFFD|\u0000/g) || []).length;
    if (bad > 20) return [{ name, type: file.type || 'application/octet-stream', size: file.size, data: `[Archivo binario ${ext(name).toUpperCase() || file.type || 'desconocido'} de ${file.size.toLocaleString('es')} bytes: no se puede leer como texto.]` }];
    return [{ name, type: file.type && !file.type.startsWith('image/') ? file.type : 'text/plain', size: file.size, data: clip(raw) }];
}

async function processFile(file) {
    const name = file.name || `archivo-${Date.now()}`;
    const e = ext(name), type = file.type || '';
    const mb = file.size / 1048576;
    const tooBig = (limit) => { if (mb > limit) throw new Error(`«${name}» pesa ${mb.toFixed(1)} MB y el máximo para este tipo es ${limit} MB.`); };

    if (type.startsWith('image/') && type !== 'image/svg+xml') {
        tooBig(25);
        const img = await readImage(file);
        return [{ name: file.name || `imagen-portapapeles-${Date.now()}.png`, type: img.type || 'image/png', size: file.size, data: img.data }];
    }
    if (e === 'pdf' || type === 'application/pdf') { tooBig(25); return readPdf(file, name); }
    if (e === 'docx') { tooBig(25); return readDocx(file, name); }
    if (['xlsx', 'xls', 'ods'].includes(e)) { tooBig(25); return readSheet(file, name); }
    if (e === 'zip') { tooBig(25); return readZip(file, name); }
    tooBig(8);
    return readText(file, name);
}

/* ------------------------------------------------------------------ */
/* ArchFile: tarjetas de archivos, vista previa y descarga             */
/* ------------------------------------------------------------------ */
const bundles = {};
let bundleSeq = 0;
const FILE_ICON = { html: 'fa-globe', htm: 'fa-globe', css: 'fa-brush', md: 'fa-file-lines', txt: 'fa-file-lines', bat: 'fa-terminal', cmd: 'fa-terminal', sh: 'fa-terminal', ps1: 'fa-terminal', zip: 'fa-file-zipper' };
const MIME = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', md: 'text/markdown', xml: 'application/xml', svg: 'image/svg+xml', csv: 'text/csv' };

function cleanName(n) {
    const parts = String(n).replace(/\\/g, '/').split('/').filter((p) => p && p !== '.' && p !== '..');
    return parts.join('/').slice(0, 120) || 'archivo.txt';
}
const sizeLabel = (s) => (s < 1024 ? `${s} B` : `${(s / 1024).toFixed(1)} KB`);

const STORAGE_SHIM = '<script>(function(){function mk(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}try{window.localStorage.getItem("x")}catch(e){try{Object.defineProperty(window,"localStorage",{value:mk(),configurable:true});Object.defineProperty(window,"sessionStorage",{value:mk(),configurable:true})}catch(_){}}})();<\/script>';

function buildPreviewDoc(files) {
    const pick = files.find((f) => /(^|\/)index\.html?$/i.test(f.name)) || files.find((f) => /\.html?$/i.test(f.name));
    if (!pick) return '';
    const find = (ref) => {
        const clean = String(ref).split(/[?#]/)[0].replace(/^\.?\//, '').replace(/^\//, '');
        return files.find((f) => f !== pick && (f.name === clean || f.name.split('/').pop() === clean.split('/').pop()));
    };
    let html = pick.content;
    html = html.replace(/<link\b[^>]*>/gi, (tag) => {
        if (!/rel=["']?stylesheet/i.test(tag)) return tag;
        const href = tag.match(/href=["']([^"']+)["']/i);
        const f = href && !/^https?:|^\/\//i.test(href[1]) ? find(href[1]) : null;
        return f ? `<style>\n${f.content}\n</style>` : tag;
    });
    html = html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
        const f = !/^https?:|^\/\//i.test(src) ? find(src) : null;
        return f ? `<script ${a} ${b}>\n${f.content.replace(/<\/script/gi, '<\\/script')}\n</script>` : tag;
    });
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + STORAGE_SHIM) : STORAGE_SHIM + html;
}

function bundleHTML(files) {
    const id = `b${++bundleSeq}`;
    bundles[id] = files;
    const doc = buildPreviewDoc(files);
    const preview = doc ? `
        <div class="arch-preview">
            <div class="arch-pbar">
                <span class="arch-ptitle"><i class="fa-solid fa-eye"></i> Vista previa interactiva</span>
                <span class="arch-devices">
                    <button type="button" class="arch-btn" data-arch="device" data-bundle="${id}" data-device="mobile" title="Móvil"><i class="fa-solid fa-mobile-screen"></i></button>
                    <button type="button" class="arch-btn" data-arch="device" data-bundle="${id}" data-device="tablet" title="Tablet"><i class="fa-solid fa-tablet-screen-button"></i></button>
                    <button type="button" class="arch-btn is-on" data-arch="device" data-bundle="${id}" data-device="desktop" title="Ordenador"><i class="fa-solid fa-desktop"></i></button>
                    <button type="button" class="arch-btn" data-arch="reload" data-bundle="${id}" title="Recargar"><i class="fa-solid fa-rotate-right"></i></button>
                    <button type="button" class="arch-btn" data-arch="fullscreen" data-bundle="${id}" title="Pantalla completa"><i class="fa-solid fa-expand"></i></button>
                </span>
            </div>
            <div class="arch-frame-wrap" data-device="desktop">
                <iframe class="arch-frame" title="Vista previa del sitio" sandbox="allow-scripts allow-forms allow-modals allow-popups" referrerpolicy="no-referrer" srcdoc="${esc(doc)}"></iframe>
            </div>
            <p class="arch-note">La vista previa funciona en un espacio aislado: los botones y scripts funcionan, pero no tiene acceso a tus datos de GhostUe46.</p>
        </div>` : '';
    const list = files.map((f, i) => `
        <details class="arch-file">
            <summary>
                <span class="arch-fname"><i class="fa-solid ${FILE_ICON[ext(f.name)] || 'fa-file-code'}"></i> ${esc(f.name)} <small>${sizeLabel(f.content.length)}</small></span>
                <span class="arch-fbtns">
                    <button type="button" class="arch-btn" data-arch="copy" data-bundle="${id}" data-file="${i}" title="Copiar"><i class="fa-regular fa-copy"></i></button>
                    <button type="button" class="arch-btn" data-arch="download" data-bundle="${id}" data-file="${i}" title="Descargar"><i class="fa-solid fa-download"></i></button>
                </span>
            </summary>
            <pre><code>${esc(f.content)}</code></pre>
        </details>`).join('');
    return `<section class="arch-bundle">
        <header class="arch-head">
            <span class="arch-title"><i class="fa-solid fa-folder-tree"></i> ArchFile · ${files.length} archivo${files.length === 1 ? '' : 's'}</span>
            <button type="button" class="arch-btn arch-zip" data-arch="zip" data-bundle="${id}"><i class="fa-solid fa-file-zipper"></i> Descargar todo (.zip)</button>
        </header>${preview}
        <div class="arch-files">${list}</div>
    </section>`;
}

const _parseMd = window.parseMarkdownAndCode;
if (typeof _parseMd === 'function') {
    window.parseMarkdownAndCode = function (text, context = {}) {
        text = String(text ?? '');
        // Seguridad de contexto: un HTML que aparezca en una respuesta normal, Pensar, Código o Visión
        // se renderiza como código. Solo las respuestas marcadas como ArchFile reciben vista previa.
        const renderMode = typeof context === 'string' ? context : (context && context.intelligenceMode) || 'none';
        if (renderMode !== 'archfile') return _parseMd.call(this, text);
        const traces = [];
        text = text.replace(/^:::pensando\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/, (m, inner) => { traces.push(inner); return '@@GHOSTTRACE0@@\n'; });
        const files = [];
        text = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (m, info, code) => {
            const p = parseInfo(info);
            if (!p.file) return m;
            files.push({ name: cleanName(p.file), lang: p.lang, content: code.replace(/\n$/, '') });
            return files.length === 1 ? '@@GHOSTBUNDLE@@' : '';
        });
        let html = _parseMd.call(this, text);
        if (files.length) html = html.replace('@@GHOSTBUNDLE@@', () => bundleHTML(files));
        if (traces.length) {
            html = html.replace('@@GHOSTTRACE0@@', () => `<details class="intel-trace"><summary><i class="fa-solid fa-brain"></i> Proceso de pensamiento</summary><div class="intel-trace-body">${_parseMd.call(this, traces[0])}</div></details>`);
        }
        return html;
    };
}

function download(name, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: `${mime || 'text/plain'};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url; a.download = name.split('/').pop(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
        const t = document.createElement('textarea');
        t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        t.remove(); return ok;
    }
}

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-arch]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const files = bundles[btn.dataset.bundle];
    if (!files) return;
    const file = files[Number(btn.dataset.file)];
    const action = btn.dataset.arch;
    const section = btn.closest('.arch-bundle');
    if (action === 'copy' && file) showToast((await copyText(file.content)) ? `${file.name} copiado.` : 'No se pudo copiar.', 'info', 'Portapapeles');
    else if (action === 'download' && file) download(file.name, file.content, MIME[ext(file.name)]);
    else if (action === 'zip') {
        try {
            await loadLib(LIBS.zip);
            const zip = new JSZip();
            files.forEach((f) => zip.file(f.name, f.content));
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'ghostue46-archivos.zip'; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            showToast('ZIP creado con todos los archivos.', 'export', 'ArchFile');
        } catch (err) {
            showToast('No se pudo crear el ZIP (necesita conexión para cargar la librería). Descargo los archivos uno a uno.', 'warning', 'ArchFile');
            files.forEach((f) => download(f.name, f.content, MIME[ext(f.name)]));
        }
    } else if (section) {
        const wrap = section.querySelector('.arch-frame-wrap');
        const frame = section.querySelector('.arch-frame');
        if (action === 'device' && wrap) {
            wrap.dataset.device = btn.dataset.device;
            section.querySelectorAll('[data-arch="device"]').forEach((b) => b.classList.toggle('is-on', b === btn));
        } else if (action === 'reload' && frame) {
            const doc = frame.srcdoc; frame.srcdoc = '';
            requestAnimationFrame(() => { frame.srcdoc = doc; });
        } else if (action === 'fullscreen' && frame) {
            if (frame.requestFullscreen) frame.requestFullscreen().catch(() => showToast('Tu navegador no permitió la pantalla completa.', 'warning', 'ArchFile'));
            else showToast('Tu navegador no permite la pantalla completa para esta vista.', 'warning', 'ArchFile');
        }
    }
});

/* ------------------------------------------------------------------ */
window.GhostIntel = { getMode, setMode, getSpeed, setSpeed, speedInstructions, chat, run, processFile, buildHistory, parseInfo, extractBlocks, MODES };
initPanel();
})();
