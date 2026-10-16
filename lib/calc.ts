// lib/calc.ts
// Core position-size engine, reverse-engineered from com.blacktowerinvestments.stinu 5.7.3.
//
//   riskAmount     = balance × risk% / 100            (or the fixed amount entered)
//   pipValuePerLot = pipSize × contractSize × accountPerQuote
//   lots           = riskAmount / (stop × pipValuePerLot)
//   miniLots       = lots × 10,  units = lots × contractSize
//
// A pip is always worth pipSize × contractSize of the *quote* currency, so
// accountPerQuote converts it into the account currency.
// Reference (the app's own screenshot): EUR/USD, USD account, $10,550, 1.5% → $158.25,
// stop 24.2 pips → pip value $10/lot → 0.6539 lots = 6.539 mini lots.
//
// Crypto uses the same formula with pipSize 1 and contractSize 1, i.e. the stop is
// a price distance in USD and the result is a number of coins.

import { pairSpec, PairSpec } from "./instruments";

export type RiskMode = "percent" | "amount";

export interface CalcInput {
  balance: number;
  riskMode: RiskMode;
  riskPercent: number;   // when percent
  riskAmount: number;    // when amount (in account currency)
  /** stop loss: pips for FX/commodities, price distance in the quote currency for crypto */
  stop: number;
  accountCurrency: string;   // e.g. "USD"
  base: string;              // e.g. "EUR"
  quote: string;             // e.g. "USD"
  /** account-currency value of 1 unit of `quote`; undefined when no rate is available */
  accountPerQuote: number | undefined;
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

const EMPTY: CalcResult = { riskAmount: 0, pipValuePerLot: 0, lots: 0, miniLots: 0, units: 0, valid: false };

/** Pip value of one standard lot, in the account currency. */
export function pipValuePerLot(spec: PairSpec, accountPerQuote: number): number {
  return spec.pipSize * spec.contractSize * accountPerQuote;
}

export function calculate(input: CalcInput): CalcResult {
  const spec = pairSpec(input.base, input.quote);
  if (!spec) return { ...EMPTY, error: "Unsupported pair" };

  const riskAmount =
    input.riskMode === "percent"
      ? input.balance * (input.riskPercent / 100)
      : input.riskAmount;
  const fail = (error: string): CalcResult => ({ ...EMPTY, riskAmount: Number.isFinite(riskAmount) ? riskAmount : 0, error });

  if (!Number.isFinite(input.balance) || input.balance <= 0) return fail("Enter your account balance");
  if (input.riskMode === "percent" && input.riskPercent > 100) return fail("Risk can't be more than 100%");
  if (!Number.isFinite(riskAmount) || riskAmount <= 0) return fail("Enter a valid risk");
  if (riskAmount > input.balance) return fail("Risk is larger than your account balance");
  if (!Number.isFinite(input.stop) || input.stop <= 0) {
    return fail(spec.kind === "crypto" ? "Enter a stop-loss distance" : "Enter a stop-loss in pips");
  }
  const apq = input.accountPerQuote;
  if (apq === undefined || !Number.isFinite(apq) || apq <= 0) {
    return fail(`No exchange rate for ${input.quote} → ${input.accountCurrency}`);
  }

  const pv = pipValuePerLot(spec, apq);
  const lots = riskAmount / (input.stop * pv);
  return {
    riskAmount,
    pipValuePerLot: pv,
    lots,
    miniLots: lots * 10,
    units: lots * spec.contractSize,
    valid: true,
  };
}

export interface TableRow {
  stop: number;
  /** stop as displayed: whole numbers bare, finer steps at the anchor's precision */
  label: string;
  value: number;    // in the selected unit mode
  /** the row for the stop the user entered */
  anchor: boolean;
}

/** Decimal places of a number as typed (24.2 → 1, 1500 → 0, 5e-7 → 7), up to 10. */
export function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = n.toFixed(10).replace(/0+$/, "");
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

const ROWS = 9;

/**
 * Stop distances for the result screen's "nudge" list (adjust risk without
 * re-entering your details). Matches the original's layout — five whole-number
 * rows, then fine steps at the anchor's precision with the anchor second:
 *   anchor 24.2 → 20 21 22 23 24 · 24.1 [24.2] 24.3 24.4
 * The anchor is always in the list. Whole-number anchors are centred
 * (20 … [24] … 28); small anchors are padded upward to keep nine rows.
 */
export function tableStops(anchor: number): Omit<TableRow, "value">[] {
  if (!Number.isFinite(anchor) || anchor <= 0) return [];
  const d = decimalsOf(anchor);
  const scale = 10 ** d;
  const a = Math.round(anchor * scale); // the anchor, counted in steps of 1/scale
  const rows: { s: number; fine: boolean }[] = [];

  if (d === 0) {
    for (let s = a - 4; s <= a + 4; s++) if (s > 0) rows.push({ s, fine: false });
  } else {
    const fine = [a - 1, a, a + 1, a + 2].filter((s) => s > 0);
    const whole = Math.ceil(fine[0] / scale) - 1; // last whole number below the fine rows
    for (let w = whole - 4; w <= whole; w++) if (w > 0) rows.push({ s: w * scale, fine: false });
    for (const s of fine) rows.push({ s, fine: true });
  }
  while (rows.length < ROWS) {
    const last = rows[rows.length - 1];
    rows.push({ s: last.s + 1, fine: last.fine });
  }

  return rows.map(({ s, fine }) => ({
    stop: s / scale,
    label: fine ? (s / scale).toFixed(d) : String(s / scale),
    anchor: s === a,
  }));
}

/** Build the stop-loss → size table the app shows on the result screen. */
export function buildTable(input: CalcInput, unitMode: "lots" | "mini" | "units"): TableRow[] {
  return tableStops(input.stop).map((row) => {
    const r = calculate({ ...input, stop: row.stop });
    const value = unitMode === "lots" ? r.lots : unitMode === "mini" ? r.miniLots : r.units;
    return { ...row, value };
  });
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
