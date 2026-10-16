"use client";
// components/Keypad.tsx — numeric keypad mirroring the app's KeyboardView.
import { applyKey, Key, KeyOpts } from "@/lib/keypad";
import { IconBackspace } from "./icons";

interface Props extends KeyOpts {
  value: string;
  onChange: (v: string) => void;
}

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

export default function Keypad({ value, onChange, maxDecimals, maxLength }: Props) {
  return (
    <div className="w-full select-none">
      <div className="grid grid-cols-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            tabIndex={-1}
            disabled={k === "." && maxDecimals <= 0}
            onClick={() => onChange(applyKey(value, k, { maxDecimals, maxLength }))}
            className="keypad-key flex h-14 items-center justify-center rounded-xl text-2xl font-medium text-ink disabled:opacity-30"
            aria-label={k === "del" ? "Backspace" : k}
          >
            {k === "del" ? <IconBackspace width={26} height={26} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
