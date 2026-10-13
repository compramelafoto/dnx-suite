"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, X } from "lucide-react";
import { navBadgeClassName } from "@/components/panels/nav-badge";
import { cn } from "@/lib/utils";
import { escolarPromoMode } from "@/lib/escolar/asistencia";
import { readEscolarPromoDismissed, writeEscolarPromoDismissed } from "@/lib/escolar/promo-dismiss";
import EscolarAsistenciaButton from "./EscolarAsistenciaButton";
import { useEscolarPanelInfo, type EscolarPanelInfo } from "./useEscolarPanelInfo";

export const ESCOLAR_LANDING_PANEL_HREF = "/fotografo/escuelas/landing";
export const ESCOLAR_EMPEZAR_HREF = "/fotografo/escuelas/nueva";

const TITLE = "Sumá la venta escolar con preventa";
const BENEFITS =
  "Las familias pagan online antes de la jornada, el colegio recibe su beneficio, las fotos se ven sólo con selfie y tu landing para colegios queda lista para compartir.";

type Props = {
  variant?: "full" | "compact";
  /** Identifica la ubicación (dashboard, albumes, pedidos…): el cierre se recuerda por ubicación. */
  placement: string;
  /**
   * Qué mostrar si el fotógrafo ya tiene instituciones propias:
   * "accesos" = franja corta con su landing y asistencia; "nada" = no mostrar.
   */
  whenInUse?: "accesos" | "nada";
  className?: string;
  /** Sólo para la vista previa: datos sin pedirlos a la API. */
  previewInfo?: EscolarPanelInfo | null;
};

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cerrar aviso (no se muestra por 30 días)"
      title="Cerrar (no se muestra por 30 días)"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#9ca3af] transition-colors hover:bg-black/5 hover:text-[#4b5563]"
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}

const linkPrimary =
  "inline-flex min-h-10 items-center justify-center rounded-full bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b06d34]";
const linkSecondary =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-[#c27b3d]/35 bg-white px-4 py-2 text-sm font-semibold text-[#6b4423] transition-colors hover:border-[#c27b3d]/60 hover:bg-[#fdf8f3]";

export default function EscolarPromoBanner({
  variant = "full",
  placement,
  whenInUse = "nada",
  className,
  previewInfo,
}: Props) {
  const infoState = useEscolarPanelInfo(previewInfo);
  // null = todavía no se leyó el navegador (evita parpadeo e hidratación distinta).
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(readEscolarPromoDismissed(safeLocalStorage(), placement, Date.now()));
  }, [placement]);

  if (infoState.status !== "ready" || dismissed !== false) return null;

  const mode = escolarPromoMode(infoState.info.schoolsCount);
  if (mode === "en-uso" && whenInUse === "nada") return null;

  const close = () => {
    writeEscolarPromoDismissed(safeLocalStorage(), placement, Date.now());
    setDismissed(true);
  };

  if (mode === "en-uso") {
    return (
      <section
        aria-label="Módulo escolar"
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#c27b3d]/20 bg-[#fffaf5] px-4 py-3",
          className
        )}
      >
        <span className="flex min-w-0 flex-1 basis-[14rem] items-center gap-2 text-sm text-[#4b3621]">
          <GraduationCap className="h-5 w-5 shrink-0 text-[#c27b3d]" aria-hidden />
          <span className="min-w-0">
            <strong className="font-semibold">Escolar:</strong> compartí tu landing con los colegios.
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={ESCOLAR_LANDING_PANEL_HREF} className="text-sm font-semibold text-[#9a5c2a] hover:underline">
            Ver mi landing escolar →
          </Link>
          <EscolarAsistenciaButton appearance="link" label="Pedir asistencia" previewInfo={previewInfo} />
        </div>
        <CloseButton onClick={close} />
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <section
        aria-label="Venta escolar"
        className={cn(
          "relative flex flex-col gap-3 rounded-xl border border-[#c27b3d]/25 bg-gradient-to-r from-[#fffaf5] to-white p-4 pr-12 sm:flex-row sm:items-center",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c27b3d]/12 text-[#c27b3d]">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1a1a1a]">
              <span className={navBadgeClassName("NUEVO")}>Nuevo</span>
              {TITLE}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#6b7280] sm:text-[13px]">
              Preventa online, beneficio para el colegio, fotos sólo con selfie y tu landing lista para compartir.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link href={ESCOLAR_EMPEZAR_HREF} className={linkPrimary}>
            Empezar
          </Link>
          <Link href={ESCOLAR_LANDING_PANEL_HREF} className={linkSecondary}>
            Ver mi landing escolar
          </Link>
          <EscolarAsistenciaButton appearance="link" label="Pedir asistencia" previewInfo={previewInfo} />
        </div>
        <div className="absolute right-2 top-2">
          <CloseButton onClick={close} />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Venta escolar"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#c27b3d]/25 bg-gradient-to-br from-[#fffaf5] via-white to-[#f8fafc] p-5 pr-12 shadow-sm md:p-6 md:pr-14",
        className
      )}
    >
      <div className="absolute right-2 top-2">
        <CloseButton onClick={close} />
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c27b3d]/12 text-[#c27b3d]">
          <GraduationCap className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className={navBadgeClassName("NUEVO")}>Nuevo</span>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[#1a1a1a] md:text-xl">{TITLE}</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#4b5563]">{BENEFITS}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={ESCOLAR_EMPEZAR_HREF} className={linkPrimary}>
              Empezar
            </Link>
            <Link href={ESCOLAR_LANDING_PANEL_HREF} className={linkSecondary}>
              Ver mi landing escolar
            </Link>
            <EscolarAsistenciaButton appearance="link" previewInfo={previewInfo} className="sm:ml-2" />
          </div>
        </div>
      </div>
    </section>
  );
}
