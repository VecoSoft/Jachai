"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MailPlus } from "lucide-react";
import { userApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { authErrorText } from "@/lib/auth-errors";
import { usePlatformFeatures } from "@/lib/community-settings";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { CodeStep } from "@/components/auth/code-step";
import { GoogleButton, useGoogleSignInAvailable } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/login-form";
import { PasswordField } from "@/components/auth/password-field";

/**
 * V70: accounts created with phone + OTP have no e-mail and phone login is switched off, so they're
 * asked to "Add email": link Google (one tap) or set an e-mail + password and enter the code. The
 * sheet opens from the banner on their next visit, from Account settings, and when an order or
 * booking answers EMAIL_VERIFICATION_REQUIRED.
 */
interface AddEmailContextValue {
  open: (reasonKey?: string) => void;
}

const AddEmailContext = createContext<AddEmailContextValue | null>(null);
const DISMISSED_KEY = "jachai:add-email-dismissed";

export function AddEmailProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpenState] = useState<{ reasonKey?: string } | null>(null);
  const open = useCallback((reasonKey?: string) => setOpenState({ reasonKey }), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <AddEmailContext.Provider value={value}>
      {children}
      <AddEmailBanner onOpen={() => open()} />
      <AddEmailSheet state={openState} onClose={() => setOpenState(null)} />
    </AddEmailContext.Provider>
  );
}

export function useAddEmail(): AddEmailContextValue {
  const ctx = useContext(AddEmailContext);
  if (!ctx) throw new Error("useAddEmail must be used within AddEmailProvider");
  return ctx;
}

/** Bottom banner for an account that still needs an e-mail; "Later" hides it for this browser session. */
function AddEmailBanner({ onOpen }: { onOpen: () => void }) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!profile?.needsEmail || dismissed) return null;

  function later() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* private mode: just hide it for now */
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-6 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-ink-200 bg-surface p-4 shadow-xl">
        <div className="flex gap-3">
          <MailPlus className="h-6 w-6 shrink-0 text-crimson-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-900">{t("addemail.banner.title")}</p>
            <p className="mt-0.5 text-sm text-ink-600">{t("addemail.banner.body")}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={onOpen}>
                {t("addemail.cta")}
              </Button>
              <Button size="sm" variant="ghost" onClick={later}>
                {t("addemail.later")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddEmailSheet({ state, onClose }: { state: { reasonKey?: string } | null; onClose: () => void }) {
  const { setProfile } = useAuth();
  const { t } = useLanguage();
  const { show } = useToast();
  const { passwordLoginEnabled } = usePlatformFeatures();
  const googleAvailable = useGoogleSignInAvailable();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ email: string; resendAfterSeconds: number } | null>(null);

  useEffect(() => {
    if (state) {
      setError(null);
      setPending(null);
    }
  }, [state]);

  function finish(profileUpdate: Parameters<typeof setProfile>[0]) {
    setProfile(profileUpdate);
    show(t("addemail.done"), "success");
    onClose();
  }

  async function linkGoogle(idToken: string) {
    setError(null);
    setBusy(true);
    try {
      finish(await userApi.linkGoogle(idToken));
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setError(null);
    if (password !== confirmPassword) {
      setError(t("auth.err.PASSWORD_MISMATCH"));
      return;
    }
    setBusy(true);
    try {
      const result = await userApi.addEmail(email.trim(), password, confirmPassword);
      setPending({ email: result.email, resendAfterSeconds: result.resendAfterSeconds });
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={state !== null} onClose={onClose} labelledBy="add-email-heading" panelClassName="max-w-md">
      <div className="px-5 py-7 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 id="add-email-heading" className="font-display text-xl font-extrabold text-ink-900">
            {t("addemail.title")}
          </h2>
          <p className="mt-1 text-sm text-ink-500">{t(state?.reasonKey ?? "addemail.banner.body")}</p>
        </div>

        {pending ? (
          <CodeStep
            email={pending.email}
            initialCooldown={pending.resendAfterSeconds}
            submitLabel={t("auth.verify.button")}
            onSubmit={async (code) => finish(await userApi.verifyAddedEmail(pending.email, code))}
            onResend={async () => (await userApi.addEmail(pending.email, password, confirmPassword)).resendAfterSeconds}
            onBack={() => setPending(null)}
          />
        ) : (
          <>
            <GoogleButton text="continue_with" onCredential={(token) => void linkGoogle(token)} />
            {passwordLoginEnabled && (
              <>
                {googleAvailable && <OrDivider />}
                <div>
                  <Label htmlFor="add-email">{t("auth.email")}</Label>
                  <Input
                    id="add-email"
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
                <PasswordField id="add-email-password" label={t("auth.password")} value={password}
                               onChange={setPassword} autoComplete="new-password" showStrength />
                <PasswordField id="add-email-password-again" label={t("auth.password_retype")} value={confirmPassword}
                               onChange={setConfirmPassword} onEnter={() => void sendCode()} autoComplete="new-password" />
              </>
            )}
            <FieldError>{error}</FieldError>
            {passwordLoginEnabled && (
              <Button className="w-full" size="lg" onClick={() => void sendCode()} loading={busy}>
                {t("auth.send_code")}
              </Button>
            )}
            <button type="button" onClick={onClose} className="block w-full text-center text-sm text-ink-500 hover:underline">
              {t("addemail.later")}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
