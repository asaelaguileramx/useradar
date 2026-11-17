import React, { useEffect, useMemo, useState } from "react";
import { supabase, listInquiries, listHistory, setInquiryStatus, addInquiryNote, isRep } from "../lib/api.js";
import { statusesFor, filterLeads } from "../lib/status.js";
import { useLocale, fmtUSD } from "../components/ui.jsx";

const R = {
  es: {
    title: "Panel de representantes", signIn: "Entrar", email: "Correo", sendLink: "Enviar enlace de acceso",
    linkSent: "Te enviamos un enlace de acceso. Ábrelo en este dispositivo.", notRep: "Esta cuenta no tiene acceso de representante.",
    signOut: "Salir", all: "Todos", existing_lot: "Vehículo identificado", vehicle_search: "Búsqueda de vehículo", wholesale_inquiry: "Subasta de dealers",
    empty: "No hay solicitudes en esta vista.", loading: "Cargando…", contact: "Contacto", whatsapp: "Escribir por WhatsApp",
    details: "Respuestas", history: "Historial", status: "Cambiar estado", note: "Nota (opcional)", save: "Guardar", addNote: "Agregar nota",
    received: "Recibida", errorGeneric: "No se pudo guardar. Intenta de nuevo.", refresh: "Actualizar", back: "Volver a la lista",
    reviewNote: "Pendiente de revisión humana. No es aceptación ni elegibilidad.",
  },
  en: {
    title: "Rep dashboard", signIn: "Sign in", email: "Email", sendLink: "Send sign-in link",
    linkSent: "We sent you a sign-in link. Open it on this device.", notRep: "This account does not have rep access.",
    signOut: "Sign out", all: "All", existing_lot: "Existing vehicle", vehicle_search: "Vehicle search", wholesale_inquiry: "Wholesale auction",
    empty: "No requests in this view.", loading: "Loading…", contact: "Contact", whatsapp: "Message on WhatsApp",
    details: "Answers", history: "History", status: "Change status", note: "Note (optional)", save: "Save", addNote: "Add note",
    received: "Received", errorGeneric: "Couldn't save. Try again.", refresh: "Refresh", back: "Back to list",
    reviewNote: "Pending human review. Not an acceptance or eligibility decision.",
  },
};

const LABELS = {
  vehicle: ["Vehículo buscado", "Vehicle sought"], budget_usd: ["Presupuesto total", "All-in budget"], location: ["Ubicación", "Location"],
  use: ["Uso", "Use"], buyer_type: ["Tipo de comprador", "Buyer type"], dealer_license: ["Licencia de dealer", "Dealer license"],
  category: ["Categoría", "Category"], experience: ["Experiencia", "Experience"], title: ["Título", "Title"],
  destination: ["Destino", "Destination"], transport: ["Transporte estimado", "Estimated transport"],
};

const typeColor = { existing_lot: "bg-brand/20 text-[#8DB6FF]", vehicle_search: "bg-sonar/15 text-sonar", wholesale_inquiry: "bg-warn/15 text-warn" };

function Login({ r }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const send = async (e) => {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/rep", shouldCreateUser: true } });
    if (error) setErr(error.message); else setSent(true);
  };
  return (
    <form onSubmit={send} className="max-w-sm space-y-4" noValidate>
      <label htmlFor="rep-email" className="block text-sm font-semibold">{r.email}</label>
      <input id="rep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
        className="w-full rounded-xl bg-surface border border-line px-4 py-3 min-h-[48px] outline-none focus:border-brand" />
      <button className="rounded-xl bg-brand text-white font-semibold px-5 min-h-[48px]">{r.sendLink}</button>
      {sent && <p className="text-sm text-ok" role="status">{r.linkSent}</p>}
      {err && <p className="text-sm text-warn" role="alert">{err}</p>}
    </form>
  );
}

function Detail({ lead, r, t, locale, onChanged, onBack }) {
  const [hist, setHist] = useState([]);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const li = locale === "es" ? 0 : 1;

  const load = () => listHistory(lead.id).then(setHist).catch(() => {});
  useEffect(() => { load(); setStatus(""); setNote(""); }, [lead.id]); // eslint-disable-line

  const save = async () => {
    if (!status) return;
    setBusy(true); setErr("");
    try { await setInquiryStatus(lead.id, status, note); setNote(""); setStatus(""); await onChanged(); await load(); }
    catch (_) { setErr(r.errorGeneric); }
    setBusy(false);
  };
  const saveNote = async () => {
    if (!note.trim()) return;
    setBusy(true); setErr("");
    try { await addInquiryNote(lead.id, note); setNote(""); await load(); } catch (_) { setErr(r.errorGeneric); }
    setBusy(false);
  };

  const phone = lead.contact_phone && /^[0-9]{11,15}$/.test(lead.contact_phone) ? lead.contact_phone : null;
  const intake = lead.intake || {};
  const rows = Object.entries(intake).filter(([k, v]) => k !== "estimate" && v !== null && v !== "");

  return (
    <article className="space-y-6">
      <button type="button" onClick={onBack} className="lg:hidden text-sm text-muted min-h-[40px]">← {r.back}</button>
      <header className="space-y-2">
        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${typeColor[lead.intent]}`}>{r[lead.intent]}</span>
        <h2 className="font-display text-2xl tracking-wide">{lead.contact_name} <span className="text-muted text-base">· {lead.reference}</span></h2>
        <p className="text-sm text-muted">{new Date(lead.created_at).toLocaleString()} · {t("st_" + lead.status)}</p>
        {lead.intent === "wholesale_inquiry" && lead.status === "NEW" && <p className="text-xs text-warn">{r.reviewNote}</p>}
      </header>

      <section className="rounded-xl border border-line p-4 space-y-2 text-sm">
        <h3 className="font-semibold">{r.contact}</h3>
        <p>+{lead.contact_phone}{lead.contact_email ? ` · ${lead.contact_email}` : ""} · {lead.preferred_language.toUpperCase()}</p>
        {phone && (
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-line px-3 min-h-[40px] hover:border-ok">{r.whatsapp}</a>
        )}
      </section>

      <section className="rounded-xl border border-line p-4 text-sm">
        <h3 className="font-semibold mb-2">{r.details}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {lead.intent === "existing_lot" && (<>
            <dt className="text-muted">Lote</dt><dd>{lead.source} · {lead.lot_number}</dd>
            {lead.vehicle_url && /^https?:\/\//.test(lead.vehicle_url) && (<><dt className="text-muted">URL</dt><dd className="break-all"><a className="underline" href={lead.vehicle_url} target="_blank" rel="noopener noreferrer">{lead.vehicle_url}</a></dd></>)}
            <dt className="text-muted">{locale === "es" ? "Oferta máxima" : "Max bid"}</dt><dd>{fmtUSD((lead.max_bid_cents || 0) / 100)}</dd>
            {intake.estimate && (<><dt className="text-muted">{locale === "es" ? "Total estimado" : "Estimated total"}</dt><dd>{fmtUSD(intake.estimate.total)} · {locale === "es" ? "depósito" : "deposit"} {fmtUSD(intake.estimate.deposit)}</dd></>)}
          </>)}
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted">{LABELS[k]?.[li] || k}</dt>
              <dd>{k.includes("budget") || k === "transport" ? fmtUSD(v) : String(v)}</dd>
            </React.Fragment>
          ))}
          {lead.customer_notes && (<><dt className="text-muted">{t("notes")}</dt><dd className="whitespace-pre-wrap">{lead.customer_notes}</dd></>)}
        </dl>
      </section>

      <section className="rounded-xl border border-line p-4 space-y-3">
        <label htmlFor="st" className="block text-sm font-semibold">{r.status}</label>
        <select id="st" value={status} onChange={(e) => setStatus(e.target.value)} disabled={lead.status === "CLOSED"}
          className="w-full rounded-lg bg-surface border border-line px-3 min-h-[44px]">
          <option value="">—</option>
          {statusesFor(lead.intent).filter((s) => s !== lead.status).map((s) => <option key={s} value={s}>{t("st_" + s)}</option>)}
        </select>
        <label htmlFor="nt" className="block text-sm font-semibold">{r.note}</label>
        <textarea id="nt" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000}
          className="w-full rounded-lg bg-surface border border-line px-3 py-2" />
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={save} disabled={busy || !status} className="rounded-lg bg-brand text-white px-4 min-h-[44px] disabled:opacity-50">{r.save}</button>
          <button type="button" onClick={saveNote} disabled={busy || !note.trim()} className="rounded-lg border border-line px-4 min-h-[44px] disabled:opacity-50">{r.addNote}</button>
        </div>
        {err && <p className="text-sm text-warn" role="alert">{err}</p>}
      </section>

      <section>
        <h3 className="font-semibold text-sm mb-2">{r.history}</h3>
        <ol className="text-sm space-y-2">
          {hist.map((h, i) => (
            <li key={i} className="border-l border-line pl-3">
              <span className="text-muted text-xs">{new Date(h.at).toLocaleString()}</span><br />
              {h.kind === "status" ? (h.from ? `${t("st_" + h.from)} → ${t("st_" + h.to)}` : r.received) : (locale === "es" ? "Nota" : "Note")}
              {h.note && h.note !== "submitted" && <span className="text-muted"> · {h.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

export default function Rep() {
  const { t, locale } = useLocale();
  const r = R[locale];
  const [session, setSession] = useState(undefined);
  const [rep, setRep] = useState(null);
  const [leads, setLeads] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => { try { setLeads(await listInquiries()); } catch (_) { setLeads([]); } };
  useEffect(() => {
    if (!session) { setRep(null); return; }
    isRep().then((ok) => { setRep(ok); if (ok) load(); }).catch(() => setRep(false));
  }, [session]);

  const shown = useMemo(() => filterLeads(leads || [], filter), [leads, filter]);
  const counts = useMemo(() => {
    const c = { all: (leads || []).length };
    for (const l of leads || []) c[l.intent] = (c[l.intent] || 0) + 1;
    return c;
  }, [leads]);
  const current = shown.find((l) => l.id === selected) || null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl tracking-wide">{r.title}</h1>
        {session && <button type="button" onClick={() => supabase.auth.signOut()} className="text-sm text-muted min-h-[40px]">{r.signOut}</button>}
      </div>

      {!supabase && <p className="text-warn">Supabase is not configured.</p>}
      {supabase && session === null && <Login r={r} />}
      {session && rep === false && <p className="text-warn" role="alert">{r.notRep}</p>}

      {rep && (
        <>
          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filtros">
            {["all", "existing_lot", "vehicle_search", "wholesale_inquiry"].map((k) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => { setFilter(k); setSelected(null); }}
                className={`rounded-full px-4 min-h-[40px] text-sm border ${filter === k ? "border-brand bg-brand/15" : "border-line"}`}>
                {r[k]} <span className="text-muted">({counts[k] || 0})</span>
              </button>
            ))}
            <button type="button" onClick={load} className="rounded-full px-4 min-h-[40px] text-sm border border-line ml-auto">{r.refresh}</button>
          </div>

          {leads === null && <p className="text-muted">{r.loading}</p>}
          {leads && shown.length === 0 && <p className="text-muted">{r.empty}</p>}

          <div className="grid lg:grid-cols-[380px_1fr] gap-6">
            <ul className={`space-y-2 ${current ? "hidden lg:block" : ""}`}>
              {shown.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setSelected(l.id)}
                    className={`w-full text-left rounded-xl border p-4 ${selected === l.id ? "border-brand bg-brand/10" : "border-line bg-surface hover:border-muted"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${typeColor[l.intent]}`}>{r[l.intent]}</span>
                      <span className="text-xs text-muted">{new Date(l.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="font-semibold mt-2">{l.contact_name}</p>
                    <p className="text-sm text-muted truncate">
                      {l.intent === "existing_lot" ? `${l.source} ${l.lot_number} · ${fmtUSD((l.max_bid_cents || 0) / 100)}`
                        : `${l.intake?.vehicle || l.intake?.category || "—"} · ${fmtUSD(l.intake?.budget_usd)}`}
                    </p>
                    <p className="text-xs mt-1">{t("st_" + l.status)}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div>{current && <Detail lead={current} r={r} t={t} locale={locale} onChanged={load} onBack={() => setSelected(null)} />}</div>
          </div>
        </>
      )}
    </div>
  );
}
