"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/field";

/** 0-4 from length and variety; the server's rules (8+ chars, a letter and a number, not common) decide. */
export function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/\p{L}/u.test(password) && /\d/.test(password)) score++;
  if ((/[a-z]/.test(password) && /[A-Z]/.test(password)) || /[^\p{L}\d]/u.test(password)) score++;
  if (password.length < 8 || !/\d/.test(password) || !/\p{L}/u.test(password)) score = Math.min(score, 1);
  return score;
}

const LEVELS = [
  { key: "auth.strength.weak", bar: "bg-red-500" },
  { key: "auth.strength.weak", bar: "bg-red-500" },
  { key: "auth.strength.fair", bar: "bg-amber-500" },
  { key: "auth.strength.good", bar: "bg-emerald-500" },
  { key: "auth.strength.strong", bar: "bg-emerald-600" },
];

/** Password input with a show/hide toggle and, optionally, a live strength hint. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  onEnter,
  autoComplete,
  showStrength,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  autoComplete: "current-password" | "new-password";
  showStrength?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const score = passwordScore(value);
  const level = LEVELS[score];

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("auth.hide_password") : t("auth.show_password")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-700"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      {showStrength && (
        <div className="mt-2" aria-live="polite">
          {value && (
            <>
              <div className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={cn("h-1 flex-1 rounded-full", n <= Math.max(score, 1) ? level.bar : "bg-ink-100")} />
                ))}
              </div>
              <p className="mt-1 text-xs font-medium text-ink-600">{t(level.key)}</p>
            </>
          )}
          <p className="mt-0.5 text-xs text-ink-400">{t("auth.strength.rules")}</p>
        </div>
      )}
    </div>
  );
}
