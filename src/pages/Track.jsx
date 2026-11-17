import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page, Field, TextInput, Button, useLocale } from "../components/ui.jsx";
import { getInquiryStatus } from "../lib/api.js";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Customer tracking by private token. Legacy route /track/:token also lands here.
export default function Track() {
  const { t, locale } = useLocale();
  const { token } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [state, setState] = useState({ loading: !!token, data: null, notFound: false });

  useEffect(() => {
    if (!token) return;
    if (!UUID.test(token)) { setState({ loading: false, data: null, notFound: true }); return; }
    setState({ loading: true, data: null, notFound: false });
    getInquiryStatus(token)
      .then((d) => setState({ loading: false, data: d, notFound: !d }))
      .catch(() => setState({ loading: false, data: null, notFound: true }));
  }, [token]);

  const go = (e) => {
    e.preventDefault();
    const m = input.match(UUID);
    if (m) navigate(`/seguimiento/${m[0]}`);
    else setState({ loading: false, data: null, notFound: true });
  };

  const fmtDate = (d) => new Date(d).toLocaleString(locale === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const d = state.data;

  return (
    <Page title={t("trackTitle")} intro={!d ? t("trackIntro") : null}>
      {!token && (
        <form onSubmit={go} className="space-y-4" noValidate>
          <Field id="tlink" label={t("trackLink")}>
            <TextInput id="tlink" value={input} onChange={setInput} />
          </Field>
          <Button type="submit">{t("trackGo")}</Button>
        </form>
      )}
      {state.loading && <p className="text-muted" role="status">{t("trackLoading")}</p>}
      {state.notFound && <p className="text-warn mt-4" role="alert">{t("trackNotFound")}</p>}
      {d && (
        <div className="space-y-6">
          <dl className="rounded-2xl border border-line bg-surface divide-y divide-line">
            <div className="p-4 flex justify-between gap-4"><dt className="text-muted text-sm">{t("okRef")}</dt><dd className="font-display text-xl tracking-wider">{d.reference}</dd></div>
            <div className="p-4 flex justify-between gap-4"><dt className="text-muted text-sm">{t("okService")}</dt><dd className="text-sm text-right">{t("service_" + d.intent)}</dd></div>
            <div className="p-4 flex justify-between gap-4"><dt className="text-muted text-sm">{t("trackStatus")}</dt><dd className="text-sm font-semibold text-sonar">{t("st_" + d.status)}</dd></div>
          </dl>
          <section>
            <h2 className="font-semibold mb-3">{t("trackHistory")}</h2>
            <ol className="border-l border-line pl-5 space-y-4">
              {d.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand" aria-hidden="true" />
                  <p className="text-sm">{i === 0 ? t("trackSubmitted") : t("st_" + h.status)}</p>
                  <p className="text-xs text-muted">{fmtDate(h.at)}</p>
                </li>
              ))}
            </ol>
          </section>
          <p className="text-sm text-muted">{t("okNext_" + d.intent)}</p>
        </div>
      )}
    </Page>
  );
}
