import type { Metadata } from "next";
import { ContentPageView } from "@/components/content-page-view";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return <ContentPageView slug="terms" />;
}
