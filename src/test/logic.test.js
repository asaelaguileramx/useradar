import { describe, it, expect, beforeEach } from "vitest";
import { estimate, buyerFee, virtualFee, gateFee, BROKER_FEE } from "../lib/fees.js";
import { validate, normalizePhone, parseLot, parseMoney } from "../lib/validation.js";
import { STRINGS, t } from "../lib/i18n.js";
import { track, buffer } from "../lib/analytics.js";
import { statusesFor, canTransition, filterLeads, QUAL_STATUSES } from "../lib/status.js";
import { errorCode } from "../lib/api.js";

describe("fees (preserved Copart/IAA tables)", () => {
  it("uses bracket edges correctly", () => {
    expect(buyerFee(999.99)).toBe(320);
    expect(buyerFee(1000)).toBe(375);
    expect(buyerFee(5000)).toBe(775);
    expect(buyerFee(15000)).toBe(1125);
    expect(buyerFee(5000, "copart", "clean")).toBe(750);
    expect(buyerFee(20000, "copart", "clean")).toBe(1450);
    expect(buyerFee(5000, "iaa")).toBe(775);
  });
  it("virtual and gate fees", () => {
    expect(virtualFee(5000)).toBe(125);
    expect(virtualFee(5000, "copart", "clean")).toBe(109);
    expect(virtualFee(50)).toBe(0);
    expect(gateFee("copart", "clean")).toBe(79);
    expect(gateFee("copart", "salvage")).toBe(95);
    expect(gateFee("iaa", "clean")).toBe(95);
  });
  it("estimate adds $350 service and a 50% deposit", () => {
    const e = estimate({ offer: 5000, transport: 300 });
    expect(e.service).toBe(BROKER_FEE);
    expect(e.deposit).toBe(2500);
    expect(e.total).toBe(5000 + 775 + 125 + 95 + 15 + 15 + 350 + 300);
  });
  it("zero offer yields zero costs", () => {
    expect(estimate({ offer: 0 }).total).toBe(0);
  });
});

describe("validation", () => {
  const base = { name: "Ana Pérez", phone: "650 555 0101", language: "es" };
  it("normalizes phones", () => {
    expect(normalizePhone("(650) 555-0101")).toBe("16505550101");
    expect(normalizePhone("+52 55 1234 5678")).toBe("525512345678");
  });
  it("parses lots from Copart and IAA links", () => {
    expect(parseLot("https://www.copart.com/lot/45612378/clean-2019")).toEqual({ lot: "45612378", auction: "copart" });
    expect(parseLot("https://www.iaai.com/VehicleDetail/39876543~US")).toEqual({ lot: "39876543", auction: "iaa" });
    expect(parseLot("abc").lot).toBeNull();
  });
  it("parses money", () => {
    expect(parseMoney("$5,000")).toBe(5000);
    expect(Number.isNaN(parseMoney("abc"))).toBe(false);
  });
  it("existing lot requires lot, offer and acknowledgement", () => {
    const e = validate("existing_lot", { ...base, lot: "", auction: "copart", maxOffer: "", title: "salvage", destination: "us" });
    expect(Object.keys(e).sort()).toEqual(["acknowledged", "lot", "maxOffer"]);
    expect(validate("existing_lot", { ...base, lot: "45612378", auction: "copart", maxOffer: "4000", title: "salvage", destination: "mx", acknowledged: true })).toEqual({});
  });
  it("vehicle search needs no lot and requires a positive budget", () => {
    expect(validate("vehicle_search", { ...base, vehicle: "no estoy seguro", budget: "9000", location: "Fresno, CA", use: "personal" })).toEqual({});
    const e = validate("vehicle_search", { ...base, vehicle: "", budget: "0", location: "", use: "" });
    expect(Object.keys(e).sort()).toEqual(["budget", "location", "use", "vehicle"]);
  });
  it("wholesale requires the disclosure acknowledgement but no license number", () => {
    const ok = { ...base, use: "resale", buyerType: "individual", license: "no", budget: "12000", location: "94070", experience: "first_time", disclosureAck: true };
    expect(validate("wholesale_inquiry", ok)).toEqual({});
    expect(validate("wholesale_inquiry", { ...ok, disclosureAck: false })).toHaveProperty("disclosureAck");
  });
  it("rejects bad contact data", () => {
    const e = validate("vehicle_search", { name: "A", phone: "123", email: "x@", language: "fr", vehicle: "a", budget: "1", location: "SF", use: "other" });
    expect(Object.keys(e).sort()).toEqual(["email", "language", "name", "phone"]);
  });
});

describe("i18n", () => {
  it("Spanish and English have the same keys", () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.es).sort());
  });
  it("Spanish never uses the word puja", () => {
    for (const v of Object.values(STRINGS.es)) expect(v.toLowerCase()).not.toMatch(/puj/);
  });
  it("every status has a label in both languages", () => {
    for (const s of [...statusesFor("existing_lot"), ...QUAL_STATUSES]) {
      expect(STRINGS.es["st_" + s]).toBeTruthy();
      expect(STRINGS.en["st_" + s]).toBeTruthy();
    }
  });
  it("has the required wholesale disclosure text", () => {
    expect(t("es", "disclosure")).toContain("no garantiza acceso ni representación");
    expect(t("en", "disclosure")).toContain("does not guarantee access or representation");
  });
  it("falls back to Spanish", () => {
    expect(t("fr", "submit")).toBe(STRINGS.es.submit);
  });
});

describe("analytics", () => {
  beforeEach(() => { buffer.length = 0; });
  it("keeps only whitelisted, non-personal fields", () => {
    const e = track("form_submitted", { intent: "vehicle_search", name: "Ana", phone: "6505550101", email: "a@b.co", notes: "x" });
    expect(e).toMatchObject({ event: "form_submitted", intent: "vehicle_search" });
    expect(e).not.toHaveProperty("name");
    expect(e).not.toHaveProperty("phone");
    expect(e).not.toHaveProperty("email");
    expect(e).not.toHaveProperty("notes");
  });
  it("ignores unknown events", () => {
    expect(track("purchase_completed", {})).toBeNull();
    expect(buffer).toHaveLength(0);
  });
});

describe("rep lifecycle and filters", () => {
  it("new lead types use the qualification lifecycle", () => {
    expect(statusesFor("vehicle_search")).toEqual(["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CLOSED"]);
    expect(statusesFor("wholesale_inquiry")).not.toContain("UNDER_REVIEW");
    expect(statusesFor("existing_lot")).toContain("UNDER_REVIEW");
  });
  it("transitions", () => {
    expect(canTransition("wholesale_inquiry", "NEW", "CONTACTED")).toBe(true);
    expect(canTransition("wholesale_inquiry", "NEW", "UNDER_REVIEW")).toBe(false);
    expect(canTransition("vehicle_search", "CLOSED", "NEW")).toBe(false);
    expect(canTransition("vehicle_search", "NEW", "NEW")).toBe(false);
  });
  it("filters by intent", () => {
    const leads = [{ intent: "existing_lot" }, { intent: "vehicle_search" }, { intent: "wholesale_inquiry" }, { intent: "vehicle_search" }];
    expect(filterLeads(leads, "all")).toHaveLength(4);
    expect(filterLeads(leads, "vehicle_search")).toHaveLength(2);
    expect(filterLeads(leads, "wholesale_inquiry")).toHaveLength(1);
  });
  it("maps server errors to codes", () => {
    expect(errorCode({ message: "rate_limited" })).toBe("rate");
    expect(errorCode({ message: "invalid:budget" })).toBe("field:budget");
    expect(errorCode(new Error("network"))).toBe("submit");
  });
});
