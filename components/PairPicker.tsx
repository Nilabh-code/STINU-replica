"use client";
// components/PairPicker.tsx — three-tab currency/instrument selector.
// Tabs: FX (major + exotic), Commodity, Crypto — matching the app's logo grid.
import { useState } from "react";
import { FX, COMMODITIES, CRYPTO, Instrument } from "@/lib/instruments";
import { IconClose, IconSearch } from "./icons";

type Tab = "fx" | "commodity" | "crypto";
const TABS: { id: Tab; label: string }[] = [
  { id: "fx", label: "Forex (FX)" },
  { id: "commodity", label: "Commodity" },
  { id: "crypto", label: "Crypto" },
];

interface Props {
  onPick: (inst: Instrument) => void;
  onClose: () => void;
}

export default function PairPicker({ onPick, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("fx");
  const [q, setQ] = useState("");

  const list: Instrument[] =
    tab === "fx" ? FX : tab === "commodity" ? COMMODITIES : CRYPTO;
  const filtered = list.filter(
    (i) =>
      i.code.toLowerCase().includes(q.toLowerCase()) ||
      i.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade" onClick={onClose}>
      <div
        className="animate-sheet w-full max-w-md rounded-t-[28px] bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header-slant flex items-center gap-3 rounded-t-[28px] px-5 pb-9 pt-5 text-white">
          <button onClick={onClose} aria-label="Close" className="opacity-90">
            <IconClose />
          </button>
          <div className="text-lg font-semibold tracking-wide">Select Instrument</div>
        </div>

        <div className="px-5">
          <div className="-mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
            <IconSearch width={18} height={18} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search currencies"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>

          <div className="mt-4 flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? "bg-navy text-white" : "bg-white text-ink-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid max-h-[46vh] grid-cols-3 gap-3 overflow-y-auto px-5 py-5 no-scrollbar">
          {filtered.map((i) => (
            <button
              key={i.code}
              disabled={!i.enabled}
              onClick={() => i.enabled && onPick(i)}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl shadow-sm transition ${
                i.enabled
                  ? "bg-white text-ink hover:bg-navy hover:text-white"
                  : "cursor-not-allowed bg-white/50 text-muted"
              }`}
            >
              <span className="text-base font-semibold tracking-widest">{i.code}</span>
              <span className="mt-0.5 text-[10px] opacity-70">{i.kind === "fx" ? "FX" : i.kind === "commodity" ? "CMD" : "CRYPTO"}</span>
            </button>
          ))}
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
