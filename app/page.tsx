"use client";
// app/page.tsx — STINU clone: home calculator + result table.
import { useEffect, useMemo, useState } from "react";
import Keypad from "@/components/Keypad";
import PairPicker from "@/components/PairPicker";
import BaseCurrencySheet from "@/components/BaseCurrencySheet";
import ResultSheet from "@/components/ResultSheet";
import { calculate, CalcInput, RiskMode, fmt } from "@/lib/calc";
import {
  byCode, Instrument, symbol, UnitMode,
} from "@/lib/instruments";
import {
  loadPrices, pairPrice, quoteToAccountRate, RateMap, STATIC_USD_RATES, hasRate,
} from "@/lib/prices";
import { IconCalculator, IconStar, IconStarFilled, IconBook, IconGear, IconSwap } from "@/components/icons";

type Field = "balance" | "risk" | "stop";
type Tab = "calc" | "favs" | "learn" | "settings";

interface Fav { base: string; quote: string; }

export default function Home() {
  const [tab, setTab] = useState<Tab>("calc");

  // ── persisted inputs (the app "remembers" your numbers) ────────────────
  const [balance, setBalance] = useState("10550");
  const [riskMode, setRiskMode] = useState<RiskMode>("percent");
  const [riskPct, setRiskPct] = useState("1.5");
  const [riskAmt, setRiskAmt] = useState("150");
  const [stop, setStop] = useState("24.2");
  const [base, setBase] = useState("EUR");
  const [quote, setQuote] = useState("USD");
  const [account, setAccount] = useState("USD");
  const [unitMode, setUnitMode] = useState<UnitMode>("mini");
  const [favs, setFavs] = useState<Fav[]>([
    { base: "EUR", quote: "USD" },
    { base: "GBP", quote: "USD" },
  ]);

  // ── live prices ────────────────────────────────────────────────────────
  const [rates, setRates] = useState<RateMap>(STATIC_USD_RATES);
  const [priceSource, setPriceSource] = useState<"live" | "offline">("offline");
  const [fedAt, setFedAt] = useState<string>("");

  useEffect(() => {
    let alive = true;
    loadPrices().then((q) => {
      if (!alive) return;
      // Rebuild a rate map from the quote's usdPer function.
      const map: RateMap = {};
      for (const c of Object.keys(STATIC_USD_RATES)) {
        const usd = q.usdPer(c);
        map[c] = usd ? 1 / usd : STATIC_USD_RATES[c];
      }
      setRates(map);
      setPriceSource(q.source === "static" ? "offline" : "live");
      setFedAt(q.date);
    });
    const id = setInterval(() => {
      loadPrices().then((q) => {
        const map: RateMap = {};
        for (const c of Object.keys(STATIC_USD_RATES)) {
          const usd = q.usdPer(c);
          map[c] = usd ? 1 / usd : STATIC_USD_RATES[c];
        }
        setRates(map);
      });
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ── active field + keypad ──────────────────────────────────────────────
  const [field, setField] = useState<Field>("balance");
  const [showPair, setShowPair] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const valueOf = (f: Field): string => {
    switch (f) {
      case "balance": return balance;
      case "risk": return riskMode === "percent" ? riskPct : riskAmt;
      case "stop": return stop;
    }
  };
  const setValueOf = (f: Field, v: string) => {
    switch (f) {
      case "balance": setBalance(v); return;
      case "risk":
        if (riskMode === "percent") setRiskPct(v);
        else setRiskAmt(v);
        return;
      case "stop": setStop(v); return;
    }
  };

  const pairLabel = `${base}/${quote}`;

  // ── computed ───────────────────────────────────────────────────────────
  const inst = byCode(base);
  const price = useMemo(() => pairPrice(rates, base, quote), [rates, base, quote]);
  const quoteToAcc = useMemo(() => quoteToAccountRate(rates, quote, account), [rates, quote, account]);
  // Commodities/crypto have no FX rate, so pairPrice falls back to 1 — flag that
  // rather than showing a misleading "Live price 1.00" or a wrong position size.
  const pairHasRate = hasRate(rates, base) && hasRate(rates, quote);

  const input: CalcInput = useMemo(
    () => ({
      balance: parseFloat(balance) || 0,
      riskMode,
      riskPercent: parseFloat(riskPct) || 0,
      riskAmount: parseFloat(riskAmt) || 0,
      stopPips: parseFloat(stop) || 0,
      accountCurrency: account,
      base,
      quote,
      price,
      quoteToAccount: quoteToAcc,
    }),
    [balance, riskMode, riskPct, riskAmt, stop, account, base, quote, price, quoteToAcc],
  );

  const result = useMemo(() => calculate(input), [input]);
  const cur = symbol(account);

  const swapPair = () => {
    setBase(quote);
    setQuote(base);
  };

  const isFav = favs.some((f) => f.base === base && f.quote === quote);
  const toggleFav = () => {
    if (isFav) setFavs(favs.filter((f) => !(f.base === base && f.quote === quote)));
    else setFavs([...favs, { base, quote }]);
  };

  const choosePair = (i: Instrument) => {
    // Pick the instrument as the pair base; quote defaults to USD unless it's USD.
    if (i.code === "USD") {
      setBase("EUR");
      setQuote("USD");
    } else {
      setBase(i.code);
      setQuote("USD");
    }
    setShowPair(false);
  };

  const applyFav = (f: Fav) => {
    setBase(f.base);
    setQuote(f.quote);
    setTab("calc");
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden app-bg">
      {/* top bar */}
      <header className="header-slant px-5 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowBase(true)} className="flex items-center gap-2 text-left">
            <span className="text-xs uppercase tracking-widest text-white/60">Account Base</span>
            <span className="text-lg font-bold">{account}</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={toggleFav} aria-label="Favourite" className="opacity-90">
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
          <button
            onClick={swapPair}
            aria-label="Swap"
            className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
          >
            <IconSwap />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
          <span className={`inline-block h-2 w-2 rounded-full ${!pairHasRate ? "bg-gray-400" : priceSource === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
          {!pairHasRate
            ? `No live ${inst?.kind === "crypto" ? "crypto" : "commodity"} price feed`
            : priceSource === "live"
            ? `Live price ${fmtPrice(price, inst?.decimals ?? 4)}`
            : "Offline price"}{" "}
          · {cur}{fmt(quoteToAcc, 3)}
        </div>
      </header>

      {/* input cards (staircase) */}
      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
        {tab === "calc" && (
          <div className="space-y-2.5">
            <InputCard
              label="Account Balance"
              value={`${cur}${fmt(parseFloat(balance) || 0, 0)}`}
              active={field === "balance"}
              onClick={() => setField("balance")}
              tone="navy"
            />
            <InputCard
              label="Risk"
              value={riskMode === "percent" ? `${riskPct}%` : `${cur}${fmt(parseFloat(riskAmt) || 0, 2)}`}
              sub={`≈ ${cur}${fmt(result.riskAmount, 2)}`}
              active={field === "risk"}
              onClick={() => setField("risk")}
              tone="teal"
              right={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRiskMode(riskMode === "percent" ? "amount" : "percent");
                  }}
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium"
                >
                  {riskMode === "percent" ? "%" : cur || "AMT"}
                </button>
              }
            />
            <InputCard
              label="Stop Loss"
              value={stop}
              unit="pips"
              active={field === "stop"}
              onClick={() => setField("stop")}
              tone="light"
            />

            <button
              onClick={() => setShowResult(true)}
              disabled={!result.valid || !pairHasRate}
              className="mt-1 h-13 w-full rounded-2xl bg-navy py-3.5 text-base font-semibold uppercase tracking-widest text-white shadow-lg transition disabled:opacity-40"
            >
              Calculate
            </button>

            {!pairHasRate && (
              <p className="px-1 text-center text-[13px] text-amber-600/90">
                No live price feed for {base}. Pick a forex pair to calculate.
              </p>
            )}
            {pairHasRate && !result.valid && result.error && (
              <p className="px-1 text-center text-[13px] text-red-500/80">{result.error}</p>
            )}

            {/* keypad */}
            <div className="mb-6 mt-4 rounded-3xl bg-paper p-2 shadow-inner">
              <Keypad
                value={valueOf(field)}
                onChange={(v) => setValueOf(field, v)}
                allowDecimal
              />
            </div>
          </div>
        )}

        {tab === "favs" && (
          <div className="space-y-2">
            <h2 className="mb-2 text-lg font-semibold">Favourites</h2>
            {favs.length === 0 && <p className="text-sm text-muted">No favourites yet. Tap the star on the home screen.</p>}
            {favs.map((f) => (
              <button
                key={`${f.base}${f.quote}`}
                onClick={() => applyFav(f)}
                className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm"
              >
                <span className="text-lg font-medium">{f.base}/{f.quote}</span>
                <span className="text-sm text-muted">{fmtPrice(pairPrice(rates, f.base, f.quote), 4)}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "learn" && (
          <div className="space-y-3">
            <h2 className="mb-2 text-lg font-semibold">Learn &amp; Tutorials</h2>
            {[
              { t: "Using STINU in 3 steps", s: "Enter account size, risk and stop loss, pick your pair, get your size." },
              { t: "Lots, Mini Lots & Units", s: "1 standard lot = 100,000 units. A mini lot is 10,000 units (0.1 lot)." },
              { t: "Gold & Silver contract sizes", s: "Silver contract size is 5,000 and Gold contract size is 100." },
              { t: "Pips explained", s: "A pip is 0.0001 on most pairs, 0.01 on JPY pairs." },
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
            <SettingRow label="Account Base" value={account} onClick={() => setShowBase(true)} />
            <SettingRow label="Risk input" value={riskMode === "percent" ? "Percent" : "Amount"} onClick={() => setRiskMode(riskMode === "percent" ? "amount" : "percent")} />
            <SettingRow label="Result units" value={unitMode === "mini" ? "Mini Lots" : unitMode === "lots" ? "Lots" : "Units"} onClick={() => setUnitMode(unitMode === "mini" ? "lots" : unitMode === "lots" ? "units" : "mini")} />
            <SettingRow label="Price feed" value={priceSource === "live" ? `Live${fedAt ? " · " + fedAt : ""}` : "Offline"} onClick={() => {}} />
            <SettingRow label="Reset inputs" value="Reset" onClick={() => { setBalance("10550"); setRiskPct("1.5"); setRiskAmt("150"); setStop("24.2"); }} />
            <p className="px-2 pt-4 text-center text-[11px] text-muted">
              Educational calculator clone. Position sizing is leverage-independent and computed from live reference rates.
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
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition ${
              tab === id ? "text-navy" : "text-muted"
            }`}
          >
            <Icon width={22} height={22} />
            {label}
          </button>
        ))}
      </nav>

      {showPair && <PairPicker onPick={choosePair} onClose={() => setShowPair(false)} />}
      {showBase && (
        <BaseCurrencySheet current={account} onPick={(c) => { setAccount(c); setShowBase(false); }} onClose={() => setShowBase(false)} />
      )}
      {showResult && result.valid && (
        <ResultSheet
          input={input}
          result={result}
          unitMode={unitMode}
          onUnitMode={setUnitMode}
          onClose={() => setShowResult(false)}
          balanceLabel="Balance"
        />
      )}
    </div>
  );
}

function fmtPrice(p: number, d: number): string {
  return isFinite(p) ? p.toFixed(d) : "—";
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
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
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

function SettingRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm">
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted">{value}</span>
    </button>
  );
}
