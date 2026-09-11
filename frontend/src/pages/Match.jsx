import React, { useState, useEffect } from "react";
import { MapPin, RefreshCw, Clock } from "lucide-react";
import { Field, Loading, ErrorNote } from "../components/atoms.jsx";
import { api } from "../api.js";
import { useLang, tf } from "../i18n.js";

export default function Match({ myJobs, presetJobId, refresh }) {
  const { t } = useLang();
  const [jobId, setJobId] = useState(presetJobId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState(null);
  const [trialStarted, setTrialStarted] = useState({});

  useEffect(() => {
    if (presetJobId) setJobId(presetJobId);
    else if (!jobId && myJobs.length) setJobId(myJobs[0].id);
  }, [myJobs, jobId, presetJobId]);

  const job = myJobs.find((j) => j.id === jobId);

  const runMatch = async () => {
    setError("");
    if (!job) { setError(t("mt_err_nojob")); return; }
    setLoading(true); setMatches(null);
    try {
      const data = await api.runMatch(job.id);
      setMatches(data.matches || []);
    } catch (e) {
      setError(e.message || t("mt_err_match"));
    } finally { setLoading(false); }
  };

  const startTrial = async (workerId, workerName) => {
    try {
      await api.startTrial({ jobId: job.id, workerId, workerName });
      setTrialStarted((s) => ({ ...s, [workerId]: true }));
    } catch (e) {}
  };

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_match")}</h1>
        <p>{t("mt_sub")}</p>
      </div>
      <div className="pram-panel wide">
        <div className="pram-match-controls">
          <Field label={t("mt_field_job")}>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {myJobs.length === 0 && <option value="">{t("mt_opt_none")}</option>}
              {myJobs.map((j) => <option key={j.id} value={j.id}>{j.shopName} — {j.role}</option>)}
            </select>
          </Field>
          <button className="pram-btn primary" onClick={runMatch} disabled={loading}>
            {loading ? <Loading label={t("mt_loading_rank")} /> : t("mt_btn_run")}
          </button>
          <button className="pram-btn ghost icon" onClick={refresh} title={t("mt_refresh_title")}><RefreshCw size={15} /></button>
        </div>

        {job && (
          <div className="pram-job-summary">
            <MapPin size={14} />
            <span>{tf(t("mt_job_summary"), { shop: job.shopName, role: job.role, location: job.location, wage: job.wageBand })}</span>
          </div>
        )}
        <ErrorNote message={error} />
        {matches && matches.length === 0 && <div className="pram-empty inline"><p>{t("mt_empty_match")}</p></div>}

        {matches && matches.length > 0 && (
          <div className="pram-match-list">
            {matches.map((m, idx) => {
              const w = m.worker;
              if (!w) return null;
              return (
                <div className="pram-match-card" key={m.workerId}>
                  <div className="pram-match-rank">#{idx + 1}</div>
                  <div className="pram-match-main">
                    <div className="pram-match-head"><span className="pram-match-name">{w.name}</span><span className="pram-match-trade">{t(w.trade)}</span></div>
                    <div className="pram-match-meta"><MapPin size={12} /> {w.location} · {tf(t("mt_match_meta"), { lang: t(w.language), score: w.score })}</div>
                    <p className="pram-match-rationale">{m.rationale}</p>
                    {trialStarted[w.id] ? (
                      <div className="pram-saved-note small"><Clock size={13} /> {t("mt_trial_started")}</div>
                    ) : (
                      <button className="pram-btn ghost small" onClick={() => startTrial(w.id, w.name)}>{t("mt_btn_trial")}</button>
                    )}
                  </div>
                  <div className="pram-match-score"><div className="pram-match-score-num">{m.matchScore}%</div><div className="pram-match-score-label">{t("mt_fit")}</div></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
