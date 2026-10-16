"use client";
// components/ResultSheet.tsx — the result screen: cards + the stop-loss/lots table.
import { CalcInput, CalcResult, buildTable, decimalsOf, fmt } from "@/lib/calc";
import { Kind, symbol, UnitMode, UNIT_LABELS } from "@/lib/instruments";
import { IconClose } from "./icons";
import Sheet from "./Sheet";

interface Props {
  input: CalcInput;
  result: CalcResult;
  kind: Kind;
  unitMode: UnitMode;
  onUnitMode: (m: UnitMode) => void;
  onClose: () => void;
}

/** Coins can be fractions of a unit, so crypto sizes keep more decimals as they shrink. */
function cryptoDp(v: number): number {
  return v >= 1000 ? 2 : v >= 1 ? 4 : 6;
}

export default function ResultSheet({ input, result, kind, unitMode, onUnitMode, onClose }: Props) {
  // Crypto sizes are coins: lots / mini lots don't apply.
  const modes: UnitMode[] = kind === "crypto" ? ["units"] : (Object.keys(UNIT_LABELS) as UnitMode[]);
  const mode = modes.includes(unitMode) ? unitMode : "units";
  const rows = buildTable(input, mode);
  const colLabel = mode === "lots" ? "LOTS" : mode === "mini" ? "MINI LOTS" : "UNITS";
  const dp = (v: number) => (kind === "crypto" ? cryptoDp(v) : mode === "units" ? 0 : 3);
  const cur = symbol(input.accountCurrency);
  const pair = `${input.base}/${input.quote}`;

  return (
    <Sheet label="Position size" onClose={onClose} className="flex max-h-[92vh] flex-col overflow-hidden bg-white">
      {/* Two-tone header: teal left / navy right, split by a diagonal seam */}
      <div className="relative overflow-hidden bg-navy-deep text-white">
        <div
          className="absolute inset-0 bg-teal"
          style={{ clipPath: "polygon(0 0, 58% 0, 40% 100%, 0 100%)" }}
        />
        <div className="relative flex items-stretch">
          <div className="flex-1 px-5 py-5">
            <button onClick={onClose} aria-label="Close" className="opacity-90">
              <IconClose />
            </button>
            <div className="mt-3 text-sm text-white/60">Risk</div>
            <div className="text-2xl font-bold">
              {input.riskMode === "percent" ? `${input.riskPercent}%` : `${cur}${fmt(input.riskAmount, 2)}`}
            </div>
            <div className="mt-2 text-sm text-white/60">Risk Amount</div>
            <div className="text-3xl font-bold">
              {cur}
              {fmt(result.riskAmount, 2)}
            </div>
          </div>
          <div className="flex-1 px-5 pb-5 pt-16 text-right">
            <div className="text-sm text-white/60">Currency Pair</div>
            <div className="text-3xl">{pair}</div>
          </div>
        </div>
      </div>

      {/* Unit toggle */}
      <div className="flex items-center justify-center gap-2 border-b border-black/5 py-2">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onUnitMode(m)}
            aria-pressed={mode === m}
            className={`rounded-full px-4 py-1 text-xs font-medium transition ${
              mode === m ? "bg-navy text-white" : "bg-black/5 text-ink-soft"
            }`}
          >
            {UNIT_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-2 border-b border-black/10 bg-white text-center text-xs font-bold uppercase tracking-wider text-ink">
        <div className="py-2">{kind === "crypto" ? `Stop Loss (${input.quote})` : "Stop Loss"}</div>
        <div className="border-l border-black/5 py-2">{colLabel}</div>
      </div>

      {/* Rows */}
      <div className="overflow-y-auto no-scrollbar">
        {rows.map((r, idx) => {
          const zebra = !r.anchor && idx % 2 === 0 ? "bg-black/[0.03]" : "";
          return (
            <div key={r.label} className="grid grid-cols-2 text-center" aria-current={r.anchor || undefined}>
              <div className={`py-2.5 ${r.anchor ? "bg-sel font-bold text-white" : `text-ink ${zebra}`}`}>
                {r.label}
              </div>
              <div
                className={`py-2.5 ${
                  r.anchor ? "bg-sel font-bold text-white" : `border-l border-black/5 text-muted ${zebra}`
                }`}
              >
                {fmt(r.value, dp(r.value))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="grid grid-cols-3 gap-px bg-black/5 text-center text-xs">
        <div className="bg-white py-2">
          {kind === "crypto" ? (
            <>
              <div className="text-muted">Stop distance</div>
              <div className="font-semibold text-ink">{fmt(input.stop, Math.max(2, decimalsOf(input.stop)))} {input.quote}</div>
            </>
          ) : (
            <>
              <div className="text-muted">Pip value / lot</div>
              <div className="font-semibold text-ink">
                {cur}
                {fmt(result.pipValuePerLot, 2)}
              </div>
            </>
          )}
        </div>
        <div className="bg-white py-2">
          <div className="text-muted">Balance</div>
          <div className="font-semibold text-ink">
            {cur}
            {fmt(input.balance, 0)}
          </div>
        </div>
        <div className="bg-white py-2">
          <div className="text-muted">Units</div>
          <div className="font-semibold text-ink">{fmt(result.units, kind === "crypto" ? cryptoDp(result.units) : 0)}</div>
        </div>
      </div>
    </Sheet>
  );
}
