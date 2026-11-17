import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

function need() {
  if (!supabase) throw new Error("not_configured");
  return supabase;
}

// Maps a database error message ("invalid:phone", "rate_limited") to a stable code.
export function errorCode(err) {
  const msg = String(err?.message || err || "");
  if (msg.includes("rate_limited")) return "rate";
  const m = msg.match(/invalid:([a-zA-Z]+)/);
  if (m) return "field:" + m[1];
  return "submit";
}

export async function submitLead(payload) {
  const { data, error } = await need().rpc("submit_inquiry", { p: payload });
  if (error) throw error;
  return data;
}

export async function getInquiryStatus(token) {
  const { data, error } = await need().rpc("track_inquiry", { p_token: token });
  if (error) throw error;
  return data;
}

const COLS = "id, reference, intent, status, contact_name, contact_phone, contact_email, preferred_language, customer_notes, lead_source, landing_path, intake, source, lot_number, vehicle_url, max_bid_cents, final_destination, contacted_at, qualified_at, created_at";

export async function listInquiries() {
  const { data, error } = await need().from("inquiry").select(COLS).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data;
}

export async function listHistory(inquiryId) {
  const db = need();
  const [h, n] = await Promise.all([
    db.from("inquiry_status_history").select("id, from_status, to_status, note, changed_at").eq("inquiry_id", inquiryId).order("changed_at"),
    db.from("inquiry_note").select("id, body, created_at").eq("inquiry_id", inquiryId).order("created_at"),
  ]);
  if (h.error) throw h.error;
  if (n.error) throw n.error;
  return [
    ...h.data.map((e) => ({ kind: "status", at: e.changed_at, from: e.from_status, to: e.to_status, note: e.note })),
    ...n.data.map((e) => ({ kind: "note", at: e.created_at, note: e.body })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
}

export async function setInquiryStatus(id, status, note) {
  const { data, error } = await need().rpc("rep_set_inquiry_status", { p_inquiry: id, p_status: status, p_note: note || null });
  if (error) throw error;
  return data;
}

export async function addInquiryNote(id, body) {
  const { error } = await need().rpc("rep_add_inquiry_note", { p_inquiry: id, p_body: body });
  if (error) throw error;
}

export async function isRep() {
  const { data, error } = await need().rpc("is_rep");
  if (error) throw error;
  return !!data;
}
