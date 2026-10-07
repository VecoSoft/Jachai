import type { Metadata } from "next";
import { ContentPageView } from "@/components/content-page-view";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return <ContentPageView slug="faq" />;
}
