// lib/store.ts — the user's inputs and preferences, remembered in localStorage.
// Read through useSyncExternalStore so the prerendered HTML (defaults) hydrates
// cleanly before the saved values take over.

import { useSyncExternalStore } from "react";
import { pairSpec, UnitMode, BASE_CURRENCIES, Pair } from "./instruments";
import type { RiskMode } from "./calc";

export interface Settings {
  balance: string;
  riskMode: RiskMode;
  riskPct: string;
  riskAmt: string;
  stop: string;
  base: string;
  quote: string;
  account: string;
  unitMode: UnitMode;
  favs: Pair[];
}

export const DEFAULTS: Settings = {
  balance: "10550",
  riskMode: "percent",
  riskPct: "1.5",
  riskAmt: "150",
  stop: "24.2",
  base: "EUR",
  quote: "USD",
  account: "USD",
  unitMode: "mini",
  favs: [
    { base: "EUR", quote: "USD" },
    { base: "GBP", quote: "USD" },
  ],
};

const KEY = "stinu:v1";
const NUMERIC = /^\d{0,12}(\.\d{0,10})?$/;

/** Keep only well-formed saved values; anything else falls back to the default. */
function sanitize(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return DEFAULTS;
  const r = raw as Record<string, unknown>;
  const num = (k: "balance" | "riskPct" | "riskAmt" | "stop") =>
    typeof r[k] === "string" && NUMERIC.test(r[k] as string) ? (r[k] as string) : DEFAULTS[k];
  const pairOk = (p: unknown): p is Pair =>
    !!p && typeof p === "object" &&
    typeof (p as Pair).base === "string" && typeof (p as Pair).quote === "string" &&
    !!pairSpec((p as Pair).base, (p as Pair).quote);
  const pair = pairOk({ base: r.base, quote: r.quote }) ? { base: r.base as string, quote: r.quote as string } : DEFAULTS;

  return {
    balance: num("balance"),
    riskPct: num("riskPct"),
    riskAmt: num("riskAmt"),
    stop: num("stop"),
    riskMode: r.riskMode === "amount" ? "amount" : "percent",
    base: pair.base,
    quote: pair.quote,
    account: typeof r.account === "string" && BASE_CURRENCIES.includes(r.account) ? r.account : DEFAULTS.account,
    unitMode: r.unitMode === "lots" || r.unitMode === "units" || r.unitMode === "mini" ? r.unitMode : DEFAULTS.unitMode,
    favs: Array.isArray(r.favs) ? r.favs.filter(pairOk).map(({ base, quote }) => ({ base, quote })) : DEFAULTS.favs,
  };
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): Settings {
  if (!current) current = read();
  return current;
}

function getServerSettings(): Settings {
  return DEFAULTS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...getSettings(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage blocked (private mode etc.) — keep working in memory
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getServerSettings);
}
