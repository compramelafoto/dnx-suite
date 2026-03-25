"use client";

import type { ModuleInfo } from "../../../lib/fotorank/contestProgress";
import { MODULE_STATUS_LABELS } from "../../../lib/fotorank/contestStatus";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  NOT_STARTED: (
    <svg className="h-5 w-5 text-fr-muted-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  IN_PROGRESS: (
    <svg className="h-5 w-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  COMPLETE: (
    <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  LOCKED: (
    <svg className="h-5 w-5 text-fr-muted-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  RESTRICTED: (
    <svg className="h-5 w-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
};

interface ContestSetupCardProps {
  module: ModuleInfo;
  onClick?: () => void;
}

export function ContestSetupCard({ module, onClick }: ContestSetupCardProps) {
  const visualState = module.visualState ?? module.status;
  const isLocked = visualState === "LOCKED";
  const isComplete = module.status === "COMPLETE";
  const cardClassName =
    "group block w-full rounded-xl border transition-all cursor-pointer text-left " +
    (isLocked
      ? "border-[#262626] bg-[#0f0f0f] hover:border-[#333] opacity-90"
      : isComplete
        ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30"
        : "border-[#262626] bg-[#141414] hover:border-gold/30 hover:bg-[#1a1a1a]");

  const statusLabel = MODULE_STATUS_LABELS[visualState] ?? MODULE_STATUS_LABELS[module.status] ?? "Pendiente";

  const content = (
    <div className="fr-recuadro">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <span className="shrink-0">{STATUS_ICONS[visualState] ?? STATUS_ICONS.NOT_STARTED}</span>
            <h3 className="font-sans text-lg font-semibold text-fr-primary">{module.label}</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-fr-muted">{module.description}</p>
          <div className="mt-6 flex items-center gap-4">
            <span
              className={
                "text-xs font-medium " +
                (isComplete ? "text-emerald-400" : isLocked ? "text-fr-muted-soft" : "text-fr-muted")
              }
            >
              {module.status === "IN_PROGRESS" && module.progress < 100
                ? module.progress + "% completado"
                : statusLabel}
            </span>
            {module.progress > 0 && module.progress < 100 && !isLocked && (
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#262626]">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: module.progress + "%" }}
                />
              </div>
            )}
          </div>
        </div>
        <span
          className={
            "inline-flex shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
            (isLocked
              ? "border border-[#262626] bg-[#0a0a0a] text-fr-muted-soft"
              : isComplete
                ? "border border-[#262626] bg-[#0a0a0a] text-fr-muted group-hover:border-gold/30 group-hover:text-gold"
                : "bg-gold text-[#050505] group-hover:bg-[#e5c04a]")
          }
        >
          {module.cta}
        </span>
      </div>
    </div>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cardClassName}
    >
      {content}
    </button>
  );
}
