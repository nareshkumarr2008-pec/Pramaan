import React from "react";
import { Users, MapPin } from "lucide-react";
import { useLang } from "../i18n.js";

export default function Postings({ myJobs, goToMatch }) {
  const { t } = useLang();
  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_postings")}</h1>
        <p>{t("ps_sub")}</p>
      </div>
      {myJobs.length === 0 && <div className="pram-empty"><Users size={26} /><p>{t("ps_empty")}</p></div>}
      <div className="pram-postings-list">
        {myJobs.map((j) => {
          const count = (j.applicants || []).length;
          return (
            <div className="pram-posting-card" key={j.id}>
              <div className="pram-posting-head">
                <div>
                  <div className="pram-job-role">{j.role}</div>
                  <div className="pram-job-meta"><MapPin size={12} /> {j.location} · {j.wageBand}</div>
                </div>
                <button className="pram-btn secondary" onClick={() => goToMatch(j.id)}>{t("ps_btn_match")}</button>
              </div>
              <div className="pram-applicant-row">
                <Users size={13} />
                <span>{count} {count === 1 ? t("ps_applicant_singular") : t("ps_applicant_plural")}</span>
                {count > 0 && (
                  <span className="pram-applicant-names">
                    {j.applicants.slice(0, 4).map((a) => a.worker_name).join(", ")}{j.applicants.length > 4 ? "…" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
