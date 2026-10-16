"use client";
// components/ResultSheet.tsx — the result screen: cards + the stop-loss/lots table.
import { CalcInput, CalcResult, buildTable, fmt } from "@/lib/calc";
import { symbol, UnitMode, UNIT_LABELS } from "@/lib/instruments";
import { IconClose } from "./icons";

interface Props {
  input: CalcInput;
  result: CalcResult;
  unitMode: UnitMode;
  onUnitMode: (m: UnitMode) => void;
  onClose: () => void;
  balanceLabel: string;
}

export default function ResultSheet({ input, result, unitMode, onUnitMode, onClose, balanceLabel }: Props) {
  // Exact nudge list from the original app: integers up to the anchor, then 0.1 steps.
  const rows = buildTable(input, unitMode, { anchor: input.stopPips });
  const colLabel = unitMode === "lots" ? "LOTS" : unitMode === "mini" ? "MINI LOTS" : "UNITS";
  const unitDp = unitMode === "units" ? 0 : 3;
  const cur = symbol(input.accountCurrency);
  const pair = `${input.base}/${input.quote}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade" onClick={onClose}>
      <div
        className="animate-sheet flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
          {(Object.keys(UNIT_LABELS) as UnitMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onUnitMode(m)}
              className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                unitMode === m ? "bg-navy text-white" : "bg-black/5 text-ink-soft"
              }`}
            >
              {UNIT_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-2 border-b border-black/10 bg-white text-center text-xs font-bold uppercase tracking-wider text-ink">
          <div className="py-2">Stop Loss</div>
          <div className="border-l border-black/5 py-2">{colLabel}</div>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto no-scrollbar">
          {rows.map((r, idx) => {
            const selected = Math.abs(r.stop - input.stopPips) < 1e-9;
            const zebra = !selected && idx % 2 === 0 ? "bg-black/[0.03]" : "";
            return (
              <div key={idx} className="grid grid-cols-2 text-center">
                <div
                  className={`py-2.5 ${
                    selected ? "bg-sel font-bold text-white" : `text-ink ${zebra}`
                  }`}
                >
                  {r.stop}
                </div>
                <div
                  className={`py-2.5 ${
                    selected
                      ? "bg-sel font-bold text-white"
                      : `border-l border-black/5 text-muted ${zebra}`
                  }`}
                >
                  {fmt(r.value, unitDp)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        <div className="grid grid-cols-3 gap-px bg-black/5 text-center text-xs">
          <div className="bg-white py-2">
            <div className="text-muted">Pip value / lot</div>
            <div className="font-semibold text-ink">
              {cur}
              {fmt(result.pipValuePerLot, 2)}
            </div>
          </div>
          <div className="bg-white py-2">
            <div className="text-muted">{balanceLabel}</div>
            <div className="font-semibold text-ink">
              {cur}
              {fmt(input.balance, 0)}
            </div>
          </div>
          <div className="bg-white py-2">
            <div className="text-muted">Units</div>
            <div className="font-semibold text-ink">{fmt(result.units, 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
