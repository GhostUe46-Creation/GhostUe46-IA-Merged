/* Sonidos de interfaz de GhostUe46 / Illusion Lab.
   click.mp3: botones, casillas y controles.
   notification.mp3: notificaciones que aparecen en #toast-container.
   El navegador puede bloquear audio hasta una interacción real del usuario. */
(() => {
  'use strict';

  const clickBase = new Audio('sounds/click.mp3');
  const notificationBase = new Audio('sounds/notification.mp3');
  for (const audio of [clickBase, notificationBase]) {
    audio.preload = 'auto';
  }

  // Interruptor «Sonidos de interfaz» (Configuración). En creator.html no existe `config`: siempre suena.
  function muted() {
    try { return typeof config !== 'undefined' && config && config.uiSoundsEnabled === false; } catch (_) { return false; }
  }

  function play(base, volume) {
    if (muted()) return;
    try {
      const audio = base.cloneNode(true);
      audio.volume = volume;
      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.catch === 'function') result.catch(() => {});
      audio.addEventListener('ended', () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }, { once: true });
    } catch (_) {
      // El sonido es complementario: nunca debe romper la interfaz.
    }
  }

  let lastClickAt = 0;
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const control = target.closest(
      'button, input[type="checkbox"], input[type="radio"], select, [role="button"], [role="checkbox"], [role="radio"]'
    );
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const now = performance.now();
    // Evita el doble sonido por eventos duplicados muy seguidos.
    if (now - lastClickAt < 65) return;
    lastClickAt = now;
    play(clickBase, 0.42);
  }, true);

  let lastNotificationAt = 0;
  function playNotification() {
    const now = performance.now();
    if (now - lastNotificationAt < 120) return;
    lastNotificationAt = now;
    play(notificationBase, 0.58);
  }

  function watchToasts() {
    const container = document.getElementById('toast-container');
    if (!container || container.dataset.uiSoundObserver === 'ready') return;
    container.dataset.uiSoundObserver = 'ready';
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('xbox-toast')) {
            playNotification();
          }
        }
      }
    });
    observer.observe(container, { childList: true });
  }

  watchToasts();
  // Public hooks for any later notification type without coupling this file to app.js.
  window.GhostUe46UiSounds = Object.freeze({
    click: () => play(clickBase, 0.42),
    notification: playNotification
  });
})();
