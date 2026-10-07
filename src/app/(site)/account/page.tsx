"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, KeyRound, Languages, Mail, MailPlus, Moon, Receipt, ShieldCheck, Smile, Star, Store, Tag, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useAddEmail } from "@/components/account/add-email-sheet";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { avatarInitials, cn, focusRing } from "@/lib/utils";
import { PageSpinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { ScreenHeader } from "@/components/account/screen-header";
import { LanguageOptions } from "@/components/account/preferences-screen";
import { ProfileEditScreen } from "@/components/account/profile-edit-screen";
import {
  SettingsCard,
  SettingsDangerRow,
  SettingsNavRow,
  SettingsSectionTitle,
  SettingsToggleRow,
  SettingsValueRow,
} from "@/components/account/settings-row";

function MobileSettingsList() {
  const router = useRouter();
  const { user, profile, logout, switchAccount } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { show } = useToast();
  const { openModal } = useCommunityUsernameModal();
  const { switchTo } = useAuthModal();
  const addEmail = useAddEmail();
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!profile) return <PageSpinner />;

  const isBusinessAccount = user?.role === "BUSINESS_OWNER";
  const canSwitchAccount = Boolean(profile.hasLinkedAccount);

  async function handleSwitchAccount() {
    setSwitching(true);
    try {
      await switchAccount();
      router.push(isBusinessAccount ? "/" : "/owner");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSwitching(false);
    }
  }

  function handleCommunityProfileClick() {
    if (profile!.communityUsername) {
      router.push("/account/community");
    } else {
      openModal(() => router.push("/account/community"));
    }
  }

  return (
    <div>
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      <div className="pb-10">
        <SettingsCard className="mt-4">
          <button
            type="button"
            onClick={() => router.push("/account/profile")}
            className={cn("flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50 dark:active:bg-ink-800", focusRing)}
          >
            {profile.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profilePhotoUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ink-100 text-lg font-bold text-ink-400 dark:bg-ink-800">
                {avatarInitials(profile.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-ink-900 dark:text-ink-100">
                {profile.name || profile.email}
              </p>
              <p className="truncate text-sm text-ink-500">
                {profile.email ? `${profile.email} · ` : ""}{isBusinessAccount ? "Business account" : "Personal account"}
              </p>
              <p className="text-sm font-medium text-crimson-600">Edit profile ›</p>
            </div>
          </button>
        </SettingsCard>

        <SettingsSectionTitle>Account</SettingsSectionTitle>
        <SettingsCard>
          <SettingsNavRow icon={User} label="Edit profile" href="/account/profile" />
          <SettingsNavRow
            icon={Smile}
            label="Community profile"
            value={profile.communityUsername ? `u/${profile.communityUsername}` : undefined}
            onClick={handleCommunityProfileClick}
          />
          {profile.email && (
            <SettingsValueRow
              icon={Mail}
              label={t("account.signin.email")}
              value={`${profile.email} · ${profile.emailVerified ? t("account.signin.verified") : t("account.signin.not_verified")}`}
            />
          )}
          <SettingsValueRow
            icon={ShieldCheck}
            label={t("account.signin.method")}
            value={t(`account.signin.method.${profile.authProvider}`)}
          />
          {profile.needsEmail ? (
            <SettingsNavRow icon={MailPlus} label={t("addemail.cta")} onClick={() => addEmail.open()} />
          ) : (
            profile.email && (
              <SettingsNavRow
                icon={KeyRound}
                label={t("account.signin.set_password")}
                onClick={() => switchTo("forgot-password", profile.email ?? undefined)}
              />
            )
          )}
          {canSwitchAccount && (
            <SettingsNavRow
              icon={Store}
              label={isBusinessAccount ? "Switch to personal account" : "Switch to business account"}
              onClick={handleSwitchAccount}
              disabled={switching}
            />
          )}
        </SettingsCard>

        <SettingsSectionTitle>Preferences</SettingsSectionTitle>
        <SettingsCard>
          <SettingsNavRow
            icon={Languages}
            label="Language"
            value={profile.preferredLanguage === "bn" ? t("account.language.bn") : t("account.language.en")}
            onClick={() => setLanguageSheetOpen(true)}
          />
          <SettingsToggleRow
            icon={Moon}
            label="Dark mode"
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </SettingsCard>

        <SettingsSectionTitle>Activity</SettingsSectionTitle>
        <SettingsCard>
          <SettingsNavRow icon={Star} label="My reviews" href="/me/reviews" />
          <SettingsNavRow icon={Bookmark} label="Saved" href="/me/bookmarks" />
          <SettingsNavRow icon={Receipt} label="Orders & bookings" href="/orders" />
          <SettingsNavRow icon={Tag} label="My offers" href="/me/offers" />
        </SettingsCard>

        <div className="mt-6">
          <SettingsCard>
            <SettingsDangerRow label="Log out" onClick={() => logout()} />
          </SettingsCard>
        </div>

        <p className="mt-8 text-center text-xs text-ink-400">Jachai · v1.0.0</p>
      </div>

      <Sheet open={languageSheetOpen} onClose={() => setLanguageSheetOpen(false)} labelledBy="language-sheet-heading">
        <h2 id="language-sheet-heading" className="px-4 pt-4 text-sm font-semibold text-ink-500">
          {t("account.language")}
        </h2>
        <LanguageOptions onSelected={() => setLanguageSheetOpen(false)} />
      </Sheet>
    </div>
  );
}

export default function AccountPage() {
  return (
    <>
      <div className="md:hidden">
        <MobileSettingsList />
      </div>
      <div className="hidden md:block">
        <ProfileEditScreen />
      </div>
    </>
  );
}
