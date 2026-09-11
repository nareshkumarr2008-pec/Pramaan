import React, { useState } from "react";
import { BadgeCheck, ShieldCheck, MapPin, QrCode } from "lucide-react";
import { ScoreBar } from "../components/atoms.jsx";
import { useLang } from "../i18n.js";

export default function Passport({ workers }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const filtered = query.trim() ? workers.filter((w) => w.name.toLowerCase().includes(query.trim().toLowerCase())) : workers;
  return (
    <div className="pram-screen">
      <div className="pram-screen-head"><h1>{t("nav_passport")}</h1><p>{t("pp_sub")}</p></div>
      <input className="pram-search" placeholder={t("pp_search_ph")} value={query} onChange={(e) => setQuery(e.target.value)} />
      {filtered.length === 0 && <div className="pram-empty"><BadgeCheck size={26} /><p>{t("pp_empty")}</p></div>}
      <div className="pram-passport-grid">
        {filtered.map((w) => (
          <div className="pram-passport-card" key={w.id}>
            <div className="pram-passport-top">
              <div><div className="pram-passport-name">{w.name}</div><div className="pram-passport-trade">{t(w.trade)}</div></div>
              <div className="pram-passport-seal"><ShieldCheck size={16} /><span>{t("pp_verified")}</span></div>
            </div>
            <div className="pram-passport-score">{w.score}<span>/900 · {w.level}</span></div>
            <ScoreBar score={w.score} />
            <p className="pram-passport-summary">{w.credentialSummary}</p>
            <div className="pram-passport-foot"><MapPin size={12} /> {w.location} · {t(w.language)}</div>
            <div className="pram-passport-idline">DigiLocker VC · {w.id}</div>
            <button className="pram-btn ghost small full" onClick={() => window.open(`/verify/${w.id}`, "_blank", "noopener")}>
              <QrCode size={14} /> {t("pp_verify_btn")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
