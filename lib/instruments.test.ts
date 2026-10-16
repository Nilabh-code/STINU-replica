import { describe, expect, it } from "vitest";
import { BASE_CURRENCIES, byCode, CRYPTO, FX, fxLegSymbol, fxPipSize, normalizePair, pairSpec } from "./instruments";
import { applyKey, keyFromKeyboard } from "./keypad";

describe("pairs", () => {
  it("orients pairs the way the market quotes them", () => {
    expect(normalizePair("JPY", "USD")).toEqual({ base: "USD", quote: "JPY" });
    expect(normalizePair("USD", "EUR")).toEqual({ base: "EUR", quote: "USD" });
    expect(normalizePair("GBP", "EUR")).toEqual({ base: "EUR", quote: "GBP" });
    expect(normalizePair("TRY", "EUR")).toEqual({ base: "EUR", quote: "TRY" });
    expect(normalizePair("CAD", "USD")).toEqual({ base: "USD", quote: "CAD" });
    expect(normalizePair("JPY", "ZAR")).toEqual({ base: "ZAR", quote: "JPY" });
    expect(normalizePair("NOK", "SEK")).toEqual({ base: "NOK", quote: "SEK" });
  });

  it("takes the pip size from the quote currency", () => {
    expect(fxPipSize("JPY")).toBe(0.01);
    expect(fxPipSize("HUF")).toBe(0.01);
    expect(fxPipSize("USD")).toBe(0.0001);
    expect(pairSpec("USD", "JPY")?.pipSize).toBe(0.01);
    expect(pairSpec("JPY", "USD")?.pipSize).toBe(0.0001);
    expect(pairSpec("USD", "JPY")?.priceDecimals).toBe(3);
  });

  it("uses wider pips for high-number quote currencies", () => {
    expect(fxPipSize("INR")).toBe(0.01);
    expect(fxPipSize("IDR")).toBe(1);
    expect(pairSpec("USD", "IDR")?.priceDecimals).toBe(1);
    expect(pairSpec("EUR", "USD")?.priceDecimals).toBe(5);
  });

  it("maps every currency to its USD leg on the live feed", () => {
    expect(fxLegSymbol("EUR")).toBe("EURUSD");
    expect(fxLegSymbol("NZD")).toBe("NZDUSD");
    expect(fxLegSymbol("JPY")).toBe("USDJPY");
    expect(fxLegSymbol("INR")).toBe("USDINR");
    expect(fxLegSymbol("USD")).toBeUndefined();
    expect(fxLegSymbol("BTC")).toBeUndefined();
    for (const { code } of FX) if (code !== "USD") expect(fxLegSymbol(code)).toMatch(/^[A-Z]{6}$/);
  });

  it("covers the wider market", () => {
    expect(FX.length).toBeGreaterThanOrEqual(45);
    expect(CRYPTO.length).toBeGreaterThanOrEqual(75);
    expect(BASE_CURRENCIES.slice(0, 9)).toEqual(["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD", "ZAR"]);
    expect(BASE_CURRENCIES).toContain("INR");
    expect(new Set(CRYPTO.map((c) => c.code)).size).toBe(CRYPTO.length);
    expect(byCode("BTC")?.liveSymbol).toBe("BTCUSDT");
    expect(byCode("XAU")?.liveSymbol).toBe("XAUUSD");
  });

  it("rejects pairs the calculator can't price", () => {
    expect(pairSpec("USD", "USD")).toBeUndefined();
    expect(pairSpec("XAU", "EUR")).toBeUndefined();
    expect(pairSpec("USD", "XAU")).toBeUndefined();
    expect(pairSpec("FOO", "USD")).toBeUndefined();
    expect(pairSpec("BTC", "USD")?.kind).toBe("crypto");
  });
});

describe("keypad rules", () => {
  const k = (v: string, key: Parameters<typeof applyKey>[1], maxDecimals = 2) => applyKey(v, key, { maxDecimals });

  it("edits digits", () => {
    expect(k("0", "5")).toBe("5");
    expect(k("12", "3")).toBe("123");
    expect(k("123", "del")).toBe("12");
    expect(k("", "del")).toBe("");
  });
  it("handles the decimal point", () => {
    expect(k("", ".")).toBe("0.");
    expect(k("1.5", ".")).toBe("1.5");
    expect(k("10", ".", 0)).toBe("10");
  });
  it("limits decimals and length", () => {
    expect(k("24.2", "5", 1)).toBe("24.2");
    expect(k("24.2", "5", 2)).toBe("24.25");
    expect(applyKey("123456789012", "3", { maxDecimals: 2 })).toBe("123456789012");
  });
  it("maps physical keys", () => {
    expect(keyFromKeyboard("7")).toBe("7");
    expect(keyFromKeyboard(",")).toBe(".");
    expect(keyFromKeyboard("Backspace")).toBe("del");
    expect(keyFromKeyboard("a")).toBeNull();
  });
});
