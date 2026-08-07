"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  PARTNER_ALLOWED_LOGO_MIMES,
  type DnxPartnerBrandAssetType,
} from "@repo/partners/client-safe";
import { PartnerLogoDualPreview } from "@/components/partners/logo/PartnerLogoDualPreview";

type Props = {
  partnerId: string;
  previewUrl?: string | null;
  logoStateLabel: string;
  approveAction: (formData: FormData) => Promise<void>;
  archiveAction: (formData: FormData) => Promise<void>;
  assetId?: string | null;
  canApprove: boolean;
  /** Default LOGO_PRIMARY */
  assetType?: DnxPartnerBrandAssetType;
};

const ACCEPT = [...PARTNER_ALLOWED_LOGO_MIMES, ".png", ".webp"].join(",");

export function PartnerLogoUpload({
  partnerId,
  previewUrl,
  logoStateLabel,
  approveAction,
  archiveAction,
  assetId,
  canApprove,
  assetType = "LOGO_PRIMARY",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    const body = new FormData();
    body.set("file", file);
    body.set("assetType", assetType);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/logo`, {
        method: "POST",
        body,
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.message || json.error || "No se pudo subir el logo.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Error de red al subir el logo.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const shown = localPreview || previewUrl || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ck-text-secondary">Estado logo: {logoStateLabel}</p>
        <button
          type="button"
          className="rounded-lg bg-ck-accent px-4 py-2 text-sm font-medium text-ck-bg disabled:opacity-50"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          Subir logo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
        />
      </div>
      <p className="text-xs text-ck-text-muted">
        Solo PNG o WEBP (fondo transparente recomendado). JPG y SVG no se aceptan en uploads
        nuevos.
      </p>
      <PartnerLogoDualPreview src={shown} transparencyHint alt="Vista previa del logo" />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {assetId ? (
        <div className="flex flex-wrap gap-3">
          {canApprove ? (
            <form action={approveAction}>
              <input type="hidden" name="partnerId" value={partnerId} />
              <input type="hidden" name="assetId" value={assetId} />
              <button
                type="submit"
                className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200"
              >
                Aprobar logo
              </button>
            </form>
          ) : null}
          <form action={archiveAction}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input type="hidden" name="assetId" value={assetId} />
            <button
              type="submit"
              className="rounded-lg border border-ck-border px-3 py-2 text-sm text-ck-text-muted"
            >
              Archivar logo
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
