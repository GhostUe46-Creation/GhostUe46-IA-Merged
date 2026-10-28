/* GhostUe46 · Reporte automático de errores mediante Formspree.
   El usuario confirma el envío con un clic en «Enviar reporte automáticamente».
   No lee ni adjunta conversaciones, claves API, localStorage ni archivos del usuario. */
(() => {
  'use strict';

  const REPORT_EMAIL = 'bleidys302023@gmail.com';
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqpppneg';
  const recentErrors = [];
  let lastFocus = null;
  let dialog;
  let preferredProvider = null;
  let isSending = false;

  const q = (selector, root = document) => root.querySelector(selector);
  const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

  function rememberError(message, source = '') {
    const normalized = clean(message, 450);
    if (!normalized) return;
    recentErrors.unshift({ message: normalized, source: clean(source, 180), time: new Date().toISOString() });
    if (recentErrors.length > 5) recentErrors.length = 5;
    const counter = q('#g46-report-error-count');
    if (counter) { counter.textContent = String(recentErrors.length); counter.hidden = false; }
  }

  window.addEventListener('error', (event) => {
    if (event instanceof ErrorEvent && event.message) {
      rememberError(event.message, `${event.filename || 'script'}${event.lineno ? ':' + event.lineno : ''}`);
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    rememberError(reason?.message || String(reason || 'Promesa rechazada sin detalle'), reason?.stack || 'unhandledrejection');
  });

  function createDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.className = 'g46-report-overlay';
    dialog.id = 'g46-report-overlay';
    dialog.setAttribute('aria-hidden', 'true');
    dialog.innerHTML = `
      <section class="g46-report-panel" role="dialog" aria-modal="true" aria-labelledby="g46-report-title" aria-describedby="g46-report-description">
        <header class="g46-report-head">
          <div class="g46-report-mark" aria-hidden="true"><i class="fa-solid fa-bug"></i></div>
          <div><h2 id="g46-report-title">Reportar un error</h2><p id="g46-report-description">Envía el reporte por Internet directamente desde GhostUe46, sin abrir otra aplicación.</p></div>
          <button type="button" class="g46-report-close" data-g46-report-close aria-label="Cerrar formulario"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <form class="g46-report-form" id="g46-report-form">
          <div class="g46-report-grid">
            <div class="g46-report-field"><label for="g46-report-kind">TIPO DE REPORTE</label><select id="g46-report-kind" name="kind"><option>Error técnico</option><option>La IA no responde</option><option>Problema visual o de diseño</option><option>Audio o animaciones</option><option>Editor o ejecución de código</option><option>Problema con archivos</option><option>Otro</option></select></div>
            <div class="g46-report-field"><label for="g46-report-title-input">TÍTULO DEL ERROR *</label><input id="g46-report-title-input" name="title" maxlength="100" required placeholder="Ej. El botón no responde"></div>
            <div class="g46-report-field g46-full"><label for="g46-report-description-input">¿QUÉ OCURRIÓ? *</label><textarea id="g46-report-description-input" name="description" maxlength="1400" required placeholder="Describe el error y lo que estabas intentando hacer..."></textarea></div>
            <div class="g46-report-field"><label for="g46-report-steps">PASOS PARA REPRODUCIRLO</label><textarea id="g46-report-steps" name="steps" maxlength="800" placeholder="1. Abrí... 2. Pulsé... 3. Ocurrió..."></textarea></div>
            <div class="g46-report-field"><label for="g46-report-expected">¿QUÉ ESPERABAS QUE PASARA?</label><textarea id="g46-report-expected" name="expected" maxlength="800" placeholder="El comportamiento esperado..."></textarea></div>
            <div class="g46-report-field g46-full"><label for="g46-report-email">TU CORREO (OPCIONAL, PARA RESPONDERTE)</label><input id="g46-report-email" name="email" type="email" maxlength="180" autocomplete="email" placeholder="tu-correo@ejemplo.com"></div>
          </div>
          <label class="g46-report-privacy"><input id="g46-report-diagnostics" type="checkbox" checked><span><strong>Incluir diagnóstico técnico básico</strong><br>Fecha, navegador, tamaño de pantalla, página y hasta 5 errores JavaScript capturados desde que abriste esta página.</span></label>
          <p class="g46-report-autodetail">Por privacidad, el reporte no incluye tus conversaciones, claves API, ajustes guardados ni archivos adjuntos. Solo se envía cuando pulsas el botón de envío.</p>
          <div class="g46-report-honeypot" aria-hidden="true"><label for="g46-report-website">Dejar vacío</label><input id="g46-report-website" name="_gotcha" type="text" tabindex="-1" autocomplete="off"></div>
          <div class="g46-report-actions">
            <button class="g46-report-action submit" type="submit" data-g46-report-submit><i class="fa-solid fa-cloud-arrow-up"></i> Enviar reporte automáticamente</button>
            <button class="g46-report-action gmail" type="button" data-g46-report-send="gmail"><i class="fa-solid fa-envelope"></i> Abrir Gmail</button>
            <button class="g46-report-action outlook" type="button" data-g46-report-send="outlook"><i class="fa-solid fa-paper-plane"></i> Abrir Outlook</button>
            <button class="g46-report-action" type="button" data-g46-report-send="mailto"><i class="fa-regular fa-paper-plane"></i> App de correo</button>
            <button class="g46-report-action copy" type="button" data-g46-report-copy><i class="fa-regular fa-copy"></i> Copiar reporte</button>
          </div>
          <p id="g46-report-status" class="g46-report-status" role="status" aria-live="polite"></p>
          <div class="g46-report-foot">Destino previsto: <a href="mailto:${REPORT_EMAIL}">${REPORT_EMAIL}</a>. El envío automático usa Formspree. Gmail y Outlook quedan como alternativas manuales. Si el envío web falla, puedes intentar con uno de esos proveedores.</div>
        </form>
      </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-g46-report-close]')) closeDialog();
      const sendButton = event.target.closest('[data-g46-report-send]');
      if (sendButton) sendReport(sendButton.dataset.g46ReportSend);
      if (event.target.closest('[data-g46-report-copy]')) copyReport();
    });
    q('#g46-report-form', dialog).addEventListener('submit', (event) => {
      event.preventDefault();
      submitAutomatically();
    });
    return dialog;
  }

  function openDialog(provider = null) {
    createDialog();
    preferredProvider = ['gmail', 'outlook'].includes(provider) ? provider : null;
    dialog.querySelectorAll('[data-g46-report-send]').forEach((button) => {
      const isPreferred = button.dataset.g46ReportSend === preferredProvider;
      button.classList.toggle('is-preferred', isPreferred);
      button.setAttribute('aria-pressed', String(isPreferred));
    });
    const status = q('#g46-report-status', dialog);
    if (status) {
      status.classList.remove('error');
      status.textContent = preferredProvider
        ? `Puedes enviar directamente por Internet o usar ${preferredProvider === 'gmail' ? 'Gmail' : 'Outlook'} como alternativa manual.`
        : '';
    }
    lastFocus = document.activeElement;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const title = q('#g46-report-title-input', dialog);
    window.setTimeout(() => title?.focus(), 40);
  }

  function closeDialog() {
    if (!dialog || isSending) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-g46-report-open]');
    if (trigger) {
      event.preventDefault();
      openDialog(trigger.dataset.g46ReportOpen || null);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog?.classList.contains('is-open')) closeDialog();
    if (event.key === 'Tab' && dialog?.classList.contains('is-open')) {
      const items = [...dialog.querySelectorAll('button, input, select, textarea, a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  function getReportText() {
    const root = createDialog();
    const title = clean(q('#g46-report-title-input', root).value, 100);
    const description = clean(q('#g46-report-description-input', root).value, 1400);
    const emailField = q('#g46-report-email', root);
    const email = clean(emailField?.value, 180);
    if (!title || !description) {
      showStatus('Completa el título y la descripción del error antes de continuar.', true);
      (!title ? q('#g46-report-title-input', root) : q('#g46-report-description-input', root)).focus();
      return null;
    }
    if (email && emailField && !emailField.checkValidity()) {
      showStatus('Revisa el formato del correo que escribiste o déjalo vacío.', true);
      emailField.focus();
      return null;
    }
    const kind = clean(q('#g46-report-kind', root).value, 100);
    const steps = clean(q('#g46-report-steps', root).value, 800) || 'No especificados.';
    const expected = clean(q('#g46-report-expected', root).value, 800) || 'No especificado.';
    const includeDiagnostics = q('#g46-report-diagnostics', root).checked;
    const subject = `[GhostUe46 · Reporte] ${title}`.slice(0, 150);
    const page = `${location.origin && location.origin !== 'null' ? location.origin : ''}${location.pathname}`;
    const theme = document.documentElement.dataset.theme || document.documentElement.dataset.mode || 'no identificado';
    const lines = [
      'REPORTE DE ERROR — GhostUe46',
      '================================',
      `Destino previsto: ${REPORT_EMAIL}`,
      `Tipo: ${kind}`,
      `Título: ${title}`,
      `Correo para respuesta: ${email || 'No proporcionado'}`,
      '',
      '¿QUÉ OCURRIÓ?', description,
      '',
      'PASOS PARA REPRODUCIRLO', steps,
      '',
      'RESULTADO ESPERADO', expected,
      ''
    ];
    if (includeDiagnostics) {
      lines.push('DIAGNÓSTICO TÉCNICO',
        `Fecha (ISO): ${new Date().toISOString()}`,
        `Página: ${page}`,
        `Navegador: ${clean(navigator.userAgent, 260)}`,
        `Idioma: ${clean(navigator.language, 30)}`,
        `Pantalla: ${window.innerWidth} × ${window.innerHeight}`,
        `Tema activo: ${clean(theme, 60)}`);
      if (recentErrors.length) {
        lines.push('', 'ERRORES JAVASCRIPT RECIENTES (capturados desde que abriste la página)');
        recentErrors.slice(0, 5).forEach((err, index) => {
          lines.push(`${index + 1}. ${err.message}${err.source ? ` — ${err.source}` : ''} [${err.time}]`);
        });
      } else {
        lines.push('Errores JavaScript capturados: ninguno desde que se abrió esta página.');
      }
      lines.push('');
    }
    lines.push('El reporte fue enviado voluntariamente desde la interfaz de GhostUe46. No se adjuntan conversaciones, claves API ni archivos automáticamente.');
    return { to: REPORT_EMAIL, subject, body: lines.join('\n').slice(0, 6500), kind, title, description, steps, expected, email, page, includeDiagnostics };
  }

  function showStatus(message, isError = false) {
    const status = q('#g46-report-status', createDialog());
    status.textContent = message;
    status.classList.toggle('error', isError);
    status.classList.toggle('success', !isError);
  }

  async function submitAutomatically() {
    if (isSending) return;
    const form = q('#g46-report-form', createDialog());
    if (!form.reportValidity()) return;
    const report = getReportText();
    if (!report) return;

    // Formspree usa el destinatario configurado para este endpoint en su panel; el navegador no decide el buzón receptor.
    // Se envía solo lo que el usuario completó más el diagnóstico opcional que aceptó incluir.
    const honeypot = q('#g46-report-website', form)?.value || '';
    if (honeypot) {
      showStatus('No se pudo validar el formulario. Borra el campo automático y vuelve a intentarlo.', true);
      return;
    }
    const submitButton = q('[data-g46-report-submit]', form);
    isSending = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando reporte…';
    }
    showStatus('Conectando con Formspree y enviando el reporte…');

    try {
      const payload = new FormData();
      payload.append('_subject', report.subject);
      payload.append('message', report.body);
      payload.append('tipo_reporte', report.kind);
      payload.append('titulo', report.title);
      payload.append('descripcion', report.description);
      payload.append('pasos_para_reproducir', report.steps);
      payload.append('resultado_esperado', report.expected);
      payload.append('pagina', report.page);
      if (report.email) payload.append('email', report.email);
      if (!report.includeDiagnostics) payload.append('diagnostico_tecnico', 'No incluido por elección del usuario.');
      payload.append('_gotcha', '');

      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = Array.isArray(result.errors) ? result.errors.map(item => item.message).filter(Boolean).join(' ') : '';
        if (response.status === 429) throw new Error('Se enviaron demasiados reportes en poco tiempo. Espera un momento y vuelve a intentarlo.');
        if (response.status === 403) throw new Error('Formspree rechazó el envío. Comprueba que el formulario esté activo y que el dominio esté autorizado en Formspree.');
        throw new Error(reason || `Formspree respondió con el código ${response.status}.`);
      }
      showStatus(`¡Reporte enviado correctamente! Formspree lo aceptó. Revisa que el formulario tenga como destinatario ${REPORT_EMAIL}.`);
      form.dataset.g46Sent = 'true';
    } catch (error) {
      const message = error instanceof TypeError
        ? 'No se pudo conectar con Formspree. Comprueba Internet y abre la web desde HTTPS o localhost; si sigue fallando, usa Gmail u Outlook como alternativa.'
        : (error?.message || 'Ocurrió un error al enviar el reporte.');
      showStatus(message, true);
    } finally {
      isSending = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Reintentar envío automático';
      }
    }
  }

  function sendReport(provider) {
    const report = getReportText();
    if (!report) return;
    const to = encodeURIComponent(report.to);
    const subject = encodeURIComponent(report.subject);
    const body = encodeURIComponent(report.body);
    let url = '';
    if (provider === 'gmail') url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    else if (provider === 'outlook') url = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`;
    else url = `mailto:${report.to}?subject=${subject}&body=${body}`;
    if (provider === 'mailto') {
      showStatus('Abriendo tu aplicación de correo. Revisa el borrador y pulsa Enviar.');
      window.location.href = url;
    } else {
      const win = window.open(url, '_blank');
      if (win) {
        try { win.opener = null; } catch { /* El proveedor puede restringir esta asignación. */ }
        showStatus('Borrador preparado para ' + (provider === 'gmail' ? 'Gmail' : 'Outlook') + '. Revisa el contenido y pulsa Enviar en esa pestaña.');
      } else {
        showStatus('El navegador bloqueó la pestaña. Permite ventanas emergentes o usa «Copiar reporte».', true);
      }
    }
  }

  async function copyReport() {
    const report = getReportText();
    if (!report) return;
    const text = `Para: ${report.to}\nAsunto: ${report.subject}\n\n${report.body}`;
    try {
      await navigator.clipboard.writeText(text);
      showStatus('Reporte copiado. Puedes pegarlo en un correo a ' + REPORT_EMAIL + '.');
    } catch {
      const field = document.createElement('textarea');
      field.value = text; field.setAttribute('readonly', '');
      field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select();
      const ok = document.execCommand('copy'); field.remove();
      showStatus(ok ? 'Reporte copiado. Pégalo en tu correo.' : 'No se pudo copiar automáticamente. Usa Gmail, Outlook o selecciona el texto de los campos.', !ok);
    }
  }
})();
