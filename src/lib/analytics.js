// Small, privacy-conscious event abstraction. There is no external analytics provider
// connected: events go to window.dataLayer (if a tag manager is added later it can read
// them) and stay in memory for debugging. Only whitelisted, non-personal fields are kept.

export const EVENTS = ["landing_view", "intent_selected", "form_started", "form_submitted", "form_submission_failed"];
const ALLOWED = ["intent", "locale", "path", "reason"];

export const buffer = [];

export function track(name, props = {}) {
  if (!EVENTS.includes(name)) return null;
  const safe = {};
  for (const k of ALLOWED) if (props[k] != null) safe[k] = String(props[k]).slice(0, 40);
  const evt = { event: name, ...safe, ts: Date.now() };
  buffer.push(evt);
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(evt);
  }
  return evt;
}
