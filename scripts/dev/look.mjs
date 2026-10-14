import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
for (const [w, h, sch] of [[390, 844, "light"], [1366, 900, "light"]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, colorScheme: sch })).newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:4173/"); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator("form.search-pill input").first().fill("aircond bocor air"); await p.keyboard.press("Enter");
  await p.locator(".seg button", { hasText: "Map" }).click(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/m-map-${w}.png` });
  await p.locator(".pcard").first().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/m-profile-${w}.png`, fullPage: true });
  // booking detail of seeded confirmed cleaning job
  await p.locator(w < 900 ? ".bottom-nav button" : ".nav-links button", { hasText: "Bookings" }).click();
  await p.locator(".seg button", { hasText: "Upcoming" }).click();
  await p.locator(".list-row").first().click(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/m-booking-${w}.png`, fullPage: true });
}
console.log(errs.length ? errs.join("\n") : "no errors");
await b.close();
