// lib/instruments.ts
// Instrument + pair model for the STINU position-size calculator clone.

export type Kind = "fx" | "commodity" | "crypto";

export interface Instrument {
  code: string;       // display code, e.g. "EUR", "XAU", "BTC"
  name: string;
  kind: Kind;
  /**
   * Commodities: price increment that counts as one pip.
   * Crypto: 1 — the stop loss is entered as a price distance in the quote currency.
   * FX: unused — a forex pip depends on the *quote* currency, see fxPipSize().
   */
  pipSize: number;
  /** units per 1.00 standard lot */
  contractSize: number;
  /** decimals to display for prices / stop distances */
  decimals: number;
  enabled: boolean;
  /** streaming symbol: biquote.io for commodities, Binance (…USDT) for crypto */
  liveSymbol?: string;
}

// ---- Fiat / FX currencies --------------------------------------------------------
// The original app's grid (first 23, in its order), then wider coverage A–Z.
const fx = (code: string, name: string): Instrument => ({
  code, name, kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true,
});

export const FX: Instrument[] = [
  fx("USD", "US Dollar"),
  fx("EUR", "Euro"),
  fx("GBP", "British Pound"),
  fx("JPY", "Japanese Yen"),
  fx("AUD", "Australian Dollar"),
  fx("CAD", "Canadian Dollar"),
  fx("CHF", "Swiss Franc"),
  fx("NZD", "New Zealand Dollar"),
  fx("CNH", "Chinese Yuan (Offshore)"),
  fx("CZK", "Czech Koruna"),
  fx("DKK", "Danish Krone"),
  fx("HUF", "Hungarian Forint"),
  fx("ILS", "Israeli Shekel"),
  fx("HKD", "Hong Kong Dollar"),
  fx("KRW", "Korean Won"),
  fx("MXN", "Mexican Peso"),
  fx("NOK", "Norwegian Krone"),
  fx("PLN", "Polish Zloty"),
  fx("RUB", "Russian Ruble"),
  fx("SEK", "Swedish Krona"),
  fx("SGD", "Singapore Dollar"),
  fx("TRY", "Turkish Lira"),
  fx("ZAR", "South African Rand"),
  fx("AED", "UAE Dirham"),
  fx("ARS", "Argentine Peso"),
  fx("BDT", "Bangladeshi Taka"),
  fx("BRL", "Brazilian Real"),
  fx("CLP", "Chilean Peso"),
  fx("COP", "Colombian Peso"),
  fx("EGP", "Egyptian Pound"),
  fx("IDR", "Indonesian Rupiah"),
  fx("INR", "Indian Rupee"),
  fx("ISK", "Icelandic Krona"),
  fx("KES", "Kenyan Shilling"),
  fx("KWD", "Kuwaiti Dinar"),
  fx("MYR", "Malaysian Ringgit"),
  fx("NGN", "Nigerian Naira"),
  fx("PHP", "Philippine Peso"),
  fx("PKR", "Pakistani Rupee"),
  fx("QAR", "Qatari Riyal"),
  fx("RON", "Romanian Leu"),
  fx("SAR", "Saudi Riyal"),
  fx("THB", "Thai Baht"),
  fx("TWD", "Taiwan Dollar"),
  fx("VND", "Vietnamese Dong"),
];

// ---- Commodities (contract sizes straight from the app's help copy) --------
// "SILVER Contract Size is 5000 / GOLD Contract Size is 100"; oil is 1,000 barrels.
export const COMMODITIES: Instrument[] = [
  { code: "WTI",   name: "Crude Oil (WTI)",   kind: "commodity", pipSize: 0.01,  contractSize: 1000, decimals: 2, enabled: true, liveSymbol: "USOIL" },
  { code: "BRENT", name: "Crude Oil (Brent)", kind: "commodity", pipSize: 0.01,  contractSize: 1000, decimals: 2, enabled: true, liveSymbol: "UKOIL" },
  { code: "XAU",   name: "Gold",              kind: "commodity", pipSize: 0.01,  contractSize: 100,  decimals: 2, enabled: true, liveSymbol: "XAUUSD" },
  { code: "XAG",   name: "Silver",            kind: "commodity", pipSize: 0.001, contractSize: 5000, decimals: 3, enabled: true, liveSymbol: "XAGUSD" },
];

// ---- Crypto (quoted vs USD) ---------------------------------------------------------
// The original app's 19 coins first, then the largest coins by market cap that trade
// against USDT on Binance (Oct 2026). Decimals follow Binance's price tick.
// The original routes crypto through a price-distance branch rather than the
// pip-based FX path, so the stop loss is a distance in USD and the size is in coins.
const crypto = (code: string, name: string, decimals: number, onBinance = true): Instrument => ({
  code, name, kind: "crypto", pipSize: 1, contractSize: 1, decimals, enabled: true,
  liveSymbol: onBinance ? `${code}USDT` : undefined,
});

export const CRYPTO: Instrument[] = [
  crypto("BTC",     "Bitcoin",            2),
  crypto("ETH",     "Ethereum",           2),
  crypto("XRP",     "XRP",                4),
  crypto("LTC",     "Litecoin",           2),
  crypto("IOTA",    "IOTA",               4),
  crypto("SOL",     "Solana",             2),
  crypto("DOGE",    "Dogecoin",           5),
  crypto("ADA",     "Cardano",            4),
  crypto("AVAX",    "Avalanche",          3),
  crypto("DAI",     "Dai",                4, false),
  crypto("USDC",    "USD Coin",           4),
  crypto("LN",      "LN",                 4, false),
  crypto("SHIB",    "Shiba Inu",          8),
  crypto("FDUSD",   "First Digital USD",  4),
  crypto("BNB",     "BNB",                2),
  crypto("TRX",     "TRON",               4),
  crypto("SUI",     "Sui",                4),
  crypto("BCH",     "Bitcoin Cash",       2),
  crypto("XLM",     "Stellar",            4),
  crypto("ZEC",     "Zcash",              2),
  crypto("HYPE",    "Hyperliquid",        2),
  crypto("LINK",    "Chainlink",          3),
  crypto("NEAR",    "NEAR Protocol",      3),
  crypto("UNI",     "Uniswap",            3),
  crypto("GRAM",    "Gram (Toncoin)",     3),
  crypto("HBAR",    "Hedera",             5),
  crypto("TAO",     "Bittensor",          2),
  crypto("QNT",     "Quant",              2),
  crypto("ENA",     "Ethena",             4),
  crypto("AAVE",    "Aave",               2),
  crypto("ONDO",    "Ondo",               4),
  crypto("PUMP",    "Pump.fun",           6),
  crypto("DOT",     "Polkadot",           3),
  crypto("WLD",     "Worldcoin",          4),
  crypto("ASTER",   "Aster",              4),
  crypto("WLFI",    "World Liberty Financial", 4),
  crypto("PEPE",    "Pepe",               8),
  crypto("ICP",     "Internet Computer",  3),
  crypto("MORPHO",  "Morpho",             3),
  crypto("SKY",     "Sky",                5),
  crypto("ARB",     "Arbitrum",           4),
  crypto("ETC",     "Ethereum Classic",   2),
  crypto("ALGO",    "Algorand",           4),
  crypto("JUP",     "Jupiter",            4),
  crypto("POL",     "POL (ex-MATIC)",     5),
  crypto("RENDER",  "Render",             3),
  crypto("FIL",     "Filecoin",           4),
  crypto("ATOM",    "Cosmos",             3),
  crypto("AERO",    "Aerodrome",          4),
  crypto("INJ",     "Injective",          3),
  crypto("ZRO",     "LayerZero",          3),
  crypto("APT",     "Aptos",              4),
  crypto("STX",     "Stacks",             4),
  crypto("CAKE",    "PancakeSwap",        3),
  crypto("PYTH",    "Pyth Network",       5),
  crypto("ETHFI",   "Ether.fi",           4),
  crypto("TIA",     "Celestia",           4),
  crypto("DASH",    "Dash",               2),
  crypto("VET",     "VeChain",            6),
  crypto("STRK",    "Starknet",           5),
  crypto("CRV",     "Curve DAO",          4),
  crypto("TRUMP",   "Official Trump",     3),
  crypto("RAY",     "Raydium",            4),
  crypto("PENGU",   "Pudgy Penguins",     6),
  crypto("FET",     "Artificial Superintelligence Alliance", 4),
  crypto("VIRTUAL", "Virtuals Protocol",  4),
  crypto("SEI",     "Sei",                5),
  crypto("PENDLE",  "Pendle",             3),
  crypto("XTZ",     "Tezos",              4),
  crypto("LDO",     "Lido DAO",           4),
  crypto("OP",      "Optimism",           4),
  crypto("GRT",     "The Graph",          5),
  crypto("BONK",    "Bonk",               8),
  crypto("JTO",     "Jito",               4),
  crypto("EIGEN",   "EigenCloud",         4),
  crypto("ENS",     "Ethereum Name Service", 2),
  crypto("FLOKI",   "FLOKI",              8),
  crypto("JASMY",   "JasmyCoin",          5),
];

export const ALL: Instrument[] = [...FX, ...COMMODITIES, ...CRYPTO];

const BY_CODE = new Map(ALL.map((i) => [i.code, i]));

export function byCode(code: string): Instrument | undefined {
  return BY_CODE.get(code);
}

// ---- Pairs --------------------------------------------------------------------

export interface Pair {
  base: string;
  quote: string;
}

/**
 * Pip size by quote currency. Most pairs use the 4th decimal; currencies worth
 * roughly 1/50 of a dollar or less are quoted to fewer decimals (USD/JPY 158.02 →
 * 1 pip = 0.01), and the thousands-per-dollar ones use whole units.
 * Brokers differ on exotics, so the calculator always shows the pip size it uses.
 */
const PIP_BY_QUOTE: Record<string, number> = {
  JPY: 0.01, HUF: 0.01, KRW: 0.01, INR: 0.01, THB: 0.01, PHP: 0.01, RUB: 0.01, ISK: 0.01,
  TWD: 0.01, PKR: 0.01, BDT: 0.01, KES: 0.01, EGP: 0.01, ARS: 0.01, NGN: 0.01, CLP: 0.01,
  IDR: 1, VND: 1, COP: 1,
};

/** Size of one pip for a forex pair, which is set by the pair's quote currency. */
export function fxPipSize(quote: string): number {
  return PIP_BY_QUOTE[quote] ?? 0.0001;
}

export interface PairSpec {
  kind: Kind;
  /** price move that counts as one pip (crypto: 1 unit of the quote currency) */
  pipSize: number;
  contractSize: number;
  /** decimals used to display the pair's price */
  priceDecimals: number;
  /** decimals allowed when typing the stop loss */
  stopDecimals: number;
}

/** Everything the calculator needs to know about a pair, or undefined if unsupported. */
export function pairSpec(base: string, quote: string): PairSpec | undefined {
  const b = byCode(base);
  const q = byCode(quote);
  if (!b || !q || base === quote) return undefined;
  if (b.kind === "fx") {
    if (q.kind !== "fx") return undefined;
    const pip = fxPipSize(quote);
    // one more decimal than the pip (the "pipette"): 1.12530, 158.020, 18022.5
    const priceDecimals = Math.max(0, Math.round(-Math.log10(pip))) + 1;
    return { kind: "fx", pipSize: pip, contractSize: b.contractSize, priceDecimals, stopDecimals: 1 };
  }
  // Commodities and crypto are only quoted against USD.
  if (quote !== "USD") return undefined;
  return {
    kind: b.kind,
    pipSize: b.pipSize,
    contractSize: b.contractSize,
    priceDecimals: b.decimals,
    stopDecimals: b.kind === "crypto" ? b.decimals : 1,
  };
}

// Market convention for which currency is quoted first: EUR > GBP > AUD > NZD >
// USD > CAD > CHF > (everything else) > JPY. So USD+JPY → USD/JPY, EUR+TRY → EUR/TRY,
// ZAR+JPY → ZAR/JPY. Two minors keep the order they were tapped in.
const PRIORITY = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF"];
const rank = (c: string) => {
  const i = PRIORITY.indexOf(c);
  if (i >= 0) return i;
  return c === "JPY" ? PRIORITY.length + 1 : PRIORITY.length;
};

/** Orient two currencies the way the market quotes them. */
export function normalizePair(first: string, second: string): Pair {
  return rank(second) < rank(first) ? { base: second, quote: first } : { base: first, quote: second };
}

// Currencies whose USD leg is quoted as XXX/USD; all others are USD/XXX.
const QUOTED_VS_USD = new Set(["EUR", "GBP", "AUD", "NZD"]);

/** biquote.io symbol for a currency's USD leg (EURUSD, USDJPY…), or undefined for USD itself. */
export function fxLegSymbol(code: string): string | undefined {
  if (code === "USD" || byCode(code)?.kind !== "fx") return undefined;
  return QUOTED_VS_USD.has(code) ? `${code}USD` : `USD${code}`;
}

/** Account-base currencies: the original app's nine, then every other currency A–Z. */
const ORIGINAL_BASES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD", "ZAR"];
export const BASE_CURRENCIES = [
  ...ORIGINAL_BASES,
  ...FX.map((i) => i.code).filter((c) => !ORIGINAL_BASES.includes(c)).sort(),
];

/** Unit modes the app supported: Lots, Mini Lots, Units. */
export type UnitMode = "lots" | "mini" | "units";
export const UNIT_LABELS: Record<UnitMode, string> = {
  lots: "Lots",
  mini: "Mini Lots",
  units: "Units",
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", CAD: "C$", CHF: "Fr ",
  NZD: "NZ$", CNH: "CN¥", CZK: "Kč ", DKK: "kr ", HUF: "Ft ", ILS: "₪", HKD: "HK$", KRW: "₩",
  MXN: "Mex$", NOK: "kr ", PLN: "zł ", RUB: "₽", SEK: "kr ", SGD: "S$", TRY: "₺", ZAR: "R",
  BRL: "R$", INR: "₹", THB: "฿", IDR: "Rp ", MYR: "RM ", PHP: "₱", TWD: "NT$", NGN: "₦",
  BDT: "৳", VND: "₫", EGP: "E£", KES: "KSh ", PKR: "Rs ",
};

/** Prefix for amounts in a currency; falls back to the ISO code. */
export function symbol(code: string): string {
  return CURRENCY_SYMBOL[code] ?? `${code} `;
}
