"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { albumModeOptions } from "@/lib/albums/album-mode-options";

export type AlbumNextStepsMode = "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE";

export type AlbumModeControlProps = {
  value: AlbumNextStepsMode;
  onChange: (value: AlbumNextStepsMode) => void;
  onSave: () => void;
  saving: boolean;
};

const STEPS_BY_MODE: Record<AlbumNextStepsMode, string[]> = {
  SCHOOL: [
    "Subir fotos del curso",
    "Configurar packs y carpeta escolar",
    "Preparar preventa (si corresponde)",
    "Configurar plantilla de diseño",
  ],
  EVENT: [
    "Subir fotos del evento",
    "Configurar packs digitales",
    "Revisar precio por foto",
    "Publicar el álbum",
  ],
  SIMPLE: [
    "Subir fotos",
    "Verificar precio de fotos digitales",
    "Publicar álbum",
  ],
  COLLABORATIVE: [
    "Subir tus fotos",
    "Revisar configuración del evento",
    "Compartir el álbum con participantes",
  ],
};

function albumDashboardHref(
  albumId: number,
  tab:
    | "fotos"
    | "ventas"
    | "packs"
    | "preventa"
    | "adicionales"
    | "videos"
    | "publicacion"
    | "configuracion"
): string {
  return `/dashboard/albums/${albumId}?tab=${tab}`;
}

function buildQuickActionLinks(opts: {
  mode: AlbumNextStepsMode;
  albumId: number;
  eventId?: number | null;
  eventShareSlug?: string | null | undefined;
  videoMvpEnabled?: boolean;
}): Array<{ label: string; href: string; key: string; primary?: boolean }> {
  const { mode, albumId } = opts;
  const out: Array<{ label: string; href: string; key: string; primary?: boolean }> = [];

  const add = (label: string, href: string, key: string, primary = false) => {
    out.push({ label, href, key, primary });
  };

  add("Subir fotos", albumDashboardHref(albumId, "fotos"), "fotos", true);
  if (opts.videoMvpEnabled) {
    add("Subir videos", albumDashboardHref(albumId, "videos"), "videos");
  }
  add("Revisar ventas", albumDashboardHref(albumId, "ventas"), "ventas");
  add("Configurar packs", albumDashboardHref(albumId, "packs"), "packs-gallery");

  if (mode === "SCHOOL") {
    add("Configurar preventa", albumDashboardHref(albumId, "preventa"), "preventa");
    add("Adicionales", albumDashboardHref(albumId, "adicionales"), "adicionales");
  }

  if (mode === "EVENT") {
    add("Publicar álbum", albumDashboardHref(albumId, "publicacion"), "publicar", true);
  }

  if (mode === "COLLABORATIVE") {
    const slug = typeof opts.eventShareSlug === "string" ? opts.eventShareSlug.trim() : "";
    if (slug) {
      add("Ver evento", `/e/${slug}`, "event-e");
    }
  }

  return out;
}

type AlbumNextStepsProps = {
  mode: AlbumNextStepsMode;
  albumId: number;
  eventId?: number | null | undefined;
  eventShareSlug?: string | null | undefined;
  albumModeControl?: AlbumModeControlProps;
  videoMvpEnabled?: boolean;
};

export default function AlbumNextSteps({
  mode,
  albumId,
  eventId,
  eventShareSlug,
  albumModeControl,
  videoMvpEnabled,
}: AlbumNextStepsProps) {
  const items = STEPS_BY_MODE[mode] ?? STEPS_BY_MODE.SIMPLE;
  const actions = buildQuickActionLinks({
    mode,
    albumId,
    eventId: eventId ?? null,
    eventShareSlug,
    videoMvpEnabled,
  });

  const modeDescription =
    albumModeControl &&
    albumModeOptions.find((o) => o.value === albumModeControl.value)?.description;

  return (
    <aside
      className="ds-fill-width rounded-xl border border-[#e8dcc8] bg-gradient-to-br from-[#fdf8f3] to-[#faf6f0] px-5 py-5 shadow-sm sm:px-6 sm:py-6"
      aria-label="Sugerencias de próximos pasos"
    >
      <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex gap-4">
            <div className="shrink-0 text-[#c27b3d] pt-0.5" aria-hidden>
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
            </div>
            <div className="ds-content-container min-w-0 space-y-2">
              <h2 className="text-lg font-semibold leading-snug text-[#1a1a1a] m-0">
                ¿Qué te recomendamos hacer ahora?
              </h2>
              <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#4b5563] m-0">
                Seguí estos pasos para dejar el álbum listo. Las acciones rápidas te llevan a cada sección.
              </p>
            </div>
          </div>

          <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm text-[#374151] marker:text-[#c27b3d]/80 sm:pl-11">
            {items.map((line) => (
              <li key={line} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>

          <div
            className="flex flex-wrap gap-3 sm:pl-11"
            role="group"
            aria-label="Acciones rápidas"
          >
            {actions.map(({ label, href, key, primary }) => (
              <Link key={key} href={href} prefetch={false} className="inline-flex shrink-0">
                <Button
                  type="button"
                  variant={primary ? "primary" : "secondary"}
                  size="md"
                  className="whitespace-nowrap px-5 py-2.5 text-sm font-semibold shadow-sm"
                >
                  {label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {albumModeControl ? (
          <div className="w-full shrink-0 sm:ml-auto sm:w-auto sm:max-w-[17.5rem]">
            <div className="flex flex-col gap-3 rounded-xl border border-[#e8dcc8]/80 bg-white/80 p-4 shadow-sm sm:p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#1a1a1a] m-0">Tipo de álbum</p>
                <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-[#6b7280] m-0">
                  Informativo; no cambia checkout ni la vista pública.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2.5">
                <label className="sr-only" htmlFor="album-next-steps-mode-select">
                  Modo del álbum
                </label>
                <Select
                  id="album-next-steps-mode-select"
                  value={albumModeControl.value}
                  onChange={(e) =>
                    albumModeControl.onChange(e.target.value as AlbumNextStepsMode)
                  }
                  className="w-full rounded-lg border-[#dfd5c9] bg-white py-2.5 pl-3 pr-9 text-sm text-[#374151] shadow-sm"
                >
                  {albumModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={albumModeControl.saving}
                  onClick={() => albumModeControl.onSave()}
                  className="w-full whitespace-nowrap py-2.5 text-sm font-semibold"
                >
                  {albumModeControl.saving ? "Guardando…" : "Guardar tipo"}
                </Button>
              </div>
              {modeDescription ? (
                <p
                  className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-[#6b7280] m-0 leading-relaxed"
                  title={modeDescription}
                >
                  {modeDescription}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
