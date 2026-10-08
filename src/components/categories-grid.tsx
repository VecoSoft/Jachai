"use client";

import { useEffect, useState } from "react";
import { referenceApi } from "@/lib/api";
import { categoryIcon } from "@/lib/category-icons";
import type { Category } from "@/lib/types";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import { Card } from "./ui/misc";

/** Home page category tiles — dynamic list, clicking filters the search results below. */
export function CategoriesGrid({ onSelect }: { onSelect: (category: Category) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    referenceApi
      .categories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  if (categories.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
      <h2 className="font-display text-2xl md:text-3xl font-bold text-ink-900 text-center mb-5">
        Categories
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {categories.slice(0, 8).map((cat) => {
          const Icon = categoryIcon(cat.name);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat)}
              className={cn("group rounded-xl text-left", interactiveTransition, focusRing)}
            >
              <Card className="flex flex-col items-center justify-center gap-2.5 py-8 transition-all duration-200 group-hover:shadow-lift group-hover:-translate-y-0.5 group-hover:border-crimson-200 dark:border-ink-700">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  <Icon size={24} strokeWidth={1.75} />
                </span>
                <span className="text-xs font-semibold text-ink-800 dark:text-ink-100">{cat.name}</span>
              </Card>
            </button>
          );
        })}
      </div>
    </section>
  );
}
