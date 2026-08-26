import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const errors = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 140)}`); });

await page.goto(BASE, { waitUntil: "networkidle" });

const crashed = await page.locator("text=Application error").count();
console.log(`  page loads:            ${crashed ? "CRASHED" : "ok"}`);
console.log(`  asset grid rendered:   ${(await page.locator("text=936 files").count()) ? "yes" : "no"}`);

// computed font must actually be Geist, not a fallback
const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
console.log(`  body font-family:      ${font.slice(0, 60)}`);
console.log(`  html data-font:        ${await page.evaluate(() => document.documentElement.dataset.font)}`);
console.log(`  data-density:          ${await page.evaluate(() => document.querySelector("[data-rgc-root]")?.dataset.density)}`);

// walk the whole dialog: every agent, every step
await page.getByRole("button", { name: /connect to agent/i }).click();
await page.waitForTimeout(400);
const agents = ["Claude Code","Claude Desktop","Codex CLI","Cursor","VS Code","Gemini CLI","Windsurf","ChatGPT","Something else"];
let walked = 0;
for (const name of agents) {
  const chip = page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first();
  if (!(await chip.count())) { errors.push(`agent tile missing: ${name}`); continue; }
  await chip.click();                       // selecting advances to step 2
  await page.waitForTimeout(250);
  // open the manual-install disclosure
  const manual = page.getByText(/manual install/i).first();
  if (await manual.count()) { await manual.click(); await page.waitForTimeout(120); }
  // step 3
  const next = page.getByRole("button", { name: /^Done —/ }).first();
  if (await next.count()) { await next.click(); await page.waitForTimeout(250); }
  const more = page.getByText(/more details|install the skill separately/i).first();
  if (await more.count()) { await more.click(); await page.waitForTimeout(120); }
  walked++;
  // back to step 1 for the next agent
  await page.getByRole("button", { name: /choose agent/i }).first().click().catch(() => {});
  await page.waitForTimeout(200);
}
console.log(`  agents walked:         ${walked}/${agents.length}`);
console.log(`  errors:                ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 8)) console.log(`    - ${e}`);
await browser.close();
process.exit(errors.length || crashed ? 1 : 0);
