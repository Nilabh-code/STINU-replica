// lib/market.ts — picks the best available price for every currency and instrument.
//
// Preference per FX currency (all relative to USD):
//   1. a streamed biquote.io tick for its USD leg, if it passes a sanity check
//      (tight spread, within 3% of an independent reference) — "live", or "closed"
//      when the market is shut and that tick is the last price
//   2. Coinbase's ~1-minute rate — "minute"
//   3. the daily reference rate (open.er-api / ECB) — "daily", or the bundled
//      snapshot when offline — "offline"
// Crypto: Binance tick → Coinbase. Gold/silver/oil: biquote tick → gold-api.com.

import { FX, Instrument, fxLegSymbol } from "./instruments";
import type { RateMap, RateSnapshot } from "./prices";

export interface Tick {
  symbol: string;
  bid?: number;
  ask?: number;
  mid: number;
  /** ms since epoch the quote was made */
  time: number;
  /** the feed reported this market as closed when we subscribed */
  closed?: boolean;
}

/** How a price was obtained, best first. */
export type Freshness = "live" | "closed" | "minute" | "stale" | "daily" | "offline" | "none";
const ORDER: Freshness[] = ["live", "closed", "minute", "stale", "daily", "offline", "none"];
export const worst = (a: Freshness, b: Freshness): Freshness => ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];

/** A streamed quote older than this is no longer "live". */
export const LIVE_AGE_MS = 2 * 60_000;
/** Coinbase rates older than this are ignored. */
export const MINUTE_MAX_AGE_MS = 10 * 60_000;
/** Reject a streamed FX quote whose spread is wider than this fraction of the price… */
export const MAX_SPREAD = 0.005;
/** …or that is further than this from the reference rate (catches broken broker feeds). */
export const MAX_DEVIATION = 0.03;

export interface MarketState {
  daily: RateSnapshot | null;
  /** Coinbase rates (units per USD, fiat + crypto) and when we fetched them */
  minute: { rates: RateMap; at: number } | null;
  ticks: Record<string, Tick>;
  /** gold-api.com fallback, USD per ounce */
  metals: Record<string, { price: number; at: number }>;
  now: number;
}

/** Forex is shut from Friday ~21:00 UTC to Sunday ~21:00 UTC. */
export function fxWeekend(now: number): boolean {
  const d = new Date(now);
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  return day === 6 || (day === 5 && h >= 21) || (day === 0 && h < 21);
}

/** Units of `code` per 1 USD implied by its USD-leg tick (EURUSD 1.125 → 0.8889 EUR). */
export function legRate(code: string, tick: Tick): number {
  return fxLegSymbol(code)?.startsWith("USD") ? tick.mid : 1 / tick.mid;
}

/** Sanity-check a streamed FX quote against its spread and an independent reference rate. */
export function tickTrusted(code: string, tick: Tick, reference: number | undefined): boolean {
  if (!(tick.mid > 0) || !Number.isFinite(tick.mid)) return false;
  if (tick.bid !== undefined && tick.ask !== undefined && (tick.ask - tick.bid) / tick.mid > MAX_SPREAD) return false;
  if (reference !== undefined && Math.abs(legRate(code, tick) / reference - 1) > MAX_DEVIATION) return false;
  return true;
}

/** Freshness of a streamed tick that has been accepted. */
function tickFreshness(tick: Tick, now: number, closedHours: boolean): Freshness {
  if (now - tick.time < LIVE_AGE_MS) return "live";
  return tick.closed || closedHours ? "closed" : "stale";
}

export interface Resolved {
  /** units per USD for every currency we know anything about */
  rates: RateMap;
  source: Record<string, Freshness>;
  /** quote time (ms) for streamed or minute rates */
  time: Record<string, number>;
}

const minuteRates = (m: MarketState) =>
  m.minute && m.now - m.minute.at < MINUTE_MAX_AGE_MS ? m.minute.rates : undefined;

export function resolveRates(m: MarketState): Resolved {
  const minute = minuteRates(m);
  const daily = m.daily?.rates;
  const rates: RateMap = { ...daily, USD: 1 };
  const source: Record<string, Freshness> = { USD: "live" };
  const time: Record<string, number> = {};
  const weekend = fxWeekend(m.now);

  for (const { code } of FX) {
    if (code === "USD") continue;
    const reference = minute?.[code] ?? daily?.[code];
    const tick = m.ticks[fxLegSymbol(code)!];
    const fresh = tick && tickTrusted(code, tick, reference) ? tickFreshness(tick, m.now, weekend) : undefined;
    if (tick && (fresh === "live" || fresh === "closed")) {
      rates[code] = legRate(code, tick);
      source[code] = fresh;
      time[code] = tick.time;
    } else if (minute?.[code]) {
      rates[code] = minute[code];
      source[code] = "minute";
      time[code] = m.minute!.at;
    } else if (tick && fresh === "stale") {
      rates[code] = legRate(code, tick);
      source[code] = "stale";
      time[code] = tick.time;
    } else if (daily?.[code]) {
      source[code] = m.daily!.source === "live" ? "daily" : "offline";
    } else {
      source[code] = "none";
    }
  }
  return { rates, source, time };
}

export interface Quote {
  price?: number;
  source: Freshness;
  time?: number;
}

/** USD price of a commodity or crypto instrument. */
export function spotQuote(inst: Instrument, m: MarketState): Quote {
  const tick = inst.liveSymbol ? m.ticks[inst.liveSymbol] : undefined;
  if (inst.kind === "crypto") {
    if (tick && m.now - tick.time < LIVE_AGE_MS) return { price: tick.mid, source: "live", time: tick.time };
    const r = minuteRates(m)?.[inst.code];
    if (r) return { price: 1 / r, source: "minute", time: m.minute!.at };
    return tick ? { price: tick.mid, source: "stale", time: tick.time } : { source: "none" };
  }
  if (inst.kind === "commodity") {
    const fresh = tick ? tickFreshness(tick, m.now, fxWeekend(m.now)) : undefined;
    if (tick && (fresh === "live" || fresh === "closed")) return { price: tick.mid, source: fresh, time: tick.time };
    const g = m.metals[inst.code];
    if (g) return { price: g.price, source: "minute", time: g.at };
    return tick ? { price: tick.mid, source: "stale", time: tick.time } : { source: "none" };
  }
  return { source: "none" };
}

/** Price and freshness of an FX pair, built from its two USD legs. */
export function fxQuote(base: string, quote: string, r: Resolved): Quote {
  const b = r.rates[base];
  const q = r.rates[quote];
  const source = worst(r.source[base] ?? "none", r.source[quote] ?? "none");
  if (!(b > 0) || !(q > 0)) return { source: "none" };
  const times = [r.time[base], r.time[quote]].filter((t): t is number => t !== undefined);
  return { price: q / b, source, time: times.length ? Math.min(...times) : undefined };
}
