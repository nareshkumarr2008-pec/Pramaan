import React, { useState } from "react";
import { Ear, X, Type, Contrast, Volume2, VolumeX, Compass } from "lucide-react";
import { useLang } from "../i18n.js";
import { useAccessibility, SPEECH_LOCALE } from "../accessibility.jsx";

// Reads back the current screen's visible text — grabs the main content
// area's headings/paragraphs/labels/buttons rather than the whole DOM, so
// sidebar chrome doesn't get read every time.
function readCurrentScreen(speak, locale) {
  const main = document.querySelector(".pram-screen");
  if (!main) return;
  const bits = [];
  main.querySelectorAll("h1, h3, h4, p, label span:first-child, button span, .pram-empty p").forEach((el) => {
    const txt = el.textContent && el.textContent.trim();
    if (txt && !bits.includes(txt)) bits.push(txt);
  });
  speak(bits.slice(0, 40).join(". "), locale);
}

const SAMPLE_TEXT = {
  en: "This is how this voice sounds when it reads your screen.",
  hi: "जब यह आवाज़ आपकी स्क्रीन पढ़ती है, तो यह ऐसी सुनाई देती है।",
  ta: "இந்த குரல் உங்கள் திரையைப் படிக்கும்போது இப்படி ஒலிக்கும்.",
};

// Lets a person pick which installed voice reads the current UI language,
// and how fast it speaks — for when the automatically-chosen voice is hard
// to understand. Renders nothing if the browser exposes no matching voices
// at all (nothing useful to switch between).
function VoicePicker({ lang, locale }) {
  const { t } = useLang();
  const a11y = useAccessibility();
  const options = a11y.voicesForLocale(locale);
  const currentOverride = a11y.voiceOverrides?.[lang] || "";
  const currentRate = a11y.speechRate?.[lang] || (lang === "ta" ? 0.92 : 0.95);

  if (!options.length) {
    return <div className="pram-a11y-novoice">{t("a11y_no_voice_installed")}</div>;
  }

  return (
    <div className="pram-a11y-voicepicker">
      <label className="pram-a11y-voicepicker-label">{t("a11y_choose_voice")}</label>
      <select value={currentOverride} onChange={(e) => a11y.setVoiceOverride(locale, e.target.value)}>
        <option value="">{t("a11y_voice_auto")}</option>
        {options.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
        ))}
      </select>

      <label className="pram-a11y-voicepicker-label">{t("a11y_reading_speed")} — {currentRate.toFixed(2)}x</label>
      <input
        type="range" min="0.5" max="1.6" step="0.02" value={currentRate}
        onChange={(e) => a11y.setSpeechRate(locale, Number(e.target.value))}
      />

      <button
        type="button"
        className="pram-btn ghost small full"
        onClick={() => a11y.speak(SAMPLE_TEXT[lang] || SAMPLE_TEXT.en, locale)}
      >
        <Volume2 size={14} /> {t("a11y_test_voice")}
      </button>
    </div>
  );
}

export default function AccessibilityWidget({ onOpenTour }) {
  const { lang, t } = useLang();
  const a11y = useAccessibility();
  const [open, setOpen] = useState(false);
  if (!a11y) return null;
  const locale = SPEECH_LOCALE[lang] || "en-IN";

  return (
    <div className="pram-a11y-root">
      {open && (
        <div className="pram-a11y-panel" role="dialog" aria-label={t("a11y_panel_title")}>
          <div className="pram-a11y-panel-head">
            <span>{t("a11y_panel_title")}</span>
            <button className="pram-a11y-close" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          <button className="pram-a11y-row" onClick={() => readCurrentScreen(a11y.speak, locale)}>
            <Volume2 size={20} /> <span>{t("a11y_read_page")}</span>
          </button>
          <button className="pram-a11y-row" onClick={a11y.stopSpeaking}>
            <VolumeX size={20} /> <span>{t("a11y_stop_reading")}</span>
          </button>

          <VoicePicker lang={lang} locale={locale} />

          <button
            className={`pram-a11y-row toggle${a11y.bigText ? " on" : ""}`}
            onClick={() => a11y.update({ bigText: !a11y.bigText })}
            aria-pressed={a11y.bigText}
          >
            <Type size={20} /> <span>{t("a11y_big_text")}</span>
            <span className="pram-a11y-switch">{a11y.bigText ? t("a11y_on") : t("a11y_off")}</span>
          </button>

          <button
            className={`pram-a11y-row toggle${a11y.highContrast ? " on" : ""}`}
            onClick={() => a11y.update({ highContrast: !a11y.highContrast })}
            aria-pressed={a11y.highContrast}
          >
            <Contrast size={20} /> <span>{t("a11y_high_contrast")}</span>
            <span className="pram-a11y-switch">{a11y.highContrast ? t("a11y_on") : t("a11y_off")}</span>
          </button>

          <button className="pram-a11y-row" onClick={() => { setOpen(false); onOpenTour(); }}>
            <Compass size={20} /> <span>{t("a11y_open_tour")}</span>
          </button>
        </div>
      )}
      <button
        className="pram-a11y-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("a11y_panel_title")}
        title={t("a11y_panel_title")}
      >
        <Ear size={26} />
      </button>
    </div>
  );
}
