import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, TextInput, TextArea, Choice, useLocale } from "./ui.jsx";
import { validate, normalizePhone, parseMoney } from "../lib/validation.js";
import { submitLead, errorCode } from "../lib/api.js";
import { track } from "../lib/analytics.js";

const DRAFT = (intent) => "radar_draft_" + intent;

export function useLeadForm(intent, initial) {
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const [f, setF] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT(intent)) || "null");
      if (saved) return { ...initial, ...saved };
    } catch (_) {}
    return { language: locale, ...initial };
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [submitError, setSubmitError] = useState("");
  const started = useRef(false);
  const inFlight = useRef(false);

  const set = (k) => (v) => {
    if (!started.current) { started.current = true; track("form_started", { intent, locale }); }
    setF((prev) => {
      const next = { ...prev, [k]: v };
      try { const { website, ...rest } = next; sessionStorage.setItem(DRAFT(intent), JSON.stringify(rest)); } catch (_) {}
      return next;
    });
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const msg = (code) => (code ? t("err_" + code) : null);

  async function submit(buildPayload) {
    if (inFlight.current) return;
    const e = validate(intent, f);
    setErrors(e);
    if (Object.keys(e).length) {
      setSubmitError(t("err_fix"));
      const first = document.querySelector("[aria-invalid=true]");
      if (first) first.focus();
      return;
    }
    inFlight.current = true;
    setStatus("sending");
    setSubmitError("");
    try {
      const payload = {
        intent,
        name: f.name,
        phone: normalizePhone(f.phone),
        email: f.email || "",
        language: f.language,
        notes: f.notes || "",
        website: f.website || "",
        source: "web",
        landingPath: window.location.pathname,
        ...buildPayload(f),
      };
      const res = await submitLead(payload);
      track("form_submitted", { intent, locale });
      try { sessionStorage.removeItem(DRAFT(intent)); } catch (_) {}
      navigate(`/listo/${res.token}`, { state: { intent: res.intent, reference: res.reference } });
    } catch (err) {
      const code = errorCode(err);
      track("form_submission_failed", { intent, locale, reason: code });
      setStatus("error");
      if (code.startsWith("field:")) {
        const fld = code.slice(6);
        setErrors((e) => ({ ...e, [fld]: fld === "maxOffer" || fld === "budget" ? "money" : fld === "disclosureAck" || fld === "acknowledged" ? "ack" : fld }));
        setSubmitError(t("err_fix"));
      } else setSubmitError(code === "rate" ? t("err_rate") : t("err_submit"));
      inFlight.current = false;
      return;
    }
  }

  return { f, set, errors, msg, status, submitError, submit, money: parseMoney };
}

export function ContactFields({ form }) {
  const { t } = useLocale();
  const { f, set, errors, msg } = form;
  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl tracking-wide">{t("contactTitle")}</h2>
      <Field id="name" label={t("name")} error={msg(errors.name)}>
        <TextInput id="name" value={f.name || ""} onChange={set("name")} error={errors.name} autoComplete="name" />
      </Field>
      <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={msg(errors.phone)}>
        <TextInput id="phone" type="tel" value={f.phone || ""} onChange={set("phone")} error={errors.phone} hint autoComplete="tel" inputMode="tel" />
      </Field>
      <Field id="email" label={t("email")} optional error={msg(errors.email)}>
        <TextInput id="email" type="email" value={f.email || ""} onChange={set("email")} error={errors.email} autoComplete="email" />
      </Field>
      <Choice name="language" label={t("language")} cols={2} value={f.language} onChange={set("language")} error={msg(errors.language)}
        options={[{ value: "es", label: t("lang_es") }, { value: "en", label: t("lang_en") }]} />
      <Field id="notes" label={t("notes")} hint={t("notesHint")} optional>
        <TextArea id="notes" value={f.notes || ""} onChange={set("notes")} />
      </Field>
      {/* Honeypot: hidden from people, filled by bots */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={f.website || ""} onChange={(e) => set("website")(e.target.value)} />
      </div>
    </div>
  );
}

export function SubmitBar({ form, label }) {
  const { t } = useLocale();
  return (
    <div className="space-y-3 pt-2">
      {form.submitError && <p className="text-sm text-warn" role="alert">{form.submitError}</p>}
      <button type="submit" disabled={form.status === "sending"} aria-busy={form.status === "sending"}
        className="w-full inline-flex items-center justify-center rounded-xl bg-brand text-white font-semibold min-h-[52px] hover:bg-[#3A82FF] disabled:opacity-60">
        {form.status === "sending" ? t("sending") : label || t("submit")}
      </button>
    </div>
  );
}
