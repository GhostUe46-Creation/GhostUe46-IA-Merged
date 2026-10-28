const DEFAULT_CUSTOM_THEME = {
    accentPrimary: '#38bdf8',
    accentSecondary: '#a855f7',
    bg1: '#050816',
    bg2: '#0e233b',
    panel: '#0a1428',
    text: '#f1f5f9',
    msgUser: '#1b2352',
    msgAssistant: '#08233b',
    border: '#add8ff',
    inputBg: '#050a19',
    glassOpacity: 62,
    blur: 24,
    radius: 24,
    fontFamily: '',
    fontCustom: '',
    fontScale: 100,
    fontCode: false
};

const DEFAULT_CONFIG = {
    provider: 'openrouter',
    apiKey: '',
    streamEnabled: true,
    ttsAutoRead: false,
    ttsVoiceGender: 'female',
    customEndpoint: '',
    dailyMessageLimit: 0,
    model: 'openai/gpt-3.5-turbo',
    webSearchEnabled: false,
    memoryEnabled: false,
    memories: [],
    theme: 'frutiger-aero',
    primaryColor: '#38bdf8',
    secondaryColor: '#a855f7',
    customTheme: { ...DEFAULT_CUSTOM_THEME },
    animationsEnabled: true,
    intelligenceMode: 'none',
    responseSpeed: 'normal',
    mode: 'light', bubbleStyle: 'frutiger-aero', xlmbEnabled: true, particlesEnabled: true, dynamicCircles: true, uiAnimations: true, liquidAnimated: true, distortion: 36,
    fxColors: ['#7dd3fc', '#1e3a8a', '#22c55e', '#ffffff'],
    persona: 'Eres GhostUe46, un asistente de IA transparente estilo agua de alta resolución. Experta en código JAVA, JAVASCRIPT, HTML, CSS, C, C++, C#, PYTHON, DirectX, OpenGL y Vulkan (estos tres últimos en fase BETA), investigación web en DuckDuckGo y gestión de archivos descargables.'
};

function readStoredJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
    } catch (error) {
        console.warn(`No se pudo leer ${key}; se usarán valores predeterminados.`, error);
        return fallback;
    }
}

let config = (() => {
    const saved = readStoredJSON('ghost_config_v2', {});
    const hasAeroChatPreset = Boolean(saved && saved.__aeroChatPresetV1);
    const merged = saved && typeof saved === 'object' && !Array.isArray(saved)
        ? { ...DEFAULT_CONFIG, ...saved }
        : { ...DEFAULT_CONFIG };
    // Apply the new interface preset exactly once while preserving existing API settings,
    // memory and chat history. After the first launch, the user can choose any theme.
    if (!hasAeroChatPreset) {
        merged.theme = 'frutiger-aero';
        merged.mode = 'light';
        merged.bubbleStyle = 'frutiger-aero';
        merged.__aeroChatPresetV1 = true;
    }
    // Descarta campos heredados de integraciones multimedia retiradas.
    delete merged.pollinationsKey;
    if (typeof merged.streamEnabled !== 'boolean') merged.streamEnabled = true;
    if (typeof merged.ttsAutoRead !== 'boolean') merged.ttsAutoRead = false;
    if (!['female', 'male'].includes(merged.ttsVoiceGender)) merged.ttsVoiceGender = 'female';
    if (typeof merged.customEndpoint !== 'string') merged.customEndpoint = '';
    merged.dailyMessageLimit = Math.max(0, Math.min(100000, Number(merged.dailyMessageLimit) || 0));
    if (!Array.isArray(merged.memories)) merged.memories = [];
    if (!['default', 'liquid-glass', 'material-you', 'aurora', 'frutiger-aero', 'assassins-creed-2', 'synthwave', 'custom'].includes(merged.theme)) merged.theme = 'default';
    if (!merged.customTheme || typeof merged.customTheme !== 'object') merged.customTheme = { ...DEFAULT_CUSTOM_THEME };
    else merged.customTheme = { ...DEFAULT_CUSTOM_THEME, ...merged.customTheme };
    if (!['none', 'think', 'code', 'archfile', 'vision'].includes(merged.intelligenceMode)) merged.intelligenceMode = 'none';
    if (!['fast', 'normal', 'slow'].includes(merged.responseSpeed)) merged.responseSpeed = 'normal';
    // Rápido y Pensar no son compatibles entre sí.
    if (merged.intelligenceMode === 'think' && merged.responseSpeed === 'fast') merged.responseSpeed = 'normal';
    if (typeof merged.webSearchEnabled !== 'boolean') merged.webSearchEnabled = false;
    if (typeof merged.memoryEnabled !== 'boolean') merged.memoryEnabled = false;
    if (typeof merged.animationsEnabled !== 'boolean') merged.animationsEnabled = true;
    if (typeof merged.particlesEnabled !== 'boolean') merged.particlesEnabled = true;
    if (!Array.isArray(merged.fxColors) || merged.fxColors.length < 4) {
        merged.fxColors = ['#7dd3fc', '#1e3a8a', '#22c55e', '#ffffff'];
    }
    return merged;
})();

const savedSessions = readStoredJSON('ghost_sessions', []);
let sessions = Array.isArray(savedSessions)
    ? savedSessions.filter(item => item && typeof item === 'object' && item.id && Array.isArray(item.messages))
    : [];
let currentSessionId = (() => {
    try { return localStorage.getItem('ghost_current_id') || null; }
    catch (error) { return null; }
})();
        let selectedAttachments = [];
        let pyodideInstance = null;
        let speechRecognition = null;

        const CODE_TEMPLATES = {
            python: `# Código Python 3 Real
def saludar(nombre):
    print(f"¡Hola {nombre} desde GhostUe46 Engine!")

saludar("Usuario")
num = [x**2 for x in range(5)]
print("Cuadrados calculados:", num)`,
            javascript: `// JavaScript Execution Engine
function calcular() {
    console.log("GhostUe46 JS Engine en ejecución");
    return [10, 20, 30].reduce((a, b) => a + b, 0);
}
console.log("Resultado:", calcular());`,
            html: `<!-- HTML Preview -->
<div style="color: #38bdf8; font-family: Orbitron, sans-serif; padding: 20px; text-align: center;">
    <h2>Efecto Water Crystal Glass</h2>
    <p>Renderizado en tiempo real por GhostUe46</p>
</div>`,
            css: `/* Reglas CSS3 Validables */
.water-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(15px);
    border-radius: 16px;
}`,
            java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Sintaxis Java comprobada en GhostUe46");
    }
}`,
            c: `#include <stdio.h>
int main() {
    printf("Sintaxis C verificada\\n");
    return 0;
}`,
            cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Sintaxis C++ validada" << endl;
    return 0;
}`,
            csharp: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Sintaxis C# analizada.");
    }
}`,
            directx: `// DirectX HLSL (BETA) — plantilla de vertex shader
struct VSInput {
    float3 position : POSITION;
};

struct VSOutput {
    float4 position : SV_POSITION;
};

VSOutput main(VSInput input) {
    VSOutput output;
    output.position = float4(input.position, 1.0);
    return output;
}`,
            opengl: `// OpenGL GLSL (BETA) — vertex shader
#version 330 core
layout (location = 0) in vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1.0);
}`,
            vulkan: `// Vulkan GLSL (BETA) — vertex shader; compile separately to SPIR-V
#version 450
layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = vec4(inPosition, 1.0);
}`
        };

// Language logos used by the animated code-generation indicator.
const CODE_LANGUAGE_INDICATORS = {
    directx: { label: 'DirectX · BETA', logo: 'assets/directx-logo.png', pattern: /\b(?:direct\s*x|directx|dx\s*11|dx\s*12|hlsl)\b/i, beta: true },
    opengl: { label: 'OpenGL · BETA', logo: 'assets/opengl-logo.png', pattern: /\b(?:open\s*gl|opengl|glsl)\b/i, beta: true },
    vulkan: { label: 'Vulkan · BETA', logo: 'assets/vulkan-logo.png', pattern: /\b(?:vulkan|spir[ -]?v|spirv)\b/i, beta: true },
    csharp: { label: 'C#', logo: 'assets/csharp-logo.png', pattern: /\b(?:c\s*#|csharp|c\s+sharp)(?=\W|$)/i },
    cpp: { label: 'C++', logo: 'assets/cpp-logo.png', pattern: /\b(?:c\s*\+\+|cpp|cplusplus)(?=\W|$)/i },
    javascript: { label: 'JavaScript', logo: 'assets/javascript-logo.webp', pattern: /\b(?:javascript|java\s*script|js)\b/i },
    python: { label: 'Python', logo: 'assets/python-logo.png', pattern: /\bpython\b|\.py\b/i },
    html: { label: 'HTML', logo: 'assets/html-logo.png', pattern: /\bhtml\b/i },
    css: { label: 'CSS', logo: 'assets/css-logo.svg', pattern: /\bcss\b/i },
    java: { label: 'Java', logo: 'assets/java-logo.webp', pattern: /\bjava\b/i },
    c: { label: 'C', logo: 'assets/c-logo.png', pattern: /\b(?:lenguaje\s+c|c)\b/i }
};

function detectRequestedCodeLanguage(prompt) {
    const text = String(prompt || '').toLowerCase();
    const creationIntent = /\b(crea|crear|creame|genera|generar|escribe|escribir|haz|hazlo|hazla|hazme|hacer|programa|programar|codifica|codificar|implementa|implementar|desarrolla|desarrollar|construye|construir|corrige|corregir|actualiza|actualizar|modifica|modificar|arma|prepara|diseña|diseñar)\b/.test(text);
    const codeContext = /\b(c[oó]digo|code|script|programa|programaci[oó]n|funci[oó]n|clase|p[aá]gina|sitio|web|shader|renderizaci[oó]n|gr[aá]ficos|api|mod|bot|app|aplicaci[oó]n|archivo|hlsl|glsl|spir[ -]?v)\b/.test(text);
    if (!creationIntent && !codeContext) return null;

    // Check longer language names first to avoid matching the "C" inside C++ or C#.
    const ordered = ['directx', 'opengl', 'vulkan', 'csharp', 'cpp', 'javascript', 'python', 'html', 'css', 'java', 'c'];
    for (const key of ordered) {
        const item = CODE_LANGUAGE_INDICATORS[key];
        if (item.pattern.test(text)) {
            // A plain "C" is ambiguous in ordinary prose; only use it with explicit code intent.
            if (key === 'c' && !creationIntent && !/\b(?:lenguaje\s+c|codigo\s+c|c code)\b/i.test(text)) continue;
            return { key, ...item };
        }
    }
    return null;
}

const BETA_GRAPHICS_WARNING = 'GhostUe46 puede crear esta instrucción para OpenGL, DirectX y Vulkan, pero estas tecnologías están en fase BETA. El código generado podría no funcionar correctamente. Por favor, verifica el código antes de usarlo.';

function detectBetaGraphicsAPI(prompt) {
    const text = String(prompt || '');
    for (const key of ['directx', 'opengl', 'vulkan']) {
        const item = CODE_LANGUAGE_INDICATORS[key];
        if (item && item.pattern.test(text)) return { key, ...item };
    }
    return null;
}

function setTypingIndicator(prompt, mode) {
    const indicator = document.getElementById('typing-indicator');
    const text = document.getElementById('typing-indicator-text');
    const languageName = document.getElementById('typing-language-name');
    const languageLogo = document.getElementById('typing-language-logo');
    const language = detectRequestedCodeLanguage(prompt);

    indicator.classList.remove('is-slow');
    text.classList.add('status-fade');

    if (mode === 'investigating') {
        text.textContent = 'GhostUe46 Está Investigando...';
        languageName.textContent = '';
        languageName.classList.add('hidden');
        languageLogo.removeAttribute('src');
        languageLogo.alt = '';
        languageLogo.title = '';
        languageLogo.classList.add('hidden');
        indicator.dataset.mode = 'investigating';
        return;
    }

    if (language) {
        text.textContent = `GhostUe46 está creando el código de ${language.label}`;
        languageName.textContent = language.label;
        languageName.classList.remove('hidden');
        languageLogo.src = language.logo;
        languageLogo.onerror = () => languageLogo.classList.add('hidden');
        languageLogo.alt = `Logo de ${language.label}`;
        languageLogo.title = language.label;
        languageLogo.classList.remove('hidden');
        indicator.dataset.mode = 'code';
    } else {
        text.textContent = 'GhostUe46 está respondiendo...';
        languageName.textContent = '';
        languageName.classList.add('hidden');
        languageLogo.removeAttribute('src');
        languageLogo.alt = '';
        languageLogo.title = '';
        languageLogo.classList.add('hidden');
        indicator.dataset.mode = 'response';
    }
}


        function updateTimeGreeting() {
            const emojiElement = document.getElementById('time-greeting-emoji');
            const textElement = document.getElementById('time-greeting-text');
            const banner = document.getElementById('time-greeting-banner');
            if (!emojiElement || !textElement || !banner) return;

            // Usa la hora local del dispositivo, sin enviar datos a ningún servidor.
            const hour = new Date().getHours();
            let emoji;
            let greeting;
            let period;

            if (hour >= 5 && hour < 12) {
                emoji = '🌞';
                greeting = 'Buenos días :D';
                period = 'morning';
            } else if (hour >= 12 && hour < 18) {
                emoji = '🌤️';
                greeting = 'Buenas tardes :P';
                period = 'afternoon';
            } else {
                emoji = '🌙';
                greeting = 'Buenas noches :/';
                period = 'night';
            }

            emojiElement.textContent = emoji;
            textElement.textContent = greeting;
            banner.dataset.period = period;
            banner.setAttribute('aria-label', `${emoji} ${greeting}`);
        }

        window.addEventListener('DOMContentLoaded', () => {
            initCanvasBackground();
            initPyodide();
            initSpeechRecognition();
            updateTimeGreeting();
            // Actualiza el saludo periódicamente por si la página queda abierta.
            window.setInterval(updateTimeGreeting, 60_000);

            if (sessions.length === 0) {
                createNewChat(false);
            } else {
                if (!currentSessionId || !sessions.find(s => s.id === currentSessionId)) {
                    currentSessionId = sessions[0].id;
                }
                loadCurrentSession();
            }
            renderSessionList();
            loadConfigIntoUI();
            applyTheme(config.theme, false);
            syncSettingsUI();
            saveStorage();
        });

        // Background waves with trailing particles (colors + toggles from config)
        function hexToRgba(hex, alpha) {
            const h = String(hex || '#ffffff').replace('#', '');
            if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }

        function getFxColors() {
            const defaults = ['#7dd3fc', '#1e3a8a', '#22c55e', '#ffffff'];
            const list = Array.isArray(config.fxColors) ? config.fxColors : defaults;
            return defaults.map((d, i) => validColor(list[i], d));
        }

        // ---- Animus (tema Assassin's Creed II) ----
        // Dos hélices de ADN dibujadas con rombos (blanco, gris y rojo), cruzadas por líneas de datos horizontales y verticales.
        const ANIMUS_COLORS = { white: '#f3f4f6', gray: '#9ca3af', red: '#e5253a', darkRed: '#7f1d1d' };
        function animusDiamond(ctx, x, y, r) {
            ctx.beginPath();
            ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.72, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.72, y);
            ctx.closePath();
        }
        function drawHelix(ctx, cx, R, h, step, scale, speed, alpha) {
            const gap = 24 * scale;
            const front = [];
            ctx.lineWidth = 1;
            let prevA = null, prevB = null;
            for (let y = -gap; y <= h + gap; y += gap) {
                const phase = y * 0.011 / scale + step * speed;
                const sx = Math.sin(phase) * R, depth = Math.cos(phase); // depth: -1 (atrás) .. 1 (delante)
                const a = { x: cx + sx, y, d: depth }, b = { x: cx - sx, y, d: -depth };
                // zigzag de cada hebra: forma las celdas rómbicas de la hélice
                ctx.strokeStyle = `rgba(156,163,175,${0.32 * alpha})`;
                if (prevA) { ctx.beginPath(); ctx.moveTo(prevA.x, prevA.y); ctx.lineTo(a.x, a.y); ctx.stroke(); }
                ctx.strokeStyle = `rgba(229,37,58,${0.38 * alpha})`;
                if (prevB) { ctx.beginPath(); ctx.moveTo(prevB.x, prevB.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
                // peldaños entre hebras (más tenues cuanto más lejos)
                ctx.strokeStyle = `rgba(243,244,246,${(0.1 + 0.16 * Math.abs(depth)) * alpha})`;
                ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); ctx.stroke();
                front.push({ n: a, c: depth >= 0 ? ANIMUS_COLORS.white : ANIMUS_COLORS.gray }, { n: b, c: -depth >= 0 ? ANIMUS_COLORS.red : ANIMUS_COLORS.darkRed });
                // rombito en medio del peldaño
                ctx.fillStyle = `rgba(243,244,246,${0.35 * alpha})`;
                animusDiamond(ctx, cx, y, 2.2 * scale); ctx.fill();
                prevA = a; prevB = b;
            }
            // nodos: los de atrás primero para que los de delante los tapen
            front.sort((p, q) => p.n.d - q.n.d).forEach(({ n, c }) => {
                const r = (3.2 + (n.d + 1) * 2.6) * scale;
                ctx.globalAlpha = (0.35 + 0.65 * ((n.d + 1) / 2)) * alpha;
                ctx.fillStyle = c; animusDiamond(ctx, n.x, n.y, r); ctx.fill();
                if (n.d > 0.55) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.8; animusDiamond(ctx, n.x, n.y, r + 2); ctx.stroke(); }
            });
            ctx.globalAlpha = 1;
        }
        function drawAnimus(ctx, w, h, step) {
            ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
            const R = Math.max(46, Math.min(130, Math.min(w, h) * 0.13));
            drawHelix(ctx, w * 0.8, R, h, step, 1, 2.2, 1);                  // hélice principal
            drawHelix(ctx, w * 0.1, R * 0.6, h, step, 0.7, -1.6, 0.7);       // hélice lejana, gira al revés
            // rombos grandes de contorno que laten
            for (let i = 0; i < 5; i++) {
                const cx = w * (0.18 + i * 0.17), cy = h * (0.22 + 0.5 * ((i * 0.37 + step * 0.05) % 1));
                const r = 26 + 10 * Math.sin(step * 3 + i * 1.7);
                ctx.strokeStyle = i % 2 ? 'rgba(229,37,58,.28)' : 'rgba(243,244,246,.2)'; ctx.lineWidth = 1;
                animusDiamond(ctx, cx, cy, r); ctx.stroke(); animusDiamond(ctx, cx, cy, r * 0.5); ctx.stroke();
            }
            // línea de escaneo roja que baja y líneas verticales grises que se desplazan
            const sy = (step * 70) % (h + 160) - 80;
            const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 2);
            g.addColorStop(0, 'rgba(229,37,58,0)'); g.addColorStop(1, 'rgba(229,37,58,.32)');
            ctx.fillStyle = g; ctx.fillRect(0, sy - 30, w, 32);
            ctx.fillStyle = 'rgba(243,244,246,.5)'; ctx.fillRect(0, sy + 1, w, 1);
            for (let i = 0; i < 6; i++) {
                const x = ((i * 0.19 + step * 0.012) % 1) * w;
                ctx.fillStyle = i % 3 === 0 ? 'rgba(229,37,58,.14)' : 'rgba(156,163,175,.1)';
                ctx.fillRect(x, 0, 1, h);
            }
        }

        function initCanvasBackground() {
            const canvas = document.getElementById('bg-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            let w = 0, h = 0, step = 0;

            function resize() {
                w = canvas.width = window.innerWidth;
                h = canvas.height = window.innerHeight;
            }
            window.addEventListener('resize', resize);
            resize();

            const particles = [];
            for (let i = 0; i < 60; i++) {
                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    size: Math.random() * 3 + 1,
                    colorIndex: i % 4,
                    trail: []
                });
            }

            function animate() {
                // Con imagen de fondo propia el lienzo se limpia (sin estela): si no, la capa translúcida se acumularía y taparía la imagen.
                if (document.documentElement.hasAttribute('data-user-bg')) {
                    ctx.clearRect(0, 0, w, h);
                } else {
                    ctx.fillStyle = window.__canvasFill || 'rgba(2, 6, 23, 0.22)';
                    ctx.fillRect(0, 0, w, h);
                }

                step += 0.008;
                const colors = document.documentElement.dataset.theme === 'synthwave' ? ['#ff2bd6', '#22d3ee', '#ff9f1c', '#a78bfa'] : getFxColors();

                // Tema Assassin's Creed II: la hélice de ADN rómbica del Animus ocupa el lugar de las ondas XLMB
                const isAnimus = document.documentElement.dataset.theme === 'assassins-creed-2';
                if (isAnimus) {
                    if (config.xlmbEnabled !== false) drawAnimus(ctx, w, h, step);
                } else if (config.xlmbEnabled !== false) {
                    // Waves with glow crossing through panels
                    ctx.lineWidth = 3.8;
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    for (let i = 0; i < 4; i++) {
                        const c = colors[i % 4];
                        ctx.beginPath();
                        ctx.strokeStyle = hexToRgba(c, 0.42);
                        ctx.shadowColor = hexToRgba(c, 0.75);
                        ctx.shadowBlur = 18;
                        for (let x = 0; x <= w; x += 16) {
                            const y = Math.sin(x * 0.003 + step + i) * 90 + Math.cos(x * 0.002 - step) * 60 + (h / 2) + (i * 45 - 75);
                            if (x === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.stroke();
                        // Soft outer glow pass
                        ctx.shadowBlur = 32;
                        ctx.strokeStyle = hexToRgba(c, 0.16);
                        ctx.lineWidth = 7;
                        ctx.stroke();
                        ctx.lineWidth = 3.8;
                    }
                    // Crossing waves
                    for (let j = 0; j < 3; j++) {
                        const c = colors[(j + 1) % 4];
                        ctx.beginPath();
                        ctx.strokeStyle = hexToRgba(c, 0.3);
                        ctx.shadowColor = hexToRgba(c, 0.65);
                        ctx.shadowBlur = 16;
                        for (let x = 0; x <= w; x += 16) {
                            const y = Math.cos(x * 0.004 - step * 1.2 + j) * 100 + Math.sin(x * 0.001 + step) * 50 + (h / 2) + (j * -60 + 60);
                            if (x === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.stroke();
                    }
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                }

                // Trailing star particles (independent toggle)
                if (config.particlesEnabled !== false) {
                    particles.forEach(p => {
                        p.x += p.vx;
                        p.y += p.vy;

                        if (p.x < 0) p.x = w;
                        if (p.x > w) p.x = 0;
                        if (p.y < 0) p.y = h;
                        if (p.y > h) p.y = 0;

                        p.trail.push({ x: p.x, y: p.y });
                        if (p.trail.length > 8) p.trail.shift();

                        const pColor = isAnimus ? ['#f3f4f6', '#9ca3af', '#e5253a', '#f3f4f6'][p.colorIndex % 4] : colors[p.colorIndex % 4];
                        for (let k = 0; k < p.trail.length; k++) {
                            const point = p.trail[k];
                            const alpha = k / p.trail.length;
                            ctx.fillStyle = pColor;
                            ctx.globalAlpha = alpha * 0.5;
                            ctx.fillRect(point.x, point.y, p.size, p.size);
                        }
                        ctx.globalAlpha = 1.0;
                        ctx.fillStyle = isAnimus ? '#ffffff' : (colors[3] || '#ffffff');
                        ctx.fillRect(p.x - 1, p.y - 1, p.size + 1, p.size + 1);
                    });
                }

                requestAnimationFrame(animate);
            }
            animate();
        }

        function syncFxColorControls() {
            const colors = getFxColors();
            for (let i = 0; i < 4; i++) {
                const input = document.getElementById(`fx-color-${i + 1}`);
                const label = document.getElementById(`fx-color-${i + 1}-val`);
                if (input) input.value = colors[i];
                if (label) label.textContent = colors[i].toUpperCase();
            }
        }

        function onFxColorsChange() {
            const next = [];
            for (let i = 1; i <= 4; i++) {
                const el = document.getElementById(`fx-color-${i}`);
                next.push(validColor(el?.value, ['#7dd3fc', '#1e3a8a', '#22c55e', '#ffffff'][i - 1]));
            }
            config.fxColors = next;
            syncFxColorControls();
            saveStorage();
        }

        function resetFxColors() {
            config.fxColors = ['#7dd3fc', '#1e3a8a', '#22c55e', '#ffffff'];
            syncFxColorControls();
            saveStorage();
            showToast('Azul claro, azul marino, verde y blanco restaurados.', 'theme', 'Colores de efectos');
        }

        async function initPyodide() {
            try {
                pyodideInstance = await loadPyodide();
                console.log("Pyodide WASM activo.");
            } catch (e) {
                console.warn("Pyodide offline:", e);
            }
        }

        function initSpeechRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
                speechRecognition = new SpeechRec();
                speechRecognition.continuous = false;
                speechRecognition.interimResults = false;
                speechRecognition.lang = 'es-ES';

                speechRecognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    const inputEl = document.getElementById('user-input');
                    inputEl.value += (inputEl.value ? ' ' : '') + transcript;
                    showToast("Voz convertida a texto", "info");
                    document.getElementById('mic-btn').classList.remove('text-red-400', 'animate-pulse');
                };

                speechRecognition.onerror = () => {
                    showToast("Error en reconocimiento de voz", "error");
                    document.getElementById('mic-btn').classList.remove('text-red-400', 'animate-pulse');
                };
            }
        }

        function toggleSpeechToText() {
            if (!speechRecognition) {
                showToast("Dictado no soportado por este navegador.", "error");
                return;
            }
            const micBtn = document.getElementById('mic-btn');
            try {
                speechRecognition.start();
                micBtn.classList.add('text-red-400', 'animate-pulse');
                showToast("Escuchando...", "info");
            } catch (e) {
                speechRecognition.stop();
                micBtn.classList.remove('text-red-400', 'animate-pulse');
            }
        }

        // Notificación estilo Xbox Series X (abajo centro). type: info|success|error|warning|upload|export|search|memory|theme
        function showToast(message, type = 'info', title) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const presets = {
                error:   { icon: 'fa-triangle-exclamation', title: 'Error', meta: 'Fallo' },
                success: { icon: 'fa-circle-check', title: 'Listo', meta: 'Completado' },
                info:    { icon: 'fa-circle-info', title: 'GhostUe46', meta: 'Aviso' },
                warning: { icon: 'fa-triangle-exclamation', title: 'Atención', meta: 'Aviso' },
                upload:  { icon: 'fa-cloud-arrow-up', title: 'Archivo adjunto', meta: 'Subida' },
                export:  { icon: 'fa-file-export', title: 'Exportado', meta: 'Descarga' },
                search:  { icon: 'fa-globe', title: 'Búsqueda web', meta: 'Internet' },
                memory:  { icon: 'fa-brain', title: 'Memoria', meta: 'Local' },
                theme:   { icon: 'fa-palette', title: 'Apariencia', meta: 'Tema' }
            };
            const kind = presets[type] ? type : 'info';
            const p = presets[kind];
            const heading = title || p.title;

            const toast = document.createElement('div');
            toast.className = 'xbox-toast';
            toast.dataset.type = kind;
            toast.innerHTML = `
                <div class="xbox-toast-icon" aria-hidden="true"><i class="fa-solid ${p.icon}"></i></div>
                <div class="xbox-toast-body">
                    <div class="xbox-toast-title">${escapeHtml(heading)}</div>
                    <div class="xbox-toast-msg">${escapeHtml(String(message || ''))}</div>
                </div>
                <div class="xbox-toast-meta">${escapeHtml(p.meta)}</div>
            `;

            // Máximo 3 a la vez
            while (container.children.length >= 3) {
                container.firstElementChild?.remove();
            }
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('is-visible'));

            const lifetime = kind === 'error' ? 5200 : 4200;
            setTimeout(() => {
                toast.classList.remove('is-visible');
                toast.classList.add('is-hiding');
                setTimeout(() => toast.remove(), 380);
            }, lifetime);
        }

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const expandBtn = document.getElementById('expand-sidebar-btn');
            sidebar.classList.toggle('hidden');
            if (sidebar.classList.contains('hidden')) {
                expandBtn.classList.remove('hidden');
            } else {
                expandBtn.classList.add('hidden');
            }
        }

        function createNewChat(switchNow = true) {
            const newSession = {
                id: 'ghost_chat_' + Date.now(),
                title: 'Conversación ' + (sessions.length + 1),
                messages: []
            };
            sessions.unshift(newSession);
            currentSessionId = newSession.id;
            saveStorage();
            renderSessionList();
            loadCurrentSession();

            if (switchNow) {
                triggerWelcomeMessage();
                showToast("Nueva conversación iniciada", "success");
            }
        }

        function switchSession(id) {
            currentSessionId = id;
            saveStorage();
            renderSessionList();
            loadCurrentSession();
        }

        function deleteSession(id, event) {
            event.stopPropagation();
            sessions = sessions.filter(s => s.id !== id);
            if (sessions.length === 0) {
                createNewChat(false);
            } else if (currentSessionId === id) {
                currentSessionId = sessions[0].id;
            }
            saveStorage();
            renderSessionList();
            loadCurrentSession();
            showToast("Conversación eliminada", "info");
        }

        function clearAllChats() {
            sessions = [];
            createNewChat(true);
            showToast("Todos los chats eliminados", "info");
        }

        function saveStorage() {
            try {
                localStorage.setItem('ghost_sessions', JSON.stringify(sessions));
                localStorage.setItem('ghost_current_id', currentSessionId || '');
                localStorage.setItem('ghost_config_v2', JSON.stringify(config));
            } catch (error) {
                console.warn('El almacenamiento del navegador no está disponible.', error);
                showToast('El navegador bloqueó el guardado local. La sesión seguirá funcionando temporalmente.', 'error');
            }
        }

        let sessionFilter = '';
        function setSessionFilter(value) { sessionFilter = String(value || '').trim().toLowerCase(); renderSessionList(); }

        function togglePinSession(id, event) {
            if (event) event.stopPropagation();
            const sess = sessions.find(x => x.id === id);
            if (!sess) return;
            sess.pinned = !sess.pinned;
            saveStorage(); renderSessionList();
            showToast(sess.pinned ? 'Conversación fijada arriba.' : 'Conversación desfijada.', 'info');
        }

        function startRenameSession(id, event) {
            if (event) event.stopPropagation();
            const sess = sessions.find(x => x.id === id);
            const row = document.querySelector(`[data-session-row="${id}"]`);
            if (!sess || !row) return;
            const label = row.querySelector('.session-title');
            const input = document.createElement('input');
            input.type = 'text'; input.value = sess.title; input.maxLength = 60; input.className = 'session-rename-input';
            input.setAttribute('aria-label', 'Nuevo nombre de la conversación');
            label.replaceWith(input);
            input.focus(); input.select();
            let finished = false;
            const finish = (save) => {
                if (finished) return; finished = true;
                const name = input.value.trim().slice(0, 60);
                if (save && name) { sess.title = name; sess.renamed = true; saveStorage(); }
                renderSessionList();
                if (id === currentSessionId) { const t = document.getElementById('current-chat-title'); if (t) t.innerText = sess.title; }
            };
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); e.stopPropagation(); });
            input.addEventListener('blur', () => finish(true));
            input.addEventListener('click', (e) => e.stopPropagation());
        }

        function renderSessionList() {
            const container = document.getElementById('session-list');
            container.innerHTML = '';
            const q = sessionFilter;
            const matches = (sess) => !q || sess.title.toLowerCase().includes(q) || (sess.messages || []).some(m => String(m.content || '').toLowerCase().includes(q));
            const list = sessions.filter(matches).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            if (!list.length) {
                const empty = document.createElement('p');
                empty.className = 'text-[11px] text-slate-400 text-center py-4';
                empty.textContent = q ? 'Ninguna conversación coincide.' : 'Aún no hay conversaciones.';
                container.appendChild(empty);
                return;
            }
            list.forEach(session => {
                const isActive = session.id === currentSessionId;
                const div = document.createElement('div');
                div.dataset.sessionRow = session.id;
                div.className = `group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${isActive ? 'water-glass border-cyan-400/50 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`;
                div.onclick = () => switchSession(session.id);
                div.ondblclick = (e) => startRenameSession(session.id, e);
                div.innerHTML = `
                    <div class="flex items-center space-x-3 truncate min-w-0">
                        ${session.pinned ? '<i class="fa-solid fa-thumbtack session-pin-mark" title="Fijada"></i>' : '<img src="assets/frutiger-aero-logo.png" alt="" class="conversation-logo" aria-hidden="true">'}
                        <span class="text-xs font-audiowide truncate session-title">${escapeHtml(session.title)}</span>
                    </div>
                    <div class="flex items-center shrink-0 session-actions">
                        <button type="button" onclick="togglePinSession('${session.id}', event)" class="text-slate-500 hover:text-cyan-300 p-1.5" title="${session.pinned ? 'Desfijar' : 'Fijar arriba'}" aria-label="${session.pinned ? 'Desfijar conversación' : 'Fijar conversación'}"><i class="fa-solid fa-thumbtack text-xs"></i></button>
                        <button type="button" onclick="startRenameSession('${session.id}', event)" class="text-slate-500 hover:text-cyan-300 p-1.5" title="Renombrar (o doble clic)" aria-label="Renombrar conversación"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button type="button" onclick="deleteSession('${session.id}', event)" class="text-slate-500 hover:text-red-400 p-1.5" title="Eliminar" aria-label="Eliminar conversación"><i class="fa-solid fa-xmark text-xs"></i></button>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function loadCurrentSession() {
            const session = sessions.find(s => s.id === currentSessionId);
            if (!session) return;

            document.getElementById('current-chat-title').innerText = session.title;
            const chatContainer = document.getElementById('chat-messages');
            chatContainer.innerHTML = '';

            session.messages.forEach(msg => {
                // Guarda el modo en el mensaje asistente: las vistas previas HTML solo se habilitan
                // cuando la respuesta se generó expresamente con Inteligencia → ArchFile.
                appendMessageToDOM(msg.role, msg.content, msg.attachments || [], msg.intelligenceMode || 'none');
            });

            scrollToBottom();
        }

        function triggerWelcomeMessage() {
            const welcomeText = "Hola, soy **GhostUe46**. \n\nPuedo procesar y generar código en **JAVA, JAVASCRIPT, HTML, CSS, C, C++, C#, PYTHON**, realizar búsquedas web en **DuckDuckGo** y procesar tus archivos adjuntos.";
            addMessageToSession('assistant', welcomeText);
            loadCurrentSession();
        }

        function handleFileSelect(event) {
            // Se copia la lista antes de vaciar el input; el procesado (PDF, Word, Excel, ZIP, imágenes) vive en intelligence.js.
            const files = Array.from(event.target.files || []);
            event.target.value = '';
            addFilesToAttachments(files);
        }

        function renderAttachmentPreview() {
            const bar = document.getElementById('attachment-preview-bar');
            if (selectedAttachments.length === 0) {
                bar.classList.add('hidden');
                return;
            }
            bar.classList.remove('hidden');
            bar.innerHTML = '';

            selectedAttachments.forEach((att, idx) => {
                const card = document.createElement('div');
                card.className = 'water-glass rounded-xl p-2 flex items-center space-x-2 text-xs text-white border border-white/10 flex-shrink-0';
                card.innerHTML = `
                    <i class="fa-solid ${att.type.startsWith('image/') ? 'fa-image text-purple-400' : 'fa-file-code text-cyan-400'}"></i>
                    <span class="truncate max-w-[100px] font-mono text-[11px]">${escapeHtml(att.name)}</span>
                    <button onclick="removeAttachment(${idx})" class="text-slate-400 hover:text-red-400 ml-1">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;
                bar.appendChild(card);
            });
        }

        function removeAttachment(index) {
            selectedAttachments.splice(index, 1);
            renderAttachmentPreview();
        }

        function handleKeydown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                document.getElementById('chat-form').requestSubmit();
            }
        }

        async function handleSendMessage(event) {
            event.preventDefault();
            // No iniciar una segunda petición mientras la primera sigue activa.
            if (activeRequestController) return;
            const inputEl = document.getElementById('user-input');
            const prompt = inputEl.value.trim();

            if (!prompt && selectedAttachments.length === 0) return;

            inputEl.value = '';
            const currentAttachments = [...selectedAttachments];
            selectedAttachments = [];
            renderAttachmentPreview();

            const newlyRemembered = captureMemoryRequest(prompt);
            if (newlyRemembered) {
                showToast('Guardé esa nota en la memoria local de GhostUe46.', 'memory', 'Nota recordada');
                const notes = document.getElementById('memory-notes-input');
                if (notes) notes.value = config.memories.join('\n');
                updateMemoryStatus();
            }

            addMessageToSession('user', prompt, currentAttachments);
            const betaGraphicsAPI = detectBetaGraphicsAPI(prompt);
            if (betaGraphicsAPI) {
                addMessageToSession('assistant', `⚠️ **Aviso de funciones en fase BETA**\n\n${BETA_GRAPHICS_WARNING}`);
            }
            loadCurrentSession();

            const typingIndicator = document.getElementById('typing-indicator');
            setTypingIndicator(prompt);
            typingIndicator.classList.remove('hidden');
            scrollToBottom();

            const requestController = new AbortController();
            activeRequestController = requestController;
            let liveBubble = null;
            setResponseBusy(true);

            try {
                let finalResponse;
                const intelMode = (window.GhostIntel && window.GhostIntel.getMode()) || 'none';
                if (intelMode !== 'none') {
                    // Inteligencia de GhostUe46: Pensar, Código, ArchFile o Visión (ver intelligence.js)
                    finalResponse = await window.GhostIntel.run(intelMode, prompt, currentAttachments);
                } else {
                    let augmentedPrompt = prompt;
                    let searchPageUrl = '';
                    if (shouldSearchWeb(prompt)) {
                        setTypingIndicator(prompt, 'investigating');
                        const webData = await searchDuckDuckGo(prompt);
                        if (requestController.signal.aborted) throw makeRequestAbortError();
                        searchPageUrl = webData.searchUrl;
                        augmentedPrompt += `\n\n[INFORMACIÓN WEB: DuckDuckGo]\n${webData.context}\nUsa solo los datos recuperados arriba como evidencia web. Si el resumen no contiene información suficiente, dilo claramente y no inventes fuentes.`;
                        setTypingIndicator(prompt);
                    }

                    // Respuesta en vivo: el texto aparece mientras el modelo escribe (no en modo Lento, que revisa su respuesta).
                    const imageIntentForPrompt = isExplicitImageGenerationRequest([{ role: 'user', content: augmentedPrompt }]);
                    if (config.streamEnabled && config.responseSpeed !== 'slow' && !imageIntentForPrompt) {
                        liveBubble = createLiveBubble();
                        streamSink = { onToken: (text) => { typingIndicator.classList.add('hidden'); liveBubble.update(text); } };
                    }
                    let aiResponse;
                    try {
                        aiResponse = window.GhostIntel && window.GhostIntel.chat
                            ? await window.GhostIntel.chat(augmentedPrompt, currentAttachments)
                            : await callSelectedChatAPI(augmentedPrompt, currentAttachments);
                    } finally { streamSink = null; if (liveBubble) liveBubble.done(); }
                    finalResponse = searchPageUrl ? `${aiResponse}\n\n[Ver búsqueda completa en DuckDuckGo](${searchPageUrl})` : aiResponse;
                }
                typingIndicator.classList.add('hidden');
                addMessageToSession('assistant', finalResponse, [], { intelligenceMode: intelMode });
                if (config.ttsAutoRead && window.GhostTTS) {
                    const spoken = window.GhostTTS.speak(finalResponse, config.ttsVoiceGender || 'female');
                    if (!spoken.ok && spoken.reason === 'unsupported') showToast('Este navegador no ofrece Texto a Voz. Prueba con Chrome o Edge.', 'warning', 'TTS no disponible');
                }

                const session = sessions.find(s => s.id === currentSessionId);
                if (session && session.messages.length <= 3 && !session.renamed) {
                    session.title = prompt.length > 20 ? prompt.substring(0, 20) + '...' : prompt;
                }

                saveStorage();
                loadCurrentSession();

            } catch (err) {
                typingIndicator.classList.add('hidden');
                if (requestController.signal.aborted || (err && err.name === 'AbortError')) {
                    if (window.GhostTTS && typeof window.GhostTTS.stop === 'function') window.GhostTTS.stop();
                    // Recarga el chat desde el historial guardado para quitar cualquier burbuja parcial.
                    loadCurrentSession();
                    showToast('La respuesta se detuvo.', 'info', 'GhostUe46');
                } else {
                    showToast(err.message || 'No se pudo completar la petición.', 'error', 'Error de API');
                    addMessageToSession('assistant', `⚠️ **Error en API (${config.provider}):** ${err.message}. Verifica tu API Key en configuración.`);
                    loadCurrentSession();
                }
            } finally {
                if (activeRequestController === requestController) activeRequestController = null;
                setResponseBusy(false);
            }
        }

        // Proveedores compatibles con la API de chat de OpenAI (y Anthropic, con formato propio).
        const CHAT_ENDPOINTS = {
            openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-3.5-turbo', name: 'OpenRouter' },
            groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', name: 'GROQ' },
            openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', name: 'OpenAI' },
            grok: { url: 'https://api.x.ai/v1/chat/completions', model: 'grok-3-mini', name: 'Grok' },
            gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', name: 'Gemini' },
            nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.1-70b-instruct', name: 'NVIDIA' },
            anthropic: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5-5', name: 'Anthropic', format: 'anthropic' },
            // META = API oficial de Llama de Meta (compatible con OpenAI). Si cambia la URL, usa «Endpoint personalizado».
            meta: { url: 'https://api.llama.com/compat/v1/chat/completions', model: 'Llama-3.3-70B-Instruct', name: 'META (Llama API)' },
            // LLAMA = Llama en tu propio equipo (Ollama por defecto). No necesita API Key.
            llama: { url: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2', name: 'LLAMA (local)', keyOptional: true }
        };
        window.CHAT_ENDPOINTS = CHAT_ENDPOINTS;

        // ---- Contador de uso por proveedor (todo local) ----
        const USAGE_PROVIDERS_KEY = 'ghost_usage_providers_v1';
        const usageToday = () => new Date().toISOString().slice(0, 10);
        function readProviderUsage() {
            try { const v = JSON.parse(localStorage.getItem(USAGE_PROVIDERS_KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
        }
        function estimateTokens(text) { return Math.ceil(String(text || '').length / 4); }
        function messagesText(messages) {
            return (messages || []).map(m => Array.isArray(m.content) ? m.content.map(c => (c && c.text) || '').join(' ') : String(m.content || '')).join('\n');
        }
        function recordProviderUsage(provider, model, inTok, outTok, estimated, failed) {
            try {
                const all = readProviderUsage();
                const u = all[provider] || { requests: 0, errors: 0, inTokens: 0, outTokens: 0, estimated: false, days: {} };
                const day = usageToday();
                const d = u.days[day] || { requests: 0, inTokens: 0, outTokens: 0 };
                if (failed) { u.errors += 1; } else {
                    u.requests += 1; u.inTokens += inTok; u.outTokens += outTok; d.requests += 1; d.inTokens += inTok; d.outTokens += outTok;
                    if (estimated) u.estimated = true;
                }
                u.days[day] = d;
                Object.keys(u.days).sort().slice(0, -45).forEach(k => delete u.days[k]); // solo 45 días
                u.lastModel = model; u.lastAt = Date.now();
                all[provider] = u;
                localStorage.setItem(USAGE_PROVIDERS_KEY, JSON.stringify(all));
                window.dispatchEvent(new CustomEvent('ghost-usage-changed', { detail: { provider, day: d } }));
            } catch (e) { /* almacenamiento bloqueado: no se cuenta */ }
        }

        // Lector de SSE (respuestas en vivo)
        async function readSSE(res, onData) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
                    const block = buf.slice(0, idx);
                    buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
                    const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
                    if (data) onData(data);
                }
            }
        }

        // Convierte los mensajes estilo OpenAI al formato de Anthropic.
        function toAnthropicPayload(messages) {
            const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
            const convert = (c) => {
                if (!Array.isArray(c)) return String(c || '');
                return c.map(part => {
                    if (part.type === 'image_url' && part.image_url && /^data:(image\/[a-z+.-]+);base64,/i.test(part.image_url.url || '')) {
                        const m = part.image_url.url.match(/^data:(image\/[a-z+.-]+);base64,(.*)$/is);
                        return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
                    }
                    return { type: 'text', text: part.text || '' };
                });
            };
            const chat = [];
            messages.filter(m => m.role !== 'system').forEach(m => {
                const role = m.role === 'assistant' ? 'assistant' : 'user';
                const content = convert(m.content);
                const last = chat[chat.length - 1];
                if (last && last.role === role) { // Anthropic exige roles alternados
                    const toArr = x => Array.isArray(x) ? x : [{ type: 'text', text: x }];
                    last.content = [...toArr(last.content), ...toArr(content)];
                } else chat.push({ role, content });
            });
            if (chat.length && chat[0].role !== 'user') chat.unshift({ role: 'user', content: '(inicio de la conversación)' });
            return { system, chat };
        }

        // Respuesta en vivo y controlador de cancelación de la petición actual.
        let streamSink = null;
        let activeRequestController = null;

        function setResponseBusy(busy) {
            const form = document.getElementById('chat-form');
            const button = document.getElementById('send-btn');
            if (!form || !button) return;
            form.classList.toggle('is-generating', Boolean(busy));
            button.classList.toggle('send-stop-button', Boolean(busy));
            if (busy) {
                button.type = 'button';
                button.dataset.action = 'stopResponse';
                button.disabled = false;
                button.title = 'Parar respuesta de GhostUe46';
                button.setAttribute('aria-label', 'Parar respuesta de GhostUe46');
                button.innerHTML = '<i class="fa-solid fa-stop text-xs" aria-hidden="true"></i><span>Parar respuesta</span>';
            } else {
                button.type = 'submit';
                delete button.dataset.action;
                button.disabled = false;
                button.title = 'Enviar mensaje';
                button.setAttribute('aria-label', 'Enviar mensaje');
                button.innerHTML = '<i class="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>';
            }
        }

        function stopCurrentResponse() {
            const controller = activeRequestController;
            if (!controller || controller.signal.aborted) return;
            controller.abort();
            if (window.GhostTTS && typeof window.GhostTTS.stop === 'function') window.GhostTTS.stop();
            const button = document.getElementById('send-btn');
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs" aria-hidden="true"></i><span>Deteniendo…</span>';
                button.setAttribute('aria-label', 'Deteniendo respuesta');
            }
        }

        function makeRequestAbortError() {
            const error = new Error('La respuesta fue detenida por el usuario.');
            error.name = 'AbortError';
            return error;
        }

        // Burbuja del asistente que se va rellenando mientras llega la respuesta.
        function createLiveBubble() {
            appendMessageToDOM('assistant', '', []);
            const container = document.getElementById('chat-messages');
            const bubble = container.lastElementChild;
            const body = bubble ? bubble.querySelector('.prose') : null;
            let pending = null, raf = 0;
            const paint = () => {
                raf = 0;
                if (!body || pending == null) return;
                const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 140;
                body.innerHTML = parseMarkdownAndCode(pending) + '<span class="stream-caret" aria-hidden="true"></span>';
                if (nearBottom) container.scrollTop = container.scrollHeight;
            };
            return {
                update(text) { pending = text; if (!raf) raf = requestAnimationFrame(paint); },
                done() { if (raf) cancelAnimationFrame(raf); raf = 0; if (body && pending != null) body.innerHTML = parseMarkdownAndCode(pending); }
            };
        }

        // Detecta peticiones explícitas de generación (no preguntas explicativas sobre cómo programarla).
        function getLastUserText(messages) {
            const lastUser = [...(Array.isArray(messages) ? messages : [])].reverse().find(m => m && m.role === 'user');
            if (!lastUser) return '';
            if (typeof lastUser.content === 'string') return lastUser.content;
            if (Array.isArray(lastUser.content)) return lastUser.content.map(part => typeof part === 'string' ? part : (part && (part.text || part.type === 'text' && part.text) || '')).join('\n');
            return '';
        }

        function isExplicitImageGenerationRequest(messages) {
            const text = getLastUserText(messages).trim();
            const questionStart = text.replace(/^[\s¿?¡!.,;:]+/, '');
            if (!text || /^(?:c[oó]mo|how to|expl[ií]ca|explique|dime c[oó]mo|tell me how)\b/i.test(questionStart) || /\bquiero saber c[oó]mo\b/i.test(text)) return false;
            if (/\b(?:c[oó]digo|script|programa|html|javascript|css)\b/i.test(text) && /\b(?:para|que permita|que haga)\b/i.test(text) && /\b(?:imagen|foto|ilustraci[oó]n|image|picture)\b/i.test(text)) return false;
            const thing = '(?:imagen(?:es)?|foto(?:graf[ií]a)?s?|ilustraci[oó]n(?:es)?|dibujo(?:s)?|image(?:s)?|picture(?:s)?|photo(?:s)?|artwork)';
            const action = '(?:puedes\s+(?:hacer(?:me)?|crear|generar|dibujar)|podr[ií]as\s+(?:hacer|crear|generar|dibujar)|genera(?:r)?|crea(?:r)?|dibuja(?:r)?|haz(?:me)?|hacer(?:me)?|dame|manda(?:me)?|pon(?:me)?|enseña(?:me)?|produce|renderiza|env[ií]a(?:me)?|muestra(?:me)?|generate|create|draw|make|render|show me|send me|quiero ver|quiero)';
            const pattern = new RegExp('\\b' + action + '\\b[\\s\\S]{0,80}\\b' + thing + '\\b', 'i');
            return pattern.test(text);
        }

        async function requestOpenRouterWithImageTool(messages, endpoint, model2, headers, inTokEst) {
            const outgoingMessages = (Array.isArray(messages) ? messages : []).map(m => ({ ...m }));
            const imageInstruction = 'El usuario ha pedido explícitamente generar una imagen. Usa la herramienta openrouter:image_generation para crearla; después responde brevemente en español y asegúrate de mostrar la imagen generada en la respuesta. No inventes enlaces de imágenes.';
            const systemIndex = outgoingMessages.findIndex(m => m.role === 'system');
            if (systemIndex >= 0 && typeof outgoingMessages[systemIndex].content === 'string') {
                outgoingMessages[systemIndex] = { ...outgoingMessages[systemIndex], content: `${imageInstruction}\n\n${outgoingMessages[systemIndex].content}` };
            } else outgoingMessages.unshift({ role: 'system', content: imageInstruction });

            const body = {
                model: model2,
                messages: outgoingMessages,
                stream: false,
                tools: [{ type: 'openrouter:image_generation', parameters: { model: 'openai/gpt-5-image-mini', quality: 'medium', size: '1024x1024', output_format: 'png' } }],
                tool_choice: 'auto'
            };
            let response;
            try {
                response = await fetch(endpoint.url, { method: 'POST', headers, body: JSON.stringify(body), signal: activeRequestController?.signal });
            } catch (error) {
                throw new Error('No se pudo conectar con OpenRouter para generar la imagen. Revisa tu conexión.');
            }
            let data;
            try { data = await response.json(); } catch { throw new Error(`OpenRouter devolvió una respuesta no válida (HTTP ${response.status}).`); }
            if (!response.ok || data.error) {
                const detail = data && data.error && (data.error.message || data.error);
                throw new Error(detail || `OpenRouter no pudo generar la imagen (HTTP ${response.status}).`);
            }
            const message = data.choices && data.choices[0] && data.choices[0].message;
            if (!message) throw new Error('OpenRouter no devolvió una respuesta de imagen.');
            let text = message.content;
            const imageUrls = [];
            const addUrl = candidate => {
                const url = typeof candidate === 'string' ? candidate : '';
                if (/^(?:https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(url) && !imageUrls.includes(url)) imageUrls.push(url);
            };
            if (Array.isArray(text)) {
                text = text.map(part => {
                    if (!part || typeof part !== 'object') return typeof part === 'string' ? part : '';
                    if (part.type === 'image_url') addUrl(part.image_url && part.image_url.url);
                    if (part.type === 'image' && part.url) addUrl(part.url);
                    return part.text || '';
                }).filter(Boolean).join('\n');
            } else text = typeof text === 'string' ? text : '';
            (Array.isArray(message.images) ? message.images : []).forEach(image => {
                addUrl(image && (image.image_url && image.image_url.url || image.url || image.imageUrl));
            });
            const extraImages = imageUrls.filter(url => !text.includes(url)).map((url, i) => `![Imagen generada por GhostUe46 ${i + 1}](${url})`);
            if (extraImages.length) text = `${text.trim()}\n\n${extraImages.join('\n\n')}`.trim();
            if (!text.trim()) text = 'OpenRouter terminó la solicitud, pero no devolvió texto ni una imagen visible. Prueba a pedir la imagen otra vez.';
            const usage = data.usage || {};
            recordProviderUsage(config.provider, model2, Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : inTokEst, Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : estimateTokens(text), !(Number.isFinite(usage.prompt_tokens) && Number.isFinite(usage.completion_tokens)), false);
            return text;
        }

        // Una sola llamada al proveedor. La usan el chat normal y los modos de Inteligencia (planificar, corregir...).
        async function requestChat(messages) {
            const endpoint = CHAT_ENDPOINTS[config.provider];
            if (!endpoint) {
                throw new Error(`El proveedor ${String(config.provider).toUpperCase()} no está disponible en esta versión.`);
            }
            if (!config.apiKey && !endpoint.keyOptional && !config.customEndpoint) {
                throw new Error(`Debes introducir una API Key para el proveedor [${config.provider.toUpperCase()}] en Configuración.`);
            }
            const sink = streamSink; streamSink = null; // se usa una sola vez
            const imageGenerationRequested = isExplicitImageGenerationRequest(messages);
            const wantStream = !!(sink && config.streamEnabled && !imageGenerationRequested);
            // Si el usuario no escribió un modelo (queda el valor genérico), se usa el modelo recomendado de ese proveedor.
            const model2 = (config.model && config.model !== DEFAULT_CONFIG.model) ? config.model : endpoint.model;
            const url = (config.customEndpoint || '').trim() || endpoint.url;
            if (config.customEndpoint && !/^https?:\/\//i.test(url)) throw new Error('El endpoint personalizado debe empezar por http:// o https://');
            if (imageGenerationRequested) {
                if (config.provider === 'openrouter' && !config.customEndpoint) {
                    const imageHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
                    return requestOpenRouterWithImageTool(messages, endpoint, model2, imageHeaders, estimateTokens(messagesText(messages)));
                }
                throw new Error('La generación de imágenes está conectada a OpenRouter (sin Pollinations). Selecciona OpenRouter en Configuración, introduce una API key y vuelve a pedir «genera una imagen de…».');
            }
            const isAnthropic = endpoint.format === 'anthropic' && !config.customEndpoint;
            const inTokEst = estimateTokens(messagesText(messages));
            let headers, body;
            if (isAnthropic) {
                const { system, chat } = toAnthropicPayload(messages);
                headers = { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' };
                body = { model: model2, max_tokens: 8192, messages: chat, stream: wantStream };
                if (system) body.system = system;
            } else {
                headers = { 'Content-Type': 'application/json' };
                if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
                body = { model: model2, messages, stream: wantStream };
            }
            let res;
            try {
                res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: activeRequestController?.signal });
            } catch (error) {
                if (activeRequestController?.signal.aborted || error?.name === 'AbortError') throw error;
                recordProviderUsage(config.provider, model2, 0, 0, true, true);
                const local = /localhost|127\.0\.0\.1/.test(url);
                throw new Error(`No se pudo conectar con ${endpoint.name}${local ? ' (¿está Ollama encendido y con OLLAMA_ORIGINS permitiendo este sitio?)' : ' (revisa tu conexión o el endpoint)'}.`);
            }
            const ctype = res.headers.get('content-type') || '';
            if (!res.ok || !/event-stream/i.test(ctype)) {
                let data;
                try { data = await res.json(); }
                catch (error) { recordProviderUsage(config.provider, model2, 0, 0, true, true); throw new Error(`${endpoint.name} devolvió una respuesta no válida (HTTP ${res.status}).`); }
                if (data.error || !res.ok) { recordProviderUsage(config.provider, model2, 0, 0, true, true); throw new Error((data.error && (data.error.message || data.error)) || `Error ${endpoint.name} (HTTP ${res.status})`); }
                let content, inTok, outTok;
                if (isAnthropic) {
                    content = (data.content || []).map(c => c.text || '').join('');
                    inTok = data.usage && data.usage.input_tokens; outTok = data.usage && data.usage.output_tokens;
                } else {
                    content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                    content = Array.isArray(content) ? content.map(part => part.text || '').join('') : (content == null ? '' : String(content));
                    inTok = data.usage && data.usage.prompt_tokens; outTok = data.usage && data.usage.completion_tokens;
                }
                if (!content) { recordProviderUsage(config.provider, model2, 0, 0, true, true); throw new Error(`${endpoint.name} devolvió una respuesta vacía.`); }
                const exact = Number.isFinite(inTok) && Number.isFinite(outTok);
                recordProviderUsage(config.provider, model2, exact ? inTok : inTokEst, exact ? outTok : estimateTokens(content), !exact, false);
                if (sink && sink.onToken) sink.onToken(content);
                return content;
            }
            // --- Respuesta en vivo (SSE) ---
            let full = '', inTok = null, outTok = null;
            try {
                await readSSE(res, (data) => {
                    if (data === '[DONE]') return;
                    let ev; try { ev = JSON.parse(data); } catch (e) { return; }
                    let piece = '';
                    if (isAnthropic) {
                        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') piece = ev.delta.text || '';
                        else if (ev.type === 'message_start' && ev.message && ev.message.usage) inTok = ev.message.usage.input_tokens;
                        else if (ev.type === 'message_delta' && ev.usage) outTok = ev.usage.output_tokens;
                        else if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'Error en la respuesta en vivo');
                    } else {
                        if (ev.error) throw new Error(ev.error.message || 'Error en la respuesta en vivo');
                        const d = ev.choices && ev.choices[0] && ev.choices[0].delta;
                        piece = (d && typeof d.content === 'string') ? d.content : '';
                        if (ev.usage) { inTok = ev.usage.prompt_tokens; outTok = ev.usage.completion_tokens; }
                    }
                    if (piece) { full += piece; try { sink.onToken(full); } catch (e) {} }
                });
            } catch (error) {
                if (activeRequestController?.signal.aborted || error?.name === 'AbortError') throw error;
                if (!full) { recordProviderUsage(config.provider, model2, 0, 0, true, true); throw error; }
                // Si hubo un corte de red no intencional después de recibir texto, se conserva lo recibido.
            }
            if (!full) { recordProviderUsage(config.provider, model2, 0, 0, true, true); throw new Error(`${endpoint.name} devolvió una respuesta vacía.`); }
            const exact = Number.isFinite(inTok) && Number.isFinite(outTok);
            recordProviderUsage(config.provider, model2, exact ? inTok : inTokEst, exact ? outTok : estimateTokens(full), !exact, false);
            return full;
        }

        // Construye los mensajes que se envían al modelo. extra.system añade instrucciones del modo de Inteligencia activo.
        function buildChatMessages(promptText, attachments, extra = {}) {
            const session = sessions.find(s => s.id === currentSessionId);
            const intel = window.GhostIntel;
            let fileDataText = '';

            (attachments || []).forEach(att => {
                if (!att.type.startsWith('image/')) {
                    fileDataText += `\n\n[Archivo: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\``;
                }
            });

            const fullContent = promptText + fileDataText;
            const savedMemories = config.memoryEnabled && Array.isArray(config.memories) && config.memories.length
                ? `\n\nMEMORIA LOCAL DEL USUARIO (úsala solo como contexto relevante, no la repitas de forma innecesaria):\n- ${config.memories.join('\n- ')}`
                : '';
            const speedText = intel && intel.speedInstructions ? intel.speedInstructions() : '';
            const modeInstructions = [extra.system, speedText].filter(Boolean).map(t => `\n\n${t}`).join('');
            const systemPrompt = `${config.persona || 'Eres GhostUe46, un asistente útil.'}${savedMemories}${modeInstructions}`;
            // The current user message was already saved to the session. Exclude it here to avoid duplicating it.
            const past = session ? session.messages.slice(0, -1) : [];
            const history = intel && intel.buildHistory
                ? intel.buildHistory(past)
                : past.map(m => ({ role: m.role, content: m.content }));
            const imageAttachments = (attachments || []).filter(att => att && typeof att.type === 'string' && att.type.startsWith('image/') && typeof att.data === 'string' && att.data.startsWith('data:'));
            const userContent = imageAttachments.length
                ? [
                    { type: 'text', text: fullContent || 'Por favor, analiza la imagen adjunta.' },
                    ...imageAttachments.map(att => ({ type: 'image_url', image_url: { url: att.data } }))
                  ]
                : fullContent;
            return [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userContent }
            ];
        }

        async function callSelectedChatAPI(promptText, attachments, extra = {}) {
            return requestChat(buildChatMessages(promptText, attachments, extra));
        }

        function addMessageToSession(role, content, attachments = [], metadata = {}) {
            const session = sessions.find(s => s.id === currentSessionId);
            if (!session) return;
            const message = {
                role,
                content,
                attachments,
                timestamp: Date.now()
            };
            if (metadata && typeof metadata.intelligenceMode === 'string') {
                message.intelligenceMode = metadata.intelligenceMode;
            }
            session.messages.push(message);
            saveStorage();
        }

        function appendMessageToDOM(role, content, attachments, intelligenceMode = 'none') {
            const container = document.getElementById('chat-messages');
            const isUser = role === 'user';

            const wrapper = document.createElement('div');
            wrapper.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`;

            const bubble = document.createElement('div');
            bubble.className = `max-w-3xl rounded-3xl p-5 shadow-2xl ${isUser ? 'msg-user text-white' : 'msg-assistant text-slate-100'}`;

            const header = document.createElement('div');
            header.className = 'flex items-center space-x-2 mb-2 text-xs font-audiowide opacity-80';
            header.innerHTML = isUser ?
                `<i class="fa-solid fa-user text-purple-300"></i><span>TÚ</span>` :
                `<img src="assets/frutiger-aero-logo.png" alt="" class="assistant-brand-logo" aria-hidden="true"><span class="text-cyan-300">GhostUe46</span>`;
            if (!isUser) {
                const readButton = document.createElement('button');
                readButton.type = 'button';
                readButton.className = 'g46-tts-message-button';
                readButton.title = 'Leer solo el texto normal de esta respuesta; el código se omite';
                readButton.setAttribute('aria-label', 'Leer respuesta de GhostUe46 en voz alta');
                readButton.innerHTML = '<i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>Escuchar</span>';
                readButton.addEventListener('click', () => {
                    const result = window.GhostTTS ? window.GhostTTS.speak(content, config.ttsVoiceGender || 'female') : { ok: false, reason: 'unsupported' };
                    if (!result.ok && result.reason === 'unsupported') showToast('Este navegador no ofrece Texto a Voz. Prueba con Chrome o Edge.', 'warning', 'TTS no disponible');
                    else if (!result.ok && result.reason === 'no-speech-text') showToast('Esta respuesta no tiene texto normal para leer; el código se ha omitido.', 'info', 'Nada que leer');
                    else if (result.ok) showToast(`Leyendo respuesta con ${result.voice}.`, 'info', 'Texto a voz');
                });
                header.appendChild(readButton);
            }
            bubble.appendChild(header);

            const body = document.createElement('div');
            body.className = 'prose prose-invert max-w-none text-sm leading-relaxed font-sans';
            body.innerHTML = parseMarkdownAndCode(content, { intelligenceMode });
            bubble.appendChild(body);

            if (attachments && attachments.length > 0) {
                const attachBox = document.createElement('div');
                attachBox.className = 'mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2';
                attachments.forEach(att => {
                    if (att.type.startsWith('image/')) {
                        attachBox.innerHTML += `<img src="${att.data}" class="max-w-xs rounded-xl border border-white/20 shadow-md"/>`;
                    } else {
                        attachBox.innerHTML += `
                            <div class="water-glass rounded-xl p-2 text-xs font-mono text-cyan-300 flex items-center space-x-2">
                                <i class="fa-solid fa-file"></i>
                                <span>${escapeHtml(att.name)}</span>
                            </div>
                        `;
                    }
                });
                bubble.appendChild(attachBox);
            }

            wrapper.appendChild(bubble);
            container.appendChild(wrapper);
        }

        function parseMarkdownAndCode(text) {
            // 1) Los bloques de código se apartan (ya escapan su contenido) y 2) TODO el resto se escapa,
            //    para que ni un mensaje del modelo ni una copia de seguridad ajena puedan inyectar HTML.
            const blocks = [];
            let formatted = String(text ?? '').replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
                const cleanLang = lang.trim() || 'code';
                const escapedCode = escapeHtml(code.trim());
                blocks.push(`
                    <div class="my-4 rounded-2xl overflow-hidden border border-white/15 bg-slate-950/90 font-mono text-xs">
                        <div class="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/10">
                            <span class="text-cyan-400 font-audiowide text-[11px]">${cleanLang.toUpperCase()}</span>
                            <div class="flex items-center space-x-2">
                                <button type="button" onclick="copyCodeBlock(this)" data-code="${encodeURIComponent(code.trim())}" class="text-emerald-300 hover:text-white text-[11px] font-audiowide bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-400/30" title="Copiar código">
                                    <i class="fa-solid fa-copy"></i> <span>Copiar</span>
                                </button>
                                <button onclick="sendToEditor(\`${encodeURIComponent(code.trim())}\`, '${cleanLang}')" class="text-purple-300 hover:text-white text-[11px] font-audiowide bg-purple-500/20 px-2 py-1 rounded-lg border border-purple-500/30">
                                    <i class="fa-solid fa-code"></i> Abrir en Editor
                                </button>
                                <button onclick="downloadCodeFile(\`${encodeURIComponent(code.trim())}\`, '${cleanLang}')" class="text-cyan-300 hover:text-white text-[11px] font-audiowide bg-cyan-500/20 px-2 py-1 rounded-lg border border-cyan-500/30">
                                    <i class="fa-solid fa-download"></i> Descargar
                                </button>
                            </div>
                        </div>
                        <pre class="p-4 text-cyan-200 overflow-x-auto"><code>${escapedCode}</code></pre>
                    </div>
                `);
                return `@@GHOSTCODE${blocks.length - 1}@@`;
            });
            formatted = escapeHtml(formatted);
            formatted = formatted.replace(/!\[([^\]]*?)\]\((https?:\/\/[^\s)]+|data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+)\)/g, '<div class="my-3"><img src="$2" alt="$1" class="rounded-2xl border border-white/20 shadow-2xl max-w-full h-auto"/></div>');
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300 font-semibold">$1</strong>');
            formatted = formatted.replace(/\n/g, '<br>');
            return formatted.replace(/@@GHOSTCODE(\d+)@@/g, (m, i) => blocks[Number(i)] || '');
        }

        async function copyCodeBlock(btn) {
            const code = decodeURIComponent(btn.dataset.code || '');
            const label = btn.querySelector('span');
            try {
                if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(code);
                else { const t = document.createElement('textarea'); t.value = code; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
                if (label) { label.textContent = '¡Copiado!'; setTimeout(() => { label.textContent = 'Copiar'; }, 1600); }
            } catch (e) { showToast('No se pudo copiar. Selecciona el código y usa Ctrl+C.', 'error'); }
        }

        function sendToEditor(encodedCode, lang) {
            const code = decodeURIComponent(encodedCode);
            document.getElementById('code-editor-input').value = code;
            
            const select = document.getElementById('editor-lang-select');
            if (CODE_TEMPLATES[lang.toLowerCase()]) {
                select.value = lang.toLowerCase();
            } else {
                select.value = 'python';
            }
            onLanguageChange();
            openEditorModal();
            showToast("Código cargado en el Editor", "info");
        }

        function downloadCodeFile(encodedCode, lang) {
            const code = decodeURIComponent(encodedCode);
            const extMap = { python: 'py', javascript: 'js', html: 'html', css: 'css', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs' };
            const ext = extMap[lang.toLowerCase()] || 'txt';
            const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ghostue46_file.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('El archivo se descargó en tu dispositivo.', 'export', 'Descarga lista');
        }

        function scrollToBottom() {
            const chatContainer = document.getElementById('chat-messages');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function openConfigModal() {
            syncSettingsUI();
            document.getElementById('config-modal').classList.remove('hidden');
            document.getElementById('settings-save-status').textContent = 'Los cambios se guardan en este navegador.';
        }

        function closeConfigModal() {
            document.getElementById('config-modal').classList.add('hidden');
        }

        function toggleModelInput() {
            const provider = document.getElementById('api-provider-select')?.value || 'openrouter';
            const modelInput = document.getElementById('api-model-input');
            if (!modelInput) return;
            const placeholders = {
                openrouter: 'Ej: openai/gpt-4o-mini o un modelo disponible en OpenRouter',
                groq: 'Ej: llama-3.3-70b-versatile', openai: 'Ej: gpt-4o-mini', gemini: 'Ej: gemini-2.5-flash',
                grok: 'Ej: grok-3-mini', anthropic: 'Ej: claude-sonnet-5-5', nvidia: 'Ej: meta/llama-3.1-70b-instruct',
                meta: 'Ej: Llama-3.3-70B-Instruct', llama: 'Ej: llama3.2 (el que tengas en Ollama)'
            };
            modelInput.placeholder = placeholders[provider] || 'Nombre o identificador del modelo';
        }

        function syncSettingsUI() {
            const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
            const setChecked = (id, value) => { const el = document.getElementById(id); if (el) el.checked = Boolean(value); };
            setValue('api-provider-select', config.provider);
            setValue('api-key-input', config.apiKey);
            setValue('custom-endpoint-input', config.customEndpoint || '');
            setValue('daily-limit-input', config.dailyMessageLimit || '');
            setChecked('stream-enabled-input', config.streamEnabled);
            setValue('system-persona-input', config.persona);
            setValue('api-model-input', config.model);
            setChecked('web-search-enabled-input', config.webSearchEnabled);
            setChecked('tts-auto-read-input', config.ttsAutoRead);
            setValue('tts-voice-select', config.ttsVoiceGender || 'female');
            setChecked('memory-enabled-input', config.memoryEnabled);
            setChecked('animations-enabled-input', config.animationsEnabled);
            setValue('memory-notes-input', (config.memories || []).join('\n'));
            setValue('primary-color-input', config.primaryColor || '#38bdf8');
            setValue('secondary-color-input', config.secondaryColor || '#a855f7');
            updateColorLabels();
            toggleModelInput();
            updateThemeControls();
            updateWebSearchUI();
            updateMemoryStatus();
            syncFxColorControls();
            applyTheme(config.theme, false);
        }

        function loadConfigIntoUI() {
            const label = document.getElementById('active-provider-label');
            if (label) label.innerText = `API Chat: ${(config.provider || 'openrouter').toUpperCase()}`;
            const providerSelect = document.getElementById('api-provider-select');
            if (providerSelect) providerSelect.value = config.provider;
            toggleModelInput();
            updateWebSearchUI();
        }

        function saveConfig() {
            config.provider = document.getElementById('api-provider-select').value;
            config.apiKey = document.getElementById('api-key-input').value.trim();
            config.customEndpoint = (document.getElementById('custom-endpoint-input')?.value || '').trim();
            config.dailyMessageLimit = Math.max(0, Math.min(100000, Number(document.getElementById('daily-limit-input')?.value) || 0));
            config.streamEnabled = Boolean(document.getElementById('stream-enabled-input')?.checked);
            config.persona = document.getElementById('system-persona-input').value.trim() || DEFAULT_CONFIG.persona;
            config.model = document.getElementById('api-model-input').value.trim() || DEFAULT_CONFIG.model;
            config.webSearchEnabled = Boolean(document.getElementById('web-search-enabled-input').checked);
            config.ttsAutoRead = Boolean(document.getElementById('tts-auto-read-input')?.checked);
            config.ttsVoiceGender = document.getElementById('tts-voice-select')?.value === 'male' ? 'male' : 'female';
            config.memoryEnabled = Boolean(document.getElementById('memory-enabled-input').checked);
            config.animationsEnabled = Boolean(document.getElementById('animations-enabled-input').checked);
            config.memories = document.getElementById('memory-notes-input').value
                .split('\n').map(note => note.trim()).filter(Boolean).slice(0, 50);
            config.primaryColor = document.getElementById('primary-color-input').value || '#38bdf8';
            config.secondaryColor = document.getElementById('secondary-color-input').value || '#a855f7';
            saveStorage();
            loadConfigIntoUI();
            syncSettingsUI();
            closeConfigModal();
            showToast('Configuración guardada correctamente', 'success');
        }

        function selectTheme(event) {
            const button = event.target.closest('[data-theme-choice]');
            if (!button) return;
            const previousTheme = config.theme;
            config.theme = button.dataset.themeChoice;
            applyTheme(config.theme, true);
            if (config.theme === 'assassins-creed-2' && previousTheme !== 'assassins-creed-2') {
                showToast('Este tema usa un fondo animado con muchas capas y puede ir mal en dispositivos de gama baja. Si notas lentitud, desactiva las animaciones de fondo en Configuración.', 'error', '⚠ Advertencia de rendimiento');
            }
            updateThemeControls();
            saveStorage();
        }

        function applyTheme(theme, preview = true) {
            const allowed = ['default', 'liquid-glass', 'material-you', 'aurora', 'frutiger-aero', 'assassins-creed-2', 'synthwave', 'custom'];
            const selected = allowed.includes(theme) ? theme : 'default';
            document.documentElement.dataset.theme = selected;

            const themeDefaults = {
                default: { primary: '#38bdf8', secondary: '#a855f7' },
                'liquid-glass': { primary: '#67e8f9', secondary: '#a78bfa' },
                aurora: { primary: '#22d3ee', secondary: '#a78bfa' },
                'frutiger-aero': { primary: '#00cfff', secondary: '#20b879' },
                'assassins-creed-2': { primary: '#e5253a', secondary: '#e5e7eb' },
                'synthwave': { primary: '#ff2bd6', secondary: '#22d3ee' },
                'material-you': {
                    primary: validColor(config.primaryColor, '#38bdf8'),
                    secondary: validColor(config.secondaryColor, '#a855f7')
                },
                custom: {
                    primary: validColor(config.customTheme?.accentPrimary, '#38bdf8'),
                    secondary: validColor(config.customTheme?.accentSecondary, '#a855f7')
                }
            };
            const accents = themeDefaults[selected] || themeDefaults.default;
            document.documentElement.style.setProperty('--accent-primary', accents.primary);
            document.documentElement.style.setProperty('--accent-secondary', accents.secondary);

            if (selected === 'custom') {
                applyCustomThemeVars();
            } else {
                clearCustomThemeVars();
            }

            document.body.classList.toggle('no-background-animation', !config.animationsEnabled);
            updateThemeControls();
            if (preview) {
                const descriptions = {
                    default: 'Tema oscuro original de GhostUe46.',
                    'liquid-glass': 'Cristal muy translúcido con reflejos y ondas animadas que simulan refracción bajo el agua.',
                    'material-you': 'Colores dinámicos según tu selección personal.',
                    aurora: 'Tema creado para GhostUe46: azul glaciar, violeta y brillo suave.',
                    'frutiger-aero': 'Cielo azul, agua turquesa, cristal brillante y naturaleza: Frutiger Aero.',
                    'assassins-creed-2': 'Estilo Animus: rombos, líneas blancas, grises y rojas, y una hélice de ADN rómbica que reemplaza las ondas XLMB. Las burbujas ya no vienen con el tema: elige «Animus» en el estilo de burbujas si las quieres.',
                    'synthwave': 'Neón retro de los años 80: atardecer con sol rayado, rejilla en perspectiva y brillo magenta y cian. Las burbujas son aparte: «Synthwave» en el estilo de burbujas.',
                    custom: 'Tu tema a medida: fondos, cristal, burbujas, texto y acentos.'
                };
                const text = document.getElementById('theme-description');
                if (text) text.textContent = descriptions[selected];
            }
        }

        function applyCustomThemeVars() {
            const ct = { ...DEFAULT_CUSTOM_THEME, ...(config.customTheme || {}) };
            const root = document.documentElement;
            root.style.setProperty('--ct-accent-primary', validColor(ct.accentPrimary, DEFAULT_CUSTOM_THEME.accentPrimary));
            root.style.setProperty('--ct-accent-secondary', validColor(ct.accentSecondary, DEFAULT_CUSTOM_THEME.accentSecondary));
            root.style.setProperty('--ct-bg-1', validColor(ct.bg1, DEFAULT_CUSTOM_THEME.bg1));
            root.style.setProperty('--ct-bg-2', validColor(ct.bg2, DEFAULT_CUSTOM_THEME.bg2));
            root.style.setProperty('--ct-panel', validColor(ct.panel, DEFAULT_CUSTOM_THEME.panel));
            root.style.setProperty('--ct-text', validColor(ct.text, DEFAULT_CUSTOM_THEME.text));
            root.style.setProperty('--ct-msg-user', validColor(ct.msgUser, DEFAULT_CUSTOM_THEME.msgUser));
            root.style.setProperty('--ct-msg-assistant', validColor(ct.msgAssistant, DEFAULT_CUSTOM_THEME.msgAssistant));
            root.style.setProperty('--ct-border', validColor(ct.border, DEFAULT_CUSTOM_THEME.border));
            root.style.setProperty('--ct-input-bg', validColor(ct.inputBg, DEFAULT_CUSTOM_THEME.inputBg));
            const opacity = Math.max(10, Math.min(95, Number(ct.glassOpacity) || 62)) / 100;
            root.style.setProperty('--ct-glass-alpha', String(opacity));
            root.style.setProperty('--ct-blur', `${Math.max(0, Math.min(40, Number(ct.blur) || 24))}px`);
            root.style.setProperty('--ct-radius', `${Math.max(8, Math.min(40, Number(ct.radius) || 24))}px`);
            root.style.setProperty('--accent-primary', validColor(ct.accentPrimary, DEFAULT_CUSTOM_THEME.accentPrimary));
            root.style.setProperty('--accent-secondary', validColor(ct.accentSecondary, DEFAULT_CUSTOM_THEME.accentSecondary));
            // Tipografía
            const fontName = (ct.fontCustom || ct.fontFamily || '').trim();
            if (fontName && window.ghostLoadFont) {
                window.ghostLoadFont(fontName);
                root.style.setProperty('--ct-font', window.ghostFontStack(fontName));
                root.dataset.ctFont = ct.fontCode ? 'all' : 'text';
            } else {
                root.style.removeProperty('--ct-font');
                delete root.dataset.ctFont;
            }
            const scale = Math.max(80, Math.min(140, Number(ct.fontScale) || 100));
            root.style.setProperty('--ct-font-scale', String(scale / 100));
        }

        function clearCustomThemeVars() {
            const keys = ['--ct-accent-primary','--ct-accent-secondary','--ct-bg-1','--ct-bg-2','--ct-panel','--ct-text','--ct-msg-user','--ct-msg-assistant','--ct-border','--ct-input-bg','--ct-glass-alpha','--ct-blur','--ct-radius','--ct-font','--ct-font-scale'];
            delete document.documentElement.dataset.ctFont;
            keys.forEach(k => document.documentElement.style.removeProperty(k));
        }

        function syncCustomThemeControls() {
            const ct = { ...DEFAULT_CUSTOM_THEME, ...(config.customTheme || {}) };
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            const setLabel = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val).toUpperCase(); };
            set('ct-accent-primary', ct.accentPrimary); setLabel('ct-accent-primary-val', ct.accentPrimary);
            set('ct-accent-secondary', ct.accentSecondary); setLabel('ct-accent-secondary-val', ct.accentSecondary);
            set('ct-bg-1', ct.bg1); setLabel('ct-bg-1-val', ct.bg1);
            set('ct-bg-2', ct.bg2); setLabel('ct-bg-2-val', ct.bg2);
            set('ct-panel', ct.panel); setLabel('ct-panel-val', ct.panel);
            set('ct-text', ct.text); setLabel('ct-text-val', ct.text);
            set('ct-msg-user', ct.msgUser); setLabel('ct-msg-user-val', ct.msgUser);
            set('ct-msg-assistant', ct.msgAssistant); setLabel('ct-msg-assistant-val', ct.msgAssistant);
            set('ct-border', ct.border); setLabel('ct-border-val', ct.border);
            set('ct-input-bg', ct.inputBg); setLabel('ct-input-bg-val', ct.inputBg);
            set('ct-glass-opacity', ct.glassOpacity);
            const opLab = document.getElementById('ct-glass-opacity-val'); if (opLab) opLab.textContent = `${ct.glassOpacity}%`;
            set('ct-blur', ct.blur);
            const blLab = document.getElementById('ct-blur-val'); if (blLab) blLab.textContent = `${ct.blur}px`;
            set('ct-radius', ct.radius);
            const rdLab = document.getElementById('ct-radius-val'); if (rdLab) rdLab.textContent = `${ct.radius}px`;
            const fSel = document.getElementById('ct-font'); if (fSel) fSel.value = ct.fontFamily || '';
            const fCus = document.getElementById('ct-font-custom'); if (fCus && document.activeElement !== fCus) fCus.value = ct.fontCustom || '';
            set('ct-font-scale', ct.fontScale);
            const fsLab = document.getElementById('ct-font-scale-val'); if (fsLab) fsLab.textContent = `${ct.fontScale}%`;
            const fCode = document.getElementById('ct-font-code'); if (fCode) fCode.checked = !!ct.fontCode;
            const fPrev = document.getElementById('ct-font-preview');
            if (fPrev) { const n = ct.fontCustom || ct.fontFamily; if (n && window.ghostLoadFont) window.ghostLoadFont(n); fPrev.style.fontFamily = n && window.ghostFontStack ? window.ghostFontStack(n) : ''; }
        }

        function readCustomThemeFromUI() {
            const g = (id, fallback) => {
                const el = document.getElementById(id);
                if (!el) return fallback;
                if (el.type === 'color') return validColor(el.value, fallback);
                return Number(el.value);
            };
            return {
                accentPrimary: g('ct-accent-primary', DEFAULT_CUSTOM_THEME.accentPrimary),
                accentSecondary: g('ct-accent-secondary', DEFAULT_CUSTOM_THEME.accentSecondary),
                bg1: g('ct-bg-1', DEFAULT_CUSTOM_THEME.bg1),
                bg2: g('ct-bg-2', DEFAULT_CUSTOM_THEME.bg2),
                panel: g('ct-panel', DEFAULT_CUSTOM_THEME.panel),
                text: g('ct-text', DEFAULT_CUSTOM_THEME.text),
                msgUser: g('ct-msg-user', DEFAULT_CUSTOM_THEME.msgUser),
                msgAssistant: g('ct-msg-assistant', DEFAULT_CUSTOM_THEME.msgAssistant),
                border: g('ct-border', DEFAULT_CUSTOM_THEME.border),
                inputBg: g('ct-input-bg', DEFAULT_CUSTOM_THEME.inputBg),
                glassOpacity: g('ct-glass-opacity', DEFAULT_CUSTOM_THEME.glassOpacity),
                blur: g('ct-blur', DEFAULT_CUSTOM_THEME.blur),
                radius: g('ct-radius', DEFAULT_CUSTOM_THEME.radius),
                fontFamily: (document.getElementById('ct-font')?.value) || '',
                fontCustom: (document.getElementById('ct-font-custom')?.value || '').trim(),
                fontScale: g('ct-font-scale', DEFAULT_CUSTOM_THEME.fontScale),
                fontCode: !!document.getElementById('ct-font-code')?.checked
            };
        }

        function onCustomThemeChange() {
            config.customTheme = readCustomThemeFromUI();
            syncCustomThemeControls();
            if (config.theme === 'custom') applyCustomThemeVars();
            saveStorage();
        }

        function resetCustomTheme() {
            config.customTheme = { ...DEFAULT_CUSTOM_THEME };
            syncCustomThemeControls();
            if (config.theme === 'custom') applyCustomThemeVars();
            saveStorage();
            showToast('Tema personalizado restaurado a valores por defecto.', 'theme', 'Tema restaurado');
        }

        function randomizeCustomTheme() {
            const rand = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
            config.customTheme = {
                accentPrimary: rand(),
                accentSecondary: rand(),
                bg1: rand(),
                bg2: rand(),
                panel: rand(),
                text: Math.random() > 0.5 ? '#f1f5f9' : '#0f172a',
                msgUser: rand(),
                msgAssistant: rand(),
                border: rand(),
                inputBg: rand(),
                glassOpacity: 40 + Math.floor(Math.random() * 40),
                blur: 8 + Math.floor(Math.random() * 28),
                radius: 12 + Math.floor(Math.random() * 24),
                fontFamily: config.customTheme?.fontFamily || '',
                fontCustom: config.customTheme?.fontCustom || '',
                fontScale: config.customTheme?.fontScale || 100,
                fontCode: !!config.customTheme?.fontCode
            };
            syncCustomThemeControls();
            if (config.theme !== 'custom') {
                config.theme = 'custom';
                applyTheme('custom', true);
            } else {
                applyCustomThemeVars();
            }
            saveStorage();
            showToast('Tema aleatorio aplicado. ¡Ajusta lo que quieras!', 'theme', 'Tema aleatorio');
        }

        function updateThemeControls() {
            const current = config.theme || 'default';
            document.querySelectorAll('[data-theme-choice]').forEach(button => {
                const active = button.dataset.themeChoice === current;
                button.classList.toggle('selected', active);
                button.setAttribute('aria-pressed', String(active));
            });
            const colors = document.getElementById('custom-color-controls');
            if (colors) colors.classList.toggle('hidden', current !== 'material-you');
            const lowEnd = document.getElementById('ac2-lowend-warning');
            if (lowEnd) lowEnd.classList.toggle('hidden', current !== 'assassins-creed-2');
            const fullCustom = document.getElementById('full-custom-theme-panel');
            if (fullCustom) {
                fullCustom.classList.toggle('hidden', current !== 'custom');
                if (current === 'custom') syncCustomThemeControls();
            }
            const descriptions = {
                default: 'Tema oscuro original de GhostUe46.',
                'liquid-glass': 'Cristal translúcido con reflejos y ondas que simulan el efecto bajo el agua.',
                'material-you': 'Elige color principal y secundario para personalizar los acentos de toda la interfaz.',
                aurora: 'Tema original de GhostUe46 con tonos glaciales y violeta.',
                'frutiger-aero': 'Cielo azul, agua turquesa, cristal brillante y naturaleza: Frutiger Aero.',
                'assassins-creed-2': 'Estilo Animus: rombos, líneas blancas, grises y rojas, y una hélice de ADN rómbica que reemplaza las ondas XLMB. Las burbujas ya no vienen con el tema: elige «Animus» en el estilo de burbujas si las quieres.',
                'synthwave': 'Neón retro de los años 80: atardecer con sol rayado, rejilla en perspectiva y brillo magenta y cian. Las burbujas son aparte: «Synthwave» en el estilo de burbujas.',
                custom: 'Diseña tu propio tema: fondos, cristal, burbujas, texto, opacidad y redondez.'
            };
            const text = document.getElementById('theme-description');
            if (text) text.textContent = descriptions[current] || descriptions.default;
        }

        function validColor(value, fallback) {
            return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
        }

        function updateColorLabels() {
            const primary = document.getElementById('primary-color-input');
            const secondary = document.getElementById('secondary-color-input');
            const pLabel = document.getElementById('primary-color-value');
            const sLabel = document.getElementById('secondary-color-value');
            if (primary && pLabel) pLabel.textContent = primary.value.toUpperCase();
            if (secondary && sLabel) sLabel.textContent = secondary.value.toUpperCase();
            if (primary) config.primaryColor = primary.value;
            if (secondary) config.secondaryColor = secondary.value;
            // Solo aplicar acentos personalizados si el tema activo es Material You
            if (config.theme === 'material-you') {
                document.documentElement.style.setProperty('--accent-primary', validColor(config.primaryColor, '#38bdf8'));
                document.documentElement.style.setProperty('--accent-secondary', validColor(config.secondaryColor, '#a855f7'));
            }
        }

        function onThemeColorChange() {
            updateColorLabels();
            if (config.theme === 'material-you') applyTheme(config.theme, false);
        }

        function toggleWebSearch() {
            config.webSearchEnabled = !config.webSearchEnabled;
            const checkbox = document.getElementById('web-search-enabled-input');
            if (checkbox) checkbox.checked = config.webSearchEnabled;
            saveStorage();
            updateWebSearchUI();
            showToast(config.webSearchEnabled ? 'Búsqueda DuckDuckGo autorizada.' : 'Búsqueda web desactivada.', 'search');
        }

        function onWebSearchChange(event) {
            config.webSearchEnabled = Boolean(event.target.checked);
            saveStorage();
            updateWebSearchUI();
            showToast(config.webSearchEnabled ? 'Búsqueda DuckDuckGo autorizada.' : 'Búsqueda web desactivada.', 'search');
        }

        function updateWebSearchUI() {
            const button = document.getElementById('web-search-toggle');
            const checkbox = document.getElementById('web-search-enabled-input');
            const enabled = Boolean(config.webSearchEnabled);
            if (button) {
                button.classList.toggle('is-enabled', enabled);
                button.setAttribute('aria-pressed', String(enabled));
                button.title = `DuckDuckGo: búsqueda web ${enabled ? 'activada' : 'desactivada'}`;
                const icon = button.querySelector('i');
                if (icon) icon.className = `fa-solid fa-globe ${enabled ? 'text-cyan-300' : 'text-slate-400'}`;
            }
            const dot = document.getElementById('web-search-status-dot');
            if (dot) dot.classList.toggle('enabled', enabled);
            const footerStatus = document.getElementById('web-search-footer-status');
            if (footerStatus) footerStatus.textContent = enabled ? 'Búsqueda web autorizada' : 'Búsqueda web desactivada';
            if (checkbox) checkbox.checked = enabled;
        }

        function onMemoryToggle(event) {
            config.memoryEnabled = Boolean(event.target.checked);
            saveStorage();
            updateMemoryStatus();
            showToast(config.memoryEnabled ? 'Memoria local activada.' : 'Memoria local pausada.', 'memory');
        }

        function updateMemoryStatus() {
            const status = document.getElementById('memory-storage-note');
            if (!status) return;
            const count = Array.isArray(config.memories) ? config.memories.length : 0;
            status.textContent = config.memoryEnabled
                ? `Memoria activa · ${count} nota${count === 1 ? '' : 's'} guardada${count === 1 ? '' : 's'} en este navegador.`
                : `Memoria desactivada · ${count} nota${count === 1 ? '' : 's'} conservada${count === 1 ? '' : 's'}, pero no se usará en respuestas.`;
        }

        function captureMemoryRequest(prompt) {
            if (!config.memoryEnabled) return false;
            const match = String(prompt || '').match(/^\s*(?:ghostue46[, :]*)?(?:recuerda(?: que)?|memoriza(?: que)?|anota(?: que)?)\s+(.+)$/i);
            if (!match) return false;
            const note = match[1].trim().replace(/[.!]+$/, '');
            if (!note || config.memories.some(existing => existing.toLowerCase() === note.toLowerCase())) return false;
            config.memories.push(note);
            config.memories = config.memories.slice(-50);
            saveStorage();
            return true;
        }

        function clearMemory() {
            config.memories = [];
            const field = document.getElementById('memory-notes-input');
            if (field) field.value = '';
            saveStorage();
            updateMemoryStatus();
            showToast('Memoria local borrada.', 'memory', 'Memoria limpia');
        }

        function onAnimationsToggle(event) {
            config.animationsEnabled = Boolean(event.target.checked);
            document.body.classList.toggle('no-background-animation', !config.animationsEnabled);
            saveStorage();
        }

        function shouldSearchWeb(prompt) {
            if (!config.webSearchEnabled) return false;
            return /\b(busca|buscar|investiga|investigar|consulta|consultar|fuentes|actualidad|actualizado|actualizada|noticias|últim[oa]s?|reciente|hoy|precio actual|qué es|que es|quién es|quien es|cuándo|cuando|dónde|donde|comparativa|documentación oficial|versión actual)\b/i.test(prompt || '');
        }

        async function searchDuckDuckGo(query) {
            const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
            const timeoutController = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const activeSignal = activeRequestController?.signal;
            const abortSearch = () => { if (timeoutController && !timeoutController.signal.aborted) timeoutController.abort(); };
            if (activeSignal?.aborted) throw makeRequestAbortError();
            activeSignal?.addEventListener('abort', abortSearch, { once: true });
            const timeoutId = timeoutController ? setTimeout(() => timeoutController.abort(), 6500) : null;
            try {
                const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
                const response = await fetch(url, timeoutController ? { signal: timeoutController.signal } : (activeSignal ? { signal: activeSignal } : {}));
                if (!response.ok) throw new Error(`DuckDuckGo respondió ${response.status}`);
                const data = await response.json();
                const pieces = [];
                if (data.Answer) pieces.push(`Respuesta: ${stripHtml(data.Answer)}`);
                if (data.AbstractText) pieces.push(`Resumen: ${stripHtml(data.AbstractText)}${data.AbstractURL ? ` (Fuente: ${data.AbstractURL})` : ''}`);
                if (data.Definition) pieces.push(`Definición: ${stripHtml(data.Definition)}${data.DefinitionURL ? ` (Fuente: ${data.DefinitionURL})` : ''}`);
                const collectTopics = (items) => {
                    for (const item of (items || [])) {
                        if (pieces.length >= 7) break;
                        if (item.Text) pieces.push(`Resultado relacionado: ${stripHtml(item.Text)}${item.FirstURL ? ` (Fuente: ${item.FirstURL})` : ''}`);
                        if (item.Topics) collectTopics(item.Topics);
                    }
                };
                collectTopics(data.RelatedTopics);
                const context = pieces.length
                    ? pieces.slice(0, 7).join('\n')
                    : 'La API de respuesta instantánea de DuckDuckGo no devolvió un resumen útil para esta consulta. No hay datos web verificables disponibles en esta respuesta; utiliza el enlace de búsqueda completa para consultar los resultados.';
                return { context: `${context}\nEnlace de búsqueda: ${searchUrl}`, searchUrl };
            } catch (error) {
                if (activeSignal?.aborted || activeRequestController?.signal.aborted) throw makeRequestAbortError();
                return {
                    context: `No se pudieron recuperar automáticamente resúmenes de DuckDuckGo desde el navegador (${error.message || 'bloqueo de red o CORS'}). No afirmes que la búsqueda fue completada; responde con conocimiento general si es útil e informa la limitación.`,
                    searchUrl
                };
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
                activeSignal?.removeEventListener('abort', abortSearch);
            }
        }

        function stripHtml(value) {
            const tmp = document.createElement('div');
            tmp.innerHTML = String(value || '');
            return (tmp.textContent || tmp.innerText || '').trim();
        }

        function exportChats() {
            const payload = {
                exportedAt: new Date().toISOString(),
                app: 'GhostUe46',
                sessions,
                preferences: {
                    theme: config.theme,
                    webSearchEnabled: config.webSearchEnabled,
                    memoryEnabled: config.memoryEnabled,
                    memories: config.memories
                }
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ghostue46-conversaciones-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('Conversaciones exportadas como JSON.', 'export', 'Exportación lista');
        }

        function openEditorModal() {
            const select = document.getElementById('editor-lang-select');
            if (!document.getElementById('code-editor-input').value) {
                document.getElementById('code-editor-input').value = CODE_TEMPLATES[select.value] || '';
            }
            document.getElementById('editor-modal').classList.remove('hidden');
            syncBetaApiPicker();
        }

        function syncBetaApiPicker() {
            const current = document.getElementById('editor-lang-select')?.value;
            document.querySelectorAll('[data-beta-api]').forEach((button) => {
                const selected = button.dataset.betaApi === current;
                button.classList.toggle('selected', selected);
                button.setAttribute('aria-pressed', String(selected));
            });
        }

        function selectBetaApi(event) {
            const api = event.target?.closest?.('[data-beta-api]')?.dataset?.betaApi;
            if (!['directx', 'opengl', 'vulkan'].includes(api)) return;
            const select = document.getElementById('editor-lang-select');
            if (!select) return;
            select.value = api;
            onLanguageChange();
            syncBetaApiPicker();
            showToast(`Seleccionaste ${CODE_LANGUAGE_INDICATORS[api].label}. Recuerda que está en fase BETA.`, 'info');
        }

        function closeEditorModal() {
            document.getElementById('editor-modal').classList.add('hidden');
        }

        function onLanguageChange() {
            const lang = document.getElementById('editor-lang-select').value;
            const filenameMap = {
                python: 'main.py',
                javascript: 'app.js',
                html: 'index.html',
                css: 'styles.css',
                java: 'Main.java',
                c: 'program.c',
                cpp: 'main.cpp',
                csharp: 'Program.cs',
                directx: 'shader.hlsl',
                opengl: 'shader.vert',
                vulkan: 'shader.vert'
            };
            document.getElementById('editor-filename').innerText = filenameMap[lang] || 'script.txt';
            document.getElementById('code-editor-input').value = CODE_TEMPLATES[lang] || '';
            clearConsole();
            syncBetaApiPicker();
        }

        function clearConsole() {
            document.getElementById('editor-console').innerHTML = '<span class="text-slate-500"># Consola lista.</span>';
            document.getElementById('mini-debug-chat').innerHTML = '<p class="text-slate-400 italic">Sin errores detectados.</p>';
        }

        function appendConsole(text, isError = false) {
            const consoleBox = document.getElementById('editor-console');
            const line = document.createElement('div');
            line.className = isError ? 'text-red-400 font-bold' : 'text-emerald-300';
            line.innerText = text;
            consoleBox.appendChild(line);
            consoleBox.scrollTop = consoleBox.scrollHeight;
        }

        async function runRealCode() {
            const lang = document.getElementById('editor-lang-select').value;
            const code = document.getElementById('code-editor-input').value;

            clearConsole();
            appendConsole(`> Ejecutando / Verificando sintaxis [${lang.toUpperCase()}]...`);
            if (window.ghostSyntaxCheck && !['directx', 'opengl', 'vulkan'].includes(lang)) {
                const res = await window.ghostSyntaxCheck(lang, code);
                if (res && res.engine) {
                    if (res.errors.length) {
                        appendConsole(`❌ ${res.errors.length} error(es) de sintaxis [${res.engine}]:`, true);
                        res.errors.forEach(e => appendConsole(` - Línea ${e.line}:${e.col} · ${e.msg}`, true));
                        renderDebugError(`${lang.toUpperCase()} · ${res.engine}`, res.errors.map(e => `Línea ${e.line}:${e.col} · ${e.msg}`).join('\n'), 'Corrige la línea indicada y vuelve a verificar.');
                        return;
                    }
                    appendConsole(`✅ Sintaxis ${lang.toUpperCase()} válida (${res.engine}).`);
                    if (!['python', 'javascript'].includes(lang)) return;
                }
            }

            if (lang === 'python') {
                if (!pyodideInstance) {
                    appendConsole("⚠️ Cargando runtime Pyodide WASM...", true);
                    return;
                }
                try {
                    pyodideInstance.runPython(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
                    `);

                    await pyodideInstance.runPythonAsync(code);

                    const stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
                    const stderr = pyodideInstance.runPython("sys.stderr.getvalue()");

                    if (stdout) appendConsole("Salida del Programa:\n" + stdout);
                    if (stderr) {
                        appendConsole("Runtime Error:\n" + stderr, true);
                        renderDebugError("Python Execution Error", stderr, "Verifica las llamadas a variables o sintaxis.");
                    } else {
                        appendConsole("✅ Código Python ejecutado en Pyodide sin errores.");
                    }
                } catch (err) {
                    appendConsole("❌ Error Sintáctico en Python:\n" + err.message, true);
                    renderDebugError("Python SyntaxError", err.message, "Revisa la indentación y los dos puntos ':' faltantes.");
                }
            } 
            else if (lang === 'javascript') {
                try {
                    const testFunc = new Function(code);
                    appendConsole("✅ Sintaxis JavaScript válida.");
                    
                    const logs = [];
                    const originalLog = console.log;
                    console.log = (...args) => logs.push(args.join(' '));
                    
                    testFunc();
                    
                    console.log = originalLog;
                    if (logs.length > 0) {
                        appendConsole("Console Output:\n" + logs.join('\n'));
                    }
                } catch (err) {
                    appendConsole("❌ Error JavaScript:\n" + err.message, true);
                    renderDebugError("JS Syntax Error", err.message, "Verifica cierres de llaves '{}' o paréntesis.");
                }
            }
            else {
                validateCompiledLanguageSyntax(lang, code);
            }
        }

        function validateCompiledLanguageSyntax(lang, code) {
            const errors = [];
            const stack = [];
            const lines = code.split('\n');

            lines.forEach((line, index) => {
                const lineNum = index + 1;
                const trimmed = line.trim();

                if (trimmed.length > 0 && 
                    !trimmed.startsWith('//') && 
                    !trimmed.startsWith('#') && 
                    !trimmed.endsWith('{') && 
                    !trimmed.endsWith('}') && 
                    !trimmed.endsWith(';') &&
                    !trimmed.startsWith('public class') &&
                    !trimmed.startsWith('class ')) {
                    if (['c', 'cpp', 'java', 'csharp'].includes(lang)) {
                        if (!trimmed.includes('main(')) {
                            errors.push(`Línea ${lineNum}: Posible falta de punto y coma ';' al final.`);
                        }
                    }
                }

                for (let char of line) {
                    if (char === '{' || char === '(' || char === '[') stack.push({ char, lineNum });
                    else if (char === '}' || char === ')' || char === ']') {
                        if (stack.length === 0) {
                            errors.push(`Línea ${lineNum}: Cierre '${char}' sin apertura.`);
                        } else {
                            const top = stack.pop();
                            if ((char === '}' && top.char !== '{') ||
                                (char === ')' && top.char !== '(') ||
                                (char === ']' && top.char !== '[')) {
                                errors.push(`Línea ${lineNum}: Cierre '${char}' no coincide con '${top.char}'.`);
                            }
                        }
                    }
                }
            });

            if (stack.length > 0) {
                stack.forEach(s => {
                    errors.push(`Línea ${s.lineNum}: Bloque '${s.char}' abierto no fue cerrado.`);
                });
            }

            if (errors.length === 0) {
                if (['directx', 'opengl', 'vulkan'].includes(lang)) {
                    appendConsole(`⚠️ ${lang.toUpperCase()} está en fase BETA. Solo se comprobaron delimitadores básicos; este navegador no compila ni valida realmente HLSL/GLSL/SPIR-V.`, true);
                } else {
                    appendConsole(`✅ Sintaxis de [${lang.toUpperCase()}] verificada sin errores.`);
                }
            } else {
                appendConsole(`❌ Detectados ${errors.length} errores de sintaxis:`, true);
                errors.forEach(e => appendConsole(" - " + e, true));
                renderDebugError(`${lang.toUpperCase()} Linter`, errors.join('\n'), "Revisa los puntos y comas ';' y balancea los corchetes o llaves.");
            }
        }

        function renderDebugError(title, errorText, fixMethod) {
            const chat = document.getElementById('mini-debug-chat');
            chat.innerHTML = `
                <div class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-white space-y-2">
                    <div class="font-audiowide text-red-400 text-xs">⚠️ ${escapeHtml(title)}</div>
                    <pre class="font-mono text-[10px] text-red-200 bg-black/50 p-2 rounded-lg overflow-x-auto">${escapeHtml(errorText)}</pre>
                    <div class="text-[11px] text-cyan-300">
                        <strong>Solución recomendada:</strong>
                        <p class="text-slate-300 mt-1">${escapeHtml(fixMethod)}</p>
                    </div>
                </div>
            `;
        }

        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

// Adjuntar desde el portapapeles, arrastrar y soltar, y capturar pantalla.
function addFilesToAttachments(files) {
    Array.from(files || []).forEach(async file => {
        if (!file) return;
        // Con intelligence.js: imágenes reducidas, y texto extraído de PDF, Word, Excel y ZIP.
        if (window.GhostIntel && window.GhostIntel.processFile) {
            try {
                const items = await window.GhostIntel.processFile(file);
                items.forEach(item => selectedAttachments.push(item));
                renderAttachmentPreview();
                showToast(file.name || 'Archivo listo para enviar.', 'upload', 'Archivo adjunto');
            } catch (error) {
                showToast(error.message || 'No se pudo leer ese archivo.', 'error', 'Archivo rechazado');
            }
            return;
        }
        if (!file.type.startsWith('image/') && file.size > 8 * 1024 * 1024) {
            showToast('Ese archivo supera 8 MB o no es compatible.', 'error', 'Archivo rechazado'); return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            selectedAttachments.push({name:file.name || `imagen-portapapeles-${Date.now()}.png`, type:file.type || 'image/png', size:file.size || 0, data:e.target.result});
            renderAttachmentPreview();
            showToast(file.name || 'Archivo listo para enviar.', 'upload', 'Archivo adjunto');
        };
        if (file.type.startsWith('image/')) reader.readAsDataURL(file); else reader.readAsText(file);
    });
}
function triggerImageInput(){ document.getElementById('image-input')?.click(); }
let screenStream = null;
async function shareScreen(){
    if (!navigator.mediaDevices?.getDisplayMedia) { showToast('Tu navegador no permite compartir pantalla.', 'error'); return; }
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({video:{cursor:'always'}, audio:false});
        const video=document.getElementById('screen-preview'); video.srcObject=screenStream;
        document.getElementById('screen-capture-modal').classList.remove('hidden');
        screenStream.getVideoTracks()[0]?.addEventListener('ended', closeScreenCapture, {once:true});
    } catch(err) { if (err.name !== 'NotAllowedError') showToast('No se pudo compartir la pantalla.', 'error'); }
}
function closeScreenCapture(){ document.getElementById('screen-capture-modal')?.classList.add('hidden'); if(screenStream){screenStream.getTracks().forEach(t=>t.stop());screenStream=null;} const v=document.getElementById('screen-preview'); if(v) v.srcObject=null; }
function takeScreenCapture(){
    const video=document.getElementById('screen-preview'); if(!video || !video.videoWidth){showToast('Espera a que aparezca la vista previa.', 'error');return;}
    const canvas=document.createElement('canvas'); canvas.width=video.videoWidth; canvas.height=video.videoHeight; canvas.getContext('2d').drawImage(video,0,0);
    selectedAttachments.push({name:`captura-pantalla-${new Date().toISOString().replace(/[:.]/g,'-')}.png`,type:'image/png',size:0,data:canvas.toDataURL('image/png')}); renderAttachmentPreview(); closeScreenCapture(); showToast('Captura adjuntada. ¡Ya puedes enviarla al chat!', 'upload', 'Captura de pantalla');
}
function captureScreen(){ shareScreen(); }
function setupDragAndPaste(){
    const overlay=document.getElementById('drop-overlay'); let dragDepth=0;
    window.addEventListener('dragenter',e=>{if(!e.dataTransfer?.types?.includes('Files'))return;e.preventDefault();dragDepth++;overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');});
    window.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault();});
    window.addEventListener('dragleave',e=>{if(!e.dataTransfer?.types?.includes('Files'))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth){overlay.classList.add('hidden');overlay.setAttribute('aria-hidden','true');}});
    window.addEventListener('drop',e=>{if(!e.dataTransfer?.files?.length)return;e.preventDefault();dragDepth=0;overlay.classList.add('hidden');overlay.setAttribute('aria-hidden','true');addFilesToAttachments(e.dataTransfer.files);});
    document.addEventListener('paste',e=>{
        const items=Array.from(e.clipboardData?.items||[]); const images=items.filter(i=>i.kind==='file' && i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
        if(images.length){e.preventDefault();addFilesToAttachments(images);showToast('Imagen del portapapeles adjuntada.', 'upload', 'Portapapeles');}
    });
    document.getElementById('image-input')?.addEventListener('change',e=>addFilesToAttachments(e.target.files));
}

function onTtsAutoChange(event) {
    config.ttsAutoRead = Boolean(event?.target?.checked);
    saveStorage();
    showToast(config.ttsAutoRead ? 'Leeré automáticamente las respuestas normales del bot; el código se omitirá.' : 'La lectura automática está desactivada. Puedes usar Escuchar en cada respuesta.', 'info', 'Texto a voz');
}
function onTtsVoiceChange(event) {
    config.ttsVoiceGender = event?.target?.value === 'male' ? 'male' : 'female';
    window.GhostTTS?.stop();
    saveStorage();
    showToast(`Voz seleccionada: ${config.ttsVoiceGender === 'male' ? 'masculina' : 'femenina'}.`, 'info', 'Texto a voz');
}
function testTtsVoice() {
    const result = window.GhostTTS?.speak('Hola, soy GhostUe46. Esta es una prueba de mi voz en español.', config.ttsVoiceGender || 'female');
    if (!result || !result.ok) showToast(result?.reason === 'no-speech-text' ? 'No hay texto para leer.' : 'Este navegador no admite Texto a Voz. Prueba con Chrome o Edge.', 'warning', 'TTS no disponible');
}

// Explicit, predictable interaction map for the split-file build.
const ACTION_HANDLERS = {
    stopResponse: () => stopCurrentResponse(),
    toggleSidebar: () => toggleSidebar(),
    createNewChat: () => createNewChat(true),
    openConfigModal: () => openConfigModal(),
    closeConfigModal: () => closeConfigModal(),
    clearAllChats: () => clearAllChats(),
    saveConfig: () => saveConfig(),
    openEditorModal: () => openEditorModal(),
    closeEditorModal: () => closeEditorModal(),
    runRealCode: () => runRealCode(),
    clearConsole: () => clearConsole(),
    toggleSpeechToText: () => toggleSpeechToText(),
    'trigger-file-input': () => document.getElementById('file-input')?.click(),
    'trigger-image-input': () => triggerImageInput(),
    'captureScreen': () => captureScreen(),
    'shareScreen': () => shareScreen(),
    'closeScreenCapture': () => closeScreenCapture(),
    'takeScreenCapture': () => takeScreenCapture(),
    toggleWebSearch: () => toggleWebSearch(),
    selectTheme: (event) => selectTheme(event),
    selectBetaApi: (event) => selectBetaApi(event),
    clearMemory: () => clearMemory(),
    exportChats: () => exportChats(),
    resetCustomTheme: () => resetCustomTheme(),
    randomizeCustomTheme: () => randomizeCustomTheme(),
    resetFxColors: () => resetFxColors(),
    ttsTest: () => testTtsVoice(),
    ttsPause: () => window.GhostTTS?.pause(),
    ttsResume: () => window.GhostTTS?.resume(),
    ttsStop: () => window.GhostTTS?.stop()
};

const CHANGE_HANDLERS = {
    toggleModelInput: () => toggleModelInput(),
    onLanguageChange: () => onLanguageChange(),
    onWebSearchChange: (event) => onWebSearchChange(event),
    onTtsAutoChange: (event) => onTtsAutoChange(event),
    onTtsVoiceChange: (event) => onTtsVoiceChange(event),
    onMemoryToggle: (event) => onMemoryToggle(event),
    onAnimationsToggle: (event) => onAnimationsToggle(event),
    onThemeColorChange: () => onThemeColorChange(),
    onCustomThemeChange: () => onCustomThemeChange(),
    onFxColorsChange: () => onFxColorsChange()
};

document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const handler = ACTION_HANDLERS[control.dataset.action];
    if (typeof handler !== 'function') return;
    try {
        handler(event);
    } catch (error) {
        console.error(`Fallo al ejecutar la acción ${control.dataset.action}`, error);
        showToast(`No se pudo completar la acción: ${control.dataset.action}`, 'error');
    }
});

document.addEventListener('change', (event) => {
    const control = event.target.closest('[data-change-action]');
    if (!control) return;
    const handler = CHANGE_HANDLERS[control.dataset.changeAction];
    if (typeof handler === 'function') handler(event);
});

// Vista previa en vivo de los sliders y colores del tema personalizado / efectos
document.addEventListener('input', (event) => {
    const control = event.target.closest('[data-change-action]');
    if (!control) return;
    if (control.dataset.changeAction === 'onCustomThemeChange') onCustomThemeChange();
    if (control.dataset.changeAction === 'onFxColorsChange') onFxColorsChange();
});

// These functions are also used by dynamically rendered message buttons.
Object.assign(window, {
    deleteSession, togglePinSession, startRenameSession, setSessionFilter, copyCodeBlock, removeAttachment, sendToEditor, downloadCodeFile,
    toggleModelInput, onLanguageChange, handleFileSelect, handleKeydown,
    handleSendMessage, toggleSidebar, createNewChat, openConfigModal,
    closeConfigModal, clearAllChats, saveConfig, openEditorModal,
    closeEditorModal, runRealCode, clearConsole, toggleSpeechToText, toggleWebSearch,
    selectTheme, selectBetaApi, syncBetaApiPicker, clearMemory, exportChats, onWebSearchChange, onMemoryToggle, onAnimationsToggle, onThemeColorChange,
    onCustomThemeChange, resetCustomTheme, randomizeCustomTheme, onFxColorsChange, resetFxColors, getFxColors,
    requestChat, buildChatMessages, callSelectedChatAPI, searchDuckDuckGo, setTypingIndicator, detectRequestedCodeLanguage, addFilesToAttachments, stopCurrentResponse,
    onTtsAutoChange, onTtsVoiceChange, testTtsVoice
});

document.getElementById('chat-form')?.addEventListener('submit', handleSendMessage);
document.getElementById('file-input')?.addEventListener('change', handleFileSelect);
setupDragAndPaste();
document.getElementById('user-input')?.addEventListener('keydown', handleKeydown);


// Frutiger Aero chat bubbles follow the appearance preference.
document.addEventListener('click', e => {
 const chip=e.target.closest('[data-ui-pref="bubbleStyle"]'); if(!chip)return;
 document.documentElement.dataset.bubbles=chip.dataset.value;
});
document.documentElement.dataset.bubbleStyle=config.bubbleStyle || 'glass';
