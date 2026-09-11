import React from "react";
import {
  Fingerprint, Building2, Shuffle, LayoutGrid,
  ChevronRight, Stamp, User, LogOut, FileText, Briefcase, Users, ShieldCheck, BarChart3, ArrowLeftRight,
} from "lucide-react";
import { useLang } from "../i18n.js";

export default function Sidebar({ screen, setScreen, stats, session, onLogout }) {
  const { lang, setLang, t } = useLang();
  const items = [
    { id: "overview", label: t("nav_overview"), icon: LayoutGrid, roles: ["worker", "msme", "admin"] },
    { id: "worker", label: t("nav_worker"), icon: Fingerprint, roles: ["worker"] },
    { id: "resume", label: t("nav_resume"), icon: FileText, roles: ["worker"] },
    { id: "browse", label: t("nav_browse"), icon: Briefcase, roles: ["worker"] },
    { id: "msme", label: t("nav_msme"), icon: Building2, roles: ["msme"] },
    { id: "postings", label: t("nav_postings"), icon: Users, roles: ["msme"] },
    { id: "match", label: t("nav_match"), icon: Shuffle, roles: ["msme"] },
    // "Skill passport" is intentionally not listed here — it's kept in the
    // app but hidden from the nav rather than shown explicitly.
    { id: "insights", label: t("nav_insights"), icon: BarChart3, roles: ["worker", "msme", "admin"] },
    { id: "admin", label: t("nav_admin"), icon: ShieldCheck, roles: ["admin"] },
  ].filter((it) => it.roles.includes(session.role));

  // Opens a brand-new tab with "noopener" so it gets its own independent
  // sessionStorage (the same-origin auth token lives there — see api.js).
  // Without noopener, a tab opened via window.open shares its opener's
  // sessionStorage, which would log this tab out the moment someone signs
  // into the new one. With it, the new tab lands on a fresh login screen
  // while this tab's session is completely untouched.
  const openSwitchAccount = () => {
    window.open(window.location.origin + "/", "_blank", "noopener");
  };

  return (
    <nav className="pram-sidebar">
      <div className="pram-brand">
        <div className="pram-brand-mark"><Stamp size={20} /></div>
        <div>
          <div className="pram-brand-name">Pramaan.AI</div>
          <div className="pram-brand-sub">{t("brand_sub")}</div>
        </div>
      </div>

      <div className="pram-nav-list">
        {items.map((it) => {
          const Icon = it.icon;
          const active = screen === it.id;
          return (
            <button key={it.id} className={`pram-nav-item${active ? " active" : ""}`} onClick={() => setScreen(it.id)}>
              <Icon size={17} />
              <span>{it.label}</span>
              {active && <ChevronRight size={14} className="pram-nav-chev" />}
            </button>
          );
        })}
        <button className="pram-nav-item" onClick={openSwitchAccount} title={t("switch_account_hint")}>
          <ArrowLeftRight size={17} />
          <span>{t("switch_account")}</span>
        </button>
      </div>

      <div className="pram-sidebar-stats">
        <div className="pram-stat"><span className="pram-stat-num">{stats.workers}</span><span className="pram-stat-label">{t("stat_workers")}</span></div>
        <div className="pram-stat"><span className="pram-stat-num">{stats.jobs}</span><span className="pram-stat-label">{t("stat_jobs")}</span></div>
      </div>

      <div className="pram-sidebar-lang">
        {["en", "hi", "ta"].map((l) => (
          <button key={l} className={`pram-lang-btn small${lang === l ? " active" : ""}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>

      <div className="pram-sidebar-user">
        <div className="pram-user-chip"><User size={13} /><span>{session.displayName}</span></div>
        <button className="pram-logout-btn" onClick={onLogout} title={t("logout")}><LogOut size={14} /></button>
      </div>
    </nav>
  );
}
