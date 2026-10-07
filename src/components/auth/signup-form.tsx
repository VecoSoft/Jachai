"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { authErrorText } from "@/lib/auth-errors";
import { usePlatformFeatures } from "@/lib/community-settings";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/lib/toast-context";
import type { TokenPairDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { CodeStep } from "./code-step";
import { GoogleButton, useGoogleSignInAvailable } from "./google-button";
import { OrDivider } from "./login-form";
import { PasswordField } from "./password-field";

/**
 * Sign up: "Continue with Google", or name + e-mail + password (with re-type, show/hide and a live
 * strength hint). An e-mail sign-up is only active once the 6-digit code from the e-mail is entered.
 */
export function SignupForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}) {
  const { login } = useAuth();
  const { show } = useToast();
  const { t, lang } = useLanguage();
  const { newSignupsEnabled, passwordLoginEnabled } = usePlatformFeatures();
  const googleAvailable = useGoogleSignInAvailable();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [pending, setPending] = useState<{ email: string; resendAfterSeconds: number } | null>(null);

  function signedIn(tokens: TokenPairDto, toastKey: string) {
    login(tokens);
    show(t(toastKey), "success");
    onSuccess();
  }

  async function handleGoogle(idToken: string) {
    setError(null);
    setGoogleBusy(true);
    try {
      signedIn(await authApi.google(idToken), "auth.toast.logged_in");
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleSignup() {
    setError(null);
    if (!name.trim()) {
      setError(t("auth.err.NAME_REQUIRED"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.err.PASSWORD_MISMATCH"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        language: lang,
      });
      setPending({ email: result.email, resendAfterSeconds: result.resendAfterSeconds });
      show(t("auth.toast.code_sent"), "success");
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (!newSignupsEnabled) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink-700">{t("auth.err.SIGNUPS_CLOSED")}</p>
        <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium text-crimson-700 hover:underline">
          {t("auth.have_account")} {t("nav.log_in")}
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <CodeStep
        email={pending.email}
        initialCooldown={pending.resendAfterSeconds}
        submitLabel={t("auth.verify.button")}
        onSubmit={async (code) => signedIn(await authApi.verifyEmail(pending.email, code), "auth.toast.email_verified")}
        onResend={async () => (await authApi.resendVerification(pending.email)).resendAfterSeconds}
        onBack={() => setPending(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <GoogleButton text="signup_with" onCredential={(token) => void handleGoogle(token)} />
      {googleBusy && (
        <div className="flex justify-center" aria-busy="true">
          <Spinner className="h-5 w-5" />
        </div>
      )}

      {passwordLoginEnabled && (
        <>
          {googleAvailable && <OrDivider />}

          <div>
            <Label htmlFor="signup-name">{t("auth.name")}</Label>
            <Input
              id="signup-name"
              autoComplete="name"
              placeholder={t("auth.name_placeholder")}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="signup-email">{t("auth.email")}</Label>
            <Input
              id="signup-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <PasswordField
            id="signup-password"
            label={t("auth.password")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            showStrength
          />

          <PasswordField
            id="signup-password-again"
            label={t("auth.password_retype")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            onEnter={() => void handleSignup()}
            autoComplete="new-password"
          />
        </>
      )}

      <FieldError>{error}</FieldError>

      {passwordLoginEnabled && (
        <Button className="w-full" size="lg" onClick={() => void handleSignup()} loading={submitting}>
          {t("auth.create_account")}
        </Button>
      )}

      <p className="text-center text-sm text-ink-500">
        {t("auth.have_account")}{" "}
        <button type="button" onClick={onSwitchToLogin} className="font-medium text-crimson-700 hover:underline">
          {t("nav.log_in")}
        </button>
      </p>
      <p className="text-center text-xs text-ink-400">{t("auth.terms_note")}</p>
    </div>
  );
}
