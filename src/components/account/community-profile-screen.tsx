"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { communityApi, userApi, uploadFileToPresignedUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/misc";
import type { CommunityGender } from "@/lib/types";
import { cn, focusRing } from "@/lib/utils";
import { CommunityGenderBadge } from "@/components/community-gender-badge";
import { Switch } from "@/components/ui/switch";
import { AvatarPicker } from "./avatar-picker";
import { ScreenHeader } from "./screen-header";

/**
 * Community avatar saves immediately on each pick/remove (its own endpoint, no Done step)
 * — same as the old page's behaviour, kept deliberately separate from Edit profile's
 * batched save since this is a distinct, pseudonymous identity from the account itself.
 */
export function CommunityProfileScreen() {
  const { profile, setProfile: setAuthProfile } = useAuth();
  const { t } = useLanguage();
  const { show } = useToast();
  const { openModal } = useCommunityUsernameModal();
  const [uploading, setUploading] = useState(false);

  if (!profile) return <PageSpinner />;

  async function handleSelectFile(file: File) {
    setUploading(true);
    try {
      const presigned = await userApi.requestCommunityAvatarUploadUrl(file.name);
      await uploadFileToPresignedUrl(presigned.uploadUrl, file);
      const updated = await userApi.updateCommunityAvatar(presigned.cdnUrlAfterUpload);
      setAuthProfile(updated);
      show(t("account.community_avatar.toast.updated"), "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      const updated = await userApi.updateCommunityAvatar(null);
      setAuthProfile(updated);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  }

  if (!profile.communityUsername) {
    return (
      <div>
        <ScreenHeader title="Community profile" />
        <div className="mx-auto max-w-sm px-4 py-10 text-center md:max-w-none md:px-0">
          <p className="text-sm text-ink-500">{t("account.community_avatar.no_username_hint")}</p>
          <Button className="mt-4" onClick={() => openModal()}>
            Set up username
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Community profile" />
      <div className="mx-auto max-w-sm px-4 pb-10 pt-6 text-center md:max-w-none md:px-0">
        <AvatarPicker
          imageUrl={profile.communityAvatarUrl}
          fallback={
            <span className="text-lg font-bold text-crimson-700">{profile.communityUsername.slice(0, 2).toUpperCase()}</span>
          }
          onSelectFile={handleSelectFile}
          onRemove={profile.communityAvatarUrl ? handleRemove : undefined}
          ariaLabel="Change community avatar"
          uploading={uploading}
        />
        <p className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-ink-900">
          u/{profile.communityUsername}
          <CommunityGenderBadge gender={profile.communityGenderVisible ? profile.communityGender : null} />
        </p>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-ink-50 p-3 text-left text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <Lock size={16} className="mt-0.5 shrink-0" strokeWidth={1.75} />
          <p>{t("account.community_avatar.hint")}</p>
        </div>

        <GenderSettings />
      </div>
    </div>
  );
}

/** V59: change the M/F choice or hide the badge. Hidden = the gender is never sent to anyone else. */
function GenderSettings() {
  const { profile, setProfile } = useAuth();
  const { t } = useLanguage();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  if (!profile?.communityUsername) return null;

  async function save(body: { gender?: CommunityGender; visible?: boolean }) {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const res = await communityApi.updateGender(body);
      setProfile({ ...profile, communityGender: res.communityGender, communityGenderVisible: res.communityGenderVisible });
      show(t("community.gender.saved"), "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 text-left" aria-labelledby="community-gender-heading">
      <h2 id="community-gender-heading" className="text-sm font-semibold text-ink-900">
        {t("community.gender.label")}
      </h2>
      <div role="radiogroup" aria-labelledby="community-gender-heading" className="mt-2 grid grid-cols-2 gap-2">
        {(["M", "F"] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={profile.communityGender === g}
            disabled={busy}
            onClick={() => profile.communityGender !== g && save({ gender: g })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-60",
              focusRing,
              profile.communityGender === g
                ? "border-crimson-500 bg-crimson-50 text-crimson-800 dark:bg-crimson-900/40 dark:text-crimson-200"
                : "border-ink-200 text-ink-700 hover:bg-ink-50"
            )}
          >
            <CommunityGenderBadge gender={g} />
            {g === "M" ? t("community.gender.male") : t("community.gender.female")}
          </button>
        ))}
      </div>
      {profile.communityGender && (
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-800">{t("community.gender.show_badge")}</p>
            <p className="mt-0.5 text-xs text-ink-500">{t("community.gender.show_badge_hint")}</p>
          </div>
          <Switch
            checked={profile.communityGenderVisible}
            onCheckedChange={(v: boolean) => save({ visible: v })}
            aria-label={t("community.gender.show_badge")}
          />
        </div>
      )}
    </section>
  );
}
