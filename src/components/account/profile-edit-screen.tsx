"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { userApi, uploadFileToPresignedUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { avatarInitials, cn, focusRing } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/misc";
import { AvatarPicker } from "./avatar-picker";

/**
 * Edit profile — name + photo, batched behind Cancel/Done (mobile) or a Save button
 * (desktop pane). Unlike the old page, a picked photo is only uploaded to storage once
 * Done is pressed; picking-then-backing-out no longer leaves an orphaned upload.
 */
export function ProfileEditScreen() {
  const router = useRouter();
  const { profile, setProfile: setAuthProfile } = useAuth();
  const { t } = useLanguage();
  const { show } = useToast();

  const [name, setName] = useState(profile?.name ?? "");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.name]);

  useEffect(() => {
    if (!pickedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pickedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pickedFile]);

  if (!profile) return <PageSpinner />;

  const displayedPhoto = removePhoto ? null : previewUrl ?? profile.profilePhotoUrl;
  const dirty = name.trim() !== (profile.name ?? "") || pickedFile !== null || removePhoto;

  function resetFields() {
    setName(profile!.name ?? "");
    setPickedFile(null);
    setRemovePhoto(false);
  }

  function handleCancel() {
    resetFields();
    router.push("/account");
  }

  async function handleDone() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      let photoUrl = profile!.profilePhotoUrl;
      if (removePhoto) {
        photoUrl = null;
      } else if (pickedFile) {
        const presigned = await userApi.requestPhotoUploadUrl(pickedFile.name);
        await uploadFileToPresignedUrl(presigned.uploadUrl, pickedFile);
        photoUrl = presigned.cdnUrlAfterUpload;
      }
      const updated = await userApi.update(name.trim() || null, profile!.preferredLanguage, photoUrl);
      setAuthProfile(updated);
      show(t("account.toast.updated"), "success");
      resetFields();
      router.push("/account");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        className={
          "sticky top-16 z-10 -mx-4 flex h-14 items-center justify-between border-b border-ink-100 bg-surface/95 px-4 backdrop-blur " +
          "sm:-mx-6 md:static md:z-auto md:mx-0 md:h-auto md:border-0 md:bg-transparent md:px-0 md:pb-6 md:backdrop-blur-none dark:border-ink-800"
        }
      >
        <button type="button" onClick={handleCancel} className={cn("text-[15px] text-ink-600 md:hidden", focusRing)}>
          Cancel
        </button>
        <h1 className="font-display text-[17px] font-semibold text-ink-900 md:text-xl dark:text-ink-100">Edit profile</h1>
        <button
          type="button"
          onClick={handleDone}
          disabled={!dirty || saving}
          className={cn("text-[15px] font-semibold text-crimson-600 disabled:text-ink-300 md:hidden", focusRing)}
        >
          {saving ? "Saving…" : "Done"}
        </button>
      </div>

      <div className="mx-auto max-w-sm px-4 pb-10 pt-6 md:max-w-none md:px-0">
        <AvatarPicker
          imageUrl={displayedPhoto}
          fallback={<span className="text-2xl font-bold text-ink-400">{avatarInitials(profile.name)}</span>}
          onSelectFile={(file) => {
            setRemovePhoto(false);
            setPickedFile(file);
          }}
          onRemove={
            displayedPhoto
              ? () => {
                  setPickedFile(null);
                  setRemovePhoto(true);
                }
              : undefined
          }
          ariaLabel="Change profile photo"
        />

        <div className="mt-8 divide-y divide-ink-100 dark:divide-ink-800">
          <div className="flex items-center gap-3 py-3">
            <span className="w-24 shrink-0 text-sm text-ink-500">{t("account.name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("account.name_placeholder")}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-ink-900 placeholder:text-ink-300 focus:outline-none dark:text-ink-100"
            />
          </div>
          {profile.email && (
            <div className="flex items-center gap-3 py-3">
              <span className="w-24 shrink-0 text-sm text-ink-500">{t("account.signin.email")}</span>
              <span className="min-w-0 flex-1 truncate text-[16px] text-ink-500">{profile.email}</span>
            </div>
          )}
        </div>

        <Button className="mt-8 hidden w-full md:inline-flex" onClick={handleDone} disabled={!dirty} loading={saving}>
          {t("account.save")}
        </Button>
      </div>
    </div>
  );
}
