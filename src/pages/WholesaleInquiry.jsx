import React from "react";
import { useNavigate } from "react-router-dom";
import { Page, Field, TextInput, Money, Choice, useLocale } from "../components/ui.jsx";
import { useLeadForm, ContactFields, SubmitBar } from "../components/forms.jsx";

// Path C: dealer-only / wholesale auction inquiry. Qualification only:
// no payment, deposit, access approval or credential sharing.
export default function WholesaleInquiry() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const form = useLeadForm("wholesale_inquiry", { use: "", buyerType: "", license: "", budget: "", category: "", location: "", experience: "", disclosureAck: false });
  const { f, set, errors, msg } = form;

  return (
    <Page title={t("cTitle")} intro={t("cIntro")} onBack={() => navigate("/")}>
      <form noValidate className="space-y-6" onSubmit={(e) => {
        e.preventDefault();
        form.submit((x) => ({
          use: x.use, buyerType: x.buyerType, license: x.license, budget: String(form.money(x.budget)),
          category: x.category, location: x.location, experience: x.experience, disclosureAck: !!x.disclosureAck,
        }));
      }}>
        <Choice name="use" label={t("use")} value={f.use} onChange={set("use")} error={msg(errors.use)}
          options={[{ value: "personal", label: t("use_personal") }, { value: "resale", label: t("use_resale") }, { value: "business_inventory", label: t("use_business_inventory") }]} />
        <Choice name="buyerType" label={t("buyerType")} value={f.buyerType} onChange={set("buyerType")} error={msg(errors.buyerType)}
          options={[{ value: "individual", label: t("bt_individual") }, { value: "licensed_dealer", label: t("bt_licensed_dealer") }, { value: "other_business", label: t("bt_other_business") }]} />
        <Choice name="license" label={t("license")} value={f.license} onChange={set("license")} error={msg(errors.license)}
          options={[{ value: "yes", label: t("lic_yes") }, { value: "no", label: t("lic_no") }, { value: "not_applicable", label: t("lic_not_applicable") }]} />
        <Field id="budget" label={t("budget")} hint={t("budgetHint")} error={errors.budget && t("err_money")}>
          <Money id="budget" value={f.budget} onChange={set("budget")} error={errors.budget} hint />
        </Field>
        <Field id="category" label={t("category")} optional>
          <TextInput id="category" value={f.category} onChange={set("category")} maxLength={200} />
        </Field>
        <Field id="location" label={t("location")} hint={t("locationHint")} error={msg(errors.location)}>
          <TextInput id="location" value={f.location} onChange={set("location")} error={errors.location} hint maxLength={120} />
        </Field>
        <Choice name="experience" label={t("experience")} value={f.experience} onChange={set("experience")} error={msg(errors.experience)}
          options={[{ value: "first_time", label: t("exp_first_time") }, { value: "occasional", label: t("exp_occasional") }, { value: "frequent", label: t("exp_frequent") }]} />
        <div className="border-t border-line pt-6"><ContactFields form={form} /></div>

        <div className={`rounded-xl border p-4 space-y-3 ${errors.disclosureAck ? "border-warn" : "border-warn/50"} bg-warn/5`}>
          <p className="text-sm">{t("disclosure")}</p>
          <label className="flex items-center gap-3 text-sm cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={!!f.disclosureAck} onChange={(e) => set("disclosureAck")(e.target.checked)}
              className="w-5 h-5 accent-[#1E6FFF]" aria-invalid={!!errors.disclosureAck} />
            {t("disclosureAck")}
          </label>
          {errors.disclosureAck && <p className="text-xs text-warn" role="alert">{t("err_ack")}</p>}
        </div>
        <SubmitBar form={form} />
      </form>
    </Page>
  );
}
