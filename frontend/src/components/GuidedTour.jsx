import React, { useEffect, useMemo, useState } from "react";
import {
  X, ChevronLeft, ChevronRight, Fingerprint, FileText, Briefcase, Stamp,
  Building2, Users, Shuffle, Sparkles, MapPin,
} from "lucide-react";
import { useLang } from "../i18n.js";
import { useAccessibility, SPEECH_LOCALE } from "../accessibility.jsx";
import { tf } from "../i18n.js";

// An icon-driven onboarding walkthrough. Each step pairs one big icon with a
// short line of text AND a spoken narration, so a worker who can't read can
// still follow along by ear + picture. "Take me there" jumps straight to the
// real screen so the tour doubles as in-context help, not just a slideshow.
export default function GuidedTour({ role, setScreen, onClose }) {
  const { lang, t } = useLang();
  const a11y = useAccessibility();
  const locale = SPEECH_LOCALE[lang] || "en-IN";

  const steps = useMemo(() => {
    const base = [{ icon: Sparkles, titleKey: "tour_welcome_title", bodyKey: "tour_welcome_body", screen: null }];
    if (role === "worker") {
      return [
        ...base,
        { icon: Fingerprint, titleKey: "tour_w1_title", bodyKey: "tour_w1_body", screen: "worker" },
        { icon: FileText, titleKey: "tour_w2_title", bodyKey: "tour_w2_body", screen: "resume" },
        { icon: Briefcase, titleKey: "tour_w3_title", bodyKey: "tour_w3_body", screen: "browse" },
        { icon: Stamp, titleKey: "tour_w4_title", bodyKey: "tour_w4_body", screen: "passport" },
      ];
    }
    if (role === "msme") {
      return [
        ...base,
        { icon: Building2, titleKey: "tour_m1_title", bodyKey: "tour_m1_body", screen: "msme" },
        { icon: Users, titleKey: "tour_m2_title", bodyKey: "tour_m2_body", screen: "postings" },
        { icon: Shuffle, titleKey: "tour_m3_title", bodyKey: "tour_m3_body", screen: "match" },
      ];
    }
    return base;
  }, [role]);

  const [i, setI] = useState(0);
  const step = steps[i];
  const Icon = step.icon;

  useEffect(() => {
    a11y && a11y.speak(`${t(step.titleKey)}. ${t(step.bodyKey)}`, locale);
    return () => a11y && a11y.stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const finish = () => { a11y && a11y.stopSpeaking(); a11y && a11y.update({ tourSeen: true }); onClose(); };
  const goThere = () => { if (step.screen) setScreen(step.screen); finish(); };

  return (
    <div className="pram-tour-overlay" role="dialog" aria-label={t("tour_title")}>
      <div className="pram-tour-card">
        <button className="pram-tour-close" onClick={finish} aria-label="Close"><X size={18} /></button>
        <div className="pram-tour-icon"><Icon size={54} /></div>
        <h3>{t(step.titleKey)}</h3>
        <p>{t(step.bodyKey)}</p>
        <div className="pram-tour-step-count">{tf(t("tour_step_of"), { n: i + 1, total: steps.length })}</div>

        {step.screen && (
          <button className="pram-btn secondary full" onClick={goThere}>
            <MapPin size={15} /> {t("tour_btn_goto")}
          </button>
        )}

        <div className="pram-tour-nav">
          <button className="pram-btn ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
            <ChevronLeft size={16} /> {t("tour_btn_prev")}
          </button>
          {i < steps.length - 1 ? (
            <button className="pram-btn primary" onClick={() => setI((n) => n + 1)}>
              {t("tour_btn_next")} <ChevronRight size={16} />
            </button>
          ) : (
            <button className="pram-btn primary" onClick={finish}>{t("tour_btn_done")}</button>
          )}
        </div>
        <button className="pram-tour-skip" onClick={finish}>{t("tour_btn_skip")}</button>
      </div>
    </div>
  );
}
