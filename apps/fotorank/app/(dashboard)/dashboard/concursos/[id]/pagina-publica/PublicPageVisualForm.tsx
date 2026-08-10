"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearContestPublicBannerAction,
  resetPublicPageVisualAction,
  savePublicPageVisualAction,
  uploadContestPublicBannerAction,
} from "../../../../../actions/public-page-visual";
import type { PublicPageVisualConfig } from "../../../../../lib/fotorank/contest-visual";
import { FormField, inputBase } from "../../../../../components/ui/form";

type Props = {
  contestId: string;
  contestTitle: string;
  contestSlug: string;
  initialConfig: PublicPageVisualConfig | null;
  coverImageUrl: string | null;
  defaultColors: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    foregroundColor: string;
  };
};

export function PublicPageVisualForm({
  contestId,
  contestTitle,
  contestSlug,
  initialConfig,
  coverImageUrl,
  defaultColors,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [primaryColor, setPrimaryColor] = useState(
    initialConfig?.primaryColor ?? defaultColors.primaryColor,
  );
  const [accentColor, setAccentColor] = useState(
    initialConfig?.accentColor ?? defaultColors.accentColor,
  );
  const [backgroundColor, setBackgroundColor] = useState(
    initialConfig?.backgroundColor ?? defaultColors.backgroundColor,
  );
  const [foregroundColor, setForegroundColor] = useState(
    initialConfig?.foregroundColor ?? defaultColors.foregroundColor,
  );

  const bannerPreview =
    initialConfig?.bannerCleared
      ? null
      : initialConfig?.bannerUrl || coverImageUrl || null;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado.");
      }
    });
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3 border-b border-fr-border pb-8">
        <p className="fr-eyebrow">Diseño</p>
        <h1 className="text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl">
          Página pública
        </h1>
        <p className="fr-page-description max-w-2xl">
          Personalizá el banner y los colores de la landing de{" "}
          <strong className="text-fr-primary">{contestTitle}</strong>. Los cambios solo afectan
          este concurso.
        </p>
        <Link
          href={`/concursos/${contestSlug}`}
          className="fr-btn fr-btn-secondary inline-flex min-h-11 w-fit px-5 py-3 text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver página pública
        </Link>
      </header>

      {error ? (
        <p className="fr-form-error-text rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="fr-form-success-text rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          {okMsg}
        </p>
      ) : null}

      <section className="fr-recuadro space-y-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-fr-primary">Banner horizontal</h2>
          <p className="mt-4 text-sm text-fr-muted md:text-base">
            Imagen panorámica de portada. JPEG, PNG o WebP · máx. 4 MB · mín. 640×240.
          </p>
        </div>

        {bannerPreview ? (
          <div className="overflow-hidden rounded-lg border border-fr-border bg-fr-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerPreview}
              alt="Vista previa del banner"
              className="mx-auto max-h-64 w-full object-contain"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-fr-border px-6 py-12 text-center text-sm text-fr-muted">
            Sin banner personalizado. Se usará el predeterminado del tema del concurso (si existe).
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("file", file);
              run(async () => {
                const res = await uploadContestPublicBannerAction(contestId, fd);
                if (!res.ok) throw new Error(res.error);
                setOkMsg("Banner actualizado.");
              });
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="fr-btn fr-btn-primary min-h-11 px-5 py-3 text-sm"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {bannerPreview ? "Reemplazar imagen" : "Subir imagen"}
          </button>
          {bannerPreview ? (
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11 px-5 py-3 text-sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await clearContestPublicBannerAction(contestId);
                  if (!res.ok) throw new Error(res.error);
                  setOkMsg("Banner eliminado.");
                })
              }
            >
              Eliminar imagen
            </button>
          ) : null}
        </div>
      </section>

      <section className="fr-recuadro space-y-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-fr-primary">Colores</h2>
          <p className="mt-4 text-sm text-fr-muted md:text-base">
            Solo hexadecimales #RRGGBB. Se valida contraste mínimo AA entre texto y fondo.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
          <ColorField label="Color principal (botones)" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Color de acento (focus)" value={accentColor} onChange={setAccentColor} />
          <ColorField label="Color de fondo" value={backgroundColor} onChange={setBackgroundColor} />
          <ColorField label="Color de texto" value={foregroundColor} onChange={setForegroundColor} />
        </div>

        <div className="rounded-lg border border-fr-border p-6" style={{ backgroundColor }}>
          <p className="text-sm font-semibold" style={{ color: foregroundColor }}>
            Vista previa del encabezado
          </p>
          <p className="mt-3 text-sm" style={{ color: foregroundColor, opacity: 0.75 }}>
            Texto secundario de ejemplo sobre el fondo elegido.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span
              className="inline-flex min-h-11 items-center rounded-md px-5 text-sm font-semibold"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
            >
              Botón principal
            </span>
            <span
              className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold"
              style={{ borderColor: accentColor, color: foregroundColor }}
            >
              Botón secundario
            </span>
          </div>
        </div>
      </section>

      <div className="fr-form-actions flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-primary min-h-11 px-6 py-3"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await savePublicPageVisualAction(contestId, {
                v: 1,
                primaryColor,
                accentColor,
                backgroundColor,
                foregroundColor,
                heroLayout: "stacked",
                heroOverlayStrength: "none",
                heroFitDesktop: "cover",
                heroFitMobile: "contain",
              });
              if (!res.ok) throw new Error(res.error);
              setOkMsg("Cambios guardados.");
            })
          }
        >
          Guardar cambios
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-6 py-3"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await resetPublicPageVisualAction(contestId);
              if (!res.ok) throw new Error(res.error);
              setPrimaryColor(defaultColors.primaryColor);
              setAccentColor(defaultColors.accentColor);
              setBackgroundColor(defaultColors.backgroundColor);
              setForegroundColor(defaultColors.foregroundColor);
              setOkMsg("Se restauraron los valores predeterminados de FotoRank / preset del concurso.");
            })
          }
        >
          Restaurar predeterminados
        </button>
        <Link
          href={`/dashboard/concursos/${contestId}`}
          className="fr-btn fr-btn-ghost min-h-11 px-6 py-3"
        >
          Volver al hub
        </Link>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded border border-fr-border bg-transparent p-1"
          aria-label={label}
        />
        <input
          className={inputBase}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0b3a6e"
          spellCheck={false}
        />
      </div>
    </FormField>
  );
}
