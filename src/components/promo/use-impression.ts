"use client";

import { useEffect, useRef } from "react";

/**
 * Fires `onImpression` once, when at least half of the element has been visible for a full second
 * (the IAB-style viewability rule the promotion analytics use). Scrolling past quickly doesn't count.
 */
export function useImpression<T extends HTMLElement>(onImpression: () => void, enabled = true) {
  const ref = useRef<T>(null);
  const fired = useRef(false);
  const callback = useRef(onImpression);
  callback.current = onImpression;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || fired.current || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!timer) {
            timer = setTimeout(() => {
              if (!fired.current) {
                fired.current = true;
                callback.current();
                observer.disconnect();
              }
            }, 1000);
          }
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [enabled]);

  return ref;
}
