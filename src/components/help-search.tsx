"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarClock, CreditCard, Search, ShoppingBag, Star, Store, UserRound, type LucideIcon } from "lucide-react";
import { contentApi } from "@/lib/api";
import { FAQ_TOPICS, faqHeadingId } from "@/lib/faq-topics";
import { useLanguage } from "@/lib/language-context";

const TOPIC_ICONS: Record<string, LucideIcon> = {
  account: UserRound,
  orders: ShoppingBag,
  bookings: CalendarClock,
  listings: Store,
  reviews: Star,
  payments: CreditCard,
};

interface FaqEntry {
  topicId: string;
  topic: string;
  question: string;
  answer: string;
}

/** Splits the FAQ Markdown into entries: "## Topic", then "**Question?**" followed by its answer lines. */
export function parseFaq(md: string): FaqEntry[] {
  const entries: FaqEntry[] = [];
  let topic = "";
  let topicId = "";
  let current: FaqEntry | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^##\s+(.+)$/);
    const question = line.match(/^\*\*(.+)\*\*$/);
    if (heading) {
      topic = heading[1].trim();
      topicId = faqHeadingId(topic);
      current = null;
    } else if (question) {
      current = { topicId, topic, question: question[1].trim(), answer: "" };
      entries.push(current);
    } else if (current && line) {
      current.answer = current.answer ? `${current.answer} ${line}` : line;
    }
  }
  return entries;
}

function strip(md: string): string {
  return md.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Help page: search the FAQ and jump to a topic. */
export function HelpSearch() {
  const { lang } = useLanguage();
  const bn = lang === "bn";
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    contentApi
      .get("faq", lang)
      .then((p) => {
        if (!cancelled) setEntries(parseFaq(p.bodyMd));
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (q.length < 2) return [];
    const words = q.split(/\s+/);
    return entries
      .map((e) => {
        const hay = `${e.question} ${e.answer} ${e.topic}`.toLowerCase();
        const score = words.reduce((n, w) => n + (hay.includes(w) ? (e.question.toLowerCase().includes(w) ? 2 : 1) : 0), 0);
        return { e, score, all: words.every((w) => hay.includes(w)) };
      })
      .filter((r) => r.all)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((r) => r.e);
  }, [entries, q]);

  return (
    <div className="mt-5 space-y-4">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={bn ? "আপনার প্রশ্ন লিখুন — যেমন \"অর্ডার বাতিল\"" : "Search help — e.g. \"cancel an order\""}
          aria-label={bn ? "সাহায্যে খুঁজুন" : "Search help"}
          className="w-full rounded-xl border border-ink-200 bg-surface py-3 pl-10 pr-3 text-sm text-ink-900 shadow-sm focus:border-crimson-400 focus:outline-none"
        />
      </div>

      {q.length >= 2 && (
        <div className="rounded-xl border border-ink-100 bg-surface" aria-live="polite">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">
              {bn ? "কিছু পাওয়া যায়নি। নিচে সাপোর্টে যোগাযোগ করুন।" : "No answers found. Try other words, or contact support below."}
            </p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {results.map((r) => (
                <li key={`${r.topicId}-${r.question}`}>
                  <Link href={`/faq#${r.topicId}`} className="block px-4 py-3 hover:bg-ink-50">
                    <p className="text-sm font-semibold text-ink-900">{strip(r.question)}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{strip(r.answer)}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-crimson-600">{r.topic}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FAQ_TOPICS.map((t) => {
          const Icon = TOPIC_ICONS[t.id] ?? BookOpen;
          return (
            <Link
              key={t.id}
              href={`/faq#${t.id}`}
              className="group rounded-xl border border-ink-100 bg-surface p-4 transition-colors hover:border-crimson-200 hover:bg-crimson-50/30"
            >
              <Icon size={20} className="text-crimson-600" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-ink-900 group-hover:text-crimson-700">{bn ? t.bn : t.en}</p>
              <p className="mt-0.5 text-xs text-ink-500">{bn ? t.blurbBn : t.blurbEn}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
