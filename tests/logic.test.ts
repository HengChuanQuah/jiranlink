import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../src/data/seed";
import type { AppState } from "../src/data/types";
import { searchProviders } from "../src/lib/search";
import { ratingStats } from "../src/lib/rating";
import { generateSlots } from "../src/lib/slots";
import * as d from "../src/lib/domain";
import { setClockOffset } from "../src/lib/time";
import { decide, understandFast } from "../src/ai/agent";
import { extractHints } from "../src/ai/hints";
import { _parseJsonForTests } from "../src/ai/adapter";

let s: AppState;
const user = (id: string) => s.users.find((u) => u.id === id)!;
const th = { confident: 0.7, lead: 0.2, lost: 0.4 };

beforeEach(() => {
  setClockOffset(0);
  s = buildSeed();
});

describe("search ranking", () => {
  it("puts providers in the resident's own precinct first and widens when needed", () => {
    const out = searchProviders(s, { resident: user("u-aisyah"), categoryIds: ["cakes"] });
    const ids = out.results.map((r) => r.provider.id);
    expect(ids[0]).toBe("p-ani");
    expect(out.results[0].ringLabel).toBe("Your area");
    expect(ids).toContain("p-meiling");
    expect(ids).toContain("p-rosnah");
    // Melawati is ~28 km away and must never appear for an Elmina resident.
    expect(ids).not.toContain("p-auntie-wong");
  });

  it("shows same-building providers first for condo residents", () => {
    const out = searchProviders(s, { resident: user("u-priya"), categoryIds: ["cakes"] });
    expect(out.results[0].provider.id).toBe("p-priya-bake");
    expect(out.results[0].ringLabel).toBe("Your building");
  });

  it("hides providers below the quality floor and counts them", () => {
    const out = searchProviders(s, { resident: user("u-aisyah"), categoryIds: ["cleaning"] });
    expect(out.results.map((r) => r.provider.id)).not.toContain("p-sparkle");
    expect(out.hiddenBelowFloor).toBe(1);
  });

  it("offers a highly rated provider just outside the reached ring", () => {
    const out = searchProviders(s, { resident: user("u-tan"), categoryIds: ["cleaning"] });
    expect(out.results.length).toBeGreaterThanOrEqual(5);
    expect(out.reachedRing).toBe(2); // stopped at the township
    expect(out.exception?.provider.id).toBe("p-sparkle-kle");
  });

  it("lists online services for everyone, without proximity", () => {
    const tan = searchProviders(s, { resident: user("u-tan"), categoryIds: ["quran"] });
    const priya = searchProviders(s, { resident: user("u-priya"), categoryIds: ["quran"] });
    expect(tan.online.map((r) => r.provider.id)).toContain("p-online-quran");
    expect(priya.online.map((r) => r.provider.id)).toContain("p-online-quran");
  });

  it("does not list a provider twice when they are nearby and online", () => {
    const out = searchProviders(s, { resident: user("u-priya"), categoryIds: ["tuition"] });
    const local = out.results.map((r) => r.provider.id);
    const online = out.online.map((r) => r.provider.id);
    expect(local).toContain("p-wei-tutor");
    expect(online).not.toContain("p-wei-tutor");
  });

  it("top-rated sort orders by Bayesian rating", () => {
    const out = searchProviders(s, { resident: user("u-tan"), categoryIds: ["cleaning"], sort: "top" });
    const plain = out.results.filter((r) => !r.newcomerSlot).map((r) => r.stats.bayes);
    expect([...plain].sort((a, b) => b - a)).toEqual(plain);
  });

  it("respects a resident's blocked list", () => {
    user("u-aisyah").blocked = ["p-ani"];
    const out = searchProviders(s, { resident: user("u-aisyah"), categoryIds: ["cakes"] });
    expect(out.results.map((r) => r.provider.id)).not.toContain("p-ani");
  });
});

describe("ratings", () => {
  it("counts past-customer reviews at half weight and caps them", () => {
    const p = s.providers.find((x) => x.id === "p-meiling")!;
    for (let i = 0; i < 8; i++) s.reviews.push({ id: `x${i}`, providerId: p.id, authorId: "u-tan", type: "past", stars: 5, text: "great", at: new Date(Date.now() - i * 1000).toISOString() });
    const st = ratingStats(p, s.reviews, s.config);
    expect(st.pastCount).toBe(5);
    expect(st.pastTotal).toBe(10);
  });

  it("marks a new provider as new and floor-exempt", () => {
    const amir = s.providers.find((x) => x.id === "p-amir-pet")!;
    const st = ratingStats(amir, s.reviews, s.config);
    expect(st.totalCount).toBe(0);
    expect(st.isNew).toBe(true);
    expect(st.acceptable).toBe(true);
    expect(st.bayes).toBeCloseTo(4.0);
  });

  it("drops the New badge when early reviews are poor", () => {
    const amir = s.providers.find((x) => x.id === "p-amir-pet")!;
    for (let i = 0; i < 4; i++) s.reviews.push({ id: `y${i}`, providerId: amir.id, authorId: "u-tan", bookingId: `fake${i}`, type: "booked", stars: 1, text: "", at: new Date().toISOString() });
    const st = ratingStats(amir, s.reviews, s.config);
    expect(st.isNew).toBe(false);
    expect(st.acceptable).toBe(false);
  });
});

describe("slots", () => {
  it("generates slots from the template and respects capacity", () => {
    const p = s.providers.find((x) => x.id === "p-faizal")!;
    const days = generateSlots(p.availability, s.bookings.filter((b) => b.providerId === p.id));
    expect(days.length).toBeGreaterThan(0);
    for (const day of days) for (const slot of day.slots) expect(new Date(slot.start).getTime()).toBeGreaterThan(Date.now());
    // the seeded confirmed job tomorrow 9am takes that slot
    const booked = days.flatMap((x) => x.slots).find((x) => new Date(x.start).getTime() === new Date(s.bookings.find((b) => b.id === "b-demo-faizal")!.start).getTime());
    if (booked) expect(booked.remaining).toBe(0);
  });

  it("skips days off", () => {
    const p = s.providers.find((x) => x.id === "p-amir-pet")!;
    const first = generateSlots(p.availability, [])[0].date;
    p.availability.daysOff = [first];
    expect(generateSlots(p.availability, []).some((x) => x.date === first)).toBe(false);
  });
});

function firstFreeSlot(providerId: string) {
  const p = s.providers.find((x) => x.id === providerId)!;
  return generateSlots(p.availability, s.bookings.filter((b) => b.providerId === providerId)).flatMap((x) => x.slots).find((x) => x.remaining > 0)!;
}

describe("booking flow", () => {
  it("runs request, accept, confirm with pay-before, done by both, release, review", () => {
    const slot = firstFreeSlot("p-faizal");
    const b = d.requestBooking(s, "u-tan", "p-faizal-s1", slot.start, "Aircond dripping, 2 units");
    expect(b.status).toBe("requested");
    d.acceptBooking(s, b.id, "p-faizal", "Chemical wash 2 units", 300);
    expect(b.status).toBe("accepted");
    d.confirmBooking(s, b.id, "u-tan", "after", "");
    expect(b.status).toBe("confirmed");
    expect(() => d.addReview(s, b.id, "u-tan", 5, "")).toThrow(/both of you/);
    d.markDone(s, b.id, "p-faizal");
    expect(b.status).toBe("confirmed");
    d.markDone(s, b.id, "u-tan");
    expect(b.status).toBe("completed");
    expect(b.payment).toBe("due");
    // owing money blocks new bookings
    expect(() => d.requestBooking(s, "u-tan", "p-ravi-plumb-s1", firstFreeSlot("p-ravi-plumb").start, "leak")).toThrow(/settle/);
    d.payBalance(s, b.id, "u-tan", "FPX");
    expect(b.payment).toBe("paid");
    d.addReview(s, b.id, "u-tan", 5, "Great");
    expect(b.status).toBe("reviewed");
    expect(() => d.addReview(s, b.id, "u-tan", 5, "again")).toThrow(/already/);
  });

  it("holds payment when paying before, and releases it on completion", () => {
    const slot = firstFreeSlot("p-ani");
    const b = d.requestBooking(s, "u-aisyah", "p-ani-s1", slot.start, "1 kg cake");
    d.acceptBooking(s, b.id, "p-ani", "1 kg chocolate", 95);
    d.confirmBooking(s, b.id, "u-aisyah", "before", "FPX");
    expect(b.payment).toBe("held");
    d.markDone(s, b.id, "p-ani");
    d.markDone(s, b.id, "u-aisyah");
    expect(b.payment).toBe("released");
  });

  it("supports a deposit, then the balance after", () => {
    const slot = firstFreeSlot("p-ani");
    const b = d.requestBooking(s, "u-aisyah", "p-ani-s1", slot.start, "cake");
    d.acceptBooking(s, b.id, "p-ani", "2 kg cake", 200);
    d.confirmBooking(s, b.id, "u-aisyah", "deposit", "Card");
    expect(b.amountPaid).toBe(100);
    d.markDone(s, b.id, "p-ani");
    d.markDone(s, b.id, "u-aisyah");
    expect(b.payment).toBe("due");
    d.payBalance(s, b.id, "u-aisyah", "FPX");
    expect(b.amountPaid).toBe(200);
  });

  it("refuses a payment option the provider does not accept", () => {
    const slot = firstFreeSlot("p-faizal"); // Faizal accepts pay after only
    const b = d.requestBooking(s, "u-tan", "p-faizal-s1", slot.start, "service");
    d.acceptBooking(s, b.id, "p-faizal", "service", 80);
    expect(() => d.confirmBooking(s, b.id, "u-tan", "before", "FPX")).toThrow(/doesn't accept/);
  });

  it("prevents double booking a full slot", () => {
    const slot = firstFreeSlot("p-faizal");
    d.requestBooking(s, "u-tan", "p-faizal-s1", slot.start, "first");
    expect(() => d.requestBooking(s, "u-aisyah", "p-faizal-s1", slot.start, "second")).toThrow(/took that slot/);
  });

  it("releases the slot when the 24-hour hold expires", () => {
    const slot = firstFreeSlot("p-faizal");
    const b = d.requestBooking(s, "u-tan", "p-faizal-s1", slot.start, "first");
    setClockOffset(25 * 3600_000);
    expect(d.expireHolds(s)).toBeGreaterThan(0);
    expect(b.status).toBe("expired");
  });

  it("issues a gate pass when the provider lives outside the resident's gated precinct", () => {
    const slot = firstFreeSlot("p-hafiz"); // Elmina Valley -> Elmina Green (gated)
    const b = d.requestBooking(s, "u-aisyah", "p-hafiz-s1", slot.start, "aircond");
    d.acceptBooking(s, b.id, "p-hafiz", "service", 80);
    d.confirmBooking(s, b.id, "u-aisyah", "after", "");
    expect(b.gatePassId).toBeTruthy();
    expect(s.gatePasses.find((g) => g.id === b.gatePassId)?.zoneName).toBe("Elmina Green");
  });

  it("does not issue a gate pass for a provider inside the same gated precinct", () => {
    const slot = firstFreeSlot("p-ani");
    const b = d.requestBooking(s, "u-aisyah", "p-ani-s1", slot.start, "cake");
    d.acceptBooking(s, b.id, "p-ani", "cake", 90);
    d.confirmBooking(s, b.id, "u-aisyah", "before", "FPX");
    expect(b.gatePassId).toBeUndefined();
  });

  it("lets the provider propose another time and the customer accept it", () => {
    const p = s.providers.find((x) => x.id === "p-ravi-plumb")!;
    const all = generateSlots(p.availability, []).flatMap((x) => x.slots);
    const b = d.requestBooking(s, "u-tan", "p-ravi-plumb-s1", all[0].start, "leak");
    d.proposeTime(s, b.id, "p-ravi-plumb", all[2].start);
    expect(() => d.acceptBooking(s, b.id, "p-ravi-plumb", "x", 50)).toThrow(/proposed time/);
    d.acceptProposal(s, b.id, "u-tan");
    expect(b.start).toBe(all[2].start);
  });
});

describe("trust rules", () => {
  it("accepts a valid past-customer review once per home and only from the same township", () => {
    const code = d.createPastInvite(s, "p-ani");
    expect(() => d.addPastReview(s, code, "u-tan", 5, "Bought from her for years")).toThrow(/township/);
    d.addPastReview(s, code, "u-aisyah", 5, "Bought from her for years");
    expect(() => d.addPastReview(s, code, "u-aisyah", 5, "Again and again")).toThrow(/already/);
  });

  it("verifies sign-up with a matching invite code and rejects reused phones", () => {
    const u = d.signUp(s, { name: "Test User", phone: "0123334444", placeIndex: 0, unit: "No. 22", inviteCode: "ELM-GRN-1024" });
    expect(u.verify).toBe("verified");
    expect(() => d.signUp(s, { name: "Other", phone: "0123334444", placeIndex: 0, unit: "No. 23", inviteCode: "" })).toThrow(/already linked/);
    const p = d.signUp(s, { name: "No Code", phone: "0125556666", placeIndex: 1, unit: "No. 5", inviteCode: "" });
    expect(p.verify).toBe("pending");
    expect(() => d.signUp(s, { name: "Wrong", phone: "0127778888", placeIndex: 1, unit: "No. 6", inviteCode: "QRZ-12A-0705" })).toThrow(/belongs to/);
  });

  it("blocks unverified residents from booking", () => {
    const slot = firstFreeSlot("p-hafiz");
    expect(() => d.requestBooking(s, "u-pending1", "p-hafiz-s1", slot.start, "hi")).toThrow(/verified/);
  });
});

describe("agent", () => {
  it("is confident on a clear Manglish request", () => {
    const r = understandFast("my aircond dripping water leh", th);
    expect(r.decision).toEqual({ kind: "confident", categoryId: "aircond" });
  });
  it("asks one question when nothing matches", () => {
    expect(understandFast("hmm not sure what I need", th).decision.kind).toBe("lost");
  });
  it("shows options instead of asking when two categories are close", () => {
    const dd = decide([{ id: "aircond", score: 0.6, matched: [] }, { id: "plumbing", score: 0.55, matched: [] }], th);
    expect(dd.kind).toBe("ambiguous");
  });
  it("extracts time hints in three languages", () => {
    expect(extractHints("esok pagi boleh?").timeText).toBe("Tomorrow morning");
    expect(extractHints("this saturday afternoon").day).toBe(6);
    expect(extractHints("星期六晚上").partOfDay).toBe("evening");
    expect(extractHints("tuisyen online").online).toBe(true);
  });
  it("parses and sanitises LLM JSON", () => {
    const out = _parseJsonForTests('Sure! {"categories":[{"id":"plumbing","score":1.4},{"id":"made_up","score":0.9}],"timeHint":"Sat","online":false}');
    expect(out.categories).toEqual([{ id: "plumbing", score: 1 }]);
  });
});

describe("payment method required", () => {
  it("needs a method when paying before", () => {
    const p = s.providers.find((x) => x.id === "p-ani")!;
    const slot = generateSlots(p.availability, s.bookings.filter((b) => b.providerId === p.id)).flatMap((x) => x.slots).find((x) => x.remaining > 0)!;
    const b = d.requestBooking(s, "u-aisyah", "p-ani-s1", slot.start, "cake");
    d.acceptBooking(s, b.id, "p-ani", "cake", 90);
    expect(() => d.confirmBooking(s, b.id, "u-aisyah", "before", "")).toThrow(/payment method/);
  });
});
