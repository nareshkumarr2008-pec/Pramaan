import React, { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useLang } from "../i18n.js";

const BRASS = "#c0862a";
const INDIGO = "#2b4570";
const GREEN = "#3f7a57";
const RUST = "#a63d2f";
const INK = "#1c2321";

function stateOf(location) {
  const m = /,\s*([A-Za-z]+)\s*$/.exec(location || "");
  return m ? m[1] : "—";
}

function BarChart({ data, width = 560, height = 220, color = BRASS, valueFmt = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const padL = 34, padB = 46, padT = 12, padR = 10;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const bw = innerW / data.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke={INK} strokeOpacity={0.1} />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = padL + i * bw + bw * 0.18;
        const y = padT + innerH - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw * 0.64} height={h} rx={2} fill={d.color || color} />
            <text x={x + bw * 0.32} y={padT + innerH + 16} textAnchor="middle" fontSize="10.5" fill={INK} fillOpacity={0.65}>
              {d.label}
            </text>
            <text x={x + bw * 0.32} y={y - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={INK} fillOpacity={0.8}>
              {valueFmt(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GroupedBarChart({ categories, series, width = 620, height = 240 }) {
  const max = Math.max(1, ...categories.flatMap((_, i) => series.map((s) => s.values[i])));
  const padL = 34, padB = 56, padT = 12, padR = 10;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const groupW = innerW / categories.length;
  const barW = (groupW * 0.7) / series.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke={INK} strokeOpacity={0.1} />
      ))}
      {categories.map((cat, ci) => {
        const gx = padL + ci * groupW + groupW * 0.15;
        return (
          <g key={cat}>
            {series.map((s, si) => {
              const v = s.values[ci];
              const h = (v / max) * innerH;
              const x = gx + si * barW;
              const y = padT + innerH - h;
              return <rect key={s.name} x={x} y={y} width={barW * 0.86} height={h} rx={2} fill={s.color} />;
            })}
            <text x={gx + (barW * series.length) / 2} y={padT + innerH + 14} textAnchor="middle" fontSize="10" fill={INK} fillOpacity={0.65} transform={`rotate(0 ${gx} 0)`}>
              {cat.length > 12 ? cat.slice(0, 11) + "…" : cat}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${padL}, ${height - 16})`}>
        {series.map((s, i) => (
          <g key={s.name} transform={`translate(${i * 120}, 0)`}>
            <rect width="10" height="10" rx="2" fill={s.color} />
            <text x="14" y="9" fontSize="10.5" fill={INK} fillOpacity={0.75}>{s.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function AreaChart({ points, width = 620, height = 200, color = INDIGO }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const padL = 30, padB = 26, padT = 12, padR = 10;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => [padL + i * step, padT + innerH - (p.value / max) * innerH]);
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0]},${c[1]}`).join(" ");
  const areaPath = `${linePath} L${padL + innerW},${padT + innerH} L${padL},${padT + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
      <defs>
        <linearGradient id="pram-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#pram-area-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
      {coords.map((c, i) => (i % Math.ceil(points.length / 8 || 1) === 0 ? (
        <text key={i} x={c[0]} y={height - 6} textAnchor="middle" fontSize="9.5" fill={INK} fillOpacity={0.55}>
          {points[i].label}
        </text>
      ) : null))}
      <text x={padL} y={padT + 4} fontSize="10" fill={INK} fillOpacity={0.5}>{max}</text>
    </svg>
  );
}

export default function Insights({ workers, jobs }) {
  const { t } = useLang();

  const scoreBands = useMemo(() => {
    const bands = { Novice: 0, Competent: 0, Skilled: 0, Master: 0 };
    workers.forEach((w) => { bands[w.level] = (bands[w.level] || 0) + 1; });
    return [
      { label: "Novice", value: bands.Novice || 0, color: RUST },
      { label: "Competent", value: bands.Competent || 0, color: BRASS },
      { label: "Skilled", value: bands.Skilled || 0, color: INDIGO },
      { label: "Master", value: bands.Master || 0, color: GREEN },
    ];
  }, [workers]);

  const tradeCounts = useMemo(() => {
    const m = new Map();
    workers.forEach((w) => m.set(w.trade, (m.get(w.trade) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label: t(label), value }));
  }, [workers, t]);

  const stateCounts = useMemo(() => {
    const m = new Map();
    workers.forEach((w) => { const s = stateOf(w.location); m.set(s, (m.get(s) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [workers]);

  const growth = useMemo(() => {
    if (!workers.length) return [];
    const sorted = [...workers].sort((a, b) => a.createdAt - b.createdAt);
    const first = sorted[0].createdAt;
    const now = Date.now();
    const weeks = Math.max(1, Math.ceil((now - first) / (7 * 86400000))) ;
    const buckets = new Array(Math.min(weeks, 26)).fill(0);
    const bucketSpan = (now - first) / buckets.length || 1;
    sorted.forEach((w) => {
      let idx = Math.floor((w.createdAt - first) / bucketSpan);
      if (idx >= buckets.length) idx = buckets.length - 1;
      if (idx < 0) idx = 0;
      buckets[idx]++;
    });
    let running = 0;
    return buckets.map((c, i) => {
      running += c;
      return { label: `W${i + 1}`, value: running };
    });
  }, [workers]);

  const supplyDemand = useMemo(() => {
    const trades = [...new Set([...workers.map((w) => w.trade), ...jobs.map((j) => j.requiredTrade)])]
      .filter(Boolean)
      .slice(0, 8);
    const supply = trades.map((tr) => workers.filter((w) => w.trade === tr).length);
    const demand = trades.map((tr) => jobs.filter((j) => j.requiredTrade === tr).length);
    return {
      categories: trades.map((tr) => t(tr)),
      series: [
        { name: t("in_supply"), color: INDIGO, values: supply },
        { name: t("in_demand"), color: BRASS, values: demand },
      ],
    };
  }, [workers, jobs, t]);

  const avgScore = workers.length ? Math.round(workers.reduce((s, w) => s + w.score, 0) / workers.length) : 0;

  return (
    <div className="pram-screen">
      <div className="pram-screen-head">
        <h1>{t("in_title")}</h1>
        <p>{t("in_sub")}</p>
      </div>

      <div className="pram-network" style={{ marginBottom: 30 }}>
        <div><div className="pram-network-num">{workers.length}</div><div className="pram-network-label">{t("stat_workers")}</div></div>
        <div><div className="pram-network-num">{jobs.length}</div><div className="pram-network-label">{t("stat_jobs")}</div></div>
        <div><div className="pram-network-num">{avgScore}</div><div className="pram-network-label">{t("in_avg_score")}</div></div>
        <div><div className="pram-network-num">{new Set(workers.map((w) => stateOf(w.location))).size}</div><div className="pram-network-label">{t("in_states_reached")}</div></div>
      </div>

      <div className="pram-two-col">
        <div className="pram-panel">
          <h3 className="pram-chart-title"><BarChart3 size={15} /> {t("in_score_dist")}</h3>
          <BarChart data={scoreBands} />
        </div>
        <div className="pram-panel">
          <h3 className="pram-chart-title"><BarChart3 size={15} /> {t("in_growth")}</h3>
          <AreaChart points={growth.length ? growth : [{ label: "", value: 0 }]} />
        </div>
      </div>

      <div className="pram-two-col" style={{ marginTop: 20 }}>
        <div className="pram-panel">
          <h3 className="pram-chart-title"><BarChart3 size={15} /> {t("in_trade_breakdown")}</h3>
          <BarChart data={tradeCounts} color={INDIGO} />
        </div>
        <div className="pram-panel">
          <h3 className="pram-chart-title"><BarChart3 size={15} /> {t("in_state_breakdown")}</h3>
          <BarChart data={stateCounts} color={GREEN} />
        </div>
      </div>

      <div className="pram-panel wide" style={{ marginTop: 20 }}>
        <h3 className="pram-chart-title"><BarChart3 size={15} /> {t("in_supply_demand")}</h3>
        <GroupedBarChart categories={supplyDemand.categories} series={supplyDemand.series} />
      </div>
    </div>
  );
}
