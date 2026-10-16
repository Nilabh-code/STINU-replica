"use client";
// components/BaseCurrencySheet.tsx — "Account Base / Select your base currency".
import { BASE_CURRENCIES, symbol } from "@/lib/instruments";
import { IconClose } from "./icons";

interface Props {
  current: string;
  onPick: (code: string) => void;
  onClose: () => void;
}

export default function BaseCurrencySheet({ current, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade" onClick={onClose}>
      <div
        className="animate-sheet w-full max-w-md rounded-t-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header-slant flex items-center gap-3 rounded-t-[28px] px-5 pb-9 pt-5 text-white">
          <button onClick={onClose} aria-label="Close" className="opacity-90">
            <IconClose />
          </button>
          <div className="text-lg font-semibold tracking-wide">Account Base</div>
        </div>
        <div className="px-5 pt-2">
          <p className="text-center text-sm text-muted">Select your base currency</p>
        </div>
        <div className="grid grid-cols-3 gap-3 px-5 py-6">
          {BASE_CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-lg font-semibold tracking-widest transition ${
                c === current
                  ? "border-transparent bg-sel text-white"
                  : "border-black/5 bg-white text-ink-soft hover:bg-black/5"
              }`}
            >
              {c}
              <span className="mt-0.5 text-[10px] font-normal opacity-60">{symbol(c)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
