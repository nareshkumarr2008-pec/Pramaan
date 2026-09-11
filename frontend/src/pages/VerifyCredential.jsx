import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, MapPin, Stamp, Link as LinkIcon, Copy, Check } from "lucide-react";
import { api } from "../api.js";
import { ScoreBar, Loading } from "../components/atoms.jsx";
import QRCode from "../components/QRCode.jsx";
import { useLang } from "../i18n.js";

export default function VerifyCredential({ workerId }) {
  const { lang, setLang, t } = useLang();
  const [state, setState] = useState("loading"); // loading | found | notfound
  const [worker, setWorker] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getWorker(workerId)
      .then((w) => {
        if (!alive) return;
        setWorker(w);
        setState("found");
      })
      .catch(() => {
        if (alive) setState("notfound");
      });
    return () => {
      alive = false;
    };
  }, [workerId]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="pram-verify-wrap">
      <div className="pram-verify-lang">
        {["en", "hi", "ta"].map((l) => (
          <button key={l} className={`pram-lang-btn${lang === l ? " active" : ""}`} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="pram-brand center" style={{ marginBottom: 26 }}>
        <div className="pram-brand-mark"><Stamp size={22} /></div>
        <div>
          <div className="pram-brand-name" style={{ color: "var(--ink)" }}>Pramaan.AI</div>
          <div className="pram-brand-sub" style={{ color: "rgba(28,35,33,0.6)" }}>{t("brand_sub")}</div>
        </div>
      </div>

      {state === "loading" && (
        <div className="pram-verify-card">
          <Loading label={t("vf_loading")} />
        </div>
      )}

      {state === "notfound" && (
        <div className="pram-verify-card notfound">
          <ShieldX size={30} />
          <h1>{t("vf_notfound_title")}</h1>
          <p>{t("vf_notfound_body")}</p>
        </div>
      )}

      {state === "found" && worker && (
        <div className="pram-verify-card">
          <div className="pram-verify-seal">
            <ShieldCheck size={16} /> <span>{t("vf_valid")}</span>
          </div>

          <div className="pram-verify-top">
            <div>
              <div className="pram-passport-name" style={{ fontSize: 20 }}>{worker.name}</div>
              <div className="pram-passport-trade">{t(worker.trade)}</div>
            </div>
          </div>

          <div className="pram-passport-score" style={{ marginTop: 14 }}>
            {worker.score}<span>/900 · {worker.level}</span>
          </div>
          <ScoreBar score={worker.score} />

          <p className="pram-passport-summary">{worker.credentialSummary}</p>

          <div className="pram-passport-foot"><MapPin size={12} /> {worker.location} · {t(worker.language)}</div>

          <div className="pram-verify-qr-block">
            <QRCode value={shareUrl} size={148} />
            <div className="pram-verify-qr-side">
              <p>{t("vf_qr_note")}</p>
              <button className="pram-btn ghost small" onClick={copyLink}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t("vf_copied") : t("vf_copy_link")}
              </button>
            </div>
          </div>

          <div className="pram-passport-idline"><LinkIcon size={10} style={{ verticalAlign: "-1px" }} /> DigiLocker VC · {worker.id}</div>
        </div>
      )}
    </div>
  );
}
