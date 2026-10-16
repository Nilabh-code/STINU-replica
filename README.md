<div align="center">

# STINU — Position Size Calculator · Web Replica

**A pixel- and math-faithful web rebuild of the Android app _"Stinu — Position Size Calculator"_ (v5.7.3),
reverse-engineered from the APK and verified byte-for-byte against the original's own output.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Verified](https://img.shields.io/badge/result_table-byte--exact-brightgreen)](#-verification)

</div>

---

## What this is

The original **STINU** is a forex position-size calculator: you enter your account balance, your risk,
and your stop-loss distance, and it tells you exactly how many **lots / mini lots / units** to trade —
then lets you *nudge the stop-loss and watch the size change live* without re-entering anything.

This repository is a **functional replica** of that app as a **Next.js web app**. The goal was not a
lookalike mockup — the calculator reproduces the original's results **exactly**, and the UI is rebuilt
from the app's real screens.

> **Scope:** calculator + UI. No paywall, no Firebase, no accounts. Exchange rates and spot prices come
> from free, keyless public feeds.

## Screenshots

| Home calculator | Result table (Mini Lots) | Result table (Units) |
|:---:|:---:|:---:|
| ![Home](docs/screenshots/01-home.png) | ![Result](docs/screenshots/02-result.png) | ![Result units](docs/screenshots/03-result-units.png) |

| Instrument picker — Forex | Instrument picker — Crypto | Account base currency |
|:---:|:---:|:---:|
| ![Picker FX](docs/screenshots/04-picker-fx.png) | ![Picker crypto](docs/screenshots/05-picker-crypto.png) | ![Base](docs/screenshots/06-base.png) |

## Features

- **Exact position sizing** — risk in **%** or **currency**, stop-loss in pips, output in **Lots / Mini Lots / Units**.
- **Any account currency, any pair** — 45 currencies (the original's 23 plus INR, BRL, THB, IDR, AED, SAR,
  MYR, PHP, TWD and more), usable as pair legs *and* as the account currency. Pip values are converted from
  the pair's quote currency into your account currency, and the stop-loss card shows the pip size in use.
- **The signature "nudge" table** — whole-number stop-loss rows plus fine steps around your value, so you can
  adjust risk *without re-entering your details*. Your own stop is always in the list and highlighted.
- **Three instrument classes** — Forex (majors, crosses, exotics), Commodities (Gold, Silver, WTI, Brent),
  and Crypto — 78 coins, the original's 19 plus the largest coins trading on Binance (stop as a USD price
  distance, size in coins).
- **Real-time prices, free and keyless** — forex, metals and oil stream tick-by-tick from biquote.io
  (MetaTrader 5 quotes); crypto streams from Binance. Live rates also drive the currency conversion, so pip
  values move with the market. See [Price sources](#price-sources) for the fallbacks.
- **Remembers you** — inputs, pair, account base, unit mode and favourites are saved in the browser.
- **Custom on-screen keypad** plus physical keyboard (digits, `.`, Backspace, Enter, ↑/↓ to switch field),
  slanted navy header, staircase input cards, and a 4-tab bar (Calculator · Favourites · Learn · Settings).
- **No backend** — it's a static app; prices are fetched client-side.

## Verification

The whole point of this project: **the math is confirmed against the original, not approximated.**

The APK was decompiled (`dex2jar` → `CFR`) and the core is `k6/l0.java`, method `P()`. Its arithmetic is
**algebraically identical** to what this clone implements. Independently, the replica was validated
against the app's own store screenshots — every value reproduces **exactly**:

> EUR/USD · balance **$10,550** · risk **1.5% → $158.25**

| STOP LOSS | MINI LOTS | | STOP LOSS | MINI LOTS |
|:---:|:---:|:---:|:---:|:---:|
| 20 | 7.912 | | 24 | 6.594 |
| 21 | 7.536 | | 24.1 | 6.566 |
| 22 | 7.193 | | **24.2** | **6.539** ← highlighted |
| 23 | 6.880 | | 24.3 | 6.512 |
| | | | 24.4 | 6.486 |

Footer: **Pip value / lot $10.00 · Balance $10,550 · Units 65,393**.

Two test layers keep it that way:

- **`npm test`** (Vitest) — unit tests for the engine with hand-worked expected values: the reference table
  above, EUR/JPY accounts, USD/JPY and crosses, swapped pairs, gold/oil/crypto, validation, the nudge-table
  layout, pair orientation and keypad rules.
- **`npm run verify`** (`verify2.mjs`, headless Chromium) — asserts the exact reference table, highlighted
  row, footer and all three unit modes, then runs the scenarios above end to end (account switch, USD/JPY,
  two-tap picker, BTC, stop 24.7, risk 500% blocked, persistence across reload, Escape). Every price source
  is mocked — REST endpoints, the biquote SignalR hub and the Binance WebSocket — so it also checks that a
  streamed tick re-prices the result, that a broken USD/INR quote is rejected, that a closed market is
  labelled, and that the app falls back to Coinbase when the hub is down. Plus **zero console errors**.
  It starts `next start` on port 4173 itself if nothing is running.

```bash
npm test
npm run build && npm run verify     # exits 0 only if every check passes
```

## Price sources

All free and keyless, and all called straight from the browser (no backend, no API keys to leak).

| Layer | Forex | Gold / Silver / Oil | Crypto |
|---|---|---|---|
| **Real-time stream** | [biquote.io](https://biquote.io) SignalR hub (MT5 ticks) | biquote.io | Binance public WebSocket |
| **~1 minute** | Coinbase `/v2/exchange-rates` | gold-api.com (XAU, XAG) | Coinbase `/v2/exchange-rates` |
| **Daily** | open.er-api.com + ECB (Frankfurter) | — | — |
| **Offline** | bundled snapshot (16 Oct 2026) | — | — |

`lib/market.ts` picks the best source per currency, every second:

- A streamed FX tick is used only if its spread is under 0.5% **and** it is within 3% of an independent
  reference (Coinbase or the daily rate). This matters: the MT5 feed's USD/INR sat ~9% off the market when
  tested, and some exotic quotes carry 2–5% spreads — those fall through to Coinbase automatically.
- When forex is shut (Friday ~21:00 UTC to Sunday ~21:00 UTC, or the hub reports the market closed) the last
  tick stays in use and the header says **Market closed** with its time. A stream that stalls mid-week gives
  way to Coinbase.
- The dot beside the price shows which layer you're seeing: green = streaming, blue = ~1 min or daily,
  amber = market closed / delayed / offline.

Sources looked at and **not** used (October 2026): Pyth Hermes (needs an API key since its August 2026
upgrade), TrueFX (the original app's feed; its endpoint was down), Kraken (thin FX books — USD/JPY spread
of ~3 yen), and Twelve Data / Finnhub / FCS / Alpha Vantage (free tiers need a key, which would have to be
hidden behind a server). biquote's terms allow in-app commercial use but not redistribution of the raw feed,
come with no SLA, and ask for a "Market data by biquote" credit, which the Settings screen shows.

## The formula

```
riskAmount      = balance × riskPercent / 100      (or the entered currency amount)
pipValuePerLot  = pipSize × contractSize × accountPerQuote
lots            = riskAmount / (stop × pipValuePerLot)
miniLots        = lots × 10
units           = lots × contractSize
```

- `pipSize` comes from the **quote** currency: 0.01 for JPY, HUF and KRW, 0.0001 otherwise
  (gold 0.01, silver 0.001, WTI 0.01).
- `accountPerQuote` is the account-currency value of one unit of the quote currency
  (1 when they're the same, so EUR/USD on a USD account needs no rate at all).
- Crypto uses `pipSize = contractSize = 1`: the stop is a price distance in USD and the size is in coins.

Examples: EUR/USD on a USD account → `0.0001 × 100,000 × 1 = $10.00`; USD/JPY on a USD account →
`0.01 × 100,000 × (1 / 158.02) = $6.33`; EUR/USD on a EUR account → `$10 × 0.88865 = €8.89`.
Formatting uses `toFixed` semantics so `158.25 / 20 → "7.912"` — matching the original's rounding.

## What's in the app

### Calculator
The home screen. Three staircase cards — **Account Balance** (navy), **Risk** (teal, with a %/amount
toggle), **Stop Loss** (white) — a **CALCULATE** button, and a custom numeric keypad. The header shows
the account base, the currency pair (tap to change, tap ⇄ to swap), the live price, and a favourite star.

### Result table
Two-tone diagonal header (Risk / Risk Amount / Currency Pair), a **Lots · Mini Lots · Units** toggle,
the stop-loss → size table with the active row highlighted, and a footer with pip value, balance and units.

### Instrument picker
Three tabs — **Forex (FX)**, **Commodity**, **Crypto** — over a searchable grid. On Forex, tap two
currencies (or a popular-pair chip); the pair is oriented the way the market quotes it, so JPY + USD
becomes USD/JPY and EUR + TRY becomes EUR/TRY. Commodities and crypto are quoted against USD.

- **Forex** (45): the original's 23 — AUD CAD CHF EUR GBP JPY NZD USD CNH CZK DKK HUF ILS HKD KRW MXN NOK PLN
  RUB SEK SGD TRY ZAR — plus AED ARS BDT BRL CLP COP EGP IDR INR ISK KES KWD MYR NGN PHP PKR QAR RON SAR THB
  TWD VND. Any two make a pair, so every cross is covered.
- **Commodities**: WTI and Brent (1,000 bbl), XAU (Gold, contract 100), XAG (Silver, contract 5000)
- **Crypto** (78): the original's 19 — BTC ETH XRP LTC IOTA SOL DOGE ADA AVAX DAI USDC LN SHIB FDUSD BNB TRX
  SUI BCH XLM — plus the largest coins by market cap that trade against USDT on Binance (LINK, HYPE, DOT,
  PEPE, NEAR, AAVE, ARB, OP, TAO, …), with Binance's price precision.

*(The original instrument lists and contract sizes were read from the decompiled binary — not guessed.)*

### Account base
Pick the currency your account is denominated in (the original's nine first, then all 45); risk and pip
value are converted accordingly.

### Favourites · Learn · Settings
Saved pairs, the app's tutorial copy (lots vs mini lots, gold/silver contract sizes, pips explained),
and settings for base currency, risk mode, result units and a reset.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Language | TypeScript |
| Font | Poppins (via `next/font`) |
| Prices | biquote.io + Binance (streaming), Coinbase, gold-api.com, open.er-api + ECB — no keys |
| Tests | Vitest (unit) + Playwright (end to end) |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

Tests:

```bash
npm test                          # unit tests
npm run build && npm run verify   # end-to-end (first time: npx playwright install chromium)
```

## Project layout

```
app/
  page.tsx          Home calculator (header, cards, keypad, tabs)
  layout.tsx        Root layout + font
  globals.css       Theme (colors sampled from the app)
components/
  Sheet.tsx         Bottom-sheet dialog (Escape, focus trap)
  Keypad.tsx        Custom numeric keypad
  PairPicker.tsx    Instrument picker (FX / Commodity / Crypto tabs)
  BaseCurrencySheet.tsx
  ResultSheet.tsx   Result screen: diagonal header + stop-loss table
  icons.tsx         Line icons
lib/
  calc.ts           Position-size engine + table builder + formatter
  instruments.ts    Instrument + pair model (pip sizes, contract sizes, orientation)
  prices.ts         REST sources: daily rates, Coinbase, gold-api, offline snapshot
  feeds.ts          Streaming clients: biquote SignalR hub, Binance WebSocket
  market.ts         Picks the best price per currency (sanity guard, market hours)
  useMarket.ts      React hook that runs every source and batches ticks
  keypad.ts         Input rules shared by keypad and keyboard
  store.ts          Saved inputs/preferences (localStorage)
  *.test.ts         Unit tests
verify2.mjs         End-to-end harness (reference table + scenarios)
```

## Notes & honest limitations

- **The APK's embedded secrets are not reproduced.** The original embeds a Firebase config and vendor
  price-feed credentials (TrueFX / currencydatafeed.com). None of those values are used here — this
  clone uses independent free feeds.
- **Free feeds, no SLA.** biquote.io and Binance can change or disappear without notice; the app degrades to
  Coinbase (~1 min) and then daily rates, and says so in the header. Prices are indicative, not tradable.
- **Crypto prices are vs USDT** on Binance, which trades within a few hundredths of a percent of USD.
- **Exotic pip sizes vary by broker.** The calculator uses 0.01 for high-number quote currencies (JPY, HUF,
  KRW, INR, THB…) and 1 for IDR, VND and COP, and always shows the pip size next to the stop loss.
- **Crypto** follows the original's price-distance approach (stop in USD, size in coins). The exact
  rounding of the original's crypto branch has not been checked against the app.

- This is an **independent reimplementation** of the app's behavior and appearance — not a copy of its
  code or assets. All trademarks belong to their owners.

---

<div align="center"><sub>Reverse-engineered and rebuilt with the Hermes Agent · educational use</sub></div>
