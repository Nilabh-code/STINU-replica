import { describe, expect, it } from "vitest";
import { byCode } from "./instruments";
import { fxQuote, fxWeekend, legRate, MarketState, resolveRates, spotQuote, Tick, tickTrusted } from "./market";
import type { RateSnapshot } from "./prices";

const WED = Date.parse("2026-10-14T12:00:00Z");
const SAT = Date.parse("2026-10-17T12:00:00Z");
const DAILY: RateSnapshot = { rates: { USD: 1, EUR: 0.9, JPY: 150, INR: 95, GBP: 0.75 }, source: "live", asOf: "2026-10-13", provider: "test" };

const tick = (symbol: string, mid: number, time: number, spread = mid * 0.0001, extra: Partial<Tick> = {}): Tick => ({
  symbol, mid, bid: mid - spread / 2, ask: mid + spread / 2, time, ...extra,
});

function state(over: Partial<MarketState> = {}): MarketState {
  return { daily: DAILY, minute: null, ticks: {}, metals: {}, now: WED, ...over };
}

describe("fx legs", () => {
  it("orients USD legs", () => {
    expect(legRate("EUR", tick("EURUSD", 1.125, WED))).toBeCloseTo(1 / 1.125, 10);
    expect(legRate("JPY", tick("USDJPY", 158, WED))).toBe(158);
  });

  it("rejects wide spreads and quotes far from the reference", () => {
    expect(tickTrusted("JPY", tick("USDJPY", 151, WED), 150)).toBe(true);
    expect(tickTrusted("JPY", tick("USDJPY", 151, WED, 151 * 0.02), 150)).toBe(false); // 2% spread
    expect(tickTrusted("INR", tick("USDINR", 103.55, WED), 95)).toBe(false); // 9% off the reference
  });
});

describe("resolveRates", () => {
  it("prefers a fresh trusted tick", () => {
    const r = resolveRates(state({ ticks: { USDJPY: tick("USDJPY", 151, WED - 5_000) } }));
    expect(r.rates.JPY).toBe(151);
    expect(r.source.JPY).toBe("live");
  });

  it("falls back to Coinbase when the tick is untrustworthy", () => {
    const r = resolveRates(state({
      ticks: { USDINR: tick("USDINR", 103.55, WED) },
      minute: { rates: { INR: 94.96 }, at: WED - 30_000 },
    }));
    expect(r.rates.INR).toBe(94.96);
    expect(r.source.INR).toBe("minute");
  });

  it("keeps the last tick over the weekend and calls the market closed", () => {
    const friday = Date.parse("2026-10-16T20:58:00Z");
    const r = resolveRates(state({
      now: SAT,
      ticks: { EURUSD: tick("EURUSD", 1.12, friday) },
      minute: { rates: { EUR: 0.8929 }, at: SAT - 10_000 },
    }));
    expect(r.rates.EUR).toBeCloseTo(1 / 1.12, 10);
    expect(r.source.EUR).toBe("closed");
    expect(r.time.EUR).toBe(friday);
  });

  it("prefers Coinbase over a stalled stream mid-week", () => {
    const r = resolveRates(state({
      ticks: { USDJPY: tick("USDJPY", 151, WED - 10 * 60_000) },
      minute: { rates: { JPY: 150.5 }, at: WED - 20_000 },
    }));
    expect(r.source.JPY).toBe("minute");
    expect(r.rates.JPY).toBe(150.5);
  });

  it("uses a stalled tick when nothing fresher exists", () => {
    const r = resolveRates(state({ ticks: { USDJPY: tick("USDJPY", 151, WED - 10 * 60_000) } }));
    expect(r.source.JPY).toBe("stale");
  });

  it("ignores Coinbase rates older than 10 minutes", () => {
    const r = resolveRates(state({ minute: { rates: { JPY: 140 }, at: WED - 11 * 60_000 } }));
    expect(r.rates.JPY).toBe(150);
    expect(r.source.JPY).toBe("daily");
  });

  it("labels the bundled snapshot as offline", () => {
    const r = resolveRates(state({ daily: { ...DAILY, source: "offline" } }));
    expect(r.source.EUR).toBe("offline");
  });

  it("knows nothing before any source has answered", () => {
    const r = resolveRates(state({ daily: null }));
    expect(r.rates.EUR).toBeUndefined();
    expect(r.source.EUR).toBe("none");
    expect(r.rates.USD).toBe(1);
  });
});

describe("fxQuote", () => {
  it("builds crosses from USD legs and reports the weaker leg", () => {
    const r = resolveRates(state({ ticks: { USDJPY: tick("USDJPY", 151, WED) } }));
    const q = fxQuote("GBP", "JPY", r); // GBP daily, JPY live
    expect(q.price).toBeCloseTo(151 / 0.75, 8);
    expect(q.source).toBe("daily");
  });
});

describe("spotQuote", () => {
  const btc = byCode("BTC")!;
  const xau = byCode("XAU")!;

  it("crypto: Binance tick, else Coinbase", () => {
    expect(spotQuote(btc, state({ ticks: { BTCUSDT: tick("BTCUSDT", 81594, WED - 1000) } }))).toMatchObject({ price: 81594, source: "live" });
    const q = spotQuote(btc, state({ minute: { rates: { BTC: 1 / 80000 }, at: WED } }));
    expect(q.source).toBe("minute");
    expect(q.price).toBeCloseTo(80000, 6);
    expect(spotQuote(btc, state()).source).toBe("none");
  });

  it("metals: biquote tick, closed at the weekend, else gold-api", () => {
    const friday = Date.parse("2026-10-16T20:57:00Z");
    expect(spotQuote(xau, state({ now: SAT, ticks: { XAUUSD: tick("XAUUSD", 4164.27, friday) } })).source).toBe("closed");
    expect(spotQuote(xau, state({ metals: { XAU: { price: 4168.1, at: WED } } }))).toMatchObject({ price: 4168.1, source: "minute" });
  });
});

describe("fxWeekend", () => {
  it("follows the Friday 21:00 – Sunday 21:00 UTC close", () => {
    expect(fxWeekend(WED)).toBe(false);
    expect(fxWeekend(SAT)).toBe(true);
    expect(fxWeekend(Date.parse("2026-10-16T20:00:00Z"))).toBe(false);
    expect(fxWeekend(Date.parse("2026-10-16T21:30:00Z"))).toBe(true);
    expect(fxWeekend(Date.parse("2026-10-18T20:00:00Z"))).toBe(true);
    expect(fxWeekend(Date.parse("2026-10-18T21:30:00Z"))).toBe(false);
  });
});
