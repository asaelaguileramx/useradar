import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Page, Field, TextInput, Money, Choice, useLocale, fmtUSD, Button } from "../components/ui.jsx";
import { useLeadForm, ContactFields, SubmitBar } from "../components/forms.jsx";
import { estimate } from "../lib/fees.js";
import { parseLot, validate } from "../lib/validation.js";

// Path A: existing Copart/IAA vehicle. Supports ?lot= prefill (link or number).
export default function QuoteWizard() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pre = params.get("lot") || params.get("url") || "";
  const preAuction = parseLot(pre).auction || "copart";
  const form = useLeadForm("existing_lot", { lot: pre, auction: preAuction, title: "salvage", destination: "us", maxOffer: "", transport: "", acknowledged: false });
  const { f, set, errors, msg } = form;
  const [step, setStep] = useState(1);

  const onLot = (v) => {
    set("lot")(v);
    const a = parseLot(v).auction;
    if (a) set("auction")(a);
  };

  const est = useMemo(() => estimate({ offer: form.money(f.maxOffer), auction: f.auction, title: f.title, transport: form.money(f.transport) || 0 }),
    [f.maxOffer, f.auction, f.title, f.transport]); // eslint-disable-line

  const step1Keys = ["lot", "auction", "maxOffer", "title", "destination"];
  const goStep2 = () => {
    const e = validate("existing_lot", { ...f, name: "xx", phone: "15555555555", language: "es" });
    const relevant = Object.fromEntries(Object.entries(e).filter(([k]) => step1Keys.includes(k)));
    if (Object.keys(relevant).length) {
      document.getElementById(Object.keys(relevant)[0])?.focus();
      setStepErrors(relevant);
      return;
    }
    setStepErrors({});
    setStep(2);
  };
  const [stepErrors, setStepErrors] = useState({});
  const err = (k) => errors[k] || stepErrors[k];

  const steps = [t("aStep1"), t("aStep2"), t("aStep3")];
  const back = () => (step === 1 ? navigate("/") : setStep(step - 1));

  return (
    <Page title={t("aTitle")} onBack={back}>
      <ol className="flex gap-2 mb-8 text-xs" aria-label="Pasos">
        {steps.map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? "step" : undefined}
            className={`flex-1 border-t-2 pt-2 ${step >= i + 1 ? "border-brand text-text" : "border-line text-muted"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-6">
          <Field id="lot" label={t("lot")} hint={t("lotHint")} error={err("lot") && t("err_lot")}>
            <TextInput id="lot" value={f.lot} onChange={onLot} error={err("lot")} hint inputMode="url" placeholder="https://www.copart.com/lot/…" />
          </Field>
          <Choice name="auction" label={t("auction")} cols={2} value={f.auction} onChange={set("auction")} error={err("auction") && t("err_auction")}
            options={[{ value: "copart", label: "Copart" }, { value: "iaa", label: "IAA" }]} />
          <Choice name="title" label={t("title")} cols={2} value={f.title} onChange={set("title")}
            options={[{ value: "salvage", label: t("title_salvage") }, { value: "clean", label: t("title_clean") }]} />
          <Field id="maxOffer" label={t("maxOffer")} hint={t("maxOfferHint")} error={err("maxOffer") && t("err_money")}>
            <Money id="maxOffer" value={f.maxOffer} onChange={set("maxOffer")} error={err("maxOffer")} hint />
          </Field>
          <Choice name="destination" label={t("destination")} cols={2} value={f.destination} onChange={set("destination")}
            options={[{ value: "us", label: t("dest_us") }, { value: "mx", label: t("dest_mx") }]} />
          <Field id="transport" label={t("transport")} optional>
            <Money id="transport" value={f.transport} onChange={set("transport")} />
          </Field>
          <Button className="w-full" onClick={goStep2}>{t("next")}</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface p-5" aria-live="polite">
            <dl className="divide-y divide-line text-sm">
              {[["est_offer", est.offer], ["est_buyer", est.buyer], ["est_virtual", est.virtual], ["est_fixed", est.fixed], ["est_service", est.service]]
                .concat(est.transport ? [["est_transport", est.transport]] : [])
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-3">
                    <dt className={k === "est_service" ? "text-sonar" : "text-muted"}>{t(k)}</dt>
                    <dd className="tabular-nums">{fmtUSD(v)}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex justify-between items-end border-t-2 border-text/80 pt-4 mt-2">
              <span className="font-semibold">{t("est_total")}</span>
              <span className="font-display text-3xl tabular-nums">{fmtUSD(est.total)}</span>
            </div>
            <div className="mt-4 rounded-xl bg-brand/15 border border-brand/40 p-4 flex justify-between gap-4 items-center">
              <div>
                <p className="font-semibold text-sm">{t("est_deposit")}</p>
                <p className="text-xs text-muted mt-1">{t("est_depositNote")}</p>
              </div>
              <p className="font-display text-2xl tabular-nums">{fmtUSD(est.deposit)}</p>
            </div>
            <p className="text-xs text-muted mt-4">{t("est_disclaimer")}</p>
            {f.destination === "mx" && <p className="text-xs text-muted mt-2">{t("est_mx")}</p>}
          </div>
          <Button className="w-full" onClick={() => setStep(3)}>{t("next")}</Button>
        </div>
      )}

      {step === 3 && (
        <form noValidate className="space-y-6" onSubmit={(e) => {
          e.preventDefault();
          form.submit((x) => ({
            lot: x.lot, auction: x.auction, title: x.title, destination: x.destination,
            maxOffer: String(form.money(x.maxOffer)), transport: x.transport ? String(form.money(x.transport)) : "",
            estimate: est, acknowledged: !!x.acknowledged,
          }));
        }}>
          <ContactFields form={form} />
          <div className={`rounded-xl border p-4 space-y-3 bg-surface ${errors.acknowledged ? "border-warn" : "border-line"}`}>
            <p className="text-sm font-semibold">{t("ackTitle")}</p>
            <ul className="text-sm text-muted space-y-2 list-disc pl-5">
              {["ack1", "ack2", "ack3", "ack4"].map((k) => <li key={k}>{t(k)}</li>)}
            </ul>
            <label className="flex items-center gap-3 text-sm cursor-pointer min-h-[44px]">
              <input type="checkbox" checked={!!f.acknowledged} onChange={(e) => set("acknowledged")(e.target.checked)}
                className="w-5 h-5 accent-[#1E6FFF]" aria-invalid={!!errors.acknowledged} />
              {t("ackAgree")}
            </label>
            {errors.acknowledged && <p className="text-xs text-warn" role="alert">{t("err_ack")}</p>}
          </div>
          <SubmitBar form={form} />
        </form>
      )}
    </Page>
  );
}
