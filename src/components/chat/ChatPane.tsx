"use client";

import { useEffect, useState } from "react";
import { Ban, Lock } from "lucide-react";
import { autoReplyApi, messageApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import type { AutoReply } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { QuickReplies } from "./QuickReplies";
import { Composer } from "./Composer";
import { useMessageThread } from "./use-message-thread";
import { ReportConversationModal } from "./ReportConversationModal";

export function ChatPane({
  threadId,
  businessId,
  currentUserId,
  otherPartyName,
  otherPartyAvatarUrl,
  verified,
  headerSubtitle,
  onBack,
  onClose,
  onMinimize,
  onViewBusiness,
  showQuickReplies = false,
  isLoggedIn = true,
  onLogin,
  isOwnBusiness,
  enabled = true,
}: {
  threadId?: string;
  businessId?: string;
  currentUserId: string | undefined;
  otherPartyName: string;
  otherPartyAvatarUrl?: string | null;
  verified?: boolean;
  headerSubtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onViewBusiness?: () => void;
  /** A consumer-asking-owner affordance — leave false on the owner's own inbox view. Needs businessId. */
  showQuickReplies?: boolean;
  isLoggedIn?: boolean;
  onLogin?: () => void;
  isOwnBusiness?: boolean;
  enabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const { lang } = useLanguage();
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const {
    threadId: activeThreadId,
    messages,
    loading,
    error,
    send,
    sendQuickReply,
    react,
    retryLast,
    lastMessageStatus,
  } = useMessageThread({
    threadId,
    businessId,
    currentUserId,
    enabled: enabled && isLoggedIn && !isOwnBusiness,
  });

  // A messaging block (after a reported conversation was reviewed) — say so instead of failing sends.
  useEffect(() => {
    if (!enabled || !isLoggedIn || isOwnBusiness) return;
    messageApi
      .canSend()
      .then((r) => setBlockedUntil(r.canSend ? null : r.blockedUntil))
      .catch(() => {});
  }, [enabled, isLoggedIn, isOwnBusiness]);

  useEffect(() => {
    if (!showQuickReplies || !businessId || !isLoggedIn || isOwnBusiness) return;
    autoReplyApi
      .list(businessId)
      .then(setAutoReplies)
      .catch(() => {});
  }, [showQuickReplies, businessId, isLoggedIn, isOwnBusiness]);

  async function handleSend(content: string) {
    if (!content.trim()) return;
    setDraft("");
    await send(content.trim());
  }

  // System defaults come in both languages so a fresh business has something to show
  // regardless of the visitor's site language; owner-authored entries (language: null)
  // are always shown, since the owner already wrote them in one specific language.
  const languageMatched = autoReplies.filter((r) => !r.language || r.language === lang);
  const sentQuestions = new Set(messages.filter((m) => m.senderUserId === currentUserId).map((m) => m.content));
  const remainingQuickReplies = languageMatched.filter((r) => !sentQuestions.has(r.question));
  const ownerHasReplied = messages.some((m) => m.senderUserId !== currentUserId);
  const showQuickRepliesRow = messages.length > 0 && !ownerHasReplied && remainingQuickReplies.length > 0;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        name={otherPartyName}
        avatarUrl={otherPartyAvatarUrl}
        subtitle={headerSubtitle}
        verified={verified}
        onBack={onBack}
        onClose={onClose}
        onMinimize={onMinimize}
        onViewBusiness={onViewBusiness}
        onReport={activeThreadId && isLoggedIn && !isOwnBusiness ? () => setReportOpen(true) : undefined}
      />
      {activeThreadId && (
        <ReportConversationModal
          threadId={activeThreadId}
          otherPartyName={otherPartyName}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
        />
      )}

      {!isLoggedIn ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-ink-500 dark:text-ink-400">Log in to message {otherPartyName}</p>
          <Button size="sm" onClick={onLogin}>
            Log in
          </Button>
        </div>
      ) : isOwnBusiness ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-sm text-ink-500 dark:text-ink-400">This is your own business — customer messages arrive in your owner inbox.</p>
        </div>
      ) : (
        <>
          <MessageList
            messages={messages}
            loading={loading}
            error={error}
            currentUserId={currentUserId}
            otherPartyName={otherPartyName}
            otherPartyAvatarUrl={otherPartyAvatarUrl}
            emptyStateSubtitle="Ask anything — the owner usually replies within a day"
            emptyStateExtra={<QuickReplies items={remainingQuickReplies} onPick={sendQuickReply} />}
            lastMessageStatus={lastMessageStatus}
            onRetryLast={retryLast}
            onReact={react}
          />

          {showQuickRepliesRow && <QuickReplies items={remainingQuickReplies} onPick={sendQuickReply} />}

          {isEmpty && (
            <p className="flex items-center gap-1.5 px-4 pt-2 text-xs text-ink-400">
              <Lock size={12} className="shrink-0" />
              Only the owner can see this
            </p>
          )}

          {blockedUntil ? (
            <p className="flex items-start gap-1.5 border-t border-ink-100 px-4 py-3 text-xs text-rose-600 dark:border-ink-700">
              <Ban size={14} className="mt-0.5 shrink-0" />
              You can&apos;t send messages until {new Date(blockedUntil).toLocaleString()} — a conversation you were in was
              reported and reviewed. Check your notifications for details.
            </p>
          ) : (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => handleSend(draft)}
            placeholder={`Message ${otherPartyName}…`}
          />
          )}
        </>
      )}
    </div>
  );
}
