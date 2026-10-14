// Turns the single-file build into a page body for publishing as a claude.ai artifact
// (the host adds its own doctype, head and body wrapper).
import fs from "node:fs";
const html = fs.readFileSync("dist-single/index.html", "utf8");
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/, "")
  .replace(/<meta name="viewport"[^>]*>/, "");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const titleMatch = head.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = head.replace(titleMatch, "");
const out = `${titleMatch}\n<meta name="claude:viewport-fit-sides" content="cover">\n${rest}\n${body}\n`;
fs.mkdirSync("dist-artifact", { recursive: true });
fs.writeFileSync("dist-artifact/jiranlink.html", out);
console.log("wrote dist-artifact/jiranlink.html", (out.length / 1024).toFixed(0), "KB");
