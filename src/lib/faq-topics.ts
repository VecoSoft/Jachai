/**
 * FAQ topics — the "## " section headings of the FAQ content page (seeded by backend V68, editable
 * in the admin panel). Each heading gets a stable anchor in both languages so /help can link to
 * /faq#orders whichever language the reader uses.
 */
export interface FaqTopic {
  id: string;
  en: string;
  bn: string;
  blurbEn: string;
  blurbBn: string;
}

export const FAQ_TOPICS: FaqTopic[] = [
  { id: "account", en: "Account", bn: "অ্যাকাউন্ট", blurbEn: "Sign up, log in, passwords", blurbBn: "সাইন আপ, লগইন, পাসওয়ার্ড" },
  { id: "orders", en: "Orders", bn: "অর্ডার", blurbEn: "Ordering, delivery, cancelling", blurbBn: "অর্ডার, ডেলিভারি, বাতিল" },
  { id: "bookings", en: "Bookings", bn: "বুকিং", blurbEn: "Appointments and no-shows", blurbBn: "অ্যাপয়েন্টমেন্ট ও না যাওয়া" },
  { id: "listings", en: "Listings", bn: "লিস্টিং", blurbEn: "Add, claim and edit a business", blurbBn: "ব্যবসা যোগ, দাবি ও সম্পাদনা" },
  { id: "reviews", en: "Reviews", bn: "রিভিউ", blurbEn: "Writing and reporting reviews", blurbBn: "রিভিউ লেখা ও রিপোর্ট" },
  { id: "payments", en: "Payments", bn: "পেমেন্ট", blurbEn: "Paying businesses and boosts", blurbBn: "ব্যবসা ও বুস্টের পেমেন্ট" },
];

/** Anchor for a FAQ heading: a known topic in either language, else a slug of the text. */
export function faqHeadingId(text: string): string {
  const t = text.trim().toLowerCase();
  const topic = FAQ_TOPICS.find((x) => x.en.toLowerCase() === t || x.bn === text.trim());
  if (topic) return topic.id;
  const slug = t.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `section-${Array.from(t).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)}`;
}
