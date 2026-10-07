"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { authErrorText, errorCode } from "@/lib/auth-errors";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { CodeInput, useCountdown } from "./code-input";
import { PasswordField } from "./password-field";

/**
 * Forgot password: e-mail → (code by e-mail) → code + new password. The first step answers the
 * same whether or not the address has an account. Resetting signs out every device, so the user
 * logs in again with the new password.
 */
export function ForgotPasswordForm({
  initialEmail,
  onSwitchToLogin,
}: {
  initialEmail?: string;
  onSuccess?: () => void;
  onSwitchToLogin: () => void;
}) {
  const { t } = useLanguage();
  const { show } = useToast();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, startCooldown] = useCountdown(0);

  async function sendCode() {
    setError(null);
    if (!email.trim()) {
      setError(t("auth.err.INVALID_EMAIL"));
      return;
    }
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
      startCooldown(60);
      setStep("reset");
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    if (code.length !== 6) {
      setError(t("auth.err.CODE_EXPIRED"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.err.PASSWORD_MISMATCH"));
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ email: email.trim(), code, password, confirmPassword });
      show(t("auth.toast.password_changed"), "success");
      onSwitchToLogin();
    } catch (err) {
      setError(authErrorText(err, t));
      if (errorCode(err) === "CODE_EXPIRED" || errorCode(err) === "CODE_TOO_MANY_ATTEMPTS") setCode("");
    } finally {
      setBusy(false);
    }
  }

  if (step === "reset") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-ink-500 break-words">{t("auth.forgot.sent", { email: email.trim() })}</p>
        <CodeInput value={code} onChange={setCode} disabled={busy} invalid={Boolean(error)} />
        <PasswordField
          id="reset-password"
          label={t("auth.new_password")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showStrength
          autoFocus={false}
        />
        <PasswordField
          id="reset-password-again"
          label={t("auth.password_retype")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          onEnter={() => void reset()}
          autoComplete="new-password"
        />
        <FieldError>{error}</FieldError>
        <Button className="w-full" size="lg" onClick={() => void reset()} loading={busy}>
          {t("auth.forgot.set_new")}
        </Button>
        <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
          <button type="button" onClick={() => setStep("email")} className="hover:underline">
            {t("auth.verify.use_other_email")}
          </button>
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={cooldown > 0 || busy}
            className="font-medium text-crimson-700 hover:underline disabled:text-ink-400 disabled:no-underline"
          >
            {cooldown > 0 ? t("auth.resend_in", { n: cooldown }) : t("auth.resend_code")}
          </button>
        </div>
        <p className="text-xs text-ink-400">{t("auth.verify.spam_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">{t("auth.forgot.intro")}</p>
      <div>
        <Label htmlFor="forgot-email">{t("auth.email")}</Label>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void sendCode()}
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button className="w-full" size="lg" onClick={() => void sendCode()} loading={busy}>
        {t("auth.send_code")}
      </Button>
      <p className="text-center text-sm text-ink-500">
        {t("auth.remembered_password")}{" "}
        <button type="button" onClick={onSwitchToLogin} className="font-medium text-crimson-700 hover:underline">
          {t("nav.log_in")}
        </button>
      </p>
    </div>
  );
}
