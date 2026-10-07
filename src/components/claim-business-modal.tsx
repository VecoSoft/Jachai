"use client";

import { useState } from "react";
import { claimApi, uploadFileToPresignedUrl } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import { usePlatformFeatures } from "@/lib/community-settings";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";

type Step = "choose" | "phone-code" | "email-address" | "email-code" | "document" | "done-instant" | "done-pending";

export function ClaimBusinessModal({
  open,
  onClose,
  businessId,
  businessName,
  onClaimed,
  alreadyClaimed = false,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  onClaimed: () => void;
  /** Skips straight to the document-review path — phone/email instant-verify only works on an
   *  unclaimed listing (the backend rejects it otherwise), so there's nothing to "choose" here. */
  alreadyClaimed?: boolean;
}) {
  const { show } = useToast();
  // Claim by SMS code only while SMS is on (phone OTP flag); e-mail and document always work.
  const { phoneOtpEnabled } = usePlatformFeatures();
  const [step, setStep] = useState<Step>(alreadyClaimed ? "document" : "choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function reset() {
    setStep(alreadyClaimed ? "document" : "choose");
    setError(null);
    setCode("");
    setEmail("");
    setFile(null);
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function startPhone() {
    setError(null);
    setBusy(true);
    try {
      await claimApi.requestPhone(businessId);
      setStep("phone-code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone() {
    setError(null);
    setBusy(true);
    try {
      await claimApi.verifyPhone(businessId, code.trim());
      setStep("done-instant");
      show("Business claimed — you're now the verified owner.", "success");
      onClaimed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function startEmail() {
    setError(null);
    if (!email.trim()) {
      setError("Enter an email address");
      return;
    }
    setBusy(true);
    try {
      await claimApi.requestEmail(email.trim());
      setStep("email-code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail() {
    setError(null);
    setBusy(true);
    try {
      await claimApi.verifyEmail(businessId, email.trim(), code.trim());
      setStep("done-instant");
      show("Business claimed — you're now the verified owner.", "success");
      onClaimed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitDocument() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const presigned = await claimApi.documentUploadUrl(file.name);
      const uploaded = await uploadFileToPresignedUrl(presigned.uploadUrl, file);
      if (!uploaded) throw new Error("Failed to upload document");
      await claimApi.fileDocument(businessId, presigned.objectKey);
      setStep("done-pending");
      show("Claim submitted for admin review.", "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="claim-modal-heading" panelClassName="max-w-md">
      <div className="p-6 sm:p-8">
        <h2 id="claim-modal-heading" className="font-display text-xl font-bold text-ink-900">
          {alreadyClaimed ? `Dispute the claim on ${businessName}` : `Claim ${businessName}`}
        </h2>

        {step === "choose" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-ink-500">Verify you own this business to claim it.</p>
            {phoneOtpEnabled && (
            <button
              onClick={startPhone}
              disabled={busy}
              className="w-full text-left rounded-lg border border-ink-100 p-4 hover:border-crimson-300 hover:bg-crimson-50/40 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink-800">Verify by phone</p>
              <p className="text-xs text-ink-500 mt-0.5">We&apos;ll text a code to the number listed on this business.</p>
            </button>
            )}
            <button
              onClick={() => setStep("email-address")}
              disabled={busy}
              className="w-full text-left rounded-lg border border-ink-100 p-4 hover:border-crimson-300 hover:bg-crimson-50/40 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink-800">Verify by email</p>
              <p className="text-xs text-ink-500 mt-0.5">Get a code at an email address you control.</p>
            </button>
            <button
              onClick={() => setStep("document")}
              disabled={busy}
              className="w-full text-left rounded-lg border border-ink-100 p-4 hover:border-crimson-300 hover:bg-crimson-50/40 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink-800">Upload a document</p>
              <p className="text-xs text-ink-500 mt-0.5">Utility bill or similar proof, reviewed by an admin (slower).</p>
            </button>
            <FieldError>{error}</FieldError>
          </div>
        )}

        {step === "phone-code" && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink-500">We sent a code to this business&apos;s listed phone number.</p>
            <div>
              <Label htmlFor="claim-phone-code">Verification code</Label>
              <Input
                id="claim-phone-code"
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyPhone()}
              />
            </div>
            <FieldError>{error}</FieldError>
            <Button className="w-full" onClick={verifyPhone} loading={busy} disabled={!code.trim()}>
              Verify &amp; claim
            </Button>
            <button onClick={() => setStep("choose")} className="text-xs text-ink-400 hover:underline">
              ← Choose a different method
            </button>
          </div>
        )}

        {step === "email-address" && (
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="claim-email">Email address</Label>
              <Input
                id="claim-email"
                type="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startEmail()}
              />
            </div>
            <FieldError>{error}</FieldError>
            <Button className="w-full" onClick={startEmail} loading={busy} disabled={!email.trim()}>
              Send code
            </Button>
            <button onClick={() => setStep("choose")} className="text-xs text-ink-400 hover:underline">
              ← Choose a different method
            </button>
          </div>
        )}

        {step === "email-code" && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink-500">We sent a code to {email}.</p>
            <div>
              <Label htmlFor="claim-email-code">Verification code</Label>
              <Input
                id="claim-email-code"
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyEmail()}
              />
            </div>
            <FieldError>{error}</FieldError>
            <Button className="w-full" onClick={verifyEmail} loading={busy} disabled={!code.trim()}>
              Verify &amp; claim
            </Button>
            <button onClick={() => setStep("email-address")} className="text-xs text-ink-400 hover:underline">
              ← Use a different email
            </button>
          </div>
        )}

        {step === "document" && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink-500">
              {alreadyClaimed
                ? "This listing is already claimed by someone else. Upload a utility bill or similar document showing your name and this business's address, and an admin will review the dispute."
                : "Upload a utility bill or similar document showing your name and this business's address. An admin will review it."}
            </p>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <FieldError>{error}</FieldError>
            <Button className="w-full" onClick={submitDocument} loading={busy} disabled={!file}>
              Submit for review
            </Button>
            {!alreadyClaimed && (
              <button onClick={() => setStep("choose")} className="text-xs text-ink-400 hover:underline">
                ← Choose a different method
              </button>
            )}
          </div>
        )}

        {step === "done-instant" && (
          <div className="mt-5">
            <p className="text-sm text-ink-700">You&apos;re now the verified owner of {businessName}.</p>
            <Button className="w-full mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {step === "done-pending" && (
          <div className="mt-5">
            <p className="text-sm text-ink-700">Your claim was submitted and is pending admin review.</p>
            <Button className="w-full mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
