"use client";

import { useState } from "react";
import { authErrorText, errorCode } from "@/lib/auth-errors";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { CodeInput, useCountdown } from "./code-input";

/**
 * "Check your email" step: six code boxes (paste / autofill friendly), submit, and a resend link
 * with a countdown. `onSubmit` throws the API error on a wrong or expired code.
 */
export function CodeStep({
  email,
  initialCooldown,
  submitLabel,
  onSubmit,
  onResend,
  onBack,
}: {
  email: string;
  initialCooldown: number;
  submitLabel: string;
  onSubmit: (code: string) => Promise<void>;
  /** Asks for a new code; resolves to the seconds before the next resend. */
  onResend?: () => Promise<number>;
  onBack?: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, startCooldown] = useCountdown(initialCooldown);

  async function submit(value = code) {
    if (value.length !== 6 || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(value);
    } catch (err) {
      setError(authErrorText(err, t));
      // a dead code can't be retried: clear the boxes for the next one
      if (errorCode(err) !== "CODE_INVALID") setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!onResend || cooldown > 0) return;
    setError(null);
    setResending(true);
    try {
      startCooldown(await onResend());
      setCode("");
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-ink-900">{t("auth.verify.title")}</p>
        <p className="mt-1 text-sm text-ink-500 break-words">{t("auth.verify.sent_to", { email })}</p>
      </div>

      <CodeInput value={code} onChange={setCode} onComplete={(c) => void submit(c)} disabled={submitting}
                 invalid={Boolean(error)} />
      <FieldError>{error}</FieldError>

      <Button className="w-full" size="lg" onClick={() => void submit()} loading={submitting} disabled={code.length !== 6}>
        {submitLabel}
      </Button>

      <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
        {onBack ? (
          <button type="button" onClick={onBack} className="hover:underline">
            {t("auth.verify.use_other_email")}
          </button>
        ) : (
          <span />
        )}
        {onResend && (
          <button type="button" onClick={() => void resend()} disabled={cooldown > 0 || resending}
                  className="font-medium text-crimson-700 hover:underline disabled:text-ink-400 disabled:no-underline">
            {cooldown > 0 ? t("auth.resend_in", { n: cooldown }) : t("auth.resend_code")}
          </button>
        )}
      </div>
      <p className="text-xs text-ink-400">{t("auth.verify.spam_hint")}</p>
    </div>
  );
}
