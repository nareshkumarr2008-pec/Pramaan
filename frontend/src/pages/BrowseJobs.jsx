import React, { useState } from "react";
import { Briefcase, MapPin, Send, Zap } from "lucide-react";
import { ErrorNote, Loading, ReadAloud } from "../components/atoms.jsx";
import { api } from "../api.js";
import { useLang } from "../i18n.js";

export default function BrowseJobs({ jobs, myApplications, myProfiles, refresh }) {
  const { t } = useLang();
  const [busyId, setBusyId] = useState("");
  const [autoBusyId, setAutoBusyId] = useState("");
  const [error, setError] = useState("");

  const applicationFor = (jobId) => myApplications.find((a) => a.job_id === jobId);
  const alreadyApplied = (jobId) => !!applicationFor(jobId);

  const apply = async (job) => {
    setError(""); setBusyId(job.id);
    try {
      await api.apply(job.id);
      refresh && refresh();
    } catch (e) {
      setError(e.message || t("bj_err_apply"));
    } finally { setBusyId(""); }
  };

  const toggleAutoApply = async (profile) => {
    setError(""); setAutoBusyId(profile.id);
    try {
      await api.setAutoApply(profile.id, !profile.autoApply);
      refresh && refresh();
    } catch (e) {
      setError(e.message || t("bj_err_apply"));
    } finally { setAutoBusyId(""); }
  };

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_browse")}<ReadAloud text={`${t("nav_browse")}. ${t("bj_sub")}`} /></h1>
        <p>{t("bj_sub")}</p>
      </div>
      <ErrorNote message={error} />

      {myProfiles && myProfiles.length > 0 && (
        <div className="pram-panel" style={{ marginBottom: 18 }}>
          <div className="pram-screen-head" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>{t("bj_auto_title")}</h2>
            <p style={{ margin: 0 }}>{t("bj_auto_sub")}</p>
          </div>
          {myProfiles.map((p) => (
            <div key={p.id} className="pram-applicant-row" style={{ justifyContent: "space-between" }}>
              <span><Zap size={13} /> {t(p.trade)} — {p.score}/900</span>
              <button
                className={`pram-btn ${p.autoApply ? "primary" : "ghost"}`}
                disabled={autoBusyId === p.id}
                onClick={() => toggleAutoApply(p)}
              >
                {autoBusyId === p.id ? <Loading label="…" /> : p.autoApply ? t("bj_auto_on") : t("bj_auto_off")}
              </button>
            </div>
          ))}
        </div>
      )}

      {jobs.length === 0 && <div className="pram-empty"><Briefcase size={26} /><p>{t("bj_empty")}</p></div>}
      <div className="pram-job-grid">
        {jobs.map((j) => {
          const application = applicationFor(j.id);
          const applied = !!application;
          return (
            <div className="pram-job-card" key={j.id}>
              <div>
                <div className="pram-job-role">{j.role}</div>
                <div className="pram-job-shop">{j.shopName} · {t(j.sector)}</div>
              </div>
              <div className="pram-job-meta"><MapPin size={12} /> {j.location} · {j.wageBand}</div>
              <div className="pram-tag-row">{(j.skillsNeeded || []).map((s, i) => <span className="pram-tag" key={i}>{s}</span>)}</div>
              <button className={`pram-btn full ${applied ? "ghost" : "secondary"}`} disabled={applied || busyId === j.id} onClick={() => apply(j)}>
                {applied
                  ? (application.source === "auto" ? <><Zap size={13} /> {t("bj_auto_badge")}</> : t("bj_applied"))
                  : busyId === j.id ? <Loading label={t("bj_loading_send")} /> : (<><Send size={13} /> {t("bj_apply")}</>)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
