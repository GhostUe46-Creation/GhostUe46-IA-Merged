/* Controla la atmósfera con el scroll: azul GhostUe46 -> Claude totalmente naranja -> azul/violeta. */
(() => {
  const bridge = document.getElementById('claude-bridge');
  const lab = document.getElementById('illusion-journey-lab');
  if (!bridge || !lab) return;

  const root = document.documentElement;
  let queued = false;
  const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  const smoothstep = value => { const x = clamp(value); return x * x * (3 - 2 * x); };

  function updateAtmosphere() {
    queued = false;
    const scrollY = window.scrollY || window.pageYOffset;
    const vh = window.innerHeight || 800;
    const bridgeTop = bridge.getBoundingClientRect().top + scrollY;
    const bridgeBottom = bridgeTop + bridge.offsetHeight;

    // The warm-up happens as the Claude section enters view; then orange stays at full strength.
    const fadeIn = smoothstep((scrollY - (bridgeTop - vh * .34)) / (vh * .58));
    const fadeOut = 1 - smoothstep((scrollY - (bridgeBottom - vh * .25)) / (vh * .78));
    const orangeZone = clamp(Math.min(fadeIn, fadeOut));
    const progress = clamp((scrollY - (bridgeTop - vh * .34)) / Math.max(1, (bridgeBottom - bridgeTop) + vh * .6));

    const warm = .025 + orangeZone * .47;
    const blue = .42 - orangeZone * .36;
    const violet = .055 - orangeZone * .035;
    root.style.setProperty('--fusion-orange', warm.toFixed(3));
    root.style.setProperty('--fusion-blue', Math.max(.035, blue).toFixed(3));
    root.style.setProperty('--fusion-violet', Math.max(.018, violet).toFixed(3));
    root.style.setProperty('--fusion-progress', progress.toFixed(3));
    root.style.setProperty('--claude-orange-zone', orangeZone.toFixed(3));
    root.classList.toggle('claude-zone-active', orangeZone > .48);
    window.__claudeOrangeZone = orangeZone;
  }
  function requestUpdate() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(updateAtmosphere);
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('load', requestUpdate, { once: true });
  requestUpdate();
})();
