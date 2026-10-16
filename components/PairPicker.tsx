"use client";
// components/PairPicker.tsx — three-tab instrument selector.
// Forex: tap two currencies ("your pair in two taps") or one of the popular pairs;
// the pair is oriented the way the market quotes it (USD + JPY → USD/JPY).
// Commodity / Crypto: one tap, quoted against USD.
import { useState } from "react";
import { FX, COMMODITIES, CRYPTO, Instrument, Pair, byCode, normalizePair } from "@/lib/instruments";
import { IconClose, IconSearch } from "./icons";
import Sheet from "./Sheet";

type Tab = "fx" | "commodity" | "crypto";
const TABS: { id: Tab; label: string }[] = [
  { id: "fx", label: "Forex (FX)" },
  { id: "commodity", label: "Commodity" },
  { id: "crypto", label: "Crypto" },
];

const POPULAR: Pair[] = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/CHF", "EUR/AUD", "GBP/CHF",
  "USD/INR", "USD/ZAR", "USD/TRY", "USD/MXN", "USD/SGD", "USD/CNH",
].map((p) => {
  const [base, quote] = p.split("/");
  return { base, quote };
});

interface Props {
  current: Pair;
  onPick: (pair: Pair) => void;
  onClose: () => void;
}

export default function PairPicker({ current, onPick, onClose }: Props) {
  const [tab, setTab] = useState<Tab>((byCode(current.base)?.kind as Tab) ?? "fx");
  const [q, setQ] = useState("");
  const [first, setFirst] = useState<string | null>(null);

  const list: Instrument[] = tab === "fx" ? FX : tab === "commodity" ? COMMODITIES : CRYPTO;
  const needle = q.trim().toLowerCase();
  const filtered = list.filter(
    (i) => i.code.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle),
  );
  const popular = POPULAR.filter((p) => `${p.base}/${p.quote}`.toLowerCase().includes(needle.replace(/\s/g, "")));

  const tap = (i: Instrument) => {
    if (i.kind !== "fx") return onPick({ base: i.code, quote: "USD" });
    if (!first) return setFirst(i.code);
    if (first === i.code) return setFirst(null);
    onPick(normalizePair(first, i.code));
  };

  return (
    <Sheet label="Select Instrument" onClose={onClose} className="bg-paper">
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
            aria-label="Search currencies"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setFirst(null); }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t.id ? "bg-navy text-white" : "bg-white text-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "fx" && (
          <>
            <p className="mt-3 text-center text-xs text-muted" aria-live="polite">
              {first ? `${first} / … — now pick the second currency` : "Pick two currencies, or a popular pair"}
            </p>
            {!first && popular.length > 0 && (
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                {popular.map((p) => (
                  <button
                    key={`${p.base}${p.quote}`}
                    onClick={() => onPick(p)}
                    className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-ink shadow-sm hover:bg-navy hover:text-white"
                  >
                    {p.base}/{p.quote}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid max-h-[46vh] grid-cols-3 gap-3 overflow-y-auto px-5 py-5 no-scrollbar">
        {filtered.map((i) => (
          <button
            key={i.code}
            disabled={!i.enabled}
            aria-pressed={first === i.code}
            onClick={() => tap(i)}
            className={`flex aspect-square flex-col items-center justify-center rounded-2xl shadow-sm transition ${
              !i.enabled
                ? "cursor-not-allowed bg-white/50 text-muted"
                : first === i.code
                ? "bg-navy text-white"
                : "bg-white text-ink hover:bg-navy hover:text-white"
            }`}
          >
            <span className="text-base font-semibold tracking-widest">{i.code}</span>
            <span className="mt-0.5 text-[10px] opacity-70">{i.kind === "fx" ? "FX" : i.kind === "commodity" ? "CMD" : "CRYPTO"}</span>
          </button>
        ))}
      </div>
      <div className="h-4" />
    </Sheet>
  );
}
