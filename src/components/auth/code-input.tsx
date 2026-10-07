"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * Six one-digit boxes for an e-mailed code: typing moves forward, Backspace moves back, and pasting
 * (or the phone's one-time-code autofill) fills every box at once. Calls `onComplete` when all six
 * digits are in. The value is always a contiguous string of up to six digits.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus = true,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useLanguage();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    boxes.current[Math.min(clean.length, LENGTH - 1)]?.focus();
    if (clean.length === LENGTH) onComplete?.(clean);
  }

  function handleInput(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    if (typed.length > 1) {
      commit(typed); // paste or autofill into one box
      return;
    }
    const at = Math.min(index, value.length);
    commit(value.slice(0, at) + typed + value.slice(at + 1));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const at = index < value.length ? index : value.length - 1;
      if (at < 0) return;
      onChange(value.slice(0, at) + value.slice(at + 1));
      boxes.current[Math.max(0, at)]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      boxes.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < Math.min(value.length, LENGTH - 1)) {
      boxes.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    commit(pasted);
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-3" dir="ltr">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={value[i] ?? ""}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("auth.code_digit", { n: i + 1 })}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-11 sm:h-14 sm:w-12 rounded-xl border bg-surface text-center text-xl font-semibold text-ink-900 tabular-nums",
            "focus:outline-none focus:ring-2 focus:ring-crimson-500/30 focus:border-crimson-500 disabled:opacity-60",
            invalid ? "border-red-400" : "border-ink-200"
          )}
        />
      ))}
    </div>
  );
}

/** Seconds left before "Resend code" is allowed again; `start(n)` restarts the countdown. */
export function useCountdown(initial = 0): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}
