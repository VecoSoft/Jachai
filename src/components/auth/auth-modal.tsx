"use client";

import { useAuthModal } from "@/lib/auth-modal-context";
import { useLanguage } from "@/lib/language-context";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";
import { ForgotPasswordForm } from "./forgot-password-form";

const COPY = {
  login: {
    headingKey: "modal.login.heading",
    descriptionKey: "modal.login.description",
  },
  signup: {
    headingKey: "modal.signup.heading",
    descriptionKey: "modal.signup.description",
  },
  "forgot-password": {
    headingKey: "modal.forgot_password.heading",
    descriptionKey: "modal.forgot_password.description",
  },
} as const;

function IllustrationPanel() {
  const { t } = useLanguage();
  return (
    <div className="relative hidden md:flex flex-col justify-between overflow-hidden rounded-l-[28px] sm:rounded-l-[32px] bg-gradient-to-br from-ink-900 via-crimson-800 to-crimson-600 p-10">
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 0, transparent 35%), radial-gradient(circle at 85% 70%, white 0, transparent 30%)",
        }}
      />
      <svg viewBox="0 0 24 24" className="relative h-10 w-10 text-white" fill="none">
        <path
          d="M12 2 L20 5 V11.5 C20 16.2 16.6 20.4 12 22 C7.4 20.4 4 16.2 4 11.5 V5 Z"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M12 2 L20 5 V11.5 C20 16.2 16.6 20.4 12 22 C7.4 20.4 4 16.2 4 11.5 V5 Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M8.3 11.7 L10.8 14.3 L15.7 8.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="relative">
        <p className="font-display text-2xl font-extrabold text-white leading-snug">
          {t("modal.illustration.title")}
        </p>
        <p className="mt-3 text-sm text-crimson-50/85 leading-relaxed">
          {t("modal.illustration.subtitle")}
        </p>
      </div>
    </div>
  );
}

export function AuthModal() {
  const { mode, prefillEmail, switchTo, close } = useAuthModal();
  const { t } = useLanguage();

  return (
    <Modal open={mode !== null} onClose={close} labelledBy="auth-modal-heading" panelClassName="max-w-4xl">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] max-h-[90vh]">
        <IllustrationPanel />

        <div className="relative px-5 py-7 sm:p-10 overflow-y-auto">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>

          {mode && (
            <>
              <h2 id="auth-modal-heading" className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900">
                {t(COPY[mode].headingKey)}
              </h2>
              <p className="mt-2 text-sm text-ink-500">{t(COPY[mode].descriptionKey)}</p>

              <div className="mt-7">
                {mode === "login" && (
                  <LoginForm
                    onSuccess={close}
                    onSwitchToSignup={() => switchTo("signup")}
                    onSwitchToForgotPassword={(email) => switchTo("forgot-password", email)}
                  />
                )}
                {mode === "signup" && <SignupForm onSuccess={close} onSwitchToLogin={() => switchTo("login")} />}
                {mode === "forgot-password" && (
                  <ForgotPasswordForm initialEmail={prefillEmail} onSuccess={close} onSwitchToLogin={() => switchTo("login")} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}