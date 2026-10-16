"use client";
// components/Keypad.tsx — numeric keypad mirroring the app's KeyboardView.
import { IconBackspace } from "./icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onDone?: () => void;
  allowDecimal?: boolean;
  label?: string;
}

export default function Keypad({ value, onChange, onDone, allowDecimal = true, label }: Props) {
  const press = (k: string) => {
    if (k === "del") {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === "." ) {
      if (!allowDecimal || value.includes(".")) return;
      onChange(value === "" ? "0." : value + ".");
      return;
    }
    if (k === "00") {
      onChange(value === "" || value === "0" ? "0" : value + "00");
      return;
    }
    if (k === "000") {
      onChange(value === "" || value === "0" ? "0" : value + "000");
      return;
    }
    // digits
    if (value === "0" && k !== ".") {
      onChange(k);
    } else {
      onChange(value + k);
    }
  };

  const keys: { k: string; node?: React.ReactNode }[] = [
    { k: "1" }, { k: "2" }, { k: "3" },
    { k: "4" }, { k: "5" }, { k: "6" },
    { k: "7" }, { k: "8" }, { k: "9" },
    { k: allowDecimal ? "." : "00" }, { k: "0" }, { k: "del", node: <IconBackspace width={26} height={26} /> },
  ];

  return (
    <div className="w-full select-none">
      <div className="grid grid-cols-3">
        {keys.map(({ k, node }) => (
          <button
            key={k}
            type="button"
            onClick={() => (k === "done" ? onDone?.() : press(k))}
            className="keypad-key flex h-14 items-center justify-center rounded-xl text-2xl font-medium text-ink"
            aria-label={k}
          >
            {node ?? k}
          </button>
        ))}
      </div>
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="mt-1 h-14 w-full rounded-xl bg-navy text-base font-semibold tracking-wide text-white"
        >
          {label ?? "DONE"}
        </button>
      )}
    </div>
  );
}
