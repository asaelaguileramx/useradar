import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../components/ui.jsx";
import { track } from "../lib/analytics.js";

function Scope() {
  return (
    <svg viewBox="-110 -110 220 220" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="g" r="1"><stop offset="0" stopColor="#1E6FFF" stopOpacity=".18" /><stop offset="1" stopColor="#1E6FFF" stopOpacity="0" /></radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4FE0FF" stopOpacity="0" /><stop offset="1" stopColor="#4FE0FF" stopOpacity=".35" /></linearGradient>
      </defs>
      <circle r="105" fill="url(#g)" />
      {[100, 75, 50, 25].map((r) => <circle key={r} r={r} fill="none" stroke="#1E6FFF" strokeOpacity={r === 100 ? 0.5 : 0.22} />)}
      <line x1="-100" x2="100" stroke="#1E6FFF" strokeOpacity=".15" />
      <line y1="-100" y2="100" stroke="#1E6FFF" strokeOpacity=".15" />
      <g className="sweep">
        <path d="M0 0 L0 -100 A100 100 0 0 1 70.7 -70.7 Z" fill="url(#beam)" />
        <line x1="0" y1="0" x2="0" y2="-100" stroke="#4FE0FF" strokeWidth="1.5" />
      </g>
      <circle r="3" fill="#4FE0FF" />
    </svg>
  );
}

const paths = [
  { key: "A", to: "/cotizar", intent: "existing_lot", primary: true },
  { key: "B", to: "/buscar", intent: "vehicle_search" },
  { key: "C", to: "/subastas-dealers", intent: "wholesale_inquiry" },
];

export default function Landing() {
  const { t, locale } = useLocale();
  useEffect(() => { track("landing_view", { locale, path: "/" }); }, []); // eslint-disable-line

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <section className="pt-6 sm:pt-16 grid sm:grid-cols-[1fr_200px] gap-6 items-center">
        <div>
          <p className="text-xs tracking-[0.25em] text-sonar uppercase">{t("brandTag")}</p>
          <h1 className="font-display font-semibold text-[32px] leading-[1.08] sm:text-6xl tracking-wide mt-2 sm:mt-3">{t("heroTitle")}</h1>
          <p className="text-muted text-[15px] sm:text-lg mt-3 sm:mt-4 max-w-xl">{t("heroSub")}</p>
        </div>
        <div className="hidden sm:block w-[200px] h-[200px]"><Scope /></div>
      </section>

      <section className="mt-5 sm:mt-8 grid gap-2.5 sm:grid-cols-3 sm:gap-4" aria-label="Opciones">
        {paths.map((p) => (
          <Link key={p.key} to={p.to}
            onClick={() => track("intent_selected", { intent: p.intent, locale })}
            className={`group rounded-2xl border p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 no-underline transition ${
              p.primary ? "border-brand bg-brand/10 hover:bg-brand/15" : "border-line bg-surface hover:border-brand"}`}>
            <span className="font-display text-lg sm:text-2xl tracking-wide text-text">{t(`path${p.key}_title`)}</span>
            <span className="text-sm text-muted">{t(`path${p.key}_desc`)}</span>
            <span className={`mt-auto inline-flex items-center justify-between rounded-xl px-4 min-h-[44px] sm:min-h-[48px] font-semibold ${
              p.primary ? "bg-brand text-white" : "border border-line text-text group-hover:border-brand"}`}>
              {t(`path${p.key}_cta`)} <span aria-hidden="true">→</span>
            </span>
            <span className="hidden sm:block text-xs text-muted">{t(`path${p.key}_note`)}</span>
          </Link>
        ))}
      </section>

      <ul className="mt-10 grid gap-3 sm:grid-cols-3 text-sm text-muted">
        {["trust1", "trust2", "trust3"].map((k) => (
          <li key={k} className="flex items-start gap-3">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-sonar shrink-0" aria-hidden="true" />{t(k)}
          </li>
        ))}
      </ul>
    </div>
  );
}
