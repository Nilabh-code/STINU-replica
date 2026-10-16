"use client";
// lib/useMarket.ts — keeps every price source running and returns one MarketState.
import { useEffect, useMemo, useRef, useState } from "react";
import { BinanceStream, BiquoteStream } from "./feeds";
import type { MarketState, Tick } from "./market";
import { loadMetalSpot, loadMinuteRates, loadRates, RateMap, RateSnapshot } from "./prices";

export interface Wanted {
  /** biquote.io symbols: FX USD legs and commodities */
  biquote: string[];
  /** Binance symbols, e.g. BTCUSDT */
  binance: string[];
  /** metals that may need the gold-api.com fallback */
  metals: string[];
}

const DAILY_REFRESH_MS = 10 * 60_000; // daily reference rates barely move
const MINUTE_REFRESH_MS = 60_000;     // Coinbase caches for ~60 s
const METAL_REFRESH_MS = 60_000;
const TICK_FLUSH_MS = 250;            // batch stream ticks into ≤4 renders a second

export function useMarket(want: Wanted): MarketState {
  const [daily, setDaily] = useState<RateSnapshot | null>(null);
  const [minute, setMinute] = useState<{ rates: RateMap; at: number } | null>(null);
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [metals, setMetals] = useState<Record<string, { price: number; at: number }>>({});
  const [now, setNow] = useState(0);
  const streams = useRef<{ biquote: BiquoteStream; binance: BinanceStream } | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  useEffect(() => poll(loadRates, (r) => setDaily(r), DAILY_REFRESH_MS), []);
  useEffect(
    () =>
      poll(
        loadMinuteRates,
        (r) => {
          if (r) setMinute({ rates: r, at: Date.now() });
        },
        MINUTE_REFRESH_MS,
      ),
    [],
  );

  useEffect(() => {
    let pending: Record<string, Tick> = {};
    let flush: ReturnType<typeof setTimeout> | undefined;
    const onTicks = (list: Tick[]) => {
      for (const t of list) pending[t.symbol] = t;
      flush ??= setTimeout(() => {
        const batch = pending;
        pending = {};
        flush = undefined;
        setTicks((prev) => ({ ...prev, ...batch }));
      }, TICK_FLUSH_MS);
    };
    const s = { biquote: new BiquoteStream(onTicks), binance: new BinanceStream(onTicks) };
    streams.current = s;
    return () => {
      s.biquote.dispose();
      s.binance.dispose();
      clearTimeout(flush);
      streams.current = null;
    };
  }, []);

  const biquoteKey = want.biquote.join(",");
  const binanceKey = want.binance.join(",");
  const metalsKey = want.metals.join(",");
  useEffect(() => streams.current?.biquote.setSymbols(split(biquoteKey)), [biquoteKey]);
  useEffect(() => streams.current?.binance.setSymbols(split(binanceKey)), [binanceKey]);

  useEffect(() => {
    const codes = split(metalsKey);
    if (!codes.length) return;
    return poll(
      () => Promise.all(codes.map(async (c) => [c, await loadMetalSpot(c)] as const)),
      (list) =>
        setMetals((prev) => {
          const next = { ...prev };
          for (const [c, price] of list) if (price) next[c] = { price, at: Date.now() };
          return next;
        }),
      METAL_REFRESH_MS,
    );
  }, [metalsKey]);

  return useMemo(() => ({ daily, minute, ticks, metals, now }), [daily, minute, ticks, metals, now]);
}

const split = (key: string) => (key ? key.split(",") : []);

/** Run `load` now and every `ms`, handing results to `apply` until cleaned up. */
function poll<T>(load: () => Promise<T>, apply: (v: T) => void, ms: number): () => void {
  let alive = true;
  const run = () =>
    load().then((v) => {
      if (alive) apply(v);
    });
  run();
  const id = setInterval(run, ms);
  return () => {
    alive = false;
    clearInterval(id);
  };
}
