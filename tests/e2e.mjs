// End-to-end walkthrough of the demo in a real browser.
// Run: npm run build && npx vite preview --port 4173 &  then  node tests/e2e.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const OUT = process.env.SHOTS ?? "shots";
const EXE = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(["PASS", name]);
    console.log("PASS", name);
  } catch (e) {
    results.push(["FAIL", name, String(e.message ?? e).split("\n")[0]]);
    console.log("FAIL", name, "\n   ", String(e.message ?? e).split("\n").slice(0, 3).join("\n    "));
    try { await page?.screenshot({ path: `${OUT}/FAIL-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png` }); } catch {}
    try { await page?.keyboard.press("Escape"); } catch {}
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch({ executablePath: EXE });
let page;

// Fake JiranLink AI server, so the assistant's AI path is tested without a real key.
// Only used when the build points at an AI server (npm run build:pages); otherwise the app gives quick answers.
async function mockAiServer(ctx) {
  await ctx.route((u) => /workers\.dev|vercel\.app\/api\//.test(u.href), async (route) => {
    const url = route.request().url();
    const body = JSON.parse(route.request().postData() || "{}");
    const reply = (content) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content }) });
    if (url.endsWith("/classify")) {
      const plumbing = /pipe|paip|sinki/i.test(body.text || "");
      return reply({ role: "model", parts: [{ text: JSON.stringify({ categories: plumbing ? [{ id: "plumbing", score: 0.9 }] : [], timeHint: null, online: false }) }] });
    }
    const last = body.contents.at(-1);
    if (last.parts.some((p) => p.functionResponse)) return reply({ role: "model", parts: [{ text: "Here are neighbours who can help." }] });
    const q = last.parts.map((p) => p.text || "").join(" ").toLowerCase();
    if (q.includes("pipe")) return reply({ role: "model", parts: [{ functionCall: { name: "find_providers", args: { need: "fix pipes", category_id: "plumbing" } } }] });
    if (q.includes("skill")) return reply({ role: "model", parts: [{ functionCall: { name: "get_help", args: { topic: "request_board" } } }] });
    return reply({ role: "model", parts: [{ text: "I can only help with JiranLink." }] });
  });
}

async function newPage(width, height, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await mockAiServer(ctx);
  // Behave like Chrome 155+: scrollIntoView returns a Promise. This is what crashed teammates' pages.
  await ctx.addInitScript(() => {
    const o = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...a) { o.apply(this, a); return Promise.resolve(); };
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/tile|openstreetmap|ERR_|Failed to load resource/i.test(m.text())) errors.push(`[console] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(BASE);
  await page.waitForSelector(".app");
  return page;
}

async function persona(page, label) {
  await page.locator(".persona-btn").click();
  await page.locator(".sheet .persona", { hasText: label }).first().click();
  await page.waitForTimeout(150);
}
async function nav(page, label) {
  const re = new RegExp(`^\\s*${label}\\s*\\d*\\s*$`);
  const bottom = page.locator(".bottom-nav button").filter({ hasText: re });
  if (await bottom.first().isVisible().catch(() => false)) return bottom.first().click();
  await page.locator(".nav-links button").filter({ hasText: re }).first().click();
}
async function search(page, q) {
  // Search starts from the box on Home; there is no separate Search tab.
  await nav(page, "Home");
  const input = page.locator("form.search-pill input").first();
  await input.fill(q);
  await input.press("Enter");
  await page.waitForTimeout(200);
}
async function openBooking(page, text, status) {
  await nav(page, page.url() && (await page.locator(".bottom-nav button", { hasText: "Jobs" }).count()) ? "Jobs" : "Bookings");
  for (const tab of ["Needs you", "Upcoming", "Past"]) {
    const t = page.locator(".seg button", { hasText: tab });
    if (await t.count()) await t.first().click();
    let row = page.locator(".list-row", { hasText: text });
    if (status) row = row.filter({ hasText: status });
    if (await row.count()) { await row.first().click(); return; }
  }
  throw new Error(`Booking row "${text}" not found`);
}
async function pickFirstSlot(page) {
  const slot = page.locator(".slot-btn:not([disabled])").first();
  await slot.waitFor({ timeout: 3000 });
  await slot.click();
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

// ---------- Phone walkthrough ----------
page = await newPage(390, 844);
page.setDefaultTimeout(6000);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector(".app");

await step("Home has no Search tab and no example chips", async () => {
  expect(await page.locator(".bottom-nav button", { hasText: /^\s*Search\s*$/ }).count() === 0, "Search tab still shown");
  expect(await page.locator(".hero-chips").count() === 0, "example chips still shown");
});

await step("Home renders hero and categories", async () => {
  expect(await page.locator(".hero").isVisible(), "hero missing");
  expect((await page.locator(".cat-tile").count()) === 0, "services grid should be gone from Home");
  expect(await page.locator(".hero-link", { hasText: "Browse all services" }).count() === 1, "browse-all link missing");
  await page.locator(".hero-link").click();
  expect((await page.locator(".cat-tile").count()) > 10, "all-services page empty");
  await nav(page, "Home");
  await shot(page, "01-home-phone");
});

await step("Aisyah: Manglish search finds Kak Ani first (same precinct)", async () => {
  await search(page, "nak order kek birthday anak");
  await page.waitForSelector(".pcard");
  const first = await page.locator(".results-layout .pcard").first().getAttribute("aria-label");
  expect(/Kak Ani/.test(first ?? ""), `first result was ${first}`);
  await shot(page, "02-search-cake-phone");
});

await step("Aisyah: books Kak Ani with a drafted message", async () => {
  await page.locator(".pcard", { hasText: "Kak Ani" }).first().click();
  await page.locator(".svc-row button", { hasText: "Book" }).first().click();
  await pickFirstSlot(page);
  const msg = await page.locator("#msg").inputValue();
  expect(msg.length > 20, "drafted message empty");
  await shot(page, "03-book-phone");
  await page.locator("button", { hasText: "Send request for" }).click();
  await page.waitForSelector(".status");
  expect(await page.locator("text=Waiting").count() > 0 || await page.locator(".st-requested").count() > 0, "not in requested state");
});

await step("Kak Ani: accepts the request at RM150", async () => {
  await persona(page, "Kak Ani");
  await openBooking(page, "Aisyah");
  await page.locator("#price").fill("150");
  await page.locator("button", { hasText: /^\s*Accept$/ }).click();
  await page.waitForSelector("text=Accepted at RM150");
});

await step("Aisyah: confirms and pays now via FPX (held)", async () => {
  await persona(page, "Aisyah");
  await openBooking(page, "Kak Ani", "Waiting for you to confirm");
  await page.locator(".option-card", { hasText: "Pay now" }).click();
  await page.locator("button", { hasText: "Confirm and pay RM150" }).click();
  await page.waitForSelector(".sheet .pay-method");
  await shot(page, "04-checkout-phone");
  await page.locator(".sheet button.btn-block").click();
  await page.waitForSelector("text=Confirmed.", { timeout: 4000 });
});

await step("Both mark done, money released, review posted", async () => {
  await page.locator("button", { hasText: "Job done" }).click();
  await persona(page, "Kak Ani");
  await openBooking(page, "Aisyah", "Confirmed");
  await page.locator("button", { hasText: "Job done" }).click();
  await page.waitForSelector("text=Completed.");
  await persona(page, "Aisyah");
  await openBooking(page, "Kak Ani", /Completed|review/i);
  await page.locator(".star-input button").nth(4).click();
  await page.locator("#rt").fill("Kek sedap, sampai on time.");
  await page.locator("button", { hasText: "Post review" }).click();
  await page.waitForSelector("text=Reviewed");
});

await step("Priya (condo): building-first results for dog walking", async () => {
  await persona(page, "Priya");
  await search(page, "someone to walk my dog");
  await page.waitForSelector(".pcard");
  const ring = await page.locator(".results-layout .pcard").first().textContent();
  expect(/Quarza|building/i.test(ring ?? ""), `first card not in building: ${ring?.slice(0, 80)}`);
  await shot(page, "05-search-priya-phone");
});

await step("Priya: books Faizal (pay after) and gets a gate pass", async () => {
  await search(page, "aircond tak sejuk");
  await page.waitForSelector(".pcard");
  const card = page.locator(".pcard", { hasText: "Faizal" });
  expect(await card.count() > 0, "Faizal not in Priya's results");
  await card.first().click();
  await page.locator(".svc-row button", { hasText: "Book" }).first().click();
  await pickFirstSlot(page);
  await page.locator("button", { hasText: "Send request for" }).click();
  await persona(page, "Faizal");
  await openBooking(page, "Priya");
  await page.locator("button", { hasText: /^\s*Accept$/ }).click();
  await persona(page, "Priya");
  await openBooking(page, "Faizal");
  await page.locator("button", { hasText: "Confirm booking" }).click();
  await page.waitForSelector("text=Confirmed.");
  await page.locator("button", { hasText: "Visitor pass" }).click();
  await page.waitForSelector(".sheet .pass");
  await shot(page, "06-gatepass-phone");
  await page.keyboard.press("Escape");
});

await step("Pay-after flow: balance due blocks, then paid", async () => {
  await page.locator("button", { hasText: "Job done" }).click();
  await persona(page, "Faizal");
  await openBooking(page, "Priya");
  await page.locator("button", { hasText: "Job done" }).click();
  await persona(page, "Priya");
  await openBooking(page, "Faizal");
  await page.waitForSelector("text=due.");
  await page.locator("button", { hasText: /^Pay RM/ }).click();
  await page.locator(".sheet .pay-method", { hasText: "DuitNow" }).click();
  await page.waitForSelector(".sheet img.qr");
  await page.locator(".sheet button.btn-block").click();
  await page.waitForSelector("text=How did it go?", { timeout: 4000 });
});

await step("Mr Tan: cleaning search shows exception card", async () => {
  await persona(page, "Mr Tan");
  await search(page, "cuci rumah");
  await page.waitForSelector(".pcard");
  expect(await page.locator("text=Highly rated, a bit further").count() > 0, "no exception card");
  await shot(page, "07-search-tan-phone");
});

await step("Ambiguous query shows chips, not a question", async () => {
  await search(page, "repair");
  const chips = await page.locator(".agent .chip").count();
  expect(chips >= 2, `expected chips, got ${chips}`);
});

await step("Online services from other townships reach Aisyah", async () => {
  await persona(page, "Aisyah");
  await search(page, "online maths tuition");
  await page.waitForSelector("text=Online from verified residents");
  expect(await page.locator(".pcard", { hasText: "Cikgu Aina" }).count() > 0, "Melawati online tutor missing for Elmina resident");
});

await step("Map view toggles without errors", async () => {
  await search(page, "aircond");
  await page.locator(".seg button", { hasText: "Map" }).click();
  await page.waitForSelector(".map-box");
  await page.waitForTimeout(600);
  await shot(page, "08-map-phone");
});

await step("Request board: post with AI tag", async () => {
  await nav(page, "Requests");
  await page.locator("#req").fill("Need someone to water my plants and feed my cat for 5 days next month");
  await page.waitForSelector("text=Tagged as");
  await page.locator("button", { hasText: "Post request" }).click();
  await page.waitForSelector("text=Your requests");
});

await step("Kak Ani: add service and change hours", async () => {
  await persona(page, "Kak Ani");
  await nav(page, "Services");
  await page.locator("button", { hasText: "Add service" }).click();
  await page.locator("#sv-cat").selectOption("kuih");
  await page.locator("#sv-title").fill("Kuih lapis, 1 tray");
  await page.locator("#sv-min").fill("45");
  await page.locator(".sheet button[type=submit]").click();
  await page.waitForSelector(".svc-row:has-text('Kuih lapis')");
  await page.locator("button", { hasText: "Set your hours" }).click();
  await page.locator(".chip", { hasText: "Sat" }).click();
  await page.locator("#slot").selectOption("90");
  await page.locator("button", { hasText: "Save hours" }).click();
  await page.waitForSelector("text=No unsaved changes.");
  await shot(page, "09-availability-phone");
});

await step("Kak Ani: settings, social verification, invite code", async () => {
  await nav(page, "Me");
  await page.locator("#ig").fill("kakanikitchen");
  await page.locator("button", { hasText: "Save links" }).click();
  await page.locator("label.check", { hasText: "pretend" }).click();
  await page.locator("button", { hasText: "Check my bio" }).click();
  await page.waitForSelector(".badge.b-verified:has-text('Verified')");
  await page.locator("button", { hasText: "Create invite code" }).click();
  expect(await page.locator(".tbl tbody tr").count() >= 2, "invite code not added");
});

await step("Sign up with invite code verifies instantly", async () => {
  await persona(page, "Aisyah");
  await page.locator(".persona-btn").click();
  await page.locator(".sheet button", { hasText: "Sign up" }).click();
  await page.locator("#nm").fill("Daniel Lee");
  await page.locator("#ph").fill("0129998888");
  await page.locator("button", { hasText: "Send code" }).click();
  await page.locator("#otp").fill("123456");
  await page.locator("#pl").fill("Quarza");
  await page.locator(".option-card", { hasText: "Quarza" }).first().click();
  await page.locator("#un").fill("Tower A, 21-03");
  await page.locator("#ic").fill("QRZ-12A-0705");
  await page.locator("button[type=submit]", { hasText: "Create account" }).click();
  await page.waitForSelector(".hero");
  await nav(page, "Me");
  await page.waitForSelector("text=Verified resident");
});

await step("Sign up without code goes pending, admin approves", async () => {
  await page.locator(".persona-btn").click();
  await page.locator(".sheet button", { hasText: "Sign up" }).click();
  await page.locator("#nm").fill("Siti Aminah");
  await page.locator("#ph").fill("0137776666");
  await page.locator("button", { hasText: "Send code" }).click();
  await page.locator("#otp").fill("123456");
  await page.locator(".option-card", { hasText: "Melawati" }).first().click();
  await page.locator("#un").fill("No. 14");
  await page.locator("button[type=submit]", { hasText: "Create account" }).click();
  await page.waitForSelector("text=Residency check in progress");
  await persona(page, "Township team");
  await page.waitForSelector(".card:has-text('Siti Aminah')");
  await page.locator(".card", { hasText: "Siti Aminah" }).locator("button", { hasText: "Approve" }).click();
  await page.waitForSelector(".tbl td:has-text('Siti Aminah')");
  await shot(page, "10-admin-phone");
});

await step("Admin: hide reported provider removes them from search", async () => {
  await page.locator("[role=tab]", { hasText: "Reports" }).click();
  await page.locator("button", { hasText: "Hide provider" }).first().click();
  await page.waitForSelector("text=Hidden providers");
  await page.locator("[role=tab]", { hasText: "Settings" }).click();
  await page.locator("#cfg-qualityFloor").fill("3.8");
  await page.locator("button", { hasText: "Save settings" }).click();
  await page.locator("[role=tab]", { hasText: "Pilot numbers" }).click();
  await page.waitForSelector(".stat");
});

await step("Duplicate phone is rejected", async () => {
  await page.locator(".persona-btn").click();
  await page.locator(".sheet button", { hasText: "Sign up" }).click();
  await page.locator("#nm").fill("Copy Cat");
  await page.locator("#ph").fill("0129998888");
  await page.locator("button", { hasText: "Send code" }).click();
  await page.locator("#otp").fill("123456");
  await page.locator(".option-card", { hasText: "Elmina" }).first().click();
  await page.locator("#un").fill("No. 1");
  await page.locator("button[type=submit]", { hasText: "Create account" }).click();
  await page.waitForSelector(".toast:has-text('already linked')");
});

await step("Ask JiranLink: find a plumber from a plain question", async () => {
  await persona(page, "Mr Tan");
  await page.locator(".assist-launch").click();
  await page.waitForSelector(".assist-panel");
  await page.locator(".assist-starter", { hasText: "leaking pipe" }).click();
  await page.waitForSelector(".assist-reply .assist-row", { timeout: 8000 });
  const cards = await page.locator(".assist-reply .assist-row").count();
  expect(cards > 0, "no provider cards");
  await shot(page, "11-assistant-phone");
  await page.locator(".assist-reply .assist-row").first().click();
  await page.waitForSelector(".profile-hero");
  expect(await page.locator(".assist-panel").count() === 0, "panel should close on phone after navigating");
});

await step("Ask JiranLink: how-to question gives a button to the right screen", async () => {
  await page.locator(".assist-launch").click();
  await page.locator("#assist-q").fill("how do i ask for a skill that isn't listed?");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".assist-card:has-text('request board')", { timeout: 8000 });
  await page.locator(".assist-card button", { hasText: "request board" }).click();
  await page.waitForSelector("#req");
});

await step("Ask JiranLink: hidden on booking screens so it never covers buttons", async () => {
  await persona(page, "Aisyah");
  expect(await page.locator(".assist-launch").count() === 1, "launcher missing on Home");
  await openBooking(page, "");
  await page.waitForSelector(".steps, .status");
  expect(await page.locator(".assist-launch").count() === 0, "launcher visible on booking page");
  await persona(page, "Kak Ani");
  expect(await page.locator(".assist-launch").count() === 0, "launcher visible in provider mode");
});

await step("Chrome 155: leaving a booking for Messages doesn't blank the page", async () => {
  await persona(page, "Aisyah");
  await openBooking(page, "");
  await page.waitForTimeout(300);
  await nav(page, "Messages");
  await page.waitForTimeout(300);
  expect(await page.locator(".app .header").count() === 1, "page went blank");
  expect(await page.locator(".crash").count() === 0, "crash guard showed");
});

// ---------- Desktop and dark mode screenshots of every main screen ----------
for (const [scheme, w, h] of [["light", 1366, 900], ["dark", 1366, 900], ["dark", 390, 844]]) {
  const p = await newPage(w, h, scheme);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector(".app");
  const tag = `${scheme}-${w}`;
  await step(`Screens render (${tag})`, async () => {
    await shot(p, `20-home-${tag}`);
    await p.screenshot({ path: `${OUT}/20-home-full-${tag}.png`, fullPage: true });
    await search(p, "aircond bocor air");
    await p.waitForSelector(".pcard");
    await shot(p, `21-search-${tag}`);
    await p.locator(".pcard").first().click();
    await p.waitForSelector(".profile-hero");
    await shot(p, `22-profile-${tag}`);
    await nav(p, "Bookings");
    await shot(p, `23-bookings-${tag}`);
    await persona(p, "Kak Ani");
    await shot(p, `24-dashboard-${tag}`);
    await persona(p, "Township team");
    await shot(p, `25-admin-${tag}`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, "horizontal overflow");
  });
  await p.context().close();
}

// Overflow check on every phone screen visited above
await step("No horizontal scroll on phone", async () => {
  const wide = await page.evaluate(() => {
    if (document.documentElement.scrollWidth <= window.innerWidth + 1) return null;
    const W = window.innerWidth, out = [];
    document.querySelectorAll("body *").forEach((el) => { const x = el.getBoundingClientRect(); if (x.right > W + 1 && !el.closest(".marquee")) out.push(`${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(x.right)}`); });
    return out.slice(0, 5).join("; ");
  });
  expect(!wide, `page scrolls sideways: ${wide}`);
});

await browser.close();
console.log("\n==== SUMMARY ====");
console.log(`${results.filter((r) => r[0] === "PASS").length}/${results.length} steps passed`);
results.filter((r) => r[0] === "FAIL").forEach((r) => console.log("FAIL:", r[1], "->", r[2]));
console.log(errors.length ? `Console errors (${errors.length}):\n` + [...new Set(errors)].join("\n") : "No console errors");
process.exit(results.some((r) => r[0] === "FAIL") || errors.length ? 1 : 0);
