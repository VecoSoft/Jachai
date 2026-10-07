"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type AuthModalMode = "login" | "signup" | "forgot-password" | null;

interface AuthModalContextValue {
  mode: AuthModalMode;
  /** E-mail carried from one screen to the next (login → forgot password). */
  prefillEmail: string | undefined;
  openLogin: () => void;
  openSignup: () => void;
  openForgotPassword: () => void;
  switchTo: (mode: Exclude<AuthModalMode, null>, prefillEmail?: string) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthModalMode>(null);
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined);

  const openLogin = useCallback(() => setMode("login"), []);
  const openSignup = useCallback(() => setMode("signup"), []);
  const openForgotPassword = useCallback(() => setMode("forgot-password"), []);
  const switchTo = useCallback((next: Exclude<AuthModalMode, null>, email?: string) => {
    setPrefillEmail(email);
    setMode(next);
  }, []);
  const close = useCallback(() => setMode(null), []);

  const value = useMemo(
    () => ({ mode, prefillEmail, openLogin, openSignup, openForgotPassword, switchTo, close }),
    [mode, prefillEmail, openLogin, openSignup, openForgotPassword, switchTo, close]
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
