"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  buildOperationalInsights,
  buildOperationalRecommendations,
  computeOperationalHealth,
  computeOrdersOperationalMetrics,
  HEALTH_TONE_CLASSES,
  INSIGHT_TONE_CLASSES,
} from "./orders-intelligence-helpers";
import { QuickChipActions } from "./OrderDrawerQuickActions";
import {
  getInsightQuickActions,
  getRecommendationQuickActions,
  type OrdersQuickAutomationHandlers,
} from "./orders-quick-automation-helpers";
import type { PhotographerOrderRow } from "./photographer-order-types";

type OrdersOperationalInsightsProps = {
  orders: PhotographerOrderRow[];
  automationHandlers: OrdersQuickAutomationHandlers;
  className?: string;
};

function HealthScoreRing({
  score,
  tone,
}: {
  score: number;
  tone: keyof typeof HEALTH_TONE_CLASSES;
}) {
  const colors = HEALTH_TONE_CLASSES[tone];
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(colors.ring)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xl font-bold tabular-nums leading-none", colors.text)}>{score}</span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

export default function OrdersOperationalInsights({
  orders,
  automationHandlers,
  className,
}: OrdersOperationalInsightsProps) {
  const metrics = useMemo(() => computeOrdersOperationalMetrics(orders), [orders]);
  const health = useMemo(() => computeOperationalHealth(metrics), [metrics]);
  const insights = useMemo(() => buildOperationalInsights(metrics), [metrics]);
  const recommendations = useMemo(() => buildOperationalRecommendations(metrics), [metrics]);
  const healthColors = HEALTH_TONE_CLASSES[health.tone];

  return (
    <div className={cn("w-full min-w-0 space-y-3", className)}>
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-2">
            <HealthScoreRing score={health.score} tone={health.tone} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                Estado operativo
              </p>
              <p className={cn("mt-0.5 text-base font-semibold leading-none", healthColors.text)}>
                {health.label}
              </p>
              <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed max-w-xs">{health.summary}</p>
            </div>
          </div>

          <div className="min-w-0 border-t md:border-t-0 md:border-l border-gray-50 pt-3 md:pt-0 md:pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
              Insights
            </p>
            <ul className="space-y-1.5 max-h-[168px] overflow-y-auto overscroll-contain pr-0.5">
              {insights.map((insight) => (
                <li key={insight.id}>
                  <div
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-left",
                      INSIGHT_TONE_CLASSES[insight.tone]
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold leading-snug">{insight.title}</p>
                        <p className="mt-0.5 text-[10px] opacity-75 leading-relaxed">{insight.description}</p>
                        <div className="mt-1.5">
                          <QuickChipActions
                            actions={getInsightQuickActions(insight, automationHandlers)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gray-50">
          <div
            className={cn("h-full", healthColors.bar)}
            style={{ width: `${health.score}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4">
        <div className="mb-2.5">
          <h3 className="text-xs font-semibold text-gray-900">Sugerencias</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Acciones para destrabar hoy</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-lg bg-gray-50/80 p-2.5 flex flex-col gap-1.5 min-w-0"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-900 leading-snug">{rec.title}</p>
                <p className="mt-0.5 text-[10px] text-gray-500 leading-relaxed">{rec.description}</p>
              </div>
              <QuickChipActions actions={getRecommendationQuickActions(rec, automationHandlers)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
