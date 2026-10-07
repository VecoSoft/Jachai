"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";

/**
 * In-session shortcut for a logged-in personal (CONSUMER) account to create its paired Business
 * account. The business account has no login of its own: it is opened through the personal
 * account (the account switcher, or "log in to your business account"). On success the two are
 * linked and the session switches straight into the new business account
 * (POST /auth/register-business, see AuthService#registerBusinessFromConsumer).
 */
export function CreateBusinessAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setName("");
    setError(null);
    setBusy(false);
    onClose();
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const tokens = await authApi.registerBusiness(name.trim());
      login(tokens);
      show("Business account created — you're switched in.", "success");
      handleClose();
      router.push("/owner");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="create-business-account-heading" panelClassName="max-w-sm">
      <div className="p-6 sm:p-8">
        <h2 id="create-business-account-heading" className="font-display text-xl font-bold text-ink-900">
          Create your Business account
        </h2>
        <p className="mt-1.5 text-sm text-ink-500">
          A separate account for managing your listings, opened from your personal account — no extra password.
          You&apos;ll be switched into it right away.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="biz-account-name">Business account name</Label>
            <Input
              id="biz-account-name"
              autoFocus
              placeholder="e.g. your name or business name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && void submit()}
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button className="w-full" onClick={() => void submit()} loading={busy} disabled={!name.trim()}>
            Create &amp; switch
          </Button>
        </div>
      </div>
    </Modal>
  );
}
