/* GhostUe46 · Tiempo de uso
   Cuenta el tiempo REAL de uso de hoy (pestaña visible y con actividad) y avisa cuando llegas al 90 % del límite.
   Todo se guarda en este navegador. El límite diario se cambia en Configuración > Tiempo de uso. */
(() => {
'use strict';

const USAGE_KEY = 'ghost_usage_v1';
const CFG_KEY = 'ghost_usage_cfg_v1';
const TICK_MS = 5000;          // cada cuánto se mide
const IDLE_MS = 2 * 60 * 1000; // sin actividad durante 2 min no se cuenta
const DEFAULT_CFG = { enabled: true, limitMinutes: 120 };

const $ = (s, r = document) => r.querySelector(s);
const read = (key, fallback) => { try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch (e) { return { ...fallback }; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* almacenamiento bloqueado: se sigue en memoria */ } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let cfg = read(CFG_KEY, DEFAULT_CFG);
let usage = read(USAGE_KEY, { day: today(), seconds: 0, warned90: false, warned100: false });
let lastActivity = Date.now();
let lastTick = Date.now();

const limitSeconds = () => Math.max(1, Number(cfg.limitMinutes) || DEFAULT_CFG.limitMinutes) * 60;
const percent = () => (usage.seconds / limitSeconds()) * 100;
const remainingSeconds = () => Math.max(0, limitSeconds() - usage.seconds);

function fmt(seconds) {
    const m = Math.ceil(seconds / 60);
    if (seconds <= 0) return '0 min';
    if (seconds < 60) return 'menos de 1 min';
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} h${r ? ` ${r} min` : ''}` : `${m} min`;
}

/* ---------- Aviso ---------- */
function injectStyle() {
    if ($('#usage-time-style')) return;
    const st = document.createElement('style');
    st.id = 'usage-time-style';
    st.textContent = `
    #usage-banner{position:fixed;top:1rem;left:50%;z-index:70;width:min(30rem,calc(100vw - 1.5rem));display:none;align-items:flex-start;gap:.75rem;padding:.85rem 1rem;border-radius:1.2rem;transform:translate(-50%,-14px);opacity:0;transition:transform .35s,opacity .35s;border:1px solid rgba(245,158,11,.75)!important;box-shadow:0 14px 40px rgba(0,0,0,.28),0 0 0 3px rgba(245,158,11,.18)!important}
    #usage-banner.is-open{display:flex}
    #usage-banner.is-visible{transform:translate(-50%,0);opacity:1}
    #usage-banner.is-limit{border-color:rgba(239,68,68,.8)!important;box-shadow:0 14px 40px rgba(0,0,0,.28),0 0 0 3px rgba(239,68,68,.2)!important}
    #usage-banner .ub-icon{flex:none;width:2.3rem;height:2.3rem;display:grid;place-items:center;border-radius:.9rem;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff!important;font-size:15px}
    #usage-banner .ub-icon i{color:#fff!important}
    #usage-banner strong{display:block;font-family:"Orbitron",sans-serif;font-size:12px;margin-bottom:.15rem}
    #usage-banner p{margin:0;font-size:12px;line-height:1.4}
    #usage-banner .ub-bar{height:6px;margin-top:.55rem;border-radius:99px;background:rgba(127,127,127,.28);overflow:hidden}
    #usage-banner .ub-bar i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#f59e0b,#ef4444);transition:width .6s}
    #usage-banner .ub-close{flex:none;padding:.3rem .5rem;border-radius:.7rem;background:rgba(127,127,127,.18)}
    .usage-meter{height:8px;margin-top:.6rem;border-radius:99px;background:rgba(127,127,127,.25);overflow:hidden}
    .usage-meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent-primary),var(--accent-secondary));transition:width .5s}
    .usage-meter.is-warn i{background:linear-gradient(90deg,#f59e0b,#ef4444)}`;
    document.head.appendChild(st);
}

function banner() {
    let el = $('#usage-banner');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'usage-banner';
    el.className = 'water-glass';
    el.setAttribute('role', 'alert');
    el.innerHTML = `<span class="ub-icon"><i class="fa-solid fa-hourglass-half"></i></span>
        <div style="flex:1;min-width:0"><strong id="ub-title"></strong><p id="ub-text"></p><div class="ub-bar"><i id="ub-fill"></i></div></div>
        <button type="button" class="ub-close" aria-label="Cerrar aviso"><i class="fa-solid fa-xmark"></i></button>`;
    el.querySelector('.ub-close').addEventListener('click', hideBanner);
    document.body.appendChild(el);
    return el;
}

function hideBanner() {
    const el = $('#usage-banner');
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(() => el.classList.remove('is-open'), 350);
}

function showBanner(limitReached) {
    const el = banner();
    el.classList.toggle('is-limit', limitReached);
    $('#ub-title').textContent = limitReached ? 'Llegaste a tu límite de uso de hoy' : 'Has usado el 90 % de tu tiempo de hoy';
    $('#ub-text').textContent = limitReached
        ? `Ya completaste tus ${fmt(limitSeconds())} de uso diario. Puedes seguir, pero quizá sea buen momento para descansar.`
        : `Te quedan ${fmt(remainingSeconds())} de uso hoy (límite diario: ${fmt(limitSeconds())}).`;
    $('#ub-fill').style.width = `${Math.min(100, percent())}%`;
    el.classList.add('is-open');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
    if (typeof showToast === 'function') showToast(limitReached ? 'Llegaste al límite de uso de hoy.' : `Te quedan ${fmt(remainingSeconds())} de uso hoy.`, 'warning', limitReached ? 'Límite de uso' : 'Tiempo de uso al 90 %');
}

function checkThresholds() {
    if (!cfg.enabled) return;
    const pct = percent();
    if (pct >= 100 && !usage.warned100) { usage.warned100 = true; usage.warned90 = true; write(USAGE_KEY, usage); showBanner(true); }
    else if (pct >= 90 && pct < 100 && !usage.warned90) { usage.warned90 = true; write(USAGE_KEY, usage); showBanner(false); }
    // Si el aviso está abierto, mantiene el tiempo restante al día
    const el = $('#usage-banner');
    if (el && el.classList.contains('is-open') && pct < 100) {
        $('#ub-text').textContent = `Te quedan ${fmt(remainingSeconds())} de uso hoy (límite diario: ${fmt(limitSeconds())}).`;
        $('#ub-fill').style.width = `${Math.min(100, pct)}%`;
    }
}

/* ---------- Medición ---------- */
function rollDay() {
    if (usage.day !== today()) {
        usage = { day: today(), seconds: 0, warned90: false, warned100: false };
        write(USAGE_KEY, usage);
        hideBanner();
    }
}

function tick() {
    const now = Date.now();
    const elapsed = Math.min((now - lastTick) / 1000, TICK_MS / 500); // evita saltos si el equipo estuvo suspendido
    lastTick = now;
    rollDay();
    const active = document.visibilityState === 'visible' && now - lastActivity < IDLE_MS;
    if (cfg.enabled && active) {
        usage.seconds += elapsed;
        write(USAGE_KEY, usage);
        checkThresholds();
    }
    renderPanel();
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
document.addEventListener('visibilitychange', () => { lastTick = Date.now(); });

/* ---------- Ajustes (Configuración > Tiempo de uso) ---------- */
function buildPanel() {
    if ($('#usage-section')) return;
    const anchor = $('.settings-small-extras');
    if (!anchor) return;
    const sec = document.createElement('section');
    sec.id = 'usage-section';
    sec.className = 'settings-section';
    sec.innerHTML = `
        <div class="settings-section-title"><i class="fa-solid fa-hourglass-half"></i><div><h4>Tiempo de uso</h4><p>Cuenta el tiempo que usas GhostUe46 hoy y te avisa al llegar al 90 %.</p></div></div>
        <label class="setting-toggle-row" for="usage-enabled-input"><span><strong>Avisarme de mi tiempo de uso</strong><small>Solo cuenta mientras la pestaña está visible y hay actividad.</small></span><input id="usage-enabled-input" type="checkbox" class="setting-switch"></label>
        <label class="settings-field-label mt-3" for="usage-limit-input">Límite diario (minutos)</label>
        <input id="usage-limit-input" type="number" min="5" max="1440" step="5" class="w-full crystal-input rounded-xl p-3 text-xs">
        <div class="usage-meter" id="usage-meter"><i></i></div>
        <div class="flex items-center justify-between gap-3 mt-2"><span id="usage-status" class="settings-hint"></span><button type="button" id="usage-reset" class="settings-danger"><i class="fa-solid fa-rotate-left"></i> Reiniciar hoy</button></div>`;
    anchor.parentNode.insertBefore(sec, anchor);
    $('#usage-enabled-input').checked = cfg.enabled;
    $('#usage-limit-input').value = cfg.limitMinutes;
    $('#usage-enabled-input').addEventListener('change', (e) => { cfg.enabled = e.target.checked; write(CFG_KEY, cfg); renderPanel(); });
    $('#usage-limit-input').addEventListener('change', (e) => setLimit(e.target.value));
    $('#usage-reset').addEventListener('click', reset);
    renderPanel();
}

function renderPanel() {
    const status = $('#usage-status');
    if (!status) return;
    const pct = Math.min(100, percent());
    status.textContent = cfg.enabled
        ? `Hoy: ${fmt(usage.seconds)} usados · quedan ${fmt(remainingSeconds())} (${Math.floor(pct)} %).`
        : 'Aviso desactivado.';
    const meter = $('#usage-meter');
    if (meter) { meter.classList.toggle('is-warn', pct >= 90); meter.firstElementChild.style.width = `${pct}%`; }
}

function setLimit(minutes) {
    const m = Math.min(1440, Math.max(5, Math.round(Number(minutes)) || DEFAULT_CFG.limitMinutes));
    cfg.limitMinutes = m;
    write(CFG_KEY, cfg);
    const input = $('#usage-limit-input');
    if (input) input.value = m;
    // Si el nuevo límite deja el uso por debajo del 90 %, el aviso vuelve a estar disponible
    if (percent() < 90) { usage.warned90 = false; usage.warned100 = false; write(USAGE_KEY, usage); hideBanner(); }
    renderPanel();
    checkThresholds();
}

function reset() {
    usage = { day: today(), seconds: 0, warned90: false, warned100: false };
    write(USAGE_KEY, usage);
    hideBanner();
    renderPanel();
    if (typeof showToast === 'function') showToast('El contador de hoy volvió a 0.', 'info', 'Tiempo de uso');
}

/* ---------- Inicio ---------- */
injectStyle();
buildPanel();
rollDay();
checkThresholds();
setInterval(tick, TICK_MS);

window.GhostUsage = {
    remainingMinutes: () => Math.ceil(remainingSeconds() / 60),
    usedMinutes: () => Math.floor(usage.seconds / 60),
    percent: () => Math.round(percent()),
    setLimit, reset
};
})();
