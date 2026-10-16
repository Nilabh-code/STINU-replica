// lib/prices.ts
// Live FX price feed. Primary: Frankfurter (ECB reference rates, free, no key).
// Fallback: open.er-api.com (free, no key). Final fallback: bundled static rates
// so the calculator always works offline.

export type RateMap = Record<string, number>; // units of quote per 1 USD

// Static fallback (approx.). Used only when both live feeds are unreachable.
export const STATIC_USD_RATES: RateMap = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 157, AUD: 1.52, CAD: 1.37, CHF: 0.88,
  NZD: 1.66, CNH: 7.26, CNY: 7.24, CZK: 23.2, DKK: 6.87, HUF: 360, ILS: 3.72,
  HKD: 7.81, KRW: 1370, MXN: 17.1, NOK: 10.7, PLN: 3.98, RUB: 92, SEK: 10.5,
  SGD: 1.34, TRY: 32.3, ZAR: 18.4,
};

// Currency codes the app uses that differ from the feed's code for the same unit.
const CODE_ALIAS: Record<string, string> = { CNH: "CNY" };

/** Resolve an app currency code to the feed's code (CNH -> CNY, else identity). */
export function feedCode(code: string): string {
  return CODE_ALIAS[code] ?? code;
}

/** True when the feed has a rate for this code (commodities/crypto do not). */
export function hasRate(rates: RateMap, code: string): boolean {
  return Number.isFinite(rates[feedCode(code)]);
}

export interface PriceQuote {
  /** USD per 1 unit of the currency (i.e. 1 / rate) */
  usdPer: (code: string) => number;
  source: "frankfurter" | "er-api" | "static";
  date: string;
}

async function fetchFrankfurter(): Promise<{ rates: RateMap; date: string } | null> {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    // j.rates: { EUR: 0.92, ... } quote per 1 USD
    return { rates: { USD: 1, ...j.rates }, date: j.date ?? "" };
  } catch {
    return null;
  }
}

async function fetchErApi(): Promise<{ rates: RateMap; date: string } | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.result !== "success") return null;
    return { rates: { USD: 1, ...j.rates }, date: (j.time_last_update_utc || "").slice(0, 16) };
  } catch {
    return null;
  }
}

export async function loadPrices(): Promise<PriceQuote> {
  // Server-side works; client-side may hit CORS but both endpoints allow it.
  const ff = await fetchFrankfurter();
  if (ff) {
    return { usdPer: (c) => (ff.rates[c] ? 1 / ff.rates[c] : 1), source: "frankfurter", date: ff.date };
  }
  const er = await fetchErApi();
  if (er) {
    return { usdPer: (c) => (er.rates[c] ? 1 / er.rates[c] : 1), source: "er-api", date: er.date };
  }
  return {
    usdPer: (c) => (STATIC_USD_RATES[c] ? 1 / STATIC_USD_RATES[c] : 1),
    source: "static",
    date: "offline",
  };
}

/**
 * Convert a live rate map into a pair price for the calculator.
 * price(base/quote) = units of quote per 1 base
 *                   = (quote per USD) / (base per USD)
 */
export function pairPrice(rates: RateMap, base: string, quote: string): number {
  const b = rates[feedCode(base)];
  const q = rates[feedCode(quote)];
  if (!b || !q) return 1;
  return q / b;
}

/**
 * How many units of `quote` are worth one unit of `account` currency.
 * quotePerAccount = (quote per USD) / (account per USD)
 */
export function quoteToAccountRate(rates: RateMap, quote: string, account: string): number {
  const q = rates[feedCode(quote)];
  const a = rates[feedCode(account)];
  if (!q || !a) return 1;
  return q / a;
}

// Default price hints for displaying the currency rows before live data loads.
export const DEFAULT_PAIRS: { pair: string; price: number }[] = [
  { pair: "EUR/USD", price: 1.0850 },
  { pair: "GBP/USD", price: 1.2650 },
  { pair: "USD/JPY", price: 157.0 },
  { pair: "AUD/USD", price: 0.6600 },
];
