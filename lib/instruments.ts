// lib/instruments.ts
// Instrument model for the STINU position-size calculator clone.
// Values derived from the original app's resource strings + result-table arithmetic.

export type Kind = "fx" | "commodity" | "crypto";

export interface Instrument {
  code: string;       // display code, e.g. "EUR", "XAU", "BTC"
  name: string;
  kind: Kind;
  /** price increment that counts as one "pip"/tick, in quote currency */
  pipSize: number;
  /** units per 1.00 standard lot */
  contractSize: number;
  /** decimals to display for prices / values */
  decimals: number;
  /** is this selectable in the original app (some cells were faded/disabled) */
  enabled: boolean;
}

// ---- Fiat / FX currencies (from the app's currency grid) --------------------
// 8 majors are enabled; the exotics match the grid (a few were shown disabled).
export const FX: Instrument[] = [
  { code: "USD", name: "US Dollar",         kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "EUR", name: "Euro",              kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "GBP", name: "British Pound",     kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "JPY", name: "Japanese Yen",      kind: "fx", pipSize: 0.01,   contractSize: 100000, decimals: 3, enabled: true },
  { code: "AUD", name: "Australian Dollar", kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "CAD", name: "Canadian Dollar",   kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "CHF", name: "Swiss Franc",       kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "NZD", name: "New Zealand Dollar",kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "CNH", name: "Chinese Yuan (Offshore)", kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "CZK", name: "Czech Koruna",       kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "DKK", name: "Danish Krone",      kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "HUF", name: "Hungarian Forint",  kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: false },
  { code: "ILS", name: "Israeli Shekel",    kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "HKD", name: "Hong Kong Dollar",  kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: false },
  { code: "KRW", name: "Korean Won",        kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "MXN", name: "Mexican Peso",      kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: false },
  { code: "NOK", name: "Norwegian Krone",   kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "PLN", name: "Polish Zloty",      kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "RUB", name: "Russian Ruble",     kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "SEK", name: "Swedish Krona",     kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "SGD", name: "Singapore Dollar",  kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "TRY", name: "Turkish Lira",      kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
  { code: "ZAR", name: "South African Rand",kind: "fx", pipSize: 0.0001, contractSize: 100000, decimals: 5, enabled: true },
];

// ---- Commodities (contract sizes straight from the app's help copy) --------
// "SILVER Contract Size is 5000 / GOLD Contract Size is 100"
export const COMMODITIES: Instrument[] = [
  { code: "WTI", name: "Crude Oil (WTI)", kind: "commodity", pipSize: 0.01, contractSize: 1000, decimals: 2, enabled: true },
  { code: "XAU", name: "Gold",            kind: "commodity", pipSize: 0.01, contractSize: 100,  decimals: 2, enabled: true },
  { code: "XAG", name: "Silver",          kind: "commodity", pipSize: 0.001, contractSize: 5000, decimals: 3, enabled: true },
];

// ---- Crypto (quoted vs USD). Exact list from the app's k6/l0.java -------------
// NOTE: the original routes crypto through a separate price-distance formula
// (k6/l0.java method P, the `z0 && A0.contains(base)` branch) rather than the
// pip-based FX/commodity path. This clone models crypto with the FX formula
// (contractSize 1) as an approximation; FX and commodities are byte-exact.
export const CRYPTO: Instrument[] = [
  { code: "BTC",   name: "Bitcoin",      kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "ETH",   name: "Ethereum",     kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "XRP",   name: "Ripple",       kind: "crypto", pipSize: 0.00001, contractSize: 1, decimals: 5, enabled: true },
  { code: "LTC",   name: "Litecoin",     kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "IOTA",  name: "IOTA",         kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "SOL",   name: "Solana",       kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "DOGE",  name: "Dogecoin",     kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "ADA",   name: "Cardano",      kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "AVAX",  name: "Avalanche",    kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "DAI",   name: "Dai",          kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "USDC",  name: "USD Coin",     kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "LN",    name: "LN",           kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "SHIB",  name: "Shiba Inu",    kind: "crypto", pipSize: 0.00000001, contractSize: 1, decimals: 8, enabled: true },
  { code: "FDUSD", name: "First Digital USD", kind: "crypto", pipSize: 0.0001, contractSize: 1, decimals: 4, enabled: true },
  { code: "BNB",   name: "BNB",          kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "TRX",   name: "TRON",         kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "SUI",   name: "Sui",          kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
  { code: "BCH",   name: "Bitcoin Cash", kind: "crypto", pipSize: 0.01,    contractSize: 1, decimals: 2, enabled: true },
  { code: "XLM",   name: "Stellar",      kind: "crypto", pipSize: 0.0001,  contractSize: 1, decimals: 4, enabled: true },
];

export const ALL: Instrument[] = [...FX, ...COMMODITIES, ...CRYPTO];

export function byCode(code: string): Instrument | undefined {
  return ALL.find((i) => i.code === code);
}

/** Account-base currencies offered by the original app (Settings → Account Base). */
export const BASE_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD", "ZAR"];

/** Unit modes the app supported: Lots, Mini Lots, Units. */
export type UnitMode = "lots" | "mini" | "units";
export const UNIT_LABELS: Record<UnitMode, string> = {
  lots: "Lots",
  mini: "Mini Lots",
  units: "Units",
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", CAD: "C$", CHF: "Fr",
  NZD: "NZ$", CNY: "¥", DKK: "kr", HUF: "Ft", ILS: "₪", HKD: "HK$", KRW: "₩",
  MXN: "Mex$", NOK: "kr", PLN: "zł", RUB: "₽", SEK: "kr", SGD: "S$", TRY: "₺", ZAR: "R",
};

export function symbol(code: string): string {
  return CURRENCY_SYMBOL[code] ?? "";
}
