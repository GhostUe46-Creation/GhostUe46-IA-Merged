/* Música ambiental con fundido cruzado guiado por el scroll.
   Los archivos de audio los pone el usuario en sounds/Happy.mp3 y sounds/Space.mp3.
   Los navegadores requieren un clic del usuario antes de reproducir audio. */
(() => {
  'use strict';

  const BASE_VOLUME = 0.30;
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const happy = new Audio('sounds/Happy.mp3');
  const space = new Audio('sounds/Space.mp3');
  for (const audio of [happy, space]) {
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
  }

  let enabled = false;
  let happyReady = false;
  let spaceReady = false;
  let happyFailed = false;
  let spaceFailed = false;

  const control = document.createElement('aside');
  control.className = 'ambient-audio-control';
  control.innerHTML = `
    <button class="ambient-audio-button" type="button" aria-pressed="false" aria-label="Activar música ambiental"
      title="Activa la música. El navegador necesita un clic antes de reproducir audio.">
      <span class="ambient-audio-glyph" aria-hidden="true">♫</span>
      <span class="ambient-audio-button-label">ACTIVAR SONIDO</span>
    </button>
    <div class="ambient-audio-status" role="status" aria-live="polite">Happy.mp3 ↔ Space.mp3</div>`;
  document.body.appendChild(control);

  const button = control.querySelector('button');
  const buttonLabel = control.querySelector('.ambient-audio-button-label');
  const status = control.querySelector('.ambient-audio-status');

  function getClaudeZone() {
    const fromFusion = Number(window.__claudeOrangeZone);
    if (Number.isFinite(fromFusion)) return Math.max(0, Math.min(1, fromFusion));
    const fromCSS = Number.parseFloat(getComputedStyle(root).getPropertyValue('--claude-orange-zone'));
    return Number.isFinite(fromCSS) ? Math.max(0, Math.min(1, fromCSS)) : 0;
  }

  function updateVolumes() {
    const zone = getClaudeZone();
    // Curva suave para que ambas músicas se crucen sin cortes ni cambios bruscos.
    const normalGain = Math.cos(zone * Math.PI / 2);
    const claudeGain = Math.sin(zone * Math.PI / 2);
    happy.volume = enabled && !happyFailed ? Math.max(0, Math.min(1, BASE_VOLUME * normalGain)) : 0;
    space.volume = enabled && !spaceFailed ? Math.max(0, Math.min(1, BASE_VOLUME * claudeGain)) : 0;
  }

  function updateUI() {
    button.setAttribute('aria-pressed', String(enabled));
    buttonLabel.textContent = enabled ? 'SILENCIAR SONIDO' : 'ACTIVAR SONIDO';
    button.classList.toggle('is-enabled', enabled);
    if (!enabled) {
      status.textContent = 'Música ambiental · desactivada';
    } else if (happyFailed && spaceFailed) {
      status.textContent = 'Pon Happy.mp3 y Space.mp3 dentro de /sounds';
    } else if (happyFailed) {
      status.textContent = 'Falta sounds/Happy.mp3';
    } else if (spaceFailed) {
      status.textContent = 'Falta sounds/Space.mp3';
    } else {
      status.textContent = getClaudeZone() >= 0.5
        ? 'DIMENSIÓN CLAUDE · Space.mp3'
        : 'GHOSTUE46 · Happy.mp3';
    }
  }

  function onReady(which) {
    if (which === 'happy') happyReady = true;
    else spaceReady = true;
    updateUI();
  }

  happy.addEventListener('canplay', () => onReady('happy'));
  space.addEventListener('canplay', () => onReady('space'));
  happy.addEventListener('error', () => { happyFailed = true; updateVolumes(); updateUI(); });
  space.addEventListener('error', () => { spaceFailed = true; updateVolumes(); updateUI(); });

  async function startTrack(audio, which) {
    try {
      await audio.play();
      if (which === 'happy') { happyFailed = false; happyReady = true; }
      else { spaceFailed = false; spaceReady = true; }
    } catch (error) {
      if (which === 'happy') happyFailed = true;
      else spaceFailed = true;
    }
  }

  button.addEventListener('click', async () => {
    if (enabled) {
      enabled = false;
      happy.pause();
      space.pause();
      updateVolumes();
      updateUI();
      return;
    }

    enabled = true;
    updateVolumes();
    updateUI();
    // Ambas llamadas ocurren directamente desde el clic autorizado por el usuario.
    await Promise.all([startTrack(happy, 'happy'), startTrack(space, 'space')]);
    updateVolumes();
    updateUI();
  });

  function handleScroll() {
    updateVolumes();
    if (enabled && !happyFailed && !spaceFailed) {
      status.textContent = getClaudeZone() >= 0.5
        ? 'DIMENSIÓN CLAUDE · Space.mp3'
        : 'GHOSTUE46 · Happy.mp3';
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleScroll, { passive: true });
  window.addEventListener('load', handleScroll, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Se conserva el estado y el punto de reproducción al cambiar de pestaña.
      happy.volume = 0;
      space.volume = 0;
    } else {
      updateVolumes();
    }
  });

  // Variables de estado declaradas también para inspección sencilla en desarrollo.
  control.dataset.reducedMotion = String(reducedMotion);
  control.dataset.happyReady = String(happyReady);
  control.dataset.spaceReady = String(spaceReady);
  updateUI();
  updateVolumes();
})();
