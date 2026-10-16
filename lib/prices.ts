// lib/prices.ts
// REST price sources, all free and keyless. The streaming sources live in lib/feeds.ts
// and lib/market.ts decides which one wins for each currency.
//
// • Daily reference FX: open.er-api.com (covers every currency in the app), gaps filled
//   from Frankfurter (ECB). Falls back to a dated bundled snapshot when both fail.
// • ~1-minute FX + crypto: Coinbase's public exchange-rates endpoint (fiat and crypto,
//   cached by Coinbase for about 60 s).
// • Gold/silver spot fallback: gold-api.com.

export type RateMap = Record<string, number>; // units of currency per 1 USD

export interface RateSnapshot {
  rates: RateMap;
  source: "live" | "offline";
  /** ISO date (YYYY-MM-DD) the rates were published */
  asOf: string;
  provider: string;
}

// Bundled snapshot from open.er-api.com, 2026-10-16. Used only when both feeds fail.
export const STATIC_RATES: RateSnapshot = {
  rates: {
    USD: 1, EUR: 0.89165, GBP: 0.754053, JPY: 158.087, AUD: 1.44602, CAD: 1.41915, CHF: 0.828286,
    NZD: 1.78076, CNH: 6.6901, CZK: 21.7151, DKK: 6.66897, HUF: 324.418, ILS: 3.1004, HKD: 7.84743,
    KRW: 1342.74, MXN: 18.4572, NOK: 9.48281, PLN: 3.89682, RUB: 83.8738, SEK: 9.9599, SGD: 1.28234,
    TRY: 49.4803, ZAR: 16.5235, AED: 3.6725, ARS: 1513.93, BDT: 123.136, BRL: 5.05445, CLP: 985.501,
    COP: 3184.57, EGP: 53.4645, IDR: 17949.1, INR: 95.1001, ISK: 121.592, KES: 129.751, KWD: 0.310459,
    MYR: 4.08249, NGN: 1331.19, PHP: 63.0843, PKR: 276.983, QAR: 3.64, RON: 4.75949, SAR: 3.75,
    THB: 33.5261, TWD: 32.3603, VND: 25856.5,
  },
  source: "offline",
  asOf: "2026-10-16",
  provider: "bundled snapshot",
};

// gold-api.com can take ~8s on a cold request.
async function getJson(url: string, timeoutMs = 12000): Promise<unknown> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Keep positive finite numbers; numeric strings (Coinbase) are accepted too. */
function cleanRates(raw: unknown): RateMap {
  const out: RateMap = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const n = typeof v === "string" ? Number(v) : v;
      if (typeof n === "number" && Number.isFinite(n) && n > 0) out[k] = n;
    }
  }
  return out;
}

async function fetchErApi(): Promise<{ rates: RateMap; asOf: string } | null> {
  const j = (await getJson("https://open.er-api.com/v6/latest/USD")) as
    | { result?: string; rates?: unknown; time_last_update_unix?: number }
    | null;
  if (!j || j.result !== "success") return null;
  const asOf = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : "";
  return { rates: cleanRates(j.rates), asOf };
}

async function fetchFrankfurter(): Promise<{ rates: RateMap; asOf: string } | null> {
  const j = (await getJson("https://api.frankfurter.dev/v1/latest?base=USD")) as
    | { rates?: unknown; date?: string }
    | null;
  if (!j) return null;
  const rates = cleanRates(j.rates);
  // ECB publishes onshore CNY only; offshore CNH tracks it closely.
  if (rates.CNY && !rates.CNH) rates.CNH = rates.CNY;
  return { rates, asOf: j.date ?? "" };
}

/** Daily reference rates (never throws; falls back to the bundled snapshot). */
export async function loadRates(): Promise<RateSnapshot> {
  const [er, ff] = await Promise.all([fetchErApi(), fetchFrankfurter()]);
  if (!er && !ff) return STATIC_RATES;
  return {
    rates: { ...ff?.rates, ...er?.rates, USD: 1 },
    source: "live",
    asOf: er?.asOf || ff?.asOf || "",
    provider: er && ff ? "open.er-api + ECB" : er ? "open.er-api" : "ECB (Frankfurter)",
  };
}

/** Coinbase rates: units per 1 USD for ~650 fiat and crypto codes, or null on failure. */
export async function loadMinuteRates(): Promise<RateMap | null> {
  const j = (await getJson("https://api.coinbase.com/v2/exchange-rates?currency=USD")) as
    | { data?: { rates?: unknown } }
    | null;
  const rates = cleanRates(j?.data?.rates);
  return Object.keys(rates).length ? { ...rates, USD: 1 } : null;
}

/** USD spot price for gold or silver from gold-api.com; undefined otherwise or on failure. */
export async function loadMetalSpot(code: string): Promise<number | undefined> {
  if (code !== "XAU" && code !== "XAG") return undefined;
  const j = (await getJson(`https://api.gold-api.com/price/${code}`)) as { price?: number } | null;
  return typeof j?.price === "number" && j.price > 0 ? j.price : undefined;
}

/** Units of `code` per 1 USD, or undefined when the map has no rate for it. */
export function rateOf(rates: RateMap, code: string): number | undefined {
  const r = rates[code];
  return Number.isFinite(r) && r > 0 ? r : undefined;
}

/** Price of base/quote (units of quote per 1 base), or undefined when either rate is missing. */
export function pairPrice(rates: RateMap, base: string, quote: string): number | undefined {
  const b = rateOf(rates, base);
  const q = rateOf(rates, quote);
  return b && q ? q / b : undefined;
}

/**
 * Account-currency value of 1 unit of `quote` — the factor that turns a pip value
 * (always denominated in the quote currency) into the account currency.
 * Exactly 1 when they are the same currency, whatever the feed says.
 */
export function accountPerQuote(rates: RateMap | undefined, quote: string, account: string): number | undefined {
  if (quote === account) return 1;
  if (!rates) return undefined;
  const q = rateOf(rates, quote);
  const a = rateOf(rates, account);
  return q && a ? a / q : undefined;
}
