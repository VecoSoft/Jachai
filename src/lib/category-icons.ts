import {
  BedDouble,
  Car,
  Dumbbell,
  GraduationCap,
  Laptop,
  Martini,
  Package,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// Best-effort visual icon per category name — purely presentational, the
// category list itself always comes from GET /api/v1/categories. Shared by
// CategoriesGrid (home page tiles) and BusinessCard (no-photo placeholder).
const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/restaurant|food|dining|cafe|coffee|bakery/i, UtensilsCrossed],
  [/shop|store|retail|fashion|cloth|boutique/i, ShoppingBag],
  [/night|club|bar|lounge/i, Martini],
  [/health|clinic|hospital|doctor|medical|pharma/i, Stethoscope],
  [/beauty|spa|salon|parlor|parlour/i, Scissors],
  [/auto|car|garage|mechanic|repair/i, Car],
  [/home|electric|plumb|clean|repair service/i, Wrench],
  [/education|school|tuition|coaching|training/i, GraduationCap],
  [/grocery|market|super/i, ShoppingCart],
  [/electronics|mobile|computer|gadget/i, Laptop],
  [/hotel|travel|tour/i, BedDouble],
  [/gym|fitness|sport/i, Dumbbell],
];

export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Package;
}
