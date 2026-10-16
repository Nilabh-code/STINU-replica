// Expected values below are worked out by hand from the textbook pip-value formula,
// not by calling the code under test.
import { describe, expect, it } from "vitest";
import { buildTable, calculate, CalcInput, decimalsOf, fmt, tableStops } from "./calc";
import { accountPerQuote, pairPrice, RateMap } from "./prices";

// units per 1 USD
const RATES: RateMap = { USD: 1, EUR: 0.88865, GBP: 0.74989, JPY: 158.02 };

function input(over: Partial<CalcInput> = {}): CalcInput {
  const base = over.base ?? "EUR";
  const quote = over.quote ?? "USD";
  const account = over.accountCurrency ?? "USD";
  return {
    balance: 10550,
    riskMode: "percent",
    riskPercent: 1.5,
    riskAmount: 0,
    stop: 24.2,
    accountCurrency: account,
    base,
    quote,
    accountPerQuote: accountPerQuote(RATES, quote, account),
    ...over,
  };
}

describe("reference case from the original app's screenshot", () => {
  it("EUR/USD, USD account, $10,550 @ 1.5%, 24.2 pips", () => {
    const r = calculate(input());
    expect(r.valid).toBe(true);
    expect(r.riskAmount).toBeCloseTo(158.25, 10);
    expect(r.pipValuePerLot).toBeCloseTo(10, 10);
    expect(fmt(r.miniLots, 3)).toBe("6.539");
    expect(fmt(r.units, 0)).toBe("65,393");
  });

  it("reproduces the result table exactly", () => {
    const rows = buildTable(input(), "mini");
    expect(rows.map((r) => `${r.label} ${fmt(r.value, 3)}`).join(" ")).toBe(
      "20 7.912 21 7.536 22 7.193 23 6.880 24 6.594 24.1 6.566 24.2 6.539 24.3 6.512 24.4 6.486",
    );
    expect(rows.filter((r) => r.anchor).map((r) => r.label)).toEqual(["24.2"]);
  });
});

describe("currency conversion", () => {
  it("EUR account on EUR/USD: a $10 pip is worth €8.8865", () => {
    const r = calculate(input({ accountCurrency: "EUR" }));
    expect(r.pipValuePerLot).toBeCloseTo(8.8865, 6);
    expect(fmt(r.miniLots, 3)).toBe("7.359"); // 158.25 / (24.2 × 8.8865) × 10
  });

  it("JPY account on EUR/USD: a $10 pip is worth ¥1,580.20", () => {
    const r = calculate(input({ accountCurrency: "JPY", balance: 1_000_000, riskPercent: 1, stop: 20 }));
    expect(r.pipValuePerLot).toBeCloseTo(1580.2, 6);
    expect(fmt(r.lots, 3)).toBe("0.316"); // 10,000 / (20 × 1,580.20)
  });

  it("USD/JPY on a USD account: ¥1,000 per pip = $6.3283", () => {
    const r = calculate(input({ base: "USD", quote: "JPY" }));
    expect(r.pipValuePerLot).toBeCloseTo(6.32831, 4);
    expect(fmt(r.miniLots, 3)).toBe("10.333"); // 158.25 × 158.02 / (24.2 × 1000) × 10
  });

  it("USD/EUR (swapped) on a USD account: €10 per pip = $11.2530", () => {
    const r = calculate(input({ base: "USD", quote: "EUR" }));
    expect(r.pipValuePerLot).toBeCloseTo(11.25302, 4);
    expect(fmt(r.miniLots, 3)).toBe("5.811");
  });

  it("GBP/JPY cross on a EUR account: ¥1,000 per pip = €5.6237", () => {
    const r = calculate(input({ base: "GBP", quote: "JPY", accountCurrency: "EUR" }));
    expect(r.pipValuePerLot).toBeCloseTo(5.62365, 4);
  });

  it("needs no rates at all when the quote is the account currency", () => {
    expect(accountPerQuote(undefined, "USD", "USD")).toBe(1);
    expect(accountPerQuote(undefined, "JPY", "USD")).toBeUndefined();
  });

  it("treats a currency missing from the feed as unknown, never as 1.0", () => {
    expect(accountPerQuote(RATES, "RUB", "USD")).toBeUndefined();
    expect(pairPrice(RATES, "RUB", "USD")).toBeUndefined();
    const r = calculate(input({ base: "USD", quote: "RUB", accountPerQuote: undefined }));
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/No exchange rate/);
  });
});

describe("commodities and crypto", () => {
  it("gold: 100 oz × $0.01 = $1 per pip per lot", () => {
    const r = calculate(input({ base: "XAU", balance: 10000, riskPercent: 1, stop: 250 }));
    expect(r.pipValuePerLot).toBeCloseTo(1, 10);
    expect(r.lots).toBeCloseTo(0.4, 10); // $100 / (250 × $1)
  });

  it("WTI: 1,000 bbl × $0.01 = $10 per pip per lot", () => {
    expect(calculate(input({ base: "WTI" })).pipValuePerLot).toBeCloseTo(10, 10);
  });

  it("crypto: stop is a USD distance, size is in coins", () => {
    const r = calculate(input({ base: "BTC", riskMode: "amount", riskAmount: 100, stop: 500 }));
    expect(r.units).toBeCloseTo(0.2, 10);
  });

  it("crypto on a EUR account converts the USD distance", () => {
    const r = calculate(input({ base: "BTC", accountCurrency: "EUR", riskMode: "amount", riskAmount: 100, stop: 500 }));
    expect(r.units).toBeCloseTo(100 / (500 * 0.88865), 8);
  });

  it("rejects commodities/crypto against a non-USD quote", () => {
    expect(calculate(input({ base: "XAU", quote: "EUR" })).error).toBe("Unsupported pair");
  });
});

describe("input validation", () => {
  it("rejects risk above 100%", () => {
    expect(calculate(input({ riskPercent: 500 })).error).toMatch(/100%/);
  });
  it("rejects a fixed risk larger than the balance", () => {
    expect(calculate(input({ riskMode: "amount", riskAmount: 20000 })).error).toMatch(/larger than your account balance/);
  });
  it("requires a balance, a risk and a stop", () => {
    expect(calculate(input({ balance: 0 })).valid).toBe(false);
    expect(calculate(input({ riskPercent: 0 })).valid).toBe(false);
    expect(calculate(input({ stop: 0 })).valid).toBe(false);
  });
});

describe("nudge table stops", () => {
  const labels = (a: number) => tableStops(a).map((r) => r.label);
  const anchor = (a: number) => tableStops(a).filter((r) => r.anchor).map((r) => r.label);

  it("keeps the original layout for 24.2", () => {
    expect(labels(24.2)).toEqual(["20", "21", "22", "23", "24", "24.1", "24.2", "24.3", "24.4"]);
  });
  it("always contains the entered stop", () => {
    expect(labels(24.7)).toEqual(["20", "21", "22", "23", "24", "24.6", "24.7", "24.8", "24.9"]);
    expect(anchor(24.7)).toEqual(["24.7"]);
    expect(labels(24.25)).toEqual(["20", "21", "22", "23", "24", "24.24", "24.25", "24.26", "24.27"]);
    expect(anchor(24.25)).toEqual(["24.25"]);
  });
  it("centres whole-number stops", () => {
    expect(labels(24)).toEqual(["20", "21", "22", "23", "24", "25", "26", "27", "28"]);
    expect(labels(1500)[4]).toBe("1500");
  });
  it("pads small stops to nine rows", () => {
    expect(labels(0.5)).toEqual(["0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0", "1.1", "1.2"]);
    expect(labels(0.1)).toEqual(["0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9"]);
    expect(labels(2.5)).toEqual(["1", "2", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "3.0"]);
    expect(labels(2)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });
  it("handles tiny crypto distances", () => {
    expect(anchor(0.0000005)).toEqual(["0.0000005"]);
    expect(tableStops(0.0000005)).toHaveLength(9);
  });
  it("returns nothing for an empty stop", () => {
    expect(tableStops(0)).toEqual([]);
  });
});

describe("decimalsOf", () => {
  it("counts typed decimals", () => {
    expect(decimalsOf(24.2)).toBe(1);
    expect(decimalsOf(1500)).toBe(0);
    expect(decimalsOf(24.25)).toBe(2);
    expect(decimalsOf(0.0000005)).toBe(7);
  });
});
