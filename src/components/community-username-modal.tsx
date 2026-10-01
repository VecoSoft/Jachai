"use client";

import { useEffect, useRef, useState } from "react";
import { communityApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import type { CommunityGender } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Availability = "checking" | "available" | "taken" | "invalid" | "idle";

const FORMAT_HINT = "3-20 characters: letters, numbers, and underscores only.";

/**
 * "Welcome to Jachai Community" username setup — the pseudonymous handle
 * (u/username) shown on every post/comment instead of the account's real
 * name. Triggered from useCommunityUsernameModal() wherever a logged-in
 * user without profile.communityUsername tries to enter/post in Community.
 *
 * <p>V59: a Male/Female choice is required too. Members who set a username before that only see
 * the short "one more step" gender picker.
 */
export function CommunityUsernameModal() {
  const { open, close, notifyComplete } = useCommunityUsernameModal();
  const { profile, setProfile } = useAuth();
  const { show } = useToast();
  const { t } = useLanguage();
  // A member with a username but no gender yet (pre-V59) only needs to pick the gender.
  const genderOnly = Boolean(profile?.communityUsername) && !profile?.communityGender;

  const [value, setValue] = useState("");
  const [gender, setGender] = useState<CommunityGender | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setGender(profile?.communityGender ?? null);
    if (genderOnly) return;
    setValue("");
    setAvailability("idle");
    setSuggesting(true);
    communityApi
      .suggestUsername()
      .then((res) => setValue(res.suggestion))
      .catch(() => {
        /* suggestion is a convenience, not required — leave the field blank on failure */
      })
      .finally(() => setSuggesting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || genderOnly) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setAvailability("idle");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const myRequest = ++requestId.current;
    const handle = setTimeout(() => {
      communityApi
        .checkUsername(trimmed)
        .then((res) => {
          if (requestId.current === myRequest) {
            setAvailability(res.available ? "available" : "taken");
          }
        })
        .catch(() => {
          if (requestId.current === myRequest) setAvailability("idle");
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [value, open, genderOnly]);

  async function handleContinue() {
    const trimmed = value.trim();
    if (submitting) return;
    if (!gender) {
      show(t("community.gender.required"), "error");
      return;
    }
    if (!genderOnly && availability !== "available") return;
    setSubmitting(true);
    try {
      const res = genderOnly ? await communityApi.updateGender({ gender }) : await communityApi.setUsername(trimmed, gender);
      if (profile) {
        setProfile({
          ...profile,
          communityUsername: res.communityUsername,
          communityGender: res.communityGender,
          communityGenderVisible: res.communityGenderVisible,
        });
      }
      show(genderOnly ? t("community.gender.saved") : `You're all set as u/${res.communityUsername}`, "success");
      notifyComplete();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  const statusText: Record<Availability, string | null> = {
    idle: null,
    checking: "Checking…",
    available: "✓ Available",
    taken: "That username is already taken",
    invalid: FORMAT_HINT,
  };
  const statusClass: Record<Availability, string> = {
    idle: "text-ink-400",
    checking: "text-ink-400",
    available: "text-brand-700",
    taken: "text-rose-600",
    invalid: "text-rose-600",
  };

  const genderPicker = (
    <fieldset className="mt-5 text-left">
      <legend className="text-xs font-semibold text-ink-500">{t("community.gender.label")}</legend>
      <div role="radiogroup" aria-label={t("community.gender.label")} className="mt-1.5 grid grid-cols-2 gap-2">
        {(["M", "F"] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={gender === g}
            onClick={() => setGender(g)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
              focusRing,
              gender === g
                ? "border-crimson-500 bg-crimson-50 text-crimson-800 dark:bg-crimson-900/40 dark:text-crimson-200"
                : "border-ink-200 text-ink-700 hover:bg-ink-50"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold",
                g === "M" ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" : "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300"
              )}
            >
              {g}
            </span>
            {g === "M" ? t("community.gender.male") : t("community.gender.female")}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-400">{t("community.gender.hint")}</p>
    </fieldset>
  );

  if (genderOnly) {
    return (
      <Modal open={open} onClose={close} labelledBy="community-username-heading" panelClassName="max-w-md">
        <div className="p-8 text-center sm:p-10">
          <h2 id="community-username-heading" className="font-display text-xl font-bold text-ink-900">
            {t("community.gender.setup_title")}
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            {t("community.gender.setup_body", { username: profile?.communityUsername ?? "" })}
          </p>
          {genderPicker}
          <Button className="mt-6 w-full" onClick={handleContinue} disabled={!gender} loading={submitting}>
            {t("community.gender.save")}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} labelledBy="community-username-heading" panelClassName="max-w-md">
      <div className="p-8 sm:p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-crimson-50 text-2xl">
          👋
        </div>
        <h2 id="community-username-heading" className="mt-4 font-display text-xl font-bold text-ink-900">
          Welcome to Jachai Community
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          Choose your Community username. This is the name other people will see when you post and comment — not
          your account name.
        </p>

        <div className="mt-6 text-left">
          <label htmlFor="community-username-input" className="text-xs font-semibold text-ink-500">
            Community username
          </label>
          <div className="mt-1.5 flex items-center rounded-lg border border-ink-200 bg-surface px-3.5 py-2.5 focus-within:border-crimson-500 focus-within:ring-2 focus-within:ring-crimson-500/30">
            <span className="text-ink-400">u/</span>
            <input
              id="community-username-input"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
              placeholder={suggesting ? "Generating a suggestion…" : "UrbanExplorer42"}
              maxLength={20}
              className="ml-0.5 w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
            />
          </div>
          {statusText[availability] && (
            <p className={cn("mt-1.5 text-xs font-medium", statusClass[availability])}>{statusText[availability]}</p>
          )}
        </div>

        {genderPicker}

        <Button
          className="mt-6 w-full"
          onClick={handleContinue}
          disabled={availability !== "available" || !gender}
          loading={submitting}
        >
          Continue
        </Button>
      </div>
    </Modal>
  );
}
