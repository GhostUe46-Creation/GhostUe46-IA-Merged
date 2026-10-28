/* Catálogo de fuentes para el Tema Personalizado de GhostUe46.
   - "Sistema": ya existen en tu equipo, no descargan nada.
   - "Google Fonts": se descargan solo cuando las eliges (necesitas Internet).
   - Además puedes escribir CUALQUIER nombre de Google Fonts en el campo de abajo. */
window.GHOST_FONT_GROUPS = {
  'Sistema': ['Arial','Verdana','Tahoma','Trebuchet MS','Segoe UI','Calibri','Georgia','Times New Roman','Palatino Linotype','Courier New','Consolas','Lucida Console','Comic Sans MS','Impact','system-ui','sans-serif','serif','monospace','cursive','fantasy'],
  'Sans-serif (Google)': ['Roboto','Open Sans','Noto Sans','Lato','Montserrat','Poppins','Inter','Nunito','Nunito Sans','Raleway','Ubuntu','Source Sans 3','Fira Sans','IBM Plex Sans','Work Sans','Rubik','Karla','Quicksand','Mulish','Barlow','DM Sans','Manrope','Josefin Sans','Cabin','Arimo','Titillium Web','Hind','Heebo','Assistant','Questrial','Varela Round','Oxygen','Overpass','Libre Franklin','Archivo','Public Sans','Lexend','Outfit','Sora','Plus Jakarta Sans','Red Hat Display','Figtree','Albert Sans','Urbanist','Be Vietnam Pro','Kanit','Prompt','Sarabun','Mukta','Catamaran','Cairo','Tajawal','M PLUS Rounded 1c','Signika','Asap','Maven Pro','Exo 2','Encode Sans','Lexend Deca','Commissioner','Jost','Epilogue','Syne','Space Grotesk','Chivo','Dosis','Pontano Sans','Didact Gothic','Nobile','Molengo','Actor','Gudea','Telex','Cantarell','Droid Sans (usa Noto Sans)'],
  'Serif (Google)': ['Merriweather','Playfair Display','Lora','PT Serif','Noto Serif','Source Serif 4','IBM Plex Serif','Bitter','Crimson Text','EB Garamond','Cormorant Garamond','Libre Baskerville','DM Serif Display','Cinzel','Cinzel Decorative','Abril Fatface','Alfa Slab One','Rokkitt','Zilla Slab','Arvo','Roboto Slab','Vollkorn','Spectral','Cardo','Gelasio','Domine','Old Standard TT','Bodoni Moda','Prata','Rufina','Playfair Display SC','Yeseva One','Cormorant','Neuton','Alegreya','Literata','Newsreader','Fraunces'],
  'Display / Retro / Tech': ['Orbitron','Audiowide','Righteous','Russo One','Bungee','Bungee Shade','Monoton','Faster One','Michroma','Syncopate','Oxanium','Chakra Petch','Rajdhani','Saira','Saira Condensed','Teko','Anton','Bebas Neue','Archivo Black','Black Ops One','Stalinist One','Wallpoet','Iceland','Iceberg','Electrolize','Aldrich','Quantico','Turret Road','Tourney','Major Mono Display','Press Start 2P','VT323','Silkscreen','Pixelify Sans','DotGothic16','Jersey 10','Orbit','Nosifer','Eater','Creepster','Frijole','Fascinate','Bangers','Luckiest Guy','Chewy','Boogaloo','Sniglet','Fredoka','Baloo 2','Comfortaa','Lilita One','Shrikhand','Modak','Rubik Glitch','Rubik Bubbles','Rubik Mono One','Rampart One','Londrina Solid','Special Elite','Cutive Mono','Metal Mania','UnifrakturCook','Pirata One','Germania One','New Rocker','Almendra','Uncial Antiqua','MedievalSharp'],
  'Manuscrita / Cursiva': ['Caveat','Pacifico','Dancing Script','Satisfy','Great Vibes','Lobster','Lobster Two','Shadows Into Light','Indie Flower','Permanent Marker','Amatic SC','Kalam','Patrick Hand','Architects Daughter','Gloria Hallelujah','Rock Salt','Courgette','Sacramento','Yellowtail','Cookie','Kaushan Script','Handlee','Reenie Beanie','Nanum Pen Script','Schoolbell','Gochi Hand','Covered By Your Grace','Homemade Apple','Just Another Hand','Allura','Alex Brush','Parisienne','Tangerine','Pinyon Script','Marck Script','Bad Script','Mansalva','Sedgwick Ave','Zeyada','La Belle Aurore','Over the Rainbow','Nothing You Could Do','Cedarville Cursive'],
  'Monoespaciada': ['Roboto Mono','JetBrains Mono','Fira Code','Fira Mono','Source Code Pro','IBM Plex Mono','Space Mono','DM Mono','Inconsolata','Ubuntu Mono','Share Tech Mono','Overpass Mono','Oxygen Mono','Anonymous Pro','Courier Prime','Noto Sans Mono','Red Hat Mono','Azeret Mono','Martian Mono','Sometype Mono','B612 Mono','PT Mono','Cousine','Nova Mono','Syne Mono','Xanh Mono']
};

(function () {
  const loaded = new Set();
  const SYSTEM = new Set(window.GHOST_FONT_GROUPS['Sistema']);
  const GENERIC = new Set(['system-ui','sans-serif','serif','monospace','cursive','fantasy']);

  // "Droid Sans" ya no se distribuye: es la fuente de Android 2.3 y su sucesora es Noto Sans.
  window.ghostRealFontName = function (name) {
    return String(name || '').replace(/\s*\(usa Noto Sans\)\s*/i, '').replace(/^Droid Sans$/i, 'Noto Sans').trim();
  };

  window.ghostLoadFont = function (rawName) {
    const name = window.ghostRealFontName(rawName);
    if (!name || SYSTEM.has(name) || loaded.has(name)) return;
    if (!/^[A-Za-z0-9 \-]{2,60}$/.test(name)) return; // evita nombres raros
    loaded.add(name);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + '&display=swap';
    link.dataset.ghostFont = name;
    link.onerror = () => loaded.delete(name);
    document.head.appendChild(link);
  };

  window.ghostFontStack = function (rawName) {
    const name = window.ghostRealFontName(rawName);
    if (!name) return '';
    if (GENERIC.has(name)) return name;
    return '"' + name.replace(/"/g, '') + '", system-ui, sans-serif';
  };

  window.ghostBuildFontSelect = function () {
    const sel = document.getElementById('ct-font');
    if (!sel || sel.dataset.built) return;
    sel.dataset.built = '1';
    const def = document.createElement('option');
    def.value = ''; def.textContent = 'Original del tema (Orbitron / Audiowide)';
    sel.appendChild(def);
    let total = 0;
    Object.entries(window.GHOST_FONT_GROUPS).forEach(([group, fonts]) => {
      const og = document.createElement('optgroup');
      og.label = group + ' · ' + fonts.length;
      fonts.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; og.appendChild(o); total++; });
      sel.appendChild(og);
    });
    const count = document.getElementById('ct-font-count');
    if (count) count.textContent = total + ' fuentes + cualquiera de Google Fonts';
    const search = document.getElementById('ct-font-search');
    if (search) search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      sel.querySelectorAll('option').forEach(o => { if (o.value) o.hidden = q && !o.value.toLowerCase().includes(q); });
      sel.querySelectorAll('optgroup').forEach(g => { g.hidden = q && ![...g.children].some(o => !o.hidden); });
    });
  };
  window.ghostBuildFontSelect();
})();
