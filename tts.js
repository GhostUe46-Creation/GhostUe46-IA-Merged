/* GhostUe46 TTS — usa las voces locales del navegador/dispositivo; no necesita servidor ni API key. */
(() => {
  'use strict';
  const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  const FEMALE_HINTS = /\b(female|woman|mujer|helena|monica|m[oó]nica|laura|luc[ií]a|lucia|sabina|paulina|carmen|elena|sofia|sof[ií]a|maria|mar[ií]a|lola|isabella|zira|aria|samantha|serena|karen)\b/i;
  const MALE_HINTS = /\b(male|man|hombre|pablo|jorge|diego|juan|carlos|andres|andr[eé]s|david|raul|ra[uú]l|enrique|miguel|alvaro|[aá]lvaro|daniel|jorge|alex|[aá]lex|jorge|guy|tom)\b/i;
  let voices = [];

  function refreshVoices() {
    voices = synth ? synth.getVoices() : [];
    return voices;
  }
  if (synth) {
    refreshVoices();
    synth.addEventListener?.('voiceschanged', refreshVoices);
    window.addEventListener('pageshow', refreshVoices);
  }

  function cleanText(input) {
    const original = String(input ?? '');
    let text = original
      .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '\n')
      .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ')
      .replace(/```[\w.+#-]*\s*[\s\S]*?```/g, '\n')
      .replace(/~~~[\w.+#-]*\s*[\s\S]*?~~~/g, '\n')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/g, '$1')
      .replace(/`[^`]*`/g, ' ')
      .replace(/<[^>]+>/g, ' ');

    // Excluye líneas de código sin vallas Markdown para no pronunciar código pegado sin formato.
    const codeLine = /^\s*(?:#!|#include\b|import\s+|export\s+|from\s+\S+\s+import\b|(?:const|let|var)\s+\w+\s*=|function\s+\w*\s*\(|(?:async\s+)?function\b|class\s+\w+|def\s+\w+\s*\(|public\s+(?:static\s+)?(?:class|void|int|string)|private\s+|return\s+[^.!?]+[;{]?\s*$|console\.(?:log|warn|error)\s*\(|print\s*\(|<\/?(?:!doctype|html|head|body|div|script|style|button|section|main)\b|\}\s*;?$|\{\s*$|\}\s*else\b|SELECT\s+.+\s+FROM\b|CREATE\s+TABLE\b|package\s+[\w.]+;)/i;
    text = text.split(/\r?\n/).filter(line => !codeLine.test(line)).join('\n');

    text = text
      .replace(/^\s{0,3}(?:#{1,6}|>)+\s*/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/\bhttps?:\/\/\S+/gi, ' enlace ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    // Si el mensaje original es esencialmente código sin bloques Markdown, no se lee nada.
    const lines = original.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const codeLikeCount = lines.filter(line => codeLine.test(line) || /[{};]\s*$/.test(line) || /=>|\bconsole\./.test(line)).length;
      if (codeLikeCount / lines.length >= 0.6) return '';
    }
    if (/^\s*(?:```|<\/?(?:html|script|div|body|!doctype)|(?:const|let|var|function|class|import|export|def|#include)\b)/i.test(original.trim()) && !text) return '';
    return text.replace(/\s+([,.!?;:])/g, '$1').trim();
  }

  function spanishVoices() {
    refreshVoices();
    return voices.filter(v => /^es(?:-|_|$)/i.test(v.lang || ''));
  }

  function getVoice(gender) {
    const all = spanishVoices();
    if (!all.length) return null;
    const genderPattern = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
    const match = all.find(v => genderPattern.test(`${v.name || ''} ${v.voiceURI || ''}`));
    if (match) return match;
    // Cuando el SO no da nombres con género, usa voces españolas diferentes si existen.
    if (gender === 'male' && all.length > 1) return all[all.length - 1];
    return all[0];
  }

  function speak(input, gender = 'female') {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      return { ok: false, reason: 'unsupported' };
    }
    const text = cleanText(input);
    if (!text) return { ok: false, reason: 'no-speech-text' };
    synth.cancel();
    const chosenGender = gender === 'male' ? 'male' : 'female';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1;
    utterance.pitch = chosenGender === 'male' ? 0.84 : 1.12;
    const voice = getVoice(chosenGender);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'es-CO';
    }
    synth.speak(utterance);
    return { ok: true, voice: voice?.name || (chosenGender === 'male' ? 'Voz masculina (tono ajustado)' : 'Voz femenina (tono ajustado)') };
  }

  function pause() { if (synth) synth.pause(); }
  function resume() { if (synth) synth.resume(); }
  function stop() { if (synth) synth.cancel(); }
  function isSupported() { return Boolean(synth && typeof SpeechSynthesisUtterance !== 'undefined'); }

  window.GhostTTS = { speak, pause, resume, stop, cleanText, isSupported, getVoice, refreshVoices };
})();
