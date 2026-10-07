"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { authErrorText, errorCode } from "@/lib/auth-errors";
import { usePlatformFeatures } from "@/lib/community-settings";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/lib/toast-context";
import type { TokenPairDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { CodeStep } from "./code-step";
import { GoogleButton, useGoogleSignInAvailable } from "./google-button";
import { PasswordField } from "./password-field";

/** "or" between the Google button and the e-mail form. */
export function OrDivider() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-400">
      <span className="h-px flex-1 bg-ink-200" />
      {t("auth.or")}
      <span className="h-px flex-1 bg-ink-200" />
    </div>
  );
}

/**
 * Log in: a big "Continue with Google", then e-mail + password. Phone login is gone (V70). An
 * account whose sign-up code was never entered goes straight to the code screen.
 */
export function LoginForm({
  onSuccess,
  onSwitchToSignup,
  onSwitchToForgotPassword,
}: {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
  onSwitchToForgotPassword: (email?: string) => void;
}) {
  const { login } = useAuth();
  const { show } = useToast();
  const { t } = useLanguage();
  const { passwordLoginEnabled } = usePlatformFeatures();
  const googleAvailable = useGoogleSignInAvailable();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [verify, setVerify] = useState<{ email: string } | null>(null);
  // Personal and business are separate accounts; the business one opens through the personal login.
  const [asBusiness, setAsBusiness] = useState(false);
  const context = asBusiness ? "BUSINESS_OWNER" : undefined;

  function signedIn(tokens: TokenPairDto) {
    login(tokens);
    show(t("auth.toast.logged_in"), "success");
    onSuccess();
  }

  async function handleGoogle(idToken: string) {
    setError(null);
    setGoogleBusy(true);
    try {
      signedIn(await authApi.google(idToken, context));
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t("auth.err.INVALID_CREDENTIALS"));
      return;
    }
    setSubmitting(true);
    try {
      signedIn(await authApi.login(email.trim(), password, context));
    } catch (err) {
      if (errorCode(err) === "EMAIL_NOT_VERIFIED") {
        // a fresh code, then the code screen
        const pending = await authApi.resendVerification(email.trim()).catch(() => null);
        setVerify({ email: pending?.email ?? email.trim().toLowerCase() });
      } else {
        setError(authErrorText(err, t));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (verify) {
    return (
      <CodeStep
        email={verify.email}
        initialCooldown={60}
        submitLabel={t("auth.verify.button")}
        onSubmit={async (code) => {
          signedIn(await authApi.verifyEmail(verify.email, code));
          show(t("auth.toast.email_verified"), "success");
        }}
        onResend={async () => (await authApi.resendVerification(verify.email)).resendAfterSeconds}
        onBack={() => setVerify(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <GoogleButton onCredential={(token) => void handleGoogle(token)} />
      {googleBusy && (
        <div className="flex justify-center" aria-busy="true">
          <Spinner className="h-5 w-5" />
        </div>
      )}

      {passwordLoginEnabled && (
        <>
          {googleAvailable && <OrDivider />}

          <div>
            <Label htmlFor="login-email">{t("auth.email")}</Label>
            <Input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
            />
          </div>

          <PasswordField
            id="login-password"
            label={t("auth.password")}
            value={password}
            onChange={setPassword}
            onEnter={() => void handleLogin()}
            autoComplete="current-password"
          />

          <div className="flex justify-end -mt-2 text-sm">
            <button
              type="button"
              onClick={() => onSwitchToForgotPassword(email.trim() || undefined)}
              className="font-medium text-crimson-700 hover:underline"
            >
              {t("auth.forgot_password")}
            </button>
          </div>
        </>
      )}

      <FieldError>{error}</FieldError>

      {passwordLoginEnabled && (
        <Button className="w-full" size="lg" onClick={() => void handleLogin()} loading={submitting}>
          {t("nav.log_in")}
        </Button>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={() => setAsBusiness((v) => !v)}
          className="text-sm text-ink-500 hover:text-ink-800 hover:underline"
        >
          {asBusiness ? t("auth.log_in_personal") : t("auth.log_in_business")}
        </button>
      </div>

      <p className="text-center text-sm text-ink-500">
        {t("auth.no_account")}{" "}
        <button type="button" onClick={onSwitchToSignup} className="font-medium text-crimson-700 hover:underline">
          {t("auth.create_account")}
        </button>
      </p>
      <p className="text-center text-xs text-ink-400">{t("auth.terms_note")}</p>
    </div>
  );
}
