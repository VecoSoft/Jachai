"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { usePlatformFeatures } from "@/lib/community-settings";

/** Google OAuth client id for the web app (Google Cloud → Credentials). Unset = no Google button. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const GIS_SRC = "https://accounts.google.com/gsi/client";

interface GoogleIdApi {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

let gisLoader: Promise<GoogleIdApi> | null = null;

/** Loads Google Identity Services once per page. */
function loadGis(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!gisLoader) {
    gisLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () =>
        window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google Identity Services unavailable"));
      script.onerror = () => {
        gisLoader = null;
        reject(new Error("Couldn't load Google sign-in"));
      };
      document.head.appendChild(script);
    });
  }
  return gisLoader;
}

/**
 * The official "Continue with Google" button (Google Identity Services). Google returns an ID token
 * (scopes openid, email, profile only), which `onCredential` sends to the API for server-side
 * verification. Renders nothing when no client id is configured or Google sign-in is switched off.
 */
export function GoogleButton({
  onCredential,
  text = "continue_with",
}: {
  onCredential: (idToken: string) => void;
  text?: "continue_with" | "signin_with" | "signup_with";
}) {
  const { lang } = useLanguage();
  const { googleLoginEnabled } = usePlatformFeatures();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  callback.current = onCredential;

  const enabled = Boolean(GOOGLE_CLIENT_ID) && googleLoginEnabled;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadGis()
      .then((gis) => {
        if (cancelled || !container.current) return;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (response.credential) callback.current(response.credential);
          },
          ux_mode: "popup",
          context: "signin",
          use_fedcm_for_button: true,
        });
        // Google's button is at most 400 px wide; fill the form width up to that.
        const width = Math.min(400, Math.max(200, Math.floor(container.current.clientWidth)));
        container.current.innerHTML = "";
        gis.renderButton(container.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          width,
          locale: lang === "bn" ? "bn" : "en",
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [enabled, lang, text]);

  if (!enabled || failed) return null;
  return (
    <div className="w-full flex justify-center">
      <div ref={container} className="w-full max-w-[400px] min-h-[44px] flex justify-center">
        {!ready && <div className="h-11 w-full rounded-full bg-ink-100 animate-pulse" aria-hidden />}
      </div>
    </div>
  );
}

/** Whether the Google button will show (for laying out the "or" divider). */
export function useGoogleSignInAvailable(): boolean {
  return Boolean(GOOGLE_CLIENT_ID) && usePlatformFeatures().googleLoginEnabled;
}
