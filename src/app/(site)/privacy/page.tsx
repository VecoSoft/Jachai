import type { Metadata } from "next";
import { ContentPageView } from "@/components/content-page-view";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return <ContentPageView slug="privacy" />;
}
