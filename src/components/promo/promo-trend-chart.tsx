"use client";

import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import type { PromoDayPoint } from "@/lib/types";

type Metric = "impressions" | "clicks" | "conversions";

const W = 640;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/**
 * Per-day promotion trend — ONE series at a time (views, clicks or conversions have different
 * scales, so they're a toggle, never a dual axis). Single brand hue validated against both chart
 * surfaces (light #C8102E, dark #F0546B), 2px line, recessive grid, crosshair + tooltip on hover,
 * and a table view for screen readers / exact values.
 */
export function PromoTrendChart({ daily, className }: { daily: PromoDayPoint[]; className?: string }) {
  const { t, lang } = useLanguage();
  const [metric, setMetric] = useState<Metric>("impressions");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const values = daily.map((d) => d[metric]);
  const max = niceMax(Math.max(0, ...values));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (daily.length <= 1 ? innerW / 2 : (i / (daily.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = useMemo(
    () => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.join(","), max]
  );
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" });
  const fmtNum = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-IN");
  const labels: Record<Metric, string> = {
    impressions: t("promo.analytics.views"),
    clicks: t("promo.analytics.clicks"),
    conversions: t("promo.analytics.conversions"),
  };
  const ticks = [0, max / 2, max];
  const xLabelEvery = Math.max(1, Math.ceil(daily.length / 6));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || daily.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (daily.length - 1));
    setHover(Math.max(0, Math.min(daily.length - 1, i)));
  }

  const hovered = hover != null ? daily[hover] : null;

  return (
    <figure className={cn("rounded-2xl border border-ink-100 bg-surface p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-semibold text-ink-900">
          {t("promo.analytics.per_day", { metric: labels[metric] })}
        </figcaption>
        <div className="flex gap-1" role="group" aria-label={t("promo.analytics.metric")}>
          {(Object.keys(labels) as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                "min-h-9 rounded-full px-3 text-xs font-semibold",
                metric === m ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-50"
              )}
            >
              {labels[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={t("promo.analytics.per_day", { metric: labels[metric] })}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tk)} y2={y(tk)} className="stroke-ink-100" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tk)} textAnchor="end" dominantBaseline="middle" className="fill-ink-400 text-[10px]">
                {fmtNum(Math.round(tk))}
              </text>
            </g>
          ))}
          {daily.map((d, i) =>
            i % xLabelEvery === 0 || i === daily.length - 1 ? (
              <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" className="fill-ink-400 text-[10px]">
                {fmtDay(d.day)}
              </text>
            ) : null
          )}
          <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-[#C8102E] dark:stroke-[#F0546B]" />
          {hovered && hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-ink-300" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(values[hover])} r={4} strokeWidth={2} className="fill-[#C8102E] stroke-surface dark:fill-[#F0546B]" />
            </g>
          )}
        </svg>
        {hovered && hover != null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-ink-100 bg-surface px-2.5 py-1.5 text-xs shadow-pop"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <div className="font-semibold text-ink-900">{fmtNum(values[hover])} {labels[metric].toLowerCase()}</div>
            <div className="text-ink-500">{fmtDay(hovered.day)}</div>
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-ink-500">{t("promo.analytics.show_table")}</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="py-1 font-medium">{t("promo.analytics.day")}</th>
              <th className="py-1 font-medium">{labels.impressions}</th>
              <th className="py-1 font-medium">{labels.clicks}</th>
              <th className="py-1 font-medium">{labels.conversions}</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-ink-100 text-ink-700">
                <td className="py-1">{fmtDay(d.day)}</td>
                <td className="py-1 tabular-nums">{fmtNum(d.impressions)}</td>
                <td className="py-1 tabular-nums">{fmtNum(d.clicks)}</td>
                <td className="py-1 tabular-nums">{fmtNum(d.conversions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
