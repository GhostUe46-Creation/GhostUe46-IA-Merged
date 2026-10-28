GhostUe46 Multiplataforma v13

Para empezar: abre index.html en un servidor web estático (por ejemplo, GitHub Pages o cualquier hosting estático). Para que la app pueda llamar al proveedor de IA, configura proveedor, modelo y API key en Configuración.

Nueva función de v13: durante la generación el botón Enviar se convierte en “Parar respuesta”. Pulsa para abortar la petición activa, detener TTS y quitar la burbuja parcial. Los controles de adjuntos se ocultan temporalmente durante la generación para que el botón quepa también en móvil.

Se mantienen de v12: TTS de navegador (voces disponibles en el dispositivo), generación de imágenes a través de OpenRouter, Creator INFO, Ko-fi, reporte de errores, temas y archivos de personalización.

Notas:
- TTS no necesita servidor ni API key propia; las voces dependen del navegador y sistema operativo.
- La generación de imágenes requiere OpenRouter, una API key válida, conexión a Internet y puede tener coste.
- Las API keys se guardan en el almacenamiento local del navegador. No publiques claves privadas en repositorios públicos.
- La cancelación detiene la operación en el navegador; no puede deshacer el procesamiento que el proveedor ya haya completado en sus servidores.

Novedad v14: la vista previa interactiva HTML/CSS/JS se activa solo para respuestas generadas con Inteligencia → ArchFile. Las respuestas de otros modos muestran código normal.

GhostUe46 v16 — Diagnóstico + Liquid Glass
- consolA-debugg.js se carga al inicio de index.html y creator.html. Captura errores JS/promesas, recursos, console.*, eventos UI, mutaciones DOM, fetch/XHR por metadatos, tareas largas, inventario de CSS/JS y estilos computados.
- Comandos DevTools: GhostConsoleDebug.help(), GhostConsoleDebug.snapshot(), GhostConsoleDebug.inspectLiquidGlass(), GhostConsoleDebug.inspectCSS(), GhostConsoleDebug.inspect('.water-glass'), GhostConsoleDebug.downloadReport(). Para imprimir todas las reglas CSS accesibles: GhostConsoleDebug.config.logEveryCSSRule = true; GhostConsoleDebug.inspectCSS().
- Privacidad: no guarda texto del chat ni valores de campos, cuerpos de peticiones, cookies o almacenamiento local; elimina parámetros de URL que podrían contener secretos. Revisa el JSON antes de compartirlo.
- Liquid Glass: el control de intensidad actualiza el mapa de desplazamiento correcto (ghost-water-disp); el resaltado refractivo se mantiene visible con baja opacidad/alto desenfoque y fondos con imágenes.
- Limitación del navegador: el filtro SVG distorsiona el patrón refractivo dibujado sobre el panel; los navegadores no ofrecen una forma CSS universal de desplazar literalmente los píxeles del backdrop detrás del vidrio.
