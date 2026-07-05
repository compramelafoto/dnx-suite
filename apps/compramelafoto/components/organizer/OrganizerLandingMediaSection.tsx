"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { DsInfoPanel } from "@/components/ui/DsLayout";

type Props = {
  logoUrl: string | null;
  bannerUrl: string | null;
  onLogoChange: (url: string | null) => void;
  onBannerChange: (url: string | null) => void;
};

type UploadState = {
  loading: boolean;
  error: string | null;
  success: string | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function OrganizerLandingMediaSection({
  logoUrl,
  bannerUrl,
  onLogoChange,
  onBannerChange,
}: Props) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [logoState, setLogoState] = useState<UploadState>({ loading: false, error: null, success: null });
  const [bannerState, setBannerState] = useState<UploadState>({ loading: false, error: null, success: null });

  async function upload(kind: "logo" | "banner", file: File) {
    const setState = kind === "logo" ? setLogoState : setBannerState;
    const onChange = kind === "logo" ? onLogoChange : onBannerChange;
    setState({ loading: true, error: null, success: null });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/organizer/landing/${kind}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ loading: false, error: data.error || "Error al subir", success: null });
        return;
      }
      const url = kind === "logo" ? data.logoUrl : data.bannerUrl;
      onChange(url ?? null);
      setState({
        loading: false,
        error: null,
        success: kind === "logo" ? "Logo actualizado." : "Portada actualizada.",
      });
      setTimeout(() => setState((s) => ({ ...s, success: null })), 4000);
    } catch {
      setState({ loading: false, error: "Error de conexión", success: null });
    }
  }

  return (
    <div className="space-y-5">
      <DsInfoPanel title="Logo y portada">
        <p className="ds-readable-text text-sm text-gray-700 m-0">
          Recomendamos un <strong>logo cuadrado</strong> (PNG o JPG con fondo transparente si podés) y un{" "}
          <strong>banner horizontal</strong> ancho para el encabezado de tu página pública.
        </p>
      </DsInfoPanel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-800 m-0">Logo</p>
          <div className="flex items-center justify-center w-full max-w-[200px] aspect-square rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm mx-auto sm:mx-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Vista previa del logo" className="w-full h-full object-contain p-3" />
            ) : (
              <span className="text-xs text-gray-400 px-4 text-center">Sin logo</span>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("logo", file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={logoState.loading}
            onClick={() => logoInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {logoState.loading ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
          </Button>
          {logoState.error ? <p className="text-xs text-red-700 m-0">{logoState.error}</p> : null}
          {logoState.success ? <p className="text-xs text-green-800 m-0">{logoState.success}</p> : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-800 m-0">Banner / portada</p>
          <div className="w-full aspect-[21/9] rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm flex items-center justify-center">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Vista previa del banner" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400 px-4 text-center">Sin banner</span>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("banner", file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={bannerState.loading}
            onClick={() => bannerInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {bannerState.loading ? "Subiendo…" : bannerUrl ? "Cambiar banner" : "Subir banner"}
          </Button>
          {bannerState.error ? <p className="text-xs text-red-700 m-0">{bannerState.error}</p> : null}
          {bannerState.success ? <p className="text-xs text-green-800 m-0">{bannerState.success}</p> : null}
        </div>
      </div>
    </div>
  );
}
