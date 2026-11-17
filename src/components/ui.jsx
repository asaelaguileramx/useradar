import React, { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t as tr, detectLocale } from "../lib/i18n.js";

const LocaleCtx = createContext({ locale: "es", setLocale: () => {}, t: (k) => k });

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);
  const setLocale = (l) => {
    setLocaleState(l);
    try { localStorage.setItem("radar_locale", l); } catch (_) {}
  };
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <LocaleCtx.Provider value={{ locale, setLocale, t: (k) => tr(locale, k) }}>{children}</LocaleCtx.Provider>;
}
export const useLocale = () => useContext(LocaleCtx);

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3 text-text no-underline" aria-label="RADAR CO.">
      <svg width="34" height="34" viewBox="-26 -26 52 52" aria-hidden="true">
        <circle r="24" fill="none" stroke="#1E6FFF" strokeWidth="1.5" opacity="0.45" />
        <circle r="16" fill="none" stroke="#1E6FFF" strokeWidth="1.5" opacity="0.7" />
        <circle r="7" fill="none" stroke="#1E6FFF" strokeWidth="1.5" />
        <g className="sweep"><line x1="0" y1="0" x2="0" y2="-24" stroke="#4FE0FF" strokeWidth="2" /></g>
        <circle r="2.5" fill="#4FE0FF" />
      </svg>
      <span className="leading-none">
        <span className="block font-display font-bold tracking-[0.18em] text-[22px]">RADAR</span>
        <span className="block text-[9px] tracking-[0.25em] text-muted mt-1">AUCTION BROKER</span>
      </span>
    </Link>
  );
}

export function Shell({ children }) {
  const { t, locale, setLocale } = useLocale();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-4 text-sm" aria-label="Principal">
            <Link to="/seguimiento" className="hidden sm:inline text-muted hover:text-text px-2 py-2">{t("navTrack")}</Link>
            <button type="button" onClick={() => setLocale(locale === "es" ? "en" : "es")}
              className="rounded-full border border-line px-3 py-2 text-text hover:border-brand min-h-[40px]">
              {t("langSwitch")}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-xs text-muted space-y-2">
          <p><Link to="/seguimiento" className="text-text underline">{t("navTrack")}</Link></p>
          <p>{t("footer1")}</p>
          <p>{t("footer2")}</p>
        </div>
      </footer>
    </div>
  );
}

export function Page({ title, intro, children, onBack }) {
  const { t } = useLocale();
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-12">
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-text mb-6 inline-flex items-center gap-2 min-h-[40px]">
          <span aria-hidden="true">←</span> {t("back")}
        </button>
      )}
      <h1 className="font-display font-semibold text-3xl sm:text-4xl tracking-wide">{title}</h1>
      {intro && <p className="text-muted mt-3">{intro}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function Field({ id, label, hint, error, optional, children }) {
  const { t } = useLocale();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">({t("optional")})</span>}
      </label>
      {children}
      {hint && !error && <p id={id + "-hint"} className="text-xs text-muted">{hint}</p>}
      {error && <p id={id + "-err"} className="text-xs text-warn" role="alert">{error}</p>}
    </div>
  );
}

const inputCls = (err) =>
  `w-full rounded-xl bg-surface border ${err ? "border-warn" : "border-line"} px-4 py-3 text-text placeholder:text-muted/70 focus:border-brand outline-none min-h-[48px]`;

export function TextInput({ id, value, onChange, error, hint, ...rest }) {
  return (
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls(error)}
      aria-invalid={!!error} aria-describedby={error ? id + "-err" : hint ? id + "-hint" : undefined} {...rest} />
  );
}

export function TextArea({ id, value, onChange, error, ...rest }) {
  return (
    <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={2000}
      className={inputCls(error) + " min-h-[96px]"} aria-invalid={!!error} {...rest} />
  );
}

export function Money({ id, value, onChange, error, hint }) {
  return (
    <div className={`flex items-center rounded-xl bg-surface border ${error ? "border-warn" : "border-line"} focus-within:border-brand px-4 min-h-[48px]`}>
      <span className="text-muted mr-2" aria-hidden="true">$</span>
      <input id={id} inputMode="decimal" autoComplete="off" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        className="flex-1 bg-transparent outline-none py-3 text-text tabular-nums"
        aria-invalid={!!error} aria-describedby={error ? id + "-err" : hint ? id + "-hint" : undefined} />
      <span className="text-muted text-xs ml-2" aria-hidden="true">USD</span>
    </div>
  );
}

export function Choice({ name, label, options, value, onChange, error, cols = 3 }) {
  return (
    <fieldset className="space-y-2">
      <legend className="block text-sm font-semibold mb-2">{label}</legend>
      <div className={`grid gap-2 grid-cols-1 ${cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {options.map((o) => (
          <label key={o.value}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer min-h-[48px] ${value === o.value ? "border-brand bg-brand/10" : "border-line bg-surface hover:border-muted"}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)}
              className="accent-[#1E6FFF] w-4 h-4" />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-warn" role="alert">{error}</p>}
    </fieldset>
  );
}

export function Button({ children, variant = "primary", className = "", ...rest }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-5 font-semibold min-h-[48px] transition disabled:opacity-60 disabled:cursor-not-allowed";
  const v = variant === "primary" ? "bg-brand text-white hover:bg-[#3A82FF]" : "border border-line text-text hover:border-brand";
  return <button className={`${base} ${v} ${className}`} {...rest}>{children}</button>;
}

export const fmtUSD = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
