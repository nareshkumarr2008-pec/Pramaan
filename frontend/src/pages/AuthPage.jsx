import React, { useEffect, useState } from "react";
import { Stamp, User, Building2, Lock, ShieldCheck, Fingerprint, Sparkles, FileText, ArrowRight } from "lucide-react";
import { Field, ErrorNote, Loading } from "../components/atoms.jsx";
import { api } from "../api.js";
import { useLang } from "../i18n.js";

export default function AuthPage({ onLogin, onSignup }) {
  const { lang, setLang, t } = useLang();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", displayName: "", role: "worker" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ workers: 0, jobs: 0 });
  const [checkId, setCheckId] = useState("");

  useEffect(() => {
    Promise.all([api.listWorkers().catch(() => []), api.listJobs().catch(() => [])]).then(([w, j]) =>
      setStats({ workers: w.length, jobs: j.length })
    );
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError("");
    if (!form.username.trim() || !form.password.trim() || (mode === "signup" && !form.displayName.trim())) {
      setError(t("auth_missing"));
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await onSignup({ ...form, uiLanguage: lang });
      } else {
        await onLogin(form.username.trim(), form.password);
      }
    } catch (e) {
      setError(e.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const runCheck = () => {
    const id = checkId.trim();
    if (id) window.location.href = `/verify/${encodeURIComponent(id)}`;
  };

  return (
    <div className="pram-landing">
      <div className="pram-landing-lang">
        {["en", "hi", "ta"].map((l) => (
          <button key={l} className={`pram-lang-btn${lang === l ? " active" : ""}`} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="pram-landing-grid">
        {/* Left: marketing */}
        <div className="pram-landing-hero">
          <div className="pram-brand" style={{ borderBottom: "none", marginBottom: 22 }}>
            <div className="pram-brand-mark"><Stamp size={20} /></div>
            <div>
              <div className="pram-brand-name" style={{ color: "var(--ink)" }}>Pramaan.AI</div>
              <div className="pram-brand-sub" style={{ color: "rgba(28,35,33,0.6)" }}>{t("brand_sub")}</div>
            </div>
          </div>

          <div className="pram-hero-eyebrow"><ShieldCheck size={15} /> {t("ov_eyebrow")}</div>
          <h1 className="pram-landing-h1">{t("ov_h1a")}<br />{t("ov_h1b")}</h1>
          <p className="pram-hero-copy">{t("ov_copy")}</p>

          <div className="pram-network" style={{ marginBottom: 26 }}>
            <div><div className="pram-network-num">{stats.workers}</div><div className="pram-network-label">{t("ov_net_workers")}</div></div>
            <div><div className="pram-network-num">{stats.jobs}</div><div className="pram-network-label">{t("ov_net_jobs")}</div></div>
            <div><div className="pram-network-num">{t("ov_net_stack_label")}</div><div className="pram-network-label">Aadhaar · DigiLocker · Udyam · Skill India Digital · Beckn</div></div>
          </div>

          <div className="pram-grid3" style={{ marginBottom: 26 }}>
            <div className="pram-card"><Fingerprint size={19} /><h3>{t("ov_card1_title")}</h3><p>{t("ov_card1_body")}</p></div>
            <div className="pram-card"><Sparkles size={19} /><h3>{t("ov_card2_title")}</h3><p>{t("ov_card2_body")}</p></div>
            <div className="pram-card"><FileText size={19} /><h3>{t("ov_card3_title")}</h3><p>{t("ov_card3_body")}</p></div>
          </div>

          <div className="pram-landing-check">
            <div className="pram-landing-check-label">{t("lp_check_label")}</div>
            <div className="pram-landing-check-row">
              <input placeholder={t("lp_check_ph")} value={checkId} onChange={(e) => setCheckId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCheck()} />
              <button className="pram-btn ghost icon" onClick={runCheck} aria-label={t("lp_check_btn")}><ArrowRight size={16} /></button>
            </div>
          </div>
        </div>

        {/* Right: auth */}
        <div className="pram-auth-wrap embedded">
          <div className="pram-auth-card">
            <p className="pram-auth-tagline">{t("auth_tagline")}</p>

            <div className="pram-auth-tabs">
              <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{t("auth_login")}</button>
              <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>{t("auth_signup")}</button>
            </div>

            <Field label={t("auth_username")}>
              <input value={form.username} onChange={set("username")} autoCapitalize="none" placeholder="e.g. ramesh_k" />
            </Field>
            <Field label={t("auth_password")}>
              <input type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
            </Field>

            {mode === "signup" && (
              <>
                <Field label={t("auth_displayname")}>
                  <input value={form.displayName} onChange={set("displayName")} placeholder="e.g. Ramesh Kumar" />
                </Field>
                <Field label={t("auth_role")}>
                  <div className="pram-role-toggle">
                    <button className={form.role === "worker" ? "active" : ""} onClick={() => setForm((f) => ({ ...f, role: "worker" }))} type="button">
                      <User size={14} /> {t("auth_role_worker")}
                    </button>
                    <button className={form.role === "msme" ? "active" : ""} onClick={() => setForm((f) => ({ ...f, role: "msme" }))} type="button">
                      <Building2 size={14} /> {t("auth_role_msme")}
                    </button>
                  </div>
                </Field>
              </>
            )}

            <ErrorNote message={error} />

            <button className="pram-btn primary full" onClick={submit} disabled={loading}>
              {loading ? <Loading label="…" /> : mode === "login" ? t("auth_submit_login") : t("auth_submit_signup")}
            </button>

            <button className="pram-auth-switch" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? t("auth_switch_signup") : t("auth_switch_login")}
            </button>

            <div className="pram-auth-note"><Lock size={11} /> {t("auth_prototype_note")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
