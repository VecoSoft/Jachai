// Per-browser "recent searches" for the search box dropdown — a convenience only, so every
// storage access is best-effort (private windows / blocked storage just mean no history).
const STORAGE_KEY = "jachai.recentSearches";
const MAX_RECENT = 5;

export function readRecentSearches(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function rememberSearch(query: string): string[] {
  const q = query.trim();
  if (!q) return readRecentSearches();
  const next = [q, ...readRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
  write(next);
  return next;
}

export function forgetSearch(query: string): string[] {
  const next = readRecentSearches().filter((s) => s !== query);
  write(next);
  return next;
}
