// verify2.mjs — assert the exact stop-loss table matches the real STINU app,
// and capture home + result screenshots.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4173/";
const EXPECT = "20 7.912 21 7.536 22 7.193 23 6.880 24 6.594 24.1 6.566 24.2 6.539 24.3 6.512 24.4 6.486";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

// home screenshot (device frame)
await page.screenshot({ path: "shot_home.png" });

// open result sheet
await page.locator("button", { hasText: /^Calculate$/ }).first().click();
await page.waitForTimeout(800);
const sheet = page.locator(".animate-sheet").last();
const txt = (await sheet.innerText()).replace(/\s+/g, " ").trim();
await page.screenshot({ path: "shot_result.png" });

// pull out the table region: after "MINI LOTS" up to "Pip value"
const m = txt.match(/MINI LOTS (.+?) Pip value/);
const table = m ? m[1].trim() : "(table not found)";

// assert the exact table
const tableOk = table === EXPECT;

// highlighted row (both cells)
const selRows = await sheet.locator(".bg-sel").count();
const selected = selRows ? (await sheet.locator(".bg-sel").allInnerTexts()).join(" ").replace(/\s+/g, " ").trim() : "?";

// footer summary: Pip value / lot, Balance, Units
const foot = txt.match(/Pip value \/ lot (.+)$/);
const footer = foot ? foot[1].trim() : "(no footer)";

// header cards
const head = txt.match(/^(.*?) Lots Mini Lots Units/);
const headerCards = head ? head[1].trim() : "?";

// also assert the three unit modes render
const unitTabs = [];
for (const label of ["Lots", "Mini Lots", "Units"]) {
  await sheet.locator("button", { hasText: new RegExp(`^${label}$`) }).first().click();
  await page.waitForTimeout(250);
  const t = (await sheet.innerText()).replace(/\s+/g, " ");
  const mm = t.match(/MINI LOTS|LOTS|UNITS/);
  unitTabs.push(label + "→" + (mm ? mm[0] : "?"));
}

const out = {
  headerCards,
  tableActual: table,
  tableExpected: EXPECT,
  tableOk,
  selectedRow: selected,
  selRows,
  footer,
  unitTabs,
  consoleErrors: errors,
};
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(tableOk && errors.length === 0 ? 0 : 1);
