import { chromium } from "@playwright/test";
const [,, base, out, scheme = "light"] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, colorScheme: scheme });
await ctx.route((u) => /workers\.dev|vercel\.app\/api\//.test(u.href), (r) => {
  const body = JSON.parse(r.request().postData() || "{}");
  const last = body.contents?.at(-1);
  const content = last?.parts.some((p) => p.functionResponse) ? { role: "model", parts: [{ text: "Ini cara bayar selepas kerja siap:" }] } : { role: "model", parts: [{ functionCall: { name: "get_help", args: { topic: "pay_after_rule" } } }] };
  r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content }) });
});
const p = await ctx.newPage();
await p.goto(base); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.locator(".assist-launch").click();
await p.locator("#assist-q").fill("macam mana nak bayar lepas kerja siap?"); await p.keyboard.press("Enter");
await p.waitForSelector(".assist-card"); await p.waitForTimeout(300);
await p.screenshot({ path: out });
await b.close();
