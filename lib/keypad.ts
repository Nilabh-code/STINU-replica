// lib/keypad.ts — input rules shared by the on-screen keypad and the physical keyboard.

export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "del";

export interface KeyOpts {
  /** digits allowed after the decimal point; 0 disables "." */
  maxDecimals: number;
  /** total characters allowed */
  maxLength?: number;
}

/** Apply one key press to a numeric input string. Invalid presses return `value` unchanged. */
export function applyKey(value: string, key: Key, { maxDecimals, maxLength = 12 }: KeyOpts): string {
  if (key === "del") return value.slice(0, -1);
  if (key === ".") {
    if (maxDecimals <= 0 || value.includes(".")) return value;
    return value === "" ? "0." : value + ".";
  }
  if (value === "0") return key;
  const next = value + key;
  const dot = next.indexOf(".");
  if (dot >= 0 && next.length - dot - 1 > maxDecimals) return value;
  if (next.length > maxLength) return value;
  return next;
}

/** Map a KeyboardEvent.key to a keypad key, or null if it isn't one. */
export function keyFromKeyboard(k: string): Key | null {
  if (/^[0-9]$/.test(k)) return k as Key;
  if (k === "." || k === ",") return ".";
  if (k === "Backspace") return "del";
  return null;
}
