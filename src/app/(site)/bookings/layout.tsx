import { FeatureRouteGate } from "@/components/feature-unavailable";

/** Bookings pages render one "unavailable" state while the admin switch for bookings is off. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureRouteGate feature="bookings">{children}</FeatureRouteGate>;
}
