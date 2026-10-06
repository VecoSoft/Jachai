"use client";

import { useState } from "react";
import { ApiClientError, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { isValidBdPhone, isValidPassword, normalizeBdPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePlatformFeatures } from "@/lib/community-settings";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";

const RESEND_COOLDOWN_SECONDS = 60;

export function SignupForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}) {
  const { login } = useAuth();
  const { show } = useToast();
  const { t } = useLanguage();
  const signupsOpen = usePlatformFeatures().newSignupsEnabled;

  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function requestOtp() {
    setError(null);
    if (!name.trim()) {
      setError(t("auth.error.enter_name"));
      return;
    }
    if (!isValidBdPhone(phone)) {
      setError(t("auth.error.invalid_phone"));
      return;
    }
    if (!isValidPassword(password)) {
      setError(t("auth.error.password_min"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.error.passwords_mismatch"));
      return;
    }
    setSending(true);
    try {
      await authApi.requestOtp(normalizeBdPhone(phone));
      setStep("otp");
      startCooldown();
      show(t("auth.toast.otp_sent"), "success");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        setError(t("auth.error.too_many_otp"));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSending(false);
    }
  }

  async function verifyAndRegister() {
    setError(null);
    if (code.trim().length < 4) {
      setError(t("auth.error.enter_code"));
      return;
    }
    setVerifying(true);
    try {
      // Every account can both write reviews and add/manage businesses (spec:
      // one account, switch modes in the nav) — role is just the backend's
      // required-but-unused-for-gating field, always CONSUMER at signup.
      const tokens = await authApi.register(normalizeBdPhone(phone), code.trim(), password, "CONSUMER", name.trim());
      login(tokens);
      show(t("auth.toast.account_created"), "success");
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  if (!signupsOpen) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink-700">New sign-ups are paused right now. Please check back soon.</p>
        <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium text-crimson-700 hover:underline">
          Already have an account? Log in
        </button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-500">{t("auth.sent_to", { phone: normalizeBdPhone(phone) })}</p>

        <div>
          <Label htmlFor="signup-code">{t("auth.otp_code_label")}</Label>
          <Input
            id="signup-code"
            inputMode="numeric"
            autoFocus
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verifyAndRegister()}
          />
          <FieldError>{error}</FieldError>
        </div>

        <Button className="w-full" size="lg" onClick={verifyAndRegister} loading={verifying}>
          {t("auth.verify_create_account")}
        </Button>

        <div className="flex justify-between text-sm text-ink-500">
          <button type="button" onClick={() => setStep("details")} className="hover:underline">
            {t("auth.back")}
          </button>
          <button
            type="button"
            onClick={requestOtp}
            disabled={cooldown > 0 || sending}
            className="hover:underline disabled:opacity-50"
          >
            {cooldown > 0 ? t("auth.resend_in", { n: cooldown }) : t("auth.resend_code")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="signup-name">{t("account.name")}</Label>
        <Input
          id="signup-name"
          autoFocus
          placeholder={t("account.name_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="signup-phone">{t("auth.mobile_number")}</Label>
        <Input
          id="signup-phone"
          inputMode="tel"
          placeholder="01712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="signup-password">{t("auth.password")}</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FieldHint>{t("auth.hint.min_8_chars")}</FieldHint>
      </div>

      <div>
        <Label htmlFor="signup-confirm-password">{t("auth.confirm_password")}</Label>
        <Input
          id="signup-confirm-password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && requestOtp()}
        />
      </div>

      <FieldError>{error}</FieldError>

      <Button className="w-full" size="lg" onClick={requestOtp} loading={sending}>
        {t("button.create_account")}
      </Button>

      <p className="text-center text-sm text-ink-500">
        {t("auth.have_account")}{" "}
        <button type="button" onClick={onSwitchToLogin} className="text-crimson-700 hover:underline font-medium">
          {t("nav.log_in")}
        </button>
      </p>
    </div>
  );
}