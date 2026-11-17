// Lead lifecycles. Existing-lot inquiries keep the original inquiry statuses;
// the two new types use a limited qualification lifecycle (mirrors the database).

export const LOT_STATUSES = ["NEW", "CONTACTED", "UNDER_REVIEW", "QUALIFIED", "DISQUALIFIED", "DUPLICATE", "ABANDONED", "SPAM", "CLOSED"];
export const QUAL_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CLOSED"];

export function statusesFor(intent) {
  return intent === "existing_lot" ? LOT_STATUSES : QUAL_STATUSES;
}

export function canTransition(intent, from, to) {
  if (from === to || from === "CLOSED") return false;
  return statusesFor(intent).includes(to);
}

export function filterLeads(leads, filter) {
  if (!filter || filter === "all") return leads;
  return leads.filter((l) => l.intent === filter);
}
