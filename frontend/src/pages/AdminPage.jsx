import React, { useState } from "react";
import { Users, Building2, Trash2, MapPin, ShieldCheck } from "lucide-react";
import { useLang, tf } from "../i18n.js";
import { api } from "../api.js";
import { ErrorNote } from "../components/atoms.jsx";

const ROLE_LABEL_KEY = { worker: "adm_role_worker", msme: "adm_role_msme", admin: "adm_role_admin" };

export default function AdminPage({ users, msmeJobs, refresh }) {
  const { t } = useLang();
  const [tab, setTab] = useState("users");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const deleteUser = async (username, displayName) => {
    if (!window.confirm(tf(t("adm_confirm_user"), { name: displayName || username }))) return;
    setError("");
    setBusyId(`user:${username}`);
    try {
      await api.adminDeleteUser(username);
      await refresh();
    } catch (e) {
      setError(e.message || t("adm_err_delete"));
    } finally {
      setBusyId("");
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm(t("adm_confirm_msme"))) return;
    setError("");
    setBusyId(`job:${jobId}`);
    try {
      await api.adminDeleteMsme(jobId);
      await refresh();
    } catch (e) {
      setError(e.message || t("adm_err_delete"));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("nav_admin")}</h1>
        <p>{t("adm_sub")}</p>
      </div>

      <div className="pram-auth-tabs" style={{ maxWidth: 320, marginBottom: 22 }}>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>{t("adm_tab_users")}</button>
        <button className={tab === "msme" ? "active" : ""} onClick={() => setTab("msme")}>{t("adm_tab_msme")}</button>
      </div>

      <ErrorNote message={error} />

      {tab === "users" ? (
        users.length === 0 ? (
          <div className="pram-empty"><Users size={26} /><p>{t("adm_users_empty")}</p></div>
        ) : (
          <div className="pram-postings-list">
            {users.map((u) => (
              <div className="pram-posting-card" key={u.username}>
                <div className="pram-posting-head">
                  <div>
                    <div className="pram-job-role">{u.displayName}</div>
                    <div className="pram-job-meta">
                      <span className="pram-tag">{t(ROLE_LABEL_KEY[u.role] || u.role)}</span>
                      <span>@{u.username}</span>
                    </div>
                  </div>
                  {u.role === "admin" ? (
                    <span className="pram-passport-seal"><ShieldCheck size={14} /><span>{t("adm_role_admin")}</span></span>
                  ) : (
                    <button
                      className="pram-btn ghost small"
                      disabled={busyId === `user:${u.username}`}
                      onClick={() => deleteUser(u.username, u.displayName)}
                    >
                      <Trash2 size={13} />
                      {busyId === `user:${u.username}` ? t("adm_deleting") : t("adm_btn_delete")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : msmeJobs.length === 0 ? (
        <div className="pram-empty"><Building2 size={26} /><p>{t("adm_msme_empty")}</p></div>
      ) : (
        <div className="pram-postings-list">
          {msmeJobs.map((j) => (
            <div className="pram-posting-card" key={j.id}>
              <div className="pram-posting-head">
                <div>
                  <div className="pram-job-role">{j.role}</div>
                  <div className="pram-job-shop">{j.shopName} · {j.ownerDisplayName}</div>
                  <div className="pram-job-meta"><MapPin size={12} /> {j.location} · {j.wageBand}</div>
                </div>
                <button
                  className="pram-btn ghost small"
                  disabled={busyId === `job:${j.id}`}
                  onClick={() => deleteJob(j.id)}
                >
                  <Trash2 size={13} />
                  {busyId === `job:${j.id}` ? t("adm_deleting") : t("adm_btn_delete")}
                </button>
              </div>
              <div className="pram-applicant-row">
                <Users size={13} />
                <span>{j.applicantCount} {t("adm_applicants")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
