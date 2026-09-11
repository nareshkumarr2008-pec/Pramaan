import React, { useRef, useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useLang } from "../i18n.js";

const SpeechRecognitionAPI = (typeof window !== "undefined")
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// A large, thumb-friendly mic button that appends dictated speech to
// whatever the caller's text currently is. Built for workers who can speak
// their trade fluently but may not be comfortable typing or reading.
// `locale` should be a BCP-47 tag (e.g. "hi-IN"); `onResult` receives the
// full updated text each time recognition produces a chunk.
export default function VoiceInputButton({ locale, value, onResult, size = "normal" }) {
  const { t } = useLang();
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(!SpeechRecognitionAPI);
  const recRef = useRef(null);
  const baseTextRef = useRef("");

  useEffect(() => () => { try { recRef.current && recRef.current.stop(); } catch { /* ignore */ } }, []);

  if (unsupported) {
    // No microphone dictation available in this browser — quietly omit the
    // control rather than showing a button that can't work.
    return null;
  }

  const start = () => {
    try {
      const rec = new SpeechRecognitionAPI();
      rec.lang = locale || "en-IN";
      rec.continuous = true;
      rec.interimResults = true;
      baseTextRef.current = value ? value.trim() + " " : "";
      rec.onresult = (ev) => {
        let finalChunk = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) finalChunk += ev.results[i][0].transcript;
        }
        if (finalChunk) {
          baseTextRef.current = (baseTextRef.current + finalChunk + " ");
          onResult(baseTextRef.current.trim());
        }
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setUnsupported(true);
    }
  };

  const stop = () => {
    try { recRef.current && recRef.current.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  return (
    <button
      type="button"
      className={`pram-voice-btn${listening ? " live" : ""}${size === "large" ? " large" : ""}`}
      onClick={listening ? stop : start}
      title={listening ? t("a11y_voice_stop") : t("a11y_voice_speak")}
      aria-pressed={listening}
    >
      {listening ? <MicOff size={size === "large" ? 22 : 16} /> : <Mic size={size === "large" ? 22 : 16} />}
      <span>{listening ? t("a11y_voice_listening") : t("a11y_voice_speak")}</span>
    </button>
  );
}
