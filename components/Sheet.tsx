"use client";
// components/Sheet.tsx — bottom-sheet dialog shell shared by the picker, base and result sheets.
// Closes on backdrop click or Escape, keeps Tab focus inside, and restores focus on close.
import { useEffect, useRef } from "react";

interface Props {
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sheet({ label, onClose, className = "", children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panel.current;
    const opener = document.activeElement as HTMLElement | null;
    el?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !el) return;
      const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`animate-sheet w-full max-w-md rounded-t-[28px] shadow-2xl outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
