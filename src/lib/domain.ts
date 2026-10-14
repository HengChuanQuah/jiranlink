// Business rules. Every function mutates the given state in place and throws an Error with a
// user-readable message when an action is not allowed. The UI store wraps these in one place.

import type { AppState, AvailabilityTemplate, Config, Booking, LatLng, PaymentMode, Provider, RequestPost, Review, Service, User } from "../data/types";
import { KNOWN_PLACES, zoneById } from "../data/geo";
import { categoryById } from "../data/categories";
import { zonesFor } from "./geo";
import { slotRemaining, templateProblems } from "./slots";
import { addMinutes, now, nowIso } from "./time";

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

const fail = (msg: string): never => {
  throw new Error(msg);
};

export const userById = (s: AppState, id: string) => s.users.find((u) => u.id === id);
export const providerById = (s: AppState, id: string) => s.providers.find((p) => p.id === id);
export const bookingById = (s: AppState, id: string) => s.bookings.find((b) => b.id === id) ?? fail("Booking not found.");
const serviceById = (s: AppState, id: string) => s.services.find((x) => x.id === id) ?? fail("Service not found.");

function log(b: Booking, by: string, text: string) {
  b.events.push({ at: nowIso(), by, text });
}

function postSystemMessage(s: AppState, bookingId: string, text: string) {
  s.messages.push({ id: newId("m"), threadId: `b:${bookingId}`, fromId: "system", text, at: nowIso() });
}

/** Releases slots whose 24-hour hold ran out without a reply. */
export function expireHolds(s: AppState): number {
  let n = 0;
  const t = now();
  for (const b of s.bookings) {
    if (b.status === "requested" && new Date(b.holdExpiresAt) <= t) {
      b.status = "expired";
      log(b, "system", "Request expired, slot released");
      n++;
    }
  }
  return n;
}

/** Payments still owed by a resident (pay-after jobs that are done but unpaid). */
export function outstanding(s: AppState, residentId: string): Booking[] {
  return s.bookings.filter((b) => b.residentId === residentId && b.payment === "due");
}

export function requestBooking(s: AppState, residentId: string, serviceId: string, startIso: string, message: string): Booking {
  const resident = userById(s, residentId) ?? fail("Sign in first.");
  if (resident.verify !== "verified") fail("Your residency is still being verified. You can book once it is approved.");
  const owed = outstanding(s, residentId);
  if (owed.length) fail(`Please settle ${owed.length === 1 ? "your unpaid job" : `${owed.length} unpaid jobs`} before booking again.`);
  const svc = serviceById(s, serviceId);
  const prov = providerById(s, svc.providerId) ?? fail("Provider not found.");
  if (prov.id === residentId) fail("You can't book your own service.");
  if (!prov.active || prov.hidden) fail("This provider isn't taking bookings right now.");
  if (!message.trim()) fail("Add a short message so the provider knows what you need.");
  const remaining = slotRemaining(prov.availability, s.bookings.filter((b) => b.providerId === prov.id), startIso);
  if (remaining === null) fail("That time is no longer offered. Pick another slot.");
  if (remaining! <= 0) fail("Someone just took that slot. Pick another time.");

  const start = new Date(startIso);
  const b: Booking = {
    id: newId("b"), residentId, providerId: prov.id, serviceId, start: startIso, end: addMinutes(start, prov.availability.slotMins).toISOString(),
    status: "requested", holdExpiresAt: addMinutes(now(), s.config.holdHours * 60).toISOString(), message: message.trim(), agreedDetails: "",
    price: 0, payment: "unpaid", amountPaid: 0, doneByProvider: false, doneByResident: false, createdAt: nowIso(), events: [],
  };
  log(b, residentId, "Requested");
  s.bookings.push(b);
  s.messages.push({ id: newId("m"), threadId: `b:${b.id}`, fromId: residentId, text: b.message, at: nowIso() });
  return b;
}

export function proposeTime(s: AppState, bookingId: string, providerId: string, startIso: string) {
  const b = bookingById(s, bookingId);
  if (b.providerId !== providerId) fail("Only the provider can propose a new time.");
  if (b.status !== "requested") fail("You can only propose a new time before accepting.");
  const prov = providerById(s, providerId)!;
  const left = slotRemaining(prov.availability, s.bookings.filter((x) => x.providerId === providerId), startIso, b.id);
  if (left === null || left <= 0) fail("That time isn't free in your calendar.");
  b.proposedStart = startIso;
  b.holdExpiresAt = addMinutes(now(), s.config.holdHours * 60).toISOString();
  log(b, providerId, "Proposed another time");
  postSystemMessage(s, b.id, "The provider proposed a different time.");
}

export function acceptProposal(s: AppState, bookingId: string, residentId: string) {
  const b = bookingById(s, bookingId);
  if (b.residentId !== residentId) fail("Only the customer can accept this.");
  const proposed = b.proposedStart ?? fail("There is no proposed time.");
  const prov = providerById(s, b.providerId)!;
  const left = slotRemaining(prov.availability, s.bookings.filter((x) => x.providerId === prov.id), proposed, b.id);
  if (left === null || left <= 0) fail("That proposed time was taken. Ask the provider for another.");
  b.start = proposed;
  b.end = addMinutes(new Date(b.start), prov.availability.slotMins).toISOString();
  b.proposedStart = undefined;
  log(b, residentId, "Accepted the proposed time");
}

export function acceptBooking(s: AppState, bookingId: string, providerId: string, details: string, price: number) {
  const b = bookingById(s, bookingId);
  if (b.providerId !== providerId) fail("Only the provider can accept.");
  if (b.status !== "requested") fail("This request is no longer waiting for you.");
  if (b.proposedStart) fail("Wait for the customer to answer your proposed time.");
  if (!details.trim()) fail("Write what you agreed to do, so the customer can confirm it.");
  if (!(price > 0)) fail("Enter the agreed price.");
  b.status = "accepted";
  b.agreedDetails = details.trim();
  b.price = Math.round(price * 100) / 100;
  log(b, providerId, `Accepted at RM${b.price}`);
  postSystemMessage(s, b.id, `Accepted: ${b.agreedDetails}, RM${b.price}. Waiting for the customer to confirm.`);
}

export function declineBooking(s: AppState, bookingId: string, providerId: string, reason: string) {
  const b = bookingById(s, bookingId);
  if (b.providerId !== providerId) fail("Only the provider can decline.");
  if (b.status !== "requested") fail("Only new requests can be declined.");
  b.status = "declined";
  log(b, providerId, "Declined");
  postSystemMessage(s, b.id, `Declined${reason ? `: ${reason}` : ""}. The slot is free again.`);
}

export function cancelBooking(s: AppState, bookingId: string, userId: string) {
  const b = bookingById(s, bookingId);
  if (b.residentId !== userId && b.providerId !== userId) fail("You aren't part of this booking.");
  if (!["requested", "accepted", "confirmed"].includes(b.status)) fail("This booking can't be cancelled any more.");
  if (b.payment === "held" || b.payment === "deposit_held") {
    b.payment = "refunded";
    log(b, "system", `Refunded RM${b.amountPaid} (demo)`);
  }
  b.status = "cancelled";
  log(b, userId, "Cancelled");
  postSystemMessage(s, b.id, "Booking cancelled.");
}

function needsGatePass(resident: User, provider: Provider): { zoneName: string } | null {
  const rz = zonesFor(resident.home);
  const gated = [rz.building, rz.precinct].find((z) => z?.gated);
  if (!gated) return null;
  const pz = zonesFor(provider.exact);
  const providerInside = (gated.type === "building" ? pz.building : pz.precinct)?.id === gated.id;
  return providerInside ? null : { zoneName: gated.name };
}

export function paymentModesFor(s: AppState, b: Booking): PaymentMode[] {
  const p = providerById(s, b.providerId)!;
  const out: PaymentMode[] = [];
  if (p.payment.before) out.push("before");
  if (p.payment.after) out.push("after");
  if (p.payment.depositPct > 0) out.push("deposit");
  return out.length ? out : ["before"];
}

export function amountNow(s: AppState, b: Booking, mode: PaymentMode): number {
  if (mode === "after") return 0;
  if (mode === "before") return b.price;
  const pct = providerById(s, b.providerId)!.payment.depositPct;
  return Math.round(b.price * pct) / 100;
}

/** Customer confirms the accepted job and chooses when to pay. Paying now is held until the job is done. */
export function confirmBooking(s: AppState, bookingId: string, residentId: string, mode: PaymentMode, method: string) {
  const b = bookingById(s, bookingId);
  if (b.residentId !== residentId) fail("Only the customer can confirm.");
  if (b.status !== "accepted") fail("The provider needs to accept first.");
  if (!paymentModesFor(s, b).includes(mode)) fail("This provider doesn't accept that payment option.");
  if (mode !== "after" && !method) fail("Choose a payment method.");
  b.status = "confirmed";
  b.paymentMode = mode;
  const due = amountNow(s, b, mode);
  if (mode === "before") {
    b.payment = "held";
    b.amountPaid = due;
    b.paymentMethod = method;
    log(b, residentId, `Confirmed and paid RM${due} (held until the job is done)`);
  } else if (mode === "deposit") {
    b.payment = "deposit_held";
    b.amountPaid = due;
    b.paymentMethod = method;
    log(b, residentId, `Confirmed and paid deposit RM${due} (held)`);
  } else {
    b.payment = "unpaid";
    log(b, residentId, "Confirmed, paying after the job");
  }

  const resident = userById(s, residentId)!;
  const provider = providerById(s, b.providerId)!;
  const gate = needsGatePass(resident, provider);
  if (gate) {
    const id = newId("gp");
    s.gatePasses.push({
      id, bookingId: b.id, visitorName: provider.displayName, zoneName: gate.zoneName,
      hostLabel: `${resident.name.split(" ")[0]} ${resident.name.split(" ")[1]?.[0] ?? ""}.`.trim(),
      validFrom: addMinutes(new Date(b.start), -30).toISOString(), validTo: addMinutes(new Date(b.end), 30).toISOString(),
    });
    b.gatePassId = id;
    log(b, "system", `Visitor pass issued for ${gate.zoneName}`);
  }
  postSystemMessage(s, b.id, `Confirmed for ${new Date(b.start).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.${gate ? " A visitor pass was sent to the provider." : ""}`);
}

/** Both sides tap "Job done". When both have, the job completes and held money is released. */
export function markDone(s: AppState, bookingId: string, userId: string) {
  const b = bookingById(s, bookingId);
  if (b.status !== "confirmed") fail("Only confirmed jobs can be marked done.");
  if (userId === b.providerId) b.doneByProvider = true;
  else if (userId === b.residentId) b.doneByResident = true;
  else fail("You aren't part of this booking.");
  log(b, userId, "Marked the job as done");
  if (b.doneByProvider && b.doneByResident) {
    b.status = "completed";
    if (b.payment === "held") {
      b.payment = "released";
      log(b, "system", `Released RM${b.amountPaid} to the provider (demo)`);
    } else if (b.payment === "deposit_held" || b.payment === "unpaid") {
      b.payment = "due";
      log(b, "system", `Balance of RM${b.price - b.amountPaid} is due`);
    }
    postSystemMessage(s, b.id, b.payment === "due" ? `Job completed. RM${b.price - b.amountPaid} is due from the customer.` : "Job completed. Payment released to the provider.");
  }
}

export function payBalance(s: AppState, bookingId: string, residentId: string, method: string) {
  const b = bookingById(s, bookingId);
  if (b.residentId !== residentId) fail("Only the customer can pay.");
  if (b.payment !== "due") fail("Nothing is due for this job.");
  if (!method) fail("Choose a payment method.");
  const amount = b.price - b.amountPaid;
  b.amountPaid = b.price;
  b.payment = "paid";
  b.paymentMethod = method;
  log(b, residentId, `Paid RM${amount} (demo)`);
  postSystemMessage(s, b.id, `Paid RM${amount}. Thank you!`);
}

export function addReview(s: AppState, bookingId: string, residentId: string, stars: number, text: string): Review {
  const b = bookingById(s, bookingId);
  if (b.residentId !== residentId) fail("Only the customer of this job can review it.");
  if (b.status === "reviewed") fail("You already reviewed this job.");
  if (b.status !== "completed") fail("You can review once both of you have marked the job as done.");
  if (!(stars >= 1 && stars <= 5)) fail("Choose 1 to 5 stars.");
  const r: Review = { id: newId("rv"), providerId: b.providerId, authorId: residentId, bookingId, type: "booked", stars: Math.round(stars), text: text.trim(), at: nowIso() };
  s.reviews.push(r);
  b.status = "reviewed";
  log(b, residentId, `Reviewed ${r.stars} stars`);
  return r;
}

export function createPastInvite(s: AppState, providerId: string): string {
  const code = `${providerId.slice(2, 5).toUpperCase()}-OLD-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  s.pastInvites.push({ code, providerId, createdAt: nowIso(), usedBy: [] });
  return code;
}

const townshipOf = (p: LatLng) => zonesFor(p).township?.townshipId ?? null;

/** Past-customer review: for people who used the provider before the app existed. Counts at half weight, max 5. */
export function addPastReview(s: AppState, code: string, residentId: string, stars: number, text: string): Review {
  const inv = s.pastInvites.find((i) => i.code.toUpperCase() === code.trim().toUpperCase()) ?? fail("That invite code doesn't exist. Check it with the provider.");
  const resident = userById(s, residentId)!;
  const provider = providerById(s, inv.providerId)!;
  const providerUser = userById(s, provider.id)!;
  if (resident.verify !== "verified") fail("Only verified residents can write past-customer reviews.");
  if (resident.id === provider.id) fail("You can't review yourself.");
  if (resident.unitKey === providerUser.unitKey) fail("People from the same home can't review each other.");
  const rt = townshipOf(resident.home);
  if (!rt || rt !== townshipOf(provider.exact)) fail("Past-customer reviews are limited to residents of the provider's own township.");
  const unitReviewers = s.reviews.filter((r) => r.providerId === provider.id && r.type === "past").map((r) => userById(s, r.authorId)?.unitKey);
  if (unitReviewers.includes(resident.unitKey)) fail("Your home has already written a past-customer review for this provider.");
  if (!(stars >= 1 && stars <= 5)) fail("Choose 1 to 5 stars.");
  if (text.trim().length < 10) fail("Say a little about your past experience (at least 10 characters).");
  const r: Review = { id: newId("rv"), providerId: provider.id, authorId: residentId, type: "past", stars: Math.round(stars), text: text.trim(), at: nowIso() };
  s.reviews.push(r);
  inv.usedBy.push(residentId);
  return r;
}

export function sendMessage(s: AppState, threadId: string, fromId: string, text: string) {
  if (!text.trim()) fail("Type a message first.");
  s.messages.push({ id: newId("m"), threadId, fromId, text: text.trim(), at: nowIso() });
}

export function postRequest(s: AppState, residentId: string, text: string, categoryId: string | null, timeHint: string): RequestPost {
  const u = userById(s, residentId)!;
  if (u.verify !== "verified") fail("Only verified residents can post requests.");
  if (text.trim().length < 10) fail("Describe what you need in a sentence or two.");
  const r: RequestPost = { id: newId("r"), residentId, text: text.trim(), categoryId, timeHint, createdAt: nowIso(), status: "open", responses: [] };
  s.requests.unshift(r);
  return r;
}

export function respondToRequest(s: AppState, requestId: string, providerId: string, text: string) {
  const r = s.requests.find((x) => x.id === requestId) ?? fail("Request not found.");
  if (r.status !== "open") fail("This request is closed.");
  if (r.residentId === providerId) fail("You can't respond to your own request.");
  if (r.responses.some((x) => x.providerId === providerId)) fail("You already responded to this request.");
  if (!text.trim()) fail("Write a short reply.");
  r.responses.push({ providerId, text: text.trim(), at: nowIso() });
  s.messages.push({ id: newId("m"), threadId: `r:${r.id}:${providerId}`, fromId: providerId, text: text.trim(), at: nowIso() });
}

export interface SignupInput {
  name: string;
  phone: string;
  placeIndex: number;
  unit: string;
  inviteCode: string;
}

/** Sign-up with residency check. A valid invite code verifies instantly; otherwise the account waits for admin review. */
export function signUp(s: AppState, input: SignupInput): User {
  const name = input.name.trim();
  const phone = input.phone.replace(/\D/g, "");
  if (name.length < 2) fail("Enter your name.");
  if (!/^01\d{7,9}$/.test(phone)) fail("Enter a Malaysian mobile number, for example 0123456789.");
  if (s.users.some((u) => u.phone === phone)) fail("This phone number is already linked to a home. Each number can join one home only.");
  const place = KNOWN_PLACES[input.placeIndex] ?? fail("Choose your home from the list.");
  if (!input.unit.trim()) fail("Enter your house or unit number. Only the township team sees it.");
  const unitKey = `${place.zoneId}:${input.unit.trim()}`;
  const housemates = s.users.filter((u) => u.unitKey === unitKey).length;
  if (housemates >= 4) fail("This home already has 4 members. Ask a family member to invite you.");

  let verify: User["verify"] = "pending";
  let note = "No invite code. Waiting for the township team to check proof of residence.";
  let matched: AppState["inviteCodes"][number] | undefined;
  if (input.inviteCode.trim()) {
    matched = s.inviteCodes.find((c) => c.code.toUpperCase() === input.inviteCode.trim().toUpperCase()) ?? fail("That invite code isn't valid. Leave it blank to verify another way.");
    if (matched!.usedBy) fail("That invite code has already been used.");
    if (matched!.zoneId !== place.zoneId) fail(`That code belongs to ${zoneById(matched!.zoneId)?.name}. Check the home you chose.`);
    verify = "verified";
    note = `Verified with invite code ${matched!.code}`;
  }
  const u: User = {
    id: newId("u"), name, phone, home: place.point, homeLabel: place.label, unit: input.unit.trim(), unitKey,
    verify, verifyNote: note, isProvider: false, isAdmin: false, createdAt: nowIso(), blocked: [],
  };
  if (matched) matched.usedBy = u.id;
  s.users.push(u);
  return u;
}

export function setVerification(s: AppState, userId: string, verify: User["verify"]) {
  const u = userById(s, userId) ?? fail("User not found.");
  u.verify = verify;
  u.verifyNote = verify === "verified" ? "Approved by the township team" : "Rejected by the township team";
}

export function becomeProvider(s: AppState, userId: string, displayName: string): Provider {
  const u = userById(s, userId)!;
  if (u.verify !== "verified") fail("Verify your residency before offering services.");
  if (providerById(s, userId)) return providerById(s, userId)!;
  const p: Provider = {
    id: userId, displayName: displayName.trim() || u.name, bio: "", hue: Math.floor(Math.random() * 360), homeBased: true, exact: u.home,
    serviceRadiusKm: 5, social: {}, socialVerified: false, socialCode: `JL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    joinedAt: nowIso(), responseMins: 60, payment: { before: true, after: true, depositPct: 0 },
    availability: { days: [1, 2, 3, 4, 5], blocks: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "17:00" }], slotMins: 60, bufferMins: 0, capacity: 1, minNoticeHrs: 12, horizonDays: 14, daysOff: [] },
    active: true, hidden: false,
  };
  s.providers.push(p);
  u.isProvider = true;
  return p;
}

export function reportProvider(s: AppState, reporterId: string, providerId: string, reason: string) {
  if (reason.trim().length < 5) fail("Tell us briefly what happened.");
  s.reports.push({ id: newId("rep"), reporterId, providerId, reason: reason.trim(), at: nowIso(), status: "open" });
}

export function toggleBlock(s: AppState, userId: string, providerId: string) {
  const u = userById(s, userId)!;
  u.blocked = u.blocked.includes(providerId) ? u.blocked.filter((x) => x !== providerId) : [...u.blocked, providerId];
}

export function residentReliability(s: AppState, residentId: string) {
  const done = s.bookings.filter((b) => b.residentId === residentId && (b.status === "completed" || b.status === "reviewed"));
  const unpaid = done.filter((b) => b.payment === "due").length;
  const cancelled = s.bookings.filter((b) => b.residentId === residentId && b.status === "cancelled").length;
  return { completed: done.length, unpaid, cancelled };
}

// ---------- Provider self-service ----------

export type ServiceInput = Omit<Service, "id" | "providerId"> & { id?: string };

export function saveService(s: AppState, providerId: string, input: ServiceInput): Service {
  providerById(s, providerId) ?? fail("Only providers can add services.");
  if (!categoryById(input.categoryId)) fail("Choose a category.");
  if (input.title.trim().length < 3) fail("Give the service a short name.");
  if (!(input.priceMin > 0)) fail("Enter a starting price above RM0.");
  if (input.priceMax < input.priceMin) fail("The highest price can't be below the starting price.");
  if (!input.priceUnit.trim()) fail("Say what the price is for, for example 'per visit'.");
  if (input.online && !categoryById(input.categoryId)?.onlineCapable) fail("This category can't be done online.");
  const clean = { ...input, title: input.title.trim(), description: input.description.trim(), priceUnit: input.priceUnit.trim() };
  if (input.id) {
    const existing = s.services.find((x) => x.id === input.id && x.providerId === providerId) ?? fail("Service not found.");
    Object.assign(existing, clean, { id: existing.id, providerId });
    return existing;
  }
  const svc: Service = { ...clean, id: newId("s"), providerId };
  s.services.push(svc);
  return svc;
}

export function removeService(s: AppState, providerId: string, serviceId: string) {
  const active = s.bookings.some((b) => b.serviceId === serviceId && ["requested", "accepted", "confirmed"].includes(b.status));
  if (active) fail("This service has upcoming bookings. Finish or cancel them first.");
  const before = s.services.length;
  s.services = s.services.filter((x) => !(x.id === serviceId && x.providerId === providerId));
  if (s.services.length === before) fail("Service not found.");
}

export function saveAvailability(s: AppState, providerId: string, tpl: AvailabilityTemplate) {
  const p = providerById(s, providerId) ?? fail("Provider not found.");
  const problems = templateProblems(tpl);
  if (problems.length) fail(problems[0]);
  p.availability = { ...tpl, days: [...tpl.days].sort(), blocks: [...tpl.blocks].sort((a, b) => a.start.localeCompare(b.start)), daysOff: [...tpl.daysOff].sort() };
}

export type ProviderPatch = Partial<Pick<Provider, "displayName" | "bio" | "homeBased" | "serviceRadiusKm" | "payment" | "introOffer" | "active" | "social">>;

export function updateProvider(s: AppState, providerId: string, patch: ProviderPatch) {
  const p = providerById(s, providerId) ?? fail("Provider not found.");
  if (patch.displayName !== undefined && patch.displayName.trim().length < 2) fail("Enter the name customers will see.");
  if (patch.payment) {
    const pay = patch.payment;
    if (!pay.before && !pay.after && !pay.depositPct) fail("Accept at least one way to pay.");
    if (pay.depositPct < 0 || pay.depositPct > 90) fail("Deposit must be between 10% and 90%.");
    if (pay.depositPct > 0 && pay.depositPct < 10) fail("Deposit must be between 10% and 90%.");
  }
  if (patch.serviceRadiusKm !== undefined && (patch.serviceRadiusKm < 0.5 || patch.serviceRadiusKm > 20)) fail("Travel distance must be between 0.5 and 20 km.");
  if (patch.social) {
    const changed = JSON.stringify(patch.social) !== JSON.stringify(p.social);
    if (changed) p.socialVerified = false; // a new handle needs a fresh check
  }
  Object.assign(p, patch);
  if (patch.introOffer !== undefined && !patch.introOffer.trim()) p.introOffer = undefined;
}

/**
 * Social link ownership check. The real app fetches the public profile and looks for the code in the bio.
 * The demo simulates that: the check passes when the provider says the code is in place.
 */
export function verifySocial(s: AppState, providerId: string, codeIsInBio: boolean) {
  const p = providerById(s, providerId) ?? fail("Provider not found.");
  if (!p.social.instagram && !p.social.facebook && !p.social.tiktok) fail("Add at least one social account first.");
  if (!codeIsInBio) fail(`We couldn't find ${p.socialCode} in your bio yet. Add it, save, then check again.`);
  p.socialVerified = true;
}

// ---------- Township team ----------

export function resolveReport(s: AppState, reportId: string, action: "hide" | "dismiss") {
  const r = s.reports.find((x) => x.id === reportId) ?? fail("Report not found.");
  r.status = action === "hide" ? "actioned" : "dismissed";
  if (action === "hide") {
    const p = providerById(s, r.providerId);
    if (p) p.hidden = true;
  }
}

export function setProviderHidden(s: AppState, providerId: string, hidden: boolean) {
  const p = providerById(s, providerId) ?? fail("Provider not found.");
  p.hidden = hidden;
}

export function updateConfig(s: AppState, patch: Partial<Config>) {
  const next = { ...s.config, ...patch };
  if (next.qualityFloor < 1 || next.qualityFloor > 5) fail("Quality floor must be between 1 and 5 stars.");
  if (next.floorExemptReviews < 0 || next.floorExemptReviews > next.newMaxReviews) fail("Floor exemption must be fewer reviews than the newcomer limit.");
  if (next.newMaxReviews < 1 || next.newMaxDays < 1) fail("Newcomer limits must be at least 1.");
  if (next.targetResults < 1 || next.targetResults > 20) fail("Target results must be between 1 and 20.");
  if (!(next.aiLost < next.aiConfident)) fail("The 'lost' threshold must be below the 'confident' threshold.");
  if (next.aiLead < 0 || next.aiLead > 1) fail("Lead must be between 0 and 1.");
  if (next.holdHours < 1 || next.holdHours > 72) fail("Hold time must be between 1 and 72 hours.");
  s.config = next;
}
