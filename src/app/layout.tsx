import type { Metadata, Viewport } from "next";
import { Sora, Inter, JetBrains_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AuthModalProvider } from "@/lib/auth-modal-context";
import { CommunityUsernameModalProvider } from "@/lib/community-username-modal-context";
import { HomeSearchProvider } from "@/lib/home-search-context";
import { LanguageProvider } from "@/lib/language-context";
import { LocationProvider } from "@/lib/location-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/lib/toast-context";
import { Navbar } from "@/components/navbar";
import { AuthModal } from "@/components/auth/auth-modal";
import { CommunityUsernameModal } from "@/components/community-username-modal";
import { SiteFooter } from "@/components/site-footer";

// Runs before hydration so the correct theme class is on <html> for the
// very first paint — without this the page flashes light before JS applies
// the user's saved/system preference.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Fallback in the font-display/font-body stacks (see tailwind.config.ts) so Bengali glyphs
// render from this font and Latin glyphs from Sora/Inter within the same text run — no
// lang-based class switching needed, since English chrome and Bengali t() strings mix freely.
const notoBengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-noto-bengali", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Jachai — Verified local businesses",
  description:
    "Find and review verified local businesses in Bangladesh — search by category, area, and rating, with verified trust badges.",
};

// resizes-content keeps a fixed-position composer (e.g. the chat widget) above the
// on-screen keyboard on Android/iOS, instead of the keyboard just covering it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} ${mono.variable} ${notoBengali.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <LanguageProvider>
                <AuthModalProvider>
                  <CommunityUsernameModalProvider>
                    <LocationProvider>
                      <HomeSearchProvider>
                        <Navbar />
                        {children}
                        <SiteFooter />
                        <AuthModal />
                        <CommunityUsernameModal />
                      </HomeSearchProvider>
                    </LocationProvider>
                  </CommunityUsernameModalProvider>
                </AuthModalProvider>
              </LanguageProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}