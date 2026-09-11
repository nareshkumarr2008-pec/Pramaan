import React from "react";
import { ShieldCheck, Fingerprint, Sparkles, FileText } from "lucide-react";
import { useLang } from "../i18n.js";

export default function Overview({ stats, setScreen, session }) {
  const { t } = useLang();
  const isWorker = session.role === "worker";
  const isAdmin = session.role === "admin";
  return (
    <div className="pram-screen">
      <div className="pram-hero">
        <div className="pram-hero-eyebrow"><ShieldCheck size={15} /> {t("ov_eyebrow")}</div>
        <h1>{t("ov_h1a")}<br />{t("ov_h1b")}</h1>
        <p className="pram-hero-copy">{t("ov_copy")}</p>
        <div className="pram-hero-actions">
          {isAdmin ? (
            <button className="pram-btn primary" onClick={() => setScreen("admin")}>{t("nav_admin")}</button>
          ) : isWorker ? (
            <>
              <button className="pram-btn primary" onClick={() => setScreen("worker")}>{t("nav_worker")}</button>
              <button className="pram-btn ghost" onClick={() => setScreen("browse")}>{t("nav_browse")}</button>
            </>
          ) : (
            <>
              <button className="pram-btn primary" onClick={() => setScreen("msme")}>{t("ov_btn_msme")}</button>
              <button className="pram-btn ghost" onClick={() => setScreen("postings")}>{t("ov_btn_postings")}</button>
            </>
          )}
        </div>
      </div>

      <div className="pram-grid3">
        <div className="pram-card"><Fingerprint size={20} /><h3>{t("ov_card1_title")}</h3><p>{t("ov_card1_body")}</p></div>
        <div className="pram-card"><Sparkles size={20} /><h3>{t("ov_card2_title")}</h3><p>{t("ov_card2_body")}</p></div>
        <div className="pram-card"><FileText size={20} /><h3>{t("ov_card3_title")}</h3><p>{t("ov_card3_body")}</p></div>
      </div>

      <div className="pram-network">
        <div><div className="pram-network-num">{stats.workers}</div><div className="pram-network-label">{t("ov_net_workers")}</div></div>
        <div><div className="pram-network-num">{stats.jobs}</div><div className="pram-network-label">{t("ov_net_jobs")}</div></div>
        <div><div className="pram-network-num">{t("ov_net_stack_label")}</div><div className="pram-network-label">Aadhaar · DigiLocker · Udyam · Skill India Digital · Beckn</div></div>
      </div>
    </div>
  );
}
