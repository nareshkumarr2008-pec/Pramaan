import React, { useState } from "react";
import { Sparkles, Mic, BadgeCheck } from "lucide-react";
import { Field, Loading, ErrorNote, ReadAloud } from "../components/atoms.jsx";
import VoiceInputButton from "../components/VoiceInputButton.jsx";
import { SPEECH_LOCALE } from "../accessibility.jsx";
import { api } from "../api.js";
import { useLang } from "../i18n.js";

const SECTORS = [
  "Textiles & Garments", "Auto Components", "Food Processing",
  "Electronics Assembly", "Furniture & Woodwork", "Metal Fabrication",
  "Leather & Footwear", "Construction",
];

export default function MsmePost({ onSaved }) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ shopName: "", sector: SECTORS[0], location: "", wageBand: "", processDescription: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capsule, setCapsule] = useState(null);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const generate = async () => {
    setError("");
    if (!form.shopName.trim() || form.processDescription.trim().length < 15) {
      setError(t("mp_err_validate"));
      return;
    }
    setLoading(true); setCapsule(null); setSaved(false);
    try {
      const data = await api.generateCapsule({
        shopName: form.shopName.trim(), sector: form.sector, location: form.location.trim(),
        wageBand: form.wageBand.trim(), processDescription: form.processDescription.trim(),
      });
      setCapsule(data);
    } catch (e) {
      setError(e.message || t("mp_err_generate"));
    } finally { setLoading(false); }
  };

  const saveJob = async () => {
    if (!capsule) return;
    setLoading(true);
    try {
      await api.saveJob({
        shopName: form.shopName.trim(), sector: form.sector,
        location: form.location.trim() || "Location not shared", wageBand: form.wageBand.trim() || "Wage on discussion",
        processDescription: form.processDescription.trim(), role: capsule.role, requiredTrade: capsule.requiredTrade,
        skillsNeeded: capsule.skillsNeeded || [], steps: capsule.steps || [], quizQuestions: capsule.quizQuestions || [],
      });
      setSaved(true);
      onSaved && onSaved();
    } catch (e) {
      setError(e.message || t("mp_err_save"));
    } finally { setLoading(false); }
  };

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_msme")}<ReadAloud text={`${t("nav_msme")}. ${t("mp_sub")}`} /></h1>
        <p>{t("mp_sub")}</p>
      </div>
      <div className="pram-two-col">
        <div className="pram-panel">
          <Field label={t("mp_field_shop")}><input value={form.shopName} onChange={set("shopName")} placeholder={t("mp_field_shop_ph")} /></Field>
          <div className="pram-field-row">
            <Field label={t("mp_field_sector")}><select value={form.sector} onChange={set("sector")}>{SECTORS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></Field>
            <Field label={t("mp_field_wage")}><input value={form.wageBand} onChange={set("wageBand")} placeholder={t("mp_field_wage_ph")} /></Field>
          </div>
          <Field label={t("mp_field_location")}><input value={form.location} onChange={set("location")} placeholder={t("mp_field_location_ph")} /></Field>
          <Field label={t("mp_field_process")}>
            <textarea rows={6} value={form.processDescription} onChange={set("processDescription")} placeholder={t("mp_field_process_ph")} />
          </Field>
          <VoiceInputButton
            size="large"
            locale={SPEECH_LOCALE[lang] || "en-IN"}
            value={form.processDescription}
            onResult={(text) => setForm((f) => ({ ...f, processDescription: text }))}
          />
          <div className="pram-mic-note"><Mic size={13} /> {t("mp_mic_note")}</div>
          <ErrorNote message={error} />
          <button className="pram-btn primary full" onClick={generate} disabled={loading}>
            {loading && !capsule ? <Loading label={t("mp_loading_build")} /> : t("mp_btn_generate")}
          </button>
        </div>
        <div className="pram-panel result">
          {!capsule && !loading && <div className="pram-empty"><Sparkles size={26} /><p>{t("mp_empty_result")}</p></div>}
          {loading && !capsule && <Loading label={t("mp_loading_read")} />}
          {capsule && (
            <div className="pram-result">
              <div className="pram-result-label">{t("mp_auto_role")}</div>
              <div className="pram-capsule-role">{capsule.role}</div>
              <div className="pram-tag-row">{(capsule.skillsNeeded || []).map((s, i) => <span className="pram-tag" key={i}>{s}</span>)}</div>
              <div className="pram-result-block"><h4>{t("mp_block_capsule")}</h4>
                <ol className="pram-steps">{(capsule.steps || []).map((s, i) => <li key={i}><strong>{s.title}</strong><span>{s.instruction}</span></li>)}</ol>
              </div>
              <div className="pram-result-block"><h4>{t("mp_block_quiz")}</h4>
                <ul>{(capsule.quizQuestions || []).map((q, i) => <li key={i}><em>{q.question}</em> — {q.answer}</li>)}</ul>
              </div>
              {!saved ? (
                <button className="pram-btn secondary full" onClick={saveJob} disabled={loading}>
                  {loading ? <Loading label={t("mp_loading_post")} /> : t("mp_btn_post")}
                </button>
              ) : (
                <div className="pram-saved-note"><BadgeCheck size={16} /> {t("mp_saved_note")}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
