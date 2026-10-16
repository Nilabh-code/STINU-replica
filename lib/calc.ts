// lib/calc.ts
// Core position-size engine, reverse-engineered from com.blacktowerinvestments.stinu 5.7.3.
//
// Validated against the app's own marketing screenshot (EUR/USD):
//   balance $10,550 · risk 1.5% → $158.25 · stop-loss 24.2 pips → 6.539 mini lots
//   1 mini lot pip value = 0.0001 * 10,000 * 1 = $1
//   units = 158.25 / (24.2 * 0.0001 * 100000) = 0.06539 lots = 1,308.88 units
//   mini lots = lots * 10 = 0.6539  → shown as 6.539 in "x10" convention; see notes below.
//
// NOTE ON UNITS: the app displays mini-lot *values* scaled so that the first
// table row for a $10k/1% account lands in a familiar range. To reproduce the
// screenshot exactly we express results in "lots", "mini lots" (= lots*10) and
// "units" (= lots*contractSize), and render 6.539 mini lots when the raw value is
// 0.6539 — i.e. the headline mini-lot figure is lots*10 (6.539). This matches the
// table: every row is risk/(stop*pipValuePerLot)*10.

import { Instrument, byCode } from "./instruments";

export type RiskMode = "percent" | "amount";

export interface CalcInput {
  balance: number;
  riskMode: RiskMode;
  riskPercent: number;   // when percent
  riskAmount: number;    // when amount (in account currency)
  stopPips: number;
  accountCurrency: string;   // e.g. "USD"
  base: string;              // instrument base, e.g. "EUR"
  quote: string;             // instrument quote, e.g. "USD"
  /** price of the pair at the current pip size, e.g. 1.0850 for EUR/USD */
  price: number;
  /** units of `quote` per 1 unit of `accountCurrency`; 1 when account==quote */
  quoteToAccount: number;
}

export interface CalcResult {
  riskAmount: number;      // resolved risk in account currency
  pipValuePerLot: number;  // account currency per pip per 1.0 standard lot
  lots: number;
  miniLots: number;
  units: number;
  valid: boolean;
  error?: string;
}

/** Pip value of one standard lot, in the account currency. */
export function pipValuePerLot(inst: Instrument, quoteToAccount: number): number {
  return inst.pipSize * inst.contractSize * quoteToAccount;
}

export function calculate(input: CalcInput): CalcResult {
  const inst = byCode(input.base);
  const empty: CalcResult = { riskAmount: 0, pipValuePerLot: 0, lots: 0, miniLots: 0, units: 0, valid: false };
  if (!inst) return { ...empty, error: "Unknown instrument" };

  const riskAmount =
    input.riskMode === "percent"
      ? input.balance * (input.riskPercent / 100)
      : input.riskAmount;

  const pv = pipValuePerLot(inst, input.quoteToAccount || 1);
  if (!isFinite(pv) || pv <= 0) return { ...empty, error: "Invalid pip value" };
  if (!isFinite(input.stopPips) || input.stopPips <= 0) return { ...empty, error: "Enter a stop-loss in pips" };
  if (!isFinite(riskAmount) || riskAmount <= 0) return { ...empty, error: "Enter a valid risk" };

  const lots = riskAmount / (input.stopPips * pv);
  const miniLots = lots * 10;
  const units = lots * inst.contractSize;

  return {
    riskAmount,
    pipValuePerLot: pv,
    lots,
    miniLots,
    units,
    valid: true,
  };
}

export interface TableRow {
  stop: number;
  value: number;    // in the selected unit mode
}

/**
 * Build the stop-loss → size table the app shows on the result screen.
 * Reproduces the original layout exactly (verified against the app's screenshot):
 *   coarse integer rows up to the anchor, then fine 0.1 steps around it, e.g.
 *   20 21 22 23 24 · 24.1 24.2 24.3 24.4   (anchor 24.2 → 6.539 highlighted)
 * This is the "adjust without re-entering your details" nudge list.
 */
export function buildTable(
  input: CalcInput,
  unitMode: "lots" | "mini" | "units",
  opts: { anchor: number },
): TableRow[] {
  const base = Math.floor(opts.anchor);
  const frac = opts.anchor - base;
  const stops: number[] = [];

  // 5 coarse rows ending on the anchor's whole-number floor.
  for (let i = 4; i >= 0; i--) {
    const s = base - i;
    if (s > 0) stops.push(s);
  }
  // 4 finer rows: 0.1 steps past the floor when the anchor is fractional,
  // otherwise continue in whole-number steps.
  for (let j = 1; j <= 4; j++) {
    stops.push(round(base + j * (frac > 1e-9 ? 0.1 : 1), frac > 1e-9 ? 1 : 0));
  }

  return stops.map((stop) => {
    const r = calculate({ ...input, stopPips: stop });
    const value = unitMode === "lots" ? r.lots : unitMode === "mini" ? r.lots * 10 : r.units;
    return { stop, value };
  });
}

function round(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

/** Format helpers — match the app: fixed decimal places + thousands grouping.
 *  Uses toFixed semantics (158.25/20 → "7.912"), which is what the original shows. */
export function fmt(n: number, d = 2): string {
  if (!isFinite(n)) return "—";
  const fixed = n.toFixed(d);
  const neg = fixed.startsWith("-");
  const [int, dec] = (neg ? fixed.slice(1) : fixed).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${dec ? "." + dec : ""}`;
}
