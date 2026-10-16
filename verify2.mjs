// verify2.mjs — end-to-end checks in headless Chromium.
// 1. The exact stop-loss table from the real STINU app's screenshot (EUR/USD, USD account).
// 2. Scenarios the original screenshot can't cover: other account currencies, JPY pairs,
//    crypto, the nudge table anchor, validation, persistence and keyboard use.
// 3. Live prices: streamed ticks, the sanity guard, market-closed state and fallbacks.
// Every price source (REST, the biquote SignalR hub and Binance's WebSocket) is mocked,
// so all expected numbers are fixed.
// Starts `next start` itself if nothing is listening (run `npm run build` first).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4173/";
const OUT = "test-results";
const REFERENCE = "20 7.912 21 7.536 22 7.193 23 6.880 24 6.594 24.1 6.566 24.2 6.539 24.3 6.512 24.4 6.486";
const RS = "\x1e";

// Daily reference rates, units per 1 USD
const RATES = { USD: 1, EUR: 0.88865, GBP: 0.74989, JPY: 158.02, AUD: 1.437, CAD: 1.4161, CHF: 0.82396, INR: 94.96 };
// Coinbase (~1 min) — same values, plus crypto
const COINBASE = { ...RATES, BTC: 1 / 81000 };
// biquote ticks (made fresh on every send). USDINR is deliberately broken (9% off) to exercise the guard.
const BIQUOTE = {
  EURUSD: 1 / 0.88865,
  GBPUSD: 1 / 0.74989,
  USDJPY: 158.02,
  USDCHF: 0.82396,
  USDINR: 103.55,
  XAUUSD: 4164.27,
};
const BINANCE = { BTCUSDT: 81594 };

const biquoteTick = (symbol, mid, time = Date.now()) => ({
  symbol, mid, bid: mid * 0.99999, ask: mid * 1.00001, timestamp: new Date(time).toISOString(),
});

// ── server ──────────────────────────────────────────────────────────────────
const isUp = () => fetch(URL).then((r) => r.ok, () => false);
let server;
if (!(await isUp())) {
  if (!existsSync(".next/BUILD_ID")) {
    console.error("No production build found — run `npm run build` first.");
    process.exit(1);
  }
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  server = spawn(process.execPath, [next, "start", "-p", new globalThis.URL(URL).port || "80"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 500));
}

// ── harness ─────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, ...(ok ? {} : { detail }) });
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** Mock every price source on a browser context. Returns a handle to push live ticks. */
async function mockFeeds(context, { biquoteDown = false } = {}) {
  const hub = { ws: null };
  await context.route("https://open.er-api.com/**", (r) =>
    r.fulfill({ json: { result: "success", time_last_update_unix: 1792108800, rates: RATES } }),
  );
  await context.route("https://api.frankfurter.dev/**", (r) => r.fulfill({ json: { date: "2026-10-16", rates: RATES } }));
  await context.route("https://api.coinbase.com/**", (r) =>
    r.fulfill({ json: { data: { currency: "USD", rates: Object.fromEntries(Object.entries(COINBASE).map(([k, v]) => [k, String(v)])) } } }),
  );
  await context.route("https://api.gold-api.com/**", (r) => r.fulfill({ json: { price: 4168.1 } }));

  if (biquoteDown) {
    await context.route("https://biquote.io/**", (r) => r.fulfill({ status: 503, body: "down" }));
  } else {
    await context.route("https://biquote.io/hubs/tick/negotiate**", (r) =>
      r.fulfill({ json: { negotiateVersion: 1, connectionId: "c", connectionToken: "t", availableTransports: [] } }),
    );
    await context.routeWebSocket(/biquote\.io\/hubs\/tick/, (ws) => {
      hub.ws = ws;
      ws.onMessage((raw) => {
        for (const frame of String(raw).split(RS).filter(Boolean)) {
          const m = JSON.parse(frame);
          if (m.protocol) ws.send("{}" + RS); // handshake
          else if (m.type === 1 && m.target === "Subscribe") {
            for (const sym of m.arguments[0]) {
              if (sym in BIQUOTE) ws.send(JSON.stringify({ type: 1, target: "ReceiveTick", arguments: [biquoteTick(sym, BIQUOTE[sym])] }) + RS);
            }
          }
        }
      });
    });
  }
  await context.routeWebSocket(/binance\.vision/, (ws) => {
    for (const stream of new globalThis.URL(ws.url()).searchParams.get("streams").split("/")) {
      const sym = stream.split("@")[0].toUpperCase();
      if (sym in BINANCE) {
        ws.send(JSON.stringify({ stream, data: { e: "24hrMiniTicker", E: Date.now(), s: sym, c: String(BINANCE[sym]) } }));
      }
    }
  });
  return {
    push: (tick) => hub.ws?.send(JSON.stringify({ type: 1, target: "ReceiveTick", arguments: [tick] }) + RS),
    state: (symbol, state) =>
      hub.ws?.send(JSON.stringify({ type: 1, target: "ReceiveSubscriptionState", arguments: [[{ symbol, state }]] }) + RS),
  };
}

async function newPage(opts) {
  const context = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
  const feeds = await mockFeeds(context, opts);
  const page = await context.newPage();
  page.feeds = feeds;
  page.errors = [];
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  page.on("pageerror", (e) => page.errors.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await status(page).filter({ hasText: opts?.biquoteDown ? "~1 min" : "Live" }).waitFor();
  return page;
}

const status = (page) => page.getByTestId("price-status");
const statusText = async (page) => norm(await status(page).innerText());
const sheet = (page) => page.locator(".animate-sheet").last();
const calcButton = (page) => page.locator("button", { hasText: /^Calculate$/ }).first();

async function openResult(page) {
  await calcButton(page).click();
  await sheet(page).locator("[aria-current=true]").first().waitFor();
  const txt = norm(await sheet(page).innerText());
  const anchor = norm((await sheet(page).locator("[aria-current=true]").allInnerTexts()).join(" "));
  return { txt, anchor };
}
async function closeSheet(page) {
  await sheet(page).locator('button[aria-label="Close"]').first().click();
  await page.locator(".animate-sheet").waitFor({ state: "detached" });
}
async function typeInto(page, cardLabel, value) {
  await page.locator("main [role=button]", { hasText: cardLabel }).first().click();
  for (let i = 0; i < 14; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type(value);
}
async function pickAccount(page, code) {
  await page.locator("header button", { hasText: "Account Base" }).click();
  await sheet(page).locator("button", { hasText: new RegExp(`^${code}`) }).click();
}
async function pickPopular(page, pair) {
  await page.locator("header button", { hasText: "Currency Pair" }).click();
  await sheet(page).locator("button", { hasText: new RegExp(`^${pair.replace("/", "\\/")}$`) }).click();
}
const waitStatus = (page, text) => status(page).filter({ hasText: text }).waitFor({ timeout: 5000 }).then(() => true, () => false);

// ── 1. reference table ──────────────────────────────────────────────────────
{
  const page = await newPage();
  await page.screenshot({ path: `${OUT}/home.png` });
  check("EUR/USD streams live from the hub", (await statusText(page)) === "Live 1.12530", await statusText(page));
  const { txt, anchor } = await openResult(page);
  await page.screenshot({ path: `${OUT}/result.png` });
  const table = txt.match(/MINI LOTS (.+?) Pip value/)?.[1].trim();
  check("reference table matches the original app", table === REFERENCE, { table });
  check("reference row 24.2 highlighted", anchor === "24.2 6.539", { anchor });
  check("reference footer", /Pip value \/ lot \$10\.00 Balance \$10,550 Units 65,393$/.test(txt), { txt });
  for (const [label, col] of [["Lots", "LOTS"], ["Mini Lots", "MINI LOTS"], ["Units", "UNITS"]]) {
    await sheet(page).locator("button", { hasText: new RegExp(`^${label}$`) }).click();
    const t = norm(await sheet(page).innerText());
    check(`unit tab ${label}`, t.includes(`STOP LOSS ${col} `), { t });
  }
  await page.keyboard.press("Escape");
  check("Escape closes the result sheet", (await page.locator(".animate-sheet").count()) === 0);
  check("no console errors (reference)", page.errors.length === 0, page.errors);
  await page.context().close();
}

// ── 2. other account currencies and pairs ───────────────────────────────────
{
  const page = await newPage();
  await pickAccount(page, "EUR");
  let r = await openResult(page);
  check("EUR account, EUR/USD → 7.359 mini lots, €8.89 pip", r.anchor === "24.2 7.359" && r.txt.includes("€8.89"), r);
  await closeSheet(page);

  await pickAccount(page, "USD");
  await pickPopular(page, "USD/JPY");
  await waitStatus(page, "Live 158.020");
  r = await openResult(page);
  check("USD/JPY, USD account → 10.333 mini lots, $6.33 pip", r.anchor === "24.2 10.333" && r.txt.includes("$6.33"), r);
  await closeSheet(page);

  // a new tick re-prices the conversion straight away
  page.feeds.push(biquoteTick("USDJPY", 155));
  check("a streamed tick updates the header", await waitStatus(page, "Live 155.000"), await statusText(page));
  r = await openResult(page);
  check("…and the position size (USD/JPY @155 → 10.136)", r.anchor === "24.2 10.136" && r.txt.includes("$6.45"), r);
  await closeSheet(page);

  // two-tap picker: JPY then GBP → GBP/JPY
  await page.locator("header button", { hasText: "Currency Pair" }).click();
  await sheet(page).locator("button", { hasText: /^JPYFX$/ }).click();
  await sheet(page).locator("button", { hasText: /^GBPFX$/ }).click();
  check("two-tap picker orients GBP/JPY", (await page.locator("header").innerText()).includes("GBP/JPY"));
  check("no console errors (conversion)", page.errors.length === 0, page.errors);
  await page.context().close();
}

// ── 3. live-price safety: bad feed, closed market, feed outage ──────────────
{
  const page = await newPage();
  await pickPopular(page, "USD/INR");
  check(
    "a broken USDINR tick (103.55) is rejected for Coinbase's 94.96",
    await waitStatus(page, "94.960 · ~1 min"),
    await statusText(page),
  );
  await pickAccount(page, "INR");
  await pickPopular(page, "EUR/USD");
  const r = await openResult(page);
  check("INR account: $10 pip = ₹949.60", r.txt.includes("₹949.60"), r.txt);
  await closeSheet(page);

  await pickAccount(page, "USD");
  await pickPopular(page, "USD/CHF");
  await waitStatus(page, "Live");
  page.feeds.state("USDCHF", "closed");
  page.feeds.push(biquoteTick("USDCHF", 0.82, Date.now() - 2 * 3600_000));
  check("an old tick on a closed market reads 'Market closed'", await waitStatus(page, "Market closed · 0.82000"), await statusText(page));
  await page.context().close();
}
{
  const page = await newPage({ biquoteDown: true });
  check("biquote down → EUR/USD falls back to Coinbase", (await statusText(page)) === "1.12530 · ~1 min", await statusText(page));
  const r = await openResult(page);
  check("…and still calculates", r.anchor === "24.2 6.539", r);
  await page.context().close();
}

// ── 4. crypto ───────────────────────────────────────────────────────────────
{
  const page = await newPage();
  await page.locator("header button", { hasText: "Currency Pair" }).click();
  await sheet(page).locator("button", { hasText: "Crypto" }).click();
  check("crypto list covers the wider market", (await sheet(page).locator("button", { hasText: /^PEPECRYPTO$/ }).count()) === 1);
  await sheet(page).locator("button", { hasText: /^BTC/ }).click();
  check("BTC streams live from Binance", await waitStatus(page, "Live $81,594.00"), await statusText(page));
  await typeInto(page, "Stop Loss", "500");
  const r = await openResult(page);
  check("BTC: $158.25 risk / $500 distance → 0.316500 coins", r.anchor === "500 0.316500", r);
  check("no console errors (crypto)", page.errors.length === 0, page.errors);
  await page.context().close();
}

// ── 5. nudge anchor, validation, persistence ────────────────────────────────
{
  const page = await newPage();
  await typeInto(page, "Stop Loss", "24.7");
  let r = await openResult(page);
  check("stop 24.7 is in the table and highlighted", r.anchor === "24.7 6.407", r);
  await closeSheet(page);

  await typeInto(page, "Risk", "500");
  check("risk 500% blocks Calculate", await calcButton(page).isDisabled());
  check("risk 500% explains why", (await page.locator("main").innerText()).includes("more than 100%"));
  await typeInto(page, "Risk", "2");
  await typeInto(page, "Account Balance", "5000");
  await page.locator("header button[aria-label=Favourite]").click(); // un-favourite EUR/USD
  await page.reload({ waitUntil: "networkidle" });
  const main = norm(await page.locator("main").innerText());
  check("inputs survive a reload", main.includes("$5,000") && main.includes("2%") && main.includes("24.7"), { main });
  await page.locator("nav button", { hasText: "Favourites" }).click();
  check("favourites survive a reload", !norm(await page.locator("main").innerText()).includes("EUR/USD"));
  check("no console errors (inputs)", page.errors.length === 0, page.errors);
  await page.context().close();
}

await browser.close();
server?.kill();

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : "  " + JSON.stringify(c.detail)}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
