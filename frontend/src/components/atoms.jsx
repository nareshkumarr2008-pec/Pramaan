import React from "react";
import { Loader2, AlertCircle, Volume2 } from "lucide-react";
import { useAccessibility } from "../accessibility.jsx";

// Small speaker icon that reads the given text aloud in the current UI
// language. Renders nothing if speech synthesis isn't available. Meant to
// sit next to headings/instructions so a worker who can't read can still
// tap to hear what the screen says.
export function ReadAloud({ text, locale, className = "" }) {
  const a11y = useAccessibility();
  if (!a11y || typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return (
    <button
      type="button"
      className={`pram-readaloud-btn ${className}`}
      onClick={() => a11y.speak(text, locale)}
      aria-label="Read aloud"
      title="Read aloud"
    >
      <Volume2 size={15} />
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="pram-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, (score / 900) * 100));
  return (
    <div className="pram-scorebar">
      <div className="pram-scorebar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Loading({ label }) {
  return (
    <div className="pram-loading">
      <Loader2 className="pram-spin" size={18} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="pram-error">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}
