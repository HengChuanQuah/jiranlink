import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto("http://localhost:4173/"); await p.evaluate(() => localStorage.clear()); await p.reload();
for (const who of ["Aisyah", "Kak Ani", "Township team"]) {
  await p.locator(".persona-btn").click(); await p.locator(".sheet .persona", { hasText: who }).first().click(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const W = window.innerWidth; const out = [];
    document.querySelectorAll("body *").forEach((el) => { const x = el.getBoundingClientRect(); if (x.right > W + 1 && x.width > 0) out.push(`${el.tagName}.${el.className}`.slice(0, 80) + " right=" + Math.round(x.right)); });
    return { sw: document.documentElement.scrollWidth, out: out.slice(0, 8) };
  });
  console.log(who, JSON.stringify(r));
}
await b.close();
