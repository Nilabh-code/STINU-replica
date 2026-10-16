"use client";
// app/page.tsx — STINU clone: home calculator + result table.
import { useEffect, useMemo, useState } from "react";
import Keypad from "@/components/Keypad";
import PairPicker from "@/components/PairPicker";
import BaseCurrencySheet from "@/components/BaseCurrencySheet";
import ResultSheet from "@/components/ResultSheet";
import { calculate, CalcInput, fmt } from "@/lib/calc";
import { byCode, fxLegSymbol, pairSpec, Pair, symbol, UnitMode } from "@/lib/instruments";
import { accountPerQuote } from "@/lib/prices";
import { Freshness, fxQuote, MarketState, Quote, Resolved, resolveRates, spotQuote, worst } from "@/lib/market";
import { useMarket, Wanted } from "@/lib/useMarket";
import { applyKey, Key, keyFromKeyboard } from "@/lib/keypad";
import { DEFAULTS, updateSettings as set, useSettings } from "@/lib/store";
import { IconCalculator, IconStar, IconStarFilled, IconBook, IconGear, IconSwap } from "@/components/icons";

type Field = "balance" | "risk" | "stop";
type Tab = "calc" | "favs" | "learn" | "settings";

const FIELDS: Field[] = ["balance", "risk", "stop"];

export default function Home() {
  // Inputs and preferences are remembered between visits (lib/store.ts).
  const s = useSettings();
  const [tab, setTab] = useState<Tab>("calc");

  // ── prices: stream what's on screen (pair, account currency, favourites) ─
  const want = useMemo(
    () => wantedFor([{ base: s.base, quote: s.quote }, ...s.favs], s.account),
    [s.base, s.quote, s.favs, s.account],
  );
  const market = useMarket(want);
  const resolved = useMemo(() => resolveRates(market), [market]);

  // ── active field + sheets ──────────────────────────────────────────────
  const [field, setField] = useState<Field>("balance");
  const [showPair, setShowPair] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // ── computed ───────────────────────────────────────────────────────────
  const spec = pairSpec(s.base, s.quote);
  const isCrypto = spec?.kind === "crypto";
  const apq = accountPerQuote(resolved.rates, s.quote, s.account);
  const cur = symbol(s.account);
  const pairLabel = `${s.base}/${s.quote}`;

  const input: CalcInput = useMemo(
    () => ({
      balance: parseFloat(s.balance) || 0,
      riskMode: s.riskMode,
      riskPercent: parseFloat(s.riskPct) || 0,
      riskAmount: parseFloat(s.riskAmt) || 0,
      stop: parseFloat(s.stop) || 0,
      accountCurrency: s.account,
      base: s.base,
      quote: s.quote,
      accountPerQuote: apq,
    }),
    [s.balance, s.riskMode, s.riskPct, s.riskAmt, s.stop, s.account, s.base, s.quote, apq],
  );
  const result = useMemo(() => calculate(input), [input]);
  const waitingForRates = apq === undefined && !market.daily && !market.minute;
  const conversion: Freshness =
    s.quote === s.account ? "live" : worst(resolved.source[s.quote] ?? "none", resolved.source[s.account] ?? "none");

  // ── keypad input (on-screen and physical keyboard share the same rules) ─
  const maxDecimals: Record<Field, number> = { balance: 2, risk: 2, stop: spec?.stopDecimals ?? 1 };
  const valueOf = (f: Field): string =>
    f === "balance" ? s.balance : f === "risk" ? (s.riskMode === "percent" ? s.riskPct : s.riskAmt) : s.stop;
  const setValueOf = (f: Field, v: string) => {
    if (f === "balance") set({ balance: v });
    else if (f === "risk") set(s.riskMode === "percent" ? { riskPct: v } : { riskAmt: v });
    else set({ stop: v });
  };
  const press = (k: Key) => setValueOf(field, applyKey(valueOf(field), k, { maxDecimals: maxDecimals[field] }));

  const sheetOpen = showPair || showBase || showResult;
  useEffect(() => {
    if (tab !== "calc" || sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea")) return;
      if (e.key === "Enter") {
        if (t?.closest("button, [role=button]")) return; // let the focused control handle it
        if (result.valid) {
          e.preventDefault();
          setShowResult(true);
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : FIELDS.length - 1;
        setField(FIELDS[(FIELDS.indexOf(field) + step) % FIELDS.length]);
        return;
      }
      const k = keyFromKeyboard(e.key);
      if (k) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── actions ────────────────────────────────────────────────────────────
  const swapPair = () => set({ base: s.quote, quote: s.base });

  const isFav = s.favs.some((f) => f.base === s.base && f.quote === s.quote);
  const toggleFav = () =>
    set({
      favs: isFav
        ? s.favs.filter((f) => !(f.base === s.base && f.quote === s.quote))
        : [...s.favs, { base: s.base, quote: s.quote }],
    });

  const choosePair = (p: Pair) => {
    set({ base: p.base, quote: p.quote });
    setShowPair(false);
  };

  const applyFav = (f: Pair) => {
    set({ base: f.base, quote: f.quote });
    setTab("calc");
  };

  // ── header status line ─────────────────────────────────────────────────
  const quote = quoteFor({ base: s.base, quote: s.quote }, market, resolved);
  const status = statusLine(quote, spec?.priceDecimals ?? 2, spec?.kind === "fx" ? "" : "$", market);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden app-bg">
      {/* top bar */}
      <header className="header-slant px-5 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowBase(true)} className="flex items-center gap-2 text-left">
            <span className="text-xs uppercase tracking-widest text-white/60">Account Base</span>
            <span className="text-lg font-bold">{s.account}</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={toggleFav} aria-label="Favourite" aria-pressed={isFav} className="opacity-90">
              {isFav ? <IconStarFilled width={22} height={22} /> : <IconStar width={22} height={22} />}
            </button>
          </div>
        </div>

        {/* pair selector */}
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setShowPair(true)} className="flex-1 text-left">
            <div className="text-sm text-white/60">Currency Pair</div>
            <div className="text-3xl font-light tracking-wide">{pairLabel}</div>
          </button>
          {spec?.kind === "fx" && (
            <button
              onClick={swapPair}
              aria-label="Swap"
              className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            >
              <IconSwap />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[quote.source]}`} />
          <span data-testid="price-status">{status}</span>
        </div>
      </header>

      {/* input cards (staircase) */}
      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
        {tab === "calc" && (
          <div className="space-y-2.5">
            <InputCard
              label="Account Balance"
              value={`${cur}${fmtTyped(s.balance)}`}
              active={field === "balance"}
              onClick={() => setField("balance")}
              tone="navy"
            />
            <InputCard
              label="Risk"
              value={s.riskMode === "percent" ? `${s.riskPct || "0"}%` : `${cur}${fmtTyped(s.riskAmt)}`}
              sub={`≈ ${cur}${fmt(result.riskAmount, 2)}`}
              active={field === "risk"}
              onClick={() => setField("risk")}
              tone="teal"
              right={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    set({ riskMode: s.riskMode === "percent" ? "amount" : "percent" });
                  }}
                  aria-label={`Risk as ${s.riskMode === "percent" ? "percent" : "amount"} — switch`}
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium"
                >
                  {s.riskMode === "percent" ? "%" : cur || "AMT"}
                </button>
              }
            />
            <InputCard
              label={isCrypto ? "Stop Loss Distance" : "Stop Loss"}
              value={s.stop || "0"}
              unit={isCrypto ? s.quote : "pips"}
              sub={!spec ? undefined : isCrypto ? "Price distance in USD" : `1 pip = ${fmtPip(spec.pipSize)}`}
              active={field === "stop"}
              onClick={() => setField("stop")}
              tone="light"
            />

            <button
              onClick={() => setShowResult(true)}
              disabled={!result.valid}
              className="mt-1 h-13 w-full rounded-2xl bg-navy py-3.5 text-base font-semibold uppercase tracking-widest text-white shadow-lg transition disabled:opacity-40"
            >
              Calculate
            </button>

            <div aria-live="polite">
              {waitingForRates ? (
                <p className="px-1 text-center text-[13px] text-muted">Loading exchange rates…</p>
              ) : !result.valid && result.error ? (
                <p className="px-1 text-center text-[13px] text-red-500/80">{result.error}</p>
              ) : conversion === "offline" ? (
                <p className="px-1 text-center text-[13px] text-amber-600/90">
                  Offline — converting {s.quote}→{s.account} with bundled rates from {fmtDate(market.daily?.asOf ?? "")}.
                </p>
              ) : conversion === "daily" ? (
                <p className="px-1 text-center text-[13px] text-muted">
                  {s.quote}→{s.account} converted at the {fmtDate(market.daily?.asOf ?? "")} reference rate.
                </p>
              ) : null}
            </div>

            {/* keypad */}
            <div className="mb-6 mt-4 rounded-3xl bg-paper p-2 shadow-inner">
              <Keypad
                value={valueOf(field)}
                onChange={(v) => setValueOf(field, v)}
                maxDecimals={maxDecimals[field]}
              />
            </div>
          </div>
        )}

        {tab === "favs" && (
          <div className="space-y-2">
            <h2 className="mb-2 text-lg font-semibold">Favourites</h2>
            {s.favs.length === 0 && <p className="text-sm text-muted">No favourites yet. Tap the star on the home screen.</p>}
            {s.favs.map((f) => {
              const fs = pairSpec(f.base, f.quote);
              const fq = quoteFor(f, market, resolved);
              return (
                <button
                  key={`${f.base}${f.quote}`}
                  onClick={() => applyFav(f)}
                  className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm"
                >
                  <span className="text-lg font-medium">{f.base}/{f.quote}</span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {fq.price !== undefined && fs ? fmt(fq.price, fs.priceDecimals) : ""}
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[fq.source]}`} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "learn" && (
          <div className="space-y-3">
            <h2 className="mb-2 text-lg font-semibold">Learn &amp; Tutorials</h2>
            {[
              { t: "Using STINU in 3 steps", s: "Enter account size, risk and stop loss, pick your pair, get your size." },
              { t: "Lots, Mini Lots & Units", s: "1 standard lot = 100,000 units. A mini lot is 10,000 units (0.1 lot)." },
              { t: "Gold & Silver contract sizes", s: "Silver contract size is 5,000 and Gold contract size is 100." },
              { t: "Pips explained", s: "A pip is 0.0001 on most pairs, 0.01 when the quote currency is JPY (also HUF, KRW, INR, THB and other high-number currencies) and 1 for IDR, VND and COP. The stop-loss card always shows the pip size in use." },
              { t: "Live prices", s: "Forex, gold, silver and oil stream from biquote.io (MetaTrader 5 quotes) and crypto from Binance. If a stream drops, prices fall back to Coinbase (about a minute old), then to daily reference rates. The dot next to the price shows which one you are seeing." },
              { t: "Crypto stop loss", s: "For crypto, enter the stop loss as a price distance in USD. The size is shown in coins." },
              { t: "Watch video tutorials", s: "Free tutorials and webinars from Urban Forex." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="font-semibold">{x.t}</div>
                <div className="mt-0.5 text-[13px] text-ink-soft">{x.s}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-2">
            <h2 className="mb-2 text-lg font-semibold">Settings</h2>
            <SettingRow label="Account Base" value={s.account} onClick={() => setShowBase(true)} />
            <SettingRow
              label="Risk input"
              value={s.riskMode === "percent" ? "Percent" : "Amount"}
              onClick={() => set({ riskMode: s.riskMode === "percent" ? "amount" : "percent" })}
            />
            <SettingRow
              label="Result units"
              value={s.unitMode === "mini" ? "Mini Lots" : s.unitMode === "lots" ? "Lots" : "Units"}
              onClick={() => set({ unitMode: NEXT_UNIT[s.unitMode] })}
            />
            <SettingRow label="Live prices" value={SOURCE_LABEL[quote.source]} />
            <SettingRow
              label="Reference rates"
              value={
                !market.daily
                  ? "Loading…"
                  : market.daily.source === "live"
                  ? `${market.daily.provider} · ${fmtDate(market.daily.asOf)}`
                  : `Offline · ${fmtDate(market.daily.asOf)}`
              }
            />
            <SettingRow
              label="Reset inputs"
              value="Reset"
              onClick={() =>
                set({ balance: DEFAULTS.balance, riskPct: DEFAULTS.riskPct, riskAmt: DEFAULTS.riskAmt, stop: DEFAULTS.stop })
              }
            />
            <p className="px-2 pt-4 text-center text-[11px] text-muted">
              Educational calculator clone. Position sizing is leverage-independent. Prices are indicative.
              <br />
              Market data by biquote, Binance and Coinbase; reference rates by open.er-api and the ECB.
            </p>
          </div>
        )}
      </main>

      {/* tab bar */}
      <nav className="sticky bottom-0 flex items-stretch justify-around border-t border-black/5 bg-white/95 backdrop-blur">
        {([
          { id: "calc", label: "Calculator", Icon: IconCalculator },
          { id: "favs", label: "Favourites", Icon: IconStar },
          { id: "learn", label: "Learn", Icon: IconBook },
          { id: "settings", label: "Settings", Icon: IconGear },
        ] as { id: Tab; label: string; Icon: typeof IconCalculator }[]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition ${
              tab === id ? "text-navy" : "text-muted"
            }`}
          >
            <Icon width={22} height={22} />
            {label}
          </button>
        ))}
      </nav>

      {showPair && (
        <PairPicker current={{ base: s.base, quote: s.quote }} onPick={choosePair} onClose={() => setShowPair(false)} />
      )}
      {showBase && (
        <BaseCurrencySheet
          current={s.account}
          onPick={(c) => {
            set({ account: c });
            setShowBase(false);
          }}
          onClose={() => setShowBase(false)}
        />
      )}
      {showResult && result.valid && spec && (
        <ResultSheet
          input={input}
          result={result}
          kind={spec.kind}
          unitMode={s.unitMode}
          onUnitMode={(m) => set({ unitMode: m })}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  );
}

const NEXT_UNIT: Record<UnitMode, UnitMode> = { mini: "lots", lots: "units", units: "mini" };

const DOT: Record<Freshness, string> = {
  live: "bg-emerald-400",
  minute: "bg-sky-300",
  daily: "bg-sky-300",
  closed: "bg-amber-400",
  stale: "bg-amber-400",
  offline: "bg-amber-400",
  none: "bg-gray-400",
};

const SOURCE_LABEL: Record<Freshness, string> = {
  live: "Streaming",
  closed: "Market closed",
  minute: "~1 min delay",
  stale: "Stream delayed",
  daily: "Daily rate",
  offline: "Offline",
  none: "Unavailable",
};

/** Feed symbols to stream for the pairs on screen and the account currency. */
function wantedFor(pairs: Pair[], account: string): Wanted {
  const biquote = new Set<string>();
  const binance = new Set<string>();
  const metals = new Set<string>();
  const fxCodes = new Set<string>([account]);
  for (const p of pairs) {
    for (const code of [p.base, p.quote]) {
      const inst = byCode(code);
      if (inst?.kind === "fx") fxCodes.add(code);
      else if (inst?.kind === "commodity") {
        if (inst.liveSymbol) biquote.add(inst.liveSymbol);
        if (code === "XAU" || code === "XAG") metals.add(code);
      } else if (inst?.kind === "crypto" && inst.liveSymbol) binance.add(inst.liveSymbol);
    }
  }
  for (const c of fxCodes) {
    const leg = fxLegSymbol(c);
    if (leg) biquote.add(leg);
  }
  return { biquote: [...biquote].sort(), binance: [...binance].sort(), metals: [...metals].sort() };
}

function quoteFor(p: Pair, market: MarketState, resolved: Resolved): Quote {
  const inst = byCode(p.base);
  if (!inst) return { source: "none" };
  return inst.kind === "fx" ? fxQuote(p.base, p.quote, resolved) : spotQuote(inst, market);
}

/** "Live 1.12393", "Market closed · 1.12393 · Fri 22:58", "Daily rate 1.12530 · 16 Oct 2026"… */
function statusLine(q: Quote, decimals: number, prefix: string, market: MarketState): string {
  if (q.price === undefined) return market.daily || market.minute ? "Price unavailable" : "Loading prices…";
  const p = `${prefix}${fmt(q.price, decimals)}`;
  const at = q.time ? fmtTime(q.time) : "";
  switch (q.source) {
    case "live":
      return `Live ${p}`;
    case "closed":
      return `Market closed · ${p}${at ? ` · ${at}` : ""}`;
    case "minute":
      return `${p} · ~1 min`;
    case "stale":
      return `${p} · last update ${at}`;
    case "daily":
      return `Daily rate ${p} · ${fmtDate(market.daily?.asOf ?? "")}`;
    case "offline":
      return `Offline rate ${p} · ${fmtDate(market.daily?.asOf ?? "")}`;
    default:
      return p;
  }
}

/** "Fri 22:58" in the viewer's time zone. */
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

/** 0.0001 → "0.0001", 1 → "1" */
function fmtPip(pip: number): string {
  return pip >= 1 ? String(pip) : pip.toFixed(Math.round(-Math.log10(pip)));
}

/** "2026-10-16" → "16 Oct 2026" */
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso || "unknown date";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Show a number exactly as typed, with thousands grouping ("10550.5" → "10,550.5"). */
function fmtTyped(v: string): string {
  if (!v) return "0";
  const [int, dec] = v.split(".");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

function InputCard({
  label, value, sub, unit, active, onClick, tone, right,
}: {
  label: string; value: string; sub?: string; unit?: string;
  active: boolean; onClick: () => void;
  tone: "navy" | "teal" | "light";
  right?: React.ReactNode;
}) {
  const palette =
    tone === "navy"
      ? "bg-navy text-white"
      : tone === "teal"
      ? "bg-teal text-white"
      : "bg-white text-ink";
  const subColor = tone === "light" ? "text-muted" : "text-white/70";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`w-full cursor-pointer rounded-3xl px-5 py-3 text-left shadow-md transition ${palette} ${
        active ? "ring-2 ring-navy/40" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-widest ${tone === "light" ? "text-muted" : "text-white/60"}`}>{label}</span>
        {right}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-2xl font-light">{value}</span>
        {unit && <span className="text-base opacity-70">{unit}</span>}
      </div>
      {sub && <div className={`text-xs ${subColor}`}>{sub}</div>}
    </div>
  );
}

function SettingRow({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted">{value}</span>
    </>
  );
  const cls = "flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm";
  return onClick ? (
    <button onClick={onClick} className={cls}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
