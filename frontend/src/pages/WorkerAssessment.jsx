import React, { useState } from "react";
import { Fingerprint, Mic, BadgeCheck, Copy, Check } from "lucide-react";
import { Field, ScoreBar, Loading, ErrorNote, ReadAloud } from "../components/atoms.jsx";
import QRCode from "../components/QRCode.jsx";
import VoiceInputButton from "../components/VoiceInputButton.jsx";
import { TRADE_LANG_LOCALE } from "../accessibility.jsx";
import { api } from "../api.js";
import { useLang } from "../i18n.js";

const TRADES = [
  "Welder", "Electrician", "Tailor / Machine Operator", "Mason",
  "CNC Operator", "Fitter", "Plumber", "Carpenter",
  "Food Processing Operator", "Packaging Operator",
];
const LANGUAGES = [
  "Hindi", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali",
  "Gujarati", "Punjabi", "Odia", "Malayalam", "Bhojpuri", "English",
];

export default function WorkerAssessment({ onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({ trade: TRADES[0], language: LANGUAGES[0], location: "", transcript: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savedWorker, setSavedWorker] = useState(null);
  const [copied, setCopied] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const runAssessment = async () => {
    setError("");
    if (form.transcript.trim().length < 15) {
      setError(t("wk_err_short"));
      return;
    }
    setLoading(true); setResult(null); setSaved(false);
    try {
      const data = await api.assessSkill({ trade: form.trade, language: form.language, transcript: form.transcript.trim() });
      setResult(data);
    } catch (e) {
      setError(e.message || t("wk_err_grade"));
    } finally { setLoading(false); }
  };

  const saveToPassport = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const worker = await api.saveWorker({
        trade: form.trade, language: form.language, location: form.location.trim() || "Location not shared",
        transcript: form.transcript.trim(), score: result.score, level: result.level,
        strengths: result.strengths || [], gaps: result.gaps || [], credentialSummary: result.credentialSummary || "",
      });
      setSavedWorker(worker);
      setSaved(true);
      onSaved && onSaved();
    } catch (e) {
      setError(e.message || t("wk_err_save"));
    } finally { setLoading(false); }
  };

  const verifyUrl = savedWorker ? `${window.location.origin}/verify/${savedWorker.id}` : "";
  const copyLink = () => {
    navigator.clipboard?.writeText(verifyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_worker")}<ReadAloud text={`${t("nav_worker")}. ${t("wk_sub")}`} /></h1>
        <p>{t("wk_sub")}</p>
      </div>
      <div className="pram-two-col">
        <div className="pram-panel">
          <div className="pram-field-row">
            <Field label={t("wk_field_trade")}><select value={form.trade} onChange={set("trade")}>{TRADES.map((tr) => <option key={tr} value={tr}>{t(tr)}</option>)}</select></Field>
            <Field label={t("wk_field_lang")}><select value={form.language} onChange={set("language")}>{LANGUAGES.map((l) => <option key={l} value={l}>{t(l)}</option>)}</select></Field>
          </div>
          <Field label={t("wk_field_location")}><input value={form.location} onChange={set("location")} placeholder={t("wk_field_location_ph")} /></Field>
          <Field label={t("wk_field_transcript")}>
            <textarea rows={6} value={form.transcript} onChange={set("transcript")} placeholder={t("wk_field_transcript_ph")} />
          </Field>
          <VoiceInputButton
            size="large"
            locale={TRADE_LANG_LOCALE[form.language] || "en-IN"}
            value={form.transcript}
            onResult={(text) => setForm((f) => ({ ...f, transcript: text }))}
          />
          <div className="pram-mic-note"><Mic size={13} /> {t("wk_mic_note")}</div>
          <ErrorNote message={error} />
          <button className="pram-btn primary full" onClick={runAssessment} disabled={loading}>
            {loading && !result ? <Loading label={t("wk_loading_grading")} /> : t("wk_btn_run")}
          </button>
        </div>
        <div className="pram-panel result">
          {!result && !loading && <div className="pram-empty"><Fingerprint size={26} /><p>{t("wk_empty_result")}</p></div>}
          {loading && !result && <Loading label={t("wk_loading_listen")} />}
          {result && (
            <div className="pram-result">
              <div className="pram-result-top">
                <div><div className="pram-result-label">{t("wk_result_score_label")}</div><div className="pram-result-score">{result.score}<span>/900</span></div></div>
                <div className="pram-level-badge">{result.level}</div>
              </div>
              <ScoreBar score={result.score} />
              <div className="pram-result-block"><h4>{t("wk_block_strengths")}</h4><ul>{(result.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              <div className="pram-result-block"><h4>{t("wk_block_gaps")}</h4><ul>{(result.gaps || []).map((g, i) => <li key={i}>{g}</li>)}</ul></div>
              <div className="pram-result-block followup"><h4>{t("wk_block_followup")}</h4><p>"{result.followUpQuestion}"</p></div>
              {!saved ? (
                <button className="pram-btn secondary full" onClick={saveToPassport} disabled={loading}>
                  {loading ? <Loading label={t("wk_loading_writing")} /> : t("wk_btn_issue")}
                </button>
              ) : (
                <div className="pram-issued-block">
                  <div className="pram-saved-note"><BadgeCheck size={16} /> {t("wk_saved_note")}</div>
                  {savedWorker && (
                    <div className="pram-verify-qr-block">
                      <QRCode value={verifyUrl} size={128} />
                      <div className="pram-verify-qr-side">
                        <p>{t("wk_credential_id_label")}</p>
                        <div className="pram-passport-idline">{savedWorker.id}</div>
                        <button className="pram-btn ghost small" onClick={copyLink}>
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied ? t("vf_copied") : t("wk_copy_verify_link")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
