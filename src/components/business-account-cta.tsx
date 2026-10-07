"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { Button } from "./ui/button";
import { CreateBusinessAccountModal } from "./create-business-account-modal";

/**
 * Shown wherever a personal (CONSUMER) account hits a Business-only surface
 * (owner/* pages via RoleGate's `fallback`, the claim CTA on a business
 * page). Two states: if this account is already linked to a Business
 * account, offer the frictionless switch; otherwise offer to create one.
 */
export function BusinessAccountCta({
  title = "This is for Business accounts",
  description = "Manage listings, reply to customers, and claim businesses from a separate Business account.",
}: {
  title?: string;
  description?: string;
}) {
  const { profile, switchAccount } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSwitch() {
    setSwitching(true);
    try {
      await switchAccount();
      router.push("/owner");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto text-center py-16">
      <h1 className="font-display text-xl text-ink-900">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">{description}</p>
      {profile?.hasLinkedAccount ? (
        <Button className="mt-5" onClick={handleSwitch} loading={switching}>
          Switch to your Business account
        </Button>
      ) : (
        <>
          <Button className="mt-5" onClick={() => setModalOpen(true)}>
            Create a Business account
          </Button>
          <CreateBusinessAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </div>
  );
}
