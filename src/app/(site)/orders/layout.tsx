import { FeatureRouteGate } from "@/components/feature-unavailable";

/** Orders pages render one "unavailable" state while the admin switch for ordering is off. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureRouteGate feature="ordering">{children}</FeatureRouteGate>;
}
