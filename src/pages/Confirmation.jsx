import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useLocale } from "../components/ui.jsx";
import { getInquiryStatus } from "../lib/api.js";

// Shown after any submission. Reads the real record by its tracking token, so the
// confirmation also works if the customer reloads or opens the link later.
export default function Confirmation() {
  const { t } = useLocale();
  const { token } = useParams();
  const { state } = useLocation();
  const [data, setData] = useState(state ? { intent: state.intent, reference: state.reference } : null);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/seguimiento/${token}`;

  useEffect(() => {
    if (data?.reference) return;
    getInquiryStatus(token).then((d) => d && setData(d)).catch(() => {});
  }, [token]); // eslint-disable-line

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch (_) {}
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-12 pb-12">
      <div className="w-12 h-12 rounded-full bg-ok/15 border border-ok/50 grid place-items-center" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#00B368" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl tracking-wide mt-5" tabIndex={-1}>{t("okTitle")}</h1>

      {data && (
        <dl className="mt-8 rounded-2xl border border-line bg-surface divide-y divide-line">
          <div className="p-4 flex justify-between gap-4"><dt className="text-muted text-sm">{t("okService")}</dt><dd className="text-sm text-right">{t("service_" + data.intent)}</dd></div>
          <div className="p-4 flex justify-between gap-4"><dt className="text-muted text-sm">{t("okRef")}</dt><dd className="font-display text-xl tracking-wider">{data.reference}</dd></div>
        </dl>
      )}

      {data && (
        <section className="mt-8">
          <h2 className="font-semibold">{t("okNextTitle")}</h2>
          <p className="text-muted mt-2">{t("okNext_" + data.intent)}</p>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-line p-4">
        <p className="text-sm">{t("okTrack")}</p>
        <p className="text-xs text-muted break-all mt-2">{link}</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" onClick={copy} className="rounded-xl border border-line px-4 min-h-[44px] text-sm hover:border-brand">
            {copied ? t("copied") : t("copy")}
          </button>
          <Link to={`/seguimiento/${token}`} className="rounded-xl border border-line px-4 min-h-[44px] text-sm hover:border-brand inline-flex items-center">{t("trackGo")}</Link>
        </div>
      </section>

      <Link to="/" className="mt-10 inline-flex items-center rounded-xl bg-brand text-white font-semibold px-5 min-h-[48px]">{t("okHome")}</Link>
    </div>
  );
}
