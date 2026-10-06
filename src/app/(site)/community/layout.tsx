import { Suspense } from "react";
import { CommunityGate } from "@/components/community-gate";
import { CommunityMobileNav } from "@/components/community-mobile-nav";
import { CommunityStatusBanner } from "@/components/community-moderation";
import { CommunitySidebar } from "@/components/community-sidebar";
import { CommunityTrendingWidget } from "@/components/community-trending-widget";
import { QuestionsForYouWidget } from "@/components/questions-for-you-widget";

/**
 * Shared 3-column shell for every /community/* route (feed, post detail,
 * profile, explore, following/followers lists) — scoped to this section
 * only, the rest of the app keeps its existing single-column (site)/layout.tsx.
 * Left nav is hidden below lg (see CommunityMobileNav for the mobile
 * equivalent); the trending rail is hidden below xl to avoid a cramped
 * middle column on medium screens.
 */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    // The site shell reserves pt-24 under the fixed navbar for every page (see
    // (site)/layout.tsx) — that's generous breathing room on desktop but leaves
    // a visibly dead strip above the compact mobile nav here, so pull just this
    // section up on mobile only (lg+ leaves the shared offset alone).
    // CommunityGate swaps the whole shell (sidebars included) for one "unavailable" page while
    // the community is switched off.
    <CommunityGate>
      <div className="mx-auto -mt-6 flex max-w-7xl items-start gap-6 lg:mt-0">
        <aside className="sticky top-24 hidden w-64 shrink-0 border-r border-ink-100 pr-4 lg:block">
          <Suspense fallback={null}>
            <CommunitySidebar />
          </Suspense>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Sticks right under the fixed main navbar (h-16) while the feed scrolls under it —
              was a plain in-flow row before, so it scrolled away with the rest of the page.
              A wrapping div carries the sticky positioning rather than passing it through
              CommunityMobileNav's own className, which already sets `position: relative`
              internally (for its dropdown menu) — two position utilities on the same
              element would fight over the same CSS property with no reliable winner.
              Hidden at lg+ (same breakpoint CommunityMobileNav itself hides at) since the
              desktop sidebar takes over then — no point keeping an empty sticky box around. */}
          <div className="sticky top-16 z-40 -mx-4 mb-2 border-b border-ink-100 bg-surface/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden dark:border-ink-700">
            <Suspense fallback={null}>
              <CommunityMobileNav />
            </Suspense>
          </div>
          {/* Admin-controlled: maintenance / read-only notice + the "Jachai Team" announcement banner. */}
          <div className="mb-3 empty:hidden lg:mt-6 lg:mb-0">
            <CommunityStatusBanner />
          </div>
          {children}
        </div>

        <aside className="sticky top-24 hidden w-72 shrink-0 xl:block">
          <QuestionsForYouWidget limit={3} className="mb-4" />
          <CommunityTrendingWidget />
        </aside>
      </div>
    </CommunityGate>
  );
}
