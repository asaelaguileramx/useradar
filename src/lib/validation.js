// Client-side validation. The database function submit_lead repeats every rule,
// so these checks are for fast feedback only.

export const INTENTS = ["existing_lot", "vehicle_search", "wholesale_inquiry"];

export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits; // assume US
  return digits;
}

export function isValidPhone(raw) {
  const d = normalizePhone(raw);
  return d.length >= 11 && d.length <= 15;
}

export function isValidEmail(raw) {
  if (!raw) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw).trim());
}

export function parseMoney(raw) {
  const n = Number(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function parseLot(raw) {
  const s = String(raw || "").trim();
  if (!s) return { lot: null, auction: null };
  const auction = /iaai?\.com/i.test(s) ? "iaa" : /copart\.com/i.test(s) ? "copart" : null;
  const m = s.match(/(\d{6,10})/);
  return { lot: m ? m[1] : null, auction };
}

const req = (v) => String(v ?? "").trim().length > 0;

export function validate(intent, f) {
  const e = {};
  if (!req(f.name) || String(f.name).trim().length < 2) e.name = "name";
  if (!isValidPhone(f.phone)) e.phone = "phone";
  if (!isValidEmail(f.email)) e.email = "email";
  if (!["es", "en"].includes(f.language)) e.language = "language";

  if (intent === "existing_lot") {
    if (!parseLot(f.lot).lot) e.lot = "lot";
    if (!["copart", "iaa"].includes(f.auction)) e.auction = "auction";
    const o = parseMoney(f.maxOffer);
    if (!(o > 0) || o > 500000) e.maxOffer = "money";
    if (!["salvage", "clean"].includes(f.title)) e.title = "title";
    if (!["us", "mx"].includes(f.destination)) e.destination = "destination";
    if (!f.acknowledged) e.acknowledged = "ack";
  }
  if (intent === "vehicle_search") {
    if (!req(f.vehicle)) e.vehicle = "vehicle";
    const b = parseMoney(f.budget);
    if (!(b > 0) || b > 500000) e.budget = "money";
    if (!req(f.location)) e.location = "location";
    if (!["personal", "resale", "other"].includes(f.use)) e.use = "use";
  }
  if (intent === "wholesale_inquiry") {
    if (!["personal", "resale", "business_inventory"].includes(f.use)) e.use = "use";
    if (!["individual", "licensed_dealer", "other_business"].includes(f.buyerType)) e.buyerType = "buyerType";
    if (!["yes", "no", "not_applicable"].includes(f.license)) e.license = "license";
    const b = parseMoney(f.budget);
    if (!(b > 0) || b > 1000000) e.budget = "money";
    if (!req(f.location)) e.location = "location";
    if (!["first_time", "occasional", "frequent"].includes(f.experience)) e.experience = "experience";
    if (!f.disclosureAck) e.disclosureAck = "ack";
  }
  return e;
}
