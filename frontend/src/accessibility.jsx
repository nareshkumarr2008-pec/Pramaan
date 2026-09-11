import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

// Maps the app's 3 UI languages to speech-synthesis / speech-recognition locales.
export const SPEECH_LOCALE = { en: "en-IN", hi: "hi-IN", ta: "ta-IN" };

// A wider map used when reading back a worker's *spoken-answer* language
// (WorkerAssessment / MsmePost let a worker pick one of ~12 languages
// independent of the UI language).
export const TRADE_LANG_LOCALE = {
  Hindi: "hi-IN", Tamil: "ta-IN", Telugu: "te-IN", Kannada: "kn-IN",
  Marathi: "mr-IN", Bengali: "bn-IN", Gujarati: "gu-IN", Punjabi: "pa-IN",
  Odia: "or-IN", Malayalam: "ml-IN", Bhojpuri: "hi-IN", English: "en-IN",
};

const STORAGE_KEY = "pram_a11y_settings_v1";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { bigText: false, highContrast: false, voiceGuide: false, tourSeen: false, voiceOverrides: {}, speechRate: {}, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { bigText: false, highContrast: false, voiceGuide: false, tourSeen: false, voiceOverrides: {}, speechRate: {} };
}

// Splits narration into short, sentence-sized chunks before handing them to
// the speech engine. Indic-language voices (Tamil especially) are much more
// legible read as separate short utterances with a natural pause between
// them than as one long run-on utterance, which tends to rush and slur.
function splitIntoChunks(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?।])\s+|(?<=[.!?।])$/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const baseLang = (locale) => String(locale || "").split("-")[0].toLowerCase();

// Ranks a candidate voice for how well it'll read a given locale, so
// speak() can pick the best-sounding installed voice instead of whatever
// the browser defaults to (which is often a low-quality compact voice, or
// silently falls back to English for languages like Tamil).
function scoreVoice(voice, locale) {
  const vLang = (voice.lang || "").toLowerCase();
  const base = baseLang(locale);
  let score = 0;
  if (vLang === locale.toLowerCase()) score += 100;
  else if (vLang.startsWith(base)) score += 60;
  // Some browsers/OSes register Tamil under regional tags other than ta-IN
  // (e.g. ta-LK) — the prefix check above already covers that; anything
  // that doesn't share the language prefix at all is unusable for this
  // locale and scored out.
  else return -1;
  // Prefer higher-quality network voices (commonly "Google …") over compact
  // on-device ones, when both are available for the same language.
  if (/google/i.test(voice.name)) score += 15;
  if (!voice.localService) score += 8;
  return score;
}

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children, lang }) {
  const [settings, setSettings] = useState(loadSettings);
  const [voices, setVoices] = useState([]);
  const voicesRef = useRef([]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  // The voice list loads asynchronously in most browsers (Chrome fires
  // "voiceschanged" once it's ready) — grab it eagerly and keep it fresh,
  // and keep a copy in state so UI (the voice picker) can react to it too.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const refreshVoices = () => {
      const list = window.speechSynthesis.getVoices();
      voicesRef.current = list;
      setVoices(list);
    };
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  // Lets someone manually pick which installed voice reads a given
  // language, for when the automatically-picked voice is unclear — some
  // devices ship several Tamil-tagged voices of very different quality, or
  // only a poor one, and a person can hear the difference better than any
  // scoring heuristic can guess.
  const setVoiceOverride = useCallback((locale, voiceURI) => {
    setSettings((s) => ({ ...s, voiceOverrides: { ...s.voiceOverrides, [baseLang(locale)]: voiceURI || undefined } }));
  }, []);

  // All installed voices whose language prefix matches the given locale
  // (e.g. every "ta*" voice for "ta-IN"), for populating a voice picker.
  const voicesForLocale = useCallback((locale) => {
    const base = baseLang(locale);
    return voicesRef.current.filter((v) => (v.lang || "").toLowerCase().startsWith(base));
  }, []);

  const pickVoice = useCallback((locale) => {
    const overrideURI = settings.voiceOverrides?.[baseLang(locale)];
    if (overrideURI) {
      const chosen = voicesRef.current.find((v) => v.voiceURI === overrideURI);
      if (chosen) return chosen;
    }
    const candidates = voicesRef.current
      .map((v) => ({ v, score: scoreVoice(v, locale) }))
      .filter((c) => c.score >= 0)
      .sort((a, b) => b.score - a.score);
    return candidates[0]?.v || null;
  }, [settings.voiceOverrides]);

  // Speaks text aloud in a given BCP-47 locale (defaults to the current UI
  // language). Cancels any speech already in progress first, so taps don't
  // pile up overlapping audio, then reads it as short, separately-queued
  // sentences through the best-matching (or manually chosen) installed
  // voice for that language.
  const speak = useCallback((text, locale) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const targetLocale = locale || SPEECH_LOCALE[lang] || "en-IN";
    try {
      window.speechSynthesis.cancel();
      // Defensive re-check: some browsers populate the voice list lazily
      // and never fire "voiceschanged" if it was already ready at mount.
      if (!voicesRef.current.length) {
        const list = window.speechSynthesis.getVoices();
        voicesRef.current = list;
        setVoices(list);
      }
      const voice = pickVoice(targetLocale);
      const base = baseLang(targetLocale);
      const isTamil = base === "ta";
      const rateOverride = settings.speechRate?.[base];
      const chunks = splitIntoChunks(text);
      (chunks.length ? chunks : [String(text)]).forEach((chunk) => {
        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = voice?.lang || targetLocale;
        if (voice) utter.voice = voice;
        // Tamil TTS on most devices reads noticeably faster and less
        // clearly than English at the same rate setting — slow it down a
        // bit more by default so words don't run together. A person can
        // fine-tune further from the accessibility panel.
        // Tamil TTS on most devices used to be slowed by default for
        // clarity, but that's now left to the person to tune from the
        // accessibility panel's speed slider — 0.92 is a more natural
        // default pace, still slightly under English/Hindi.
        utter.rate = rateOverride || (isTamil ? 0.92 : 0.95);
        utter.pitch = 1;
        window.speechSynthesis.speak(utter);
      });
    } catch { /* speech synthesis unsupported — fail silently */ }
  }, [lang, pickVoice, settings.speechRate]);

  const stopSpeaking = useCallback(() => {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }, []);

  const setSpeechRate = useCallback((locale, rate) => {
    setSettings((s) => ({ ...s, speechRate: { ...s.speechRate, [baseLang(locale)]: rate } }));
  }, []);

  return (
    <AccessibilityContext.Provider value={{
      ...settings, voices, update, speak, stopSpeaking,
      setVoiceOverride, voicesForLocale, setSpeechRate,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);
