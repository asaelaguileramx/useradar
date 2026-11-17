import React from "react";
import { useNavigate } from "react-router-dom";
import { Page, Field, TextInput, Money, Choice, useLocale } from "../components/ui.jsx";
import { useLeadForm, ContactFields, SubmitBar } from "../components/forms.jsx";

// Path B: help me find a vehicle. No lot or VIN.
export default function SearchRequest() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const form = useLeadForm("vehicle_search", { vehicle: "", budget: "", location: "", use: "" });
  const { f, set, errors, msg } = form;

  return (
    <Page title={t("bTitle")} intro={t("bIntro")} onBack={() => navigate("/")}>
      <form noValidate className="space-y-6" onSubmit={(e) => {
        e.preventDefault();
        form.submit((x) => ({ vehicle: x.vehicle, budget: String(form.money(x.budget)), location: x.location, use: x.use }));
      }}>
        <Field id="vehicle" label={t("vehicle")} hint={t("vehicleHint")} error={msg(errors.vehicle)}>
          <TextInput id="vehicle" value={f.vehicle} onChange={set("vehicle")} error={errors.vehicle} hint maxLength={200} />
        </Field>
        <Field id="budget" label={t("budget")} hint={t("budgetHint")} error={errors.budget && t("err_money")}>
          <Money id="budget" value={f.budget} onChange={set("budget")} error={errors.budget} hint />
        </Field>
        <Field id="location" label={t("location")} hint={t("locationHint")} error={msg(errors.location)}>
          <TextInput id="location" value={f.location} onChange={set("location")} error={errors.location} hint autoComplete="address-level2" maxLength={120} />
        </Field>
        <Choice name="use" label={t("use")} value={f.use} onChange={set("use")} error={msg(errors.use)}
          options={[{ value: "personal", label: t("use_personal") }, { value: "resale", label: t("use_resale") }, { value: "other", label: t("use_other") }]} />
        <div className="border-t border-line pt-6"><ContactFields form={form} /></div>
        <SubmitBar form={form} />
      </form>
    </Page>
  );
}
