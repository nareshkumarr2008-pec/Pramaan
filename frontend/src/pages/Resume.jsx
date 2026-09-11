import React, { useState, useEffect, useRef } from "react";
import { FileText, Printer, ShieldCheck } from "lucide-react";
import { Field, Loading, ErrorNote } from "../components/atoms.jsx";
import QRCode from "../components/QRCode.jsx";
import { api } from "../api.js";
import { useLang } from "../i18n.js";

const RESUME_LANG_NAMES = { en: "English", hi: "Hindi", ta: "Tamil" };

export default function Resume({ myProfiles }) {
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState(myProfiles[0]?.id || "");
  const [resumeLang, setResumeLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resume, setResume] = useState(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!selectedId && myProfiles.length) setSelectedId(myProfiles[0].id);
  }, [myProfiles, selectedId]);

  const generate = async () => {
    if (!selectedId) return;
    setError(""); setLoading(true); setResume(null);
    try {
      const data = await api.generateResume(selectedId, resumeLang);
      setResume(data);
    } catch (e) {
      setError(e.message || t("rs_err_generate"));
    } finally { setLoading(false); }
  };

  const selectAll = () => { if (textRef.current) { textRef.current.focus(); textRef.current.select(); } };
  const doPrint = () => window.print();
  const selectedWorker = myProfiles.find((w) => w.id === selectedId);
  const verifyUrl = selectedWorker ? `${window.location.origin}/verify/${selectedWorker.id}` : "";

  const plainText = resume
    ? [
        resume.fullName, resume.headline, "", resume.summary, "",
        t("rs_key_skills") + ": " + (resume.keySkills || []).join(", "), "",
        t("rs_highlights") + ":", ...(resume.experienceHighlights || []).map((h) => "- " + h), "",
        resume.credentialLine, resume.contactNote,
      ].join("\n")
    : "";

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_resume")}</h1>
        <p>{t("rs_sub")}</p>
      </div>

      {myProfiles.length === 0 ? (
        <div className="pram-empty"><FileText size={26} /><p>{t("rs_empty_noprofile")}</p></div>
      ) : (
        <div className="pram-two-col">
          <div className="pram-panel">
            <Field label={t("rs_field_profile")}>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {myProfiles.map((w) => <option key={w.id} value={w.id}>{t(w.trade)} — {w.score}/900</option>)}
              </select>
            </Field>
            <Field label={t("rs_field_lang")}>
              <div className="pram-role-toggle">
                {["en", "hi", "ta"].map((l) => (
                  <button key={l} className={resumeLang === l ? "active" : ""} onClick={() => setResumeLang(l)} type="button">
                    {t(RESUME_LANG_NAMES[l])}
                  </button>
                ))}
              </div>
            </Field>
            <ErrorNote message={error} />
            <button className="pram-btn primary full" onClick={generate} disabled={loading}>
              {loading ? <Loading label={t("rs_loading_writing")} /> : t("rs_btn_generate")}
            </button>
            {selectedWorker && (
              <div className="pram-resume-verify">
                <QRCode value={verifyUrl} size={80} />
                <div>
                  <div className="pram-passport-idline">{selectedWorker.id}</div>
                  <a className="pram-auth-switch" style={{ marginTop: 0, padding: 0 }} href={verifyUrl} target="_blank" rel="noopener noreferrer">
                    {t("pp_verify_btn")}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="pram-panel result">
            {!resume && !loading && <div className="pram-empty"><FileText size={26} /><p>{t("rs_empty_preview")}</p></div>}
            {loading && !resume && <Loading label={t("rs_loading_draft")} />}
            {resume && (
              <div className="pram-resume-doc">
                <div className="pram-resume-name">{resume.fullName}</div>
                <div className="pram-resume-headline">{resume.headline}</div>
                <p className="pram-resume-summary">{resume.summary}</p>
                <h4>{t("rs_key_skills")}</h4>
                <div className="pram-tag-row">{(resume.keySkills || []).map((s, i) => <span className="pram-tag" key={i}>{s}</span>)}</div>
                <h4>{t("rs_highlights")}</h4>
                <ul>{(resume.experienceHighlights || []).map((h, i) => <li key={i}>{h}</li>)}</ul>
                <p className="pram-resume-credential"><ShieldCheck size={13} /> {resume.credentialLine}</p>
                <p className="pram-resume-contact">{resume.contactNote}</p>
                <div className="pram-resume-actions">
                  <button className="pram-btn ghost" onClick={doPrint}><Printer size={14} /> {t("rs_btn_print")}</button>
                  <button className="pram-btn ghost" onClick={selectAll}>{t("rs_btn_copy")}</button>
                </div>
                <textarea ref={textRef} readOnly className="pram-resume-raw" rows={6} value={plainText} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
