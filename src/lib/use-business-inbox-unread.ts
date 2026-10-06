"use client";

import { useCallback, useEffect, useState } from "react";
import { messageApi } from "./api";
import { useAuth } from "./auth-context";

const POLL_INTERVAL_MS = 45_000;

/**
 * Total unread messages across the business owner's inbox threads. Silently 0
 * for non-owner accounts or a failed fetch — same "don't disrupt the rest of
 * the UI" convention as NotificationBell — since /threads/business-inbox 403s
 * for any account that isn't role BUSINESS_OWNER.
 */
/** {@code enabled} false (owner chat switched off, maintenance mode) → no polling, always 0. */
export function useBusinessInboxUnreadCount(enabled = true): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled || !user || user.role !== "BUSINESS_OWNER") {
      setCount(0);
      return;
    }
    messageApi
      .businessInbox()
      .then((threads) => setCount(threads.reduce((sum, t) => sum + t.unreadCount, 0)))
      .catch(() => setCount(0));
  }, [user, enabled]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return count;
}
