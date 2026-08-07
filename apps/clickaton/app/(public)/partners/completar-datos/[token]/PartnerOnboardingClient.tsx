"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DnxPartnerBrandAssetType,
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
} from "@repo/partners/client-safe";
import { PartnerOnboardingWizard } from "@/components/partners/onboarding/PartnerOnboardingWizard";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/layout/Container";
import type { PartnerLogoLibraryAsset } from "@/components/partners/logo/PartnerLogoLibrary";

type LoadState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "submitted" }
  | {
      kind: "ready";
      draft: PartnerOnboardingDraft | null;
      partnerDisplayName: string | null;
    };

type Props = { token: string };

export function PartnerOnboardingClient({ token }: Props) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/public/partners/onboarding/${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          draft?: PartnerOnboardingDraft | null;
          partnerDisplayName?: string | null;
          submitted?: boolean;
          status?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setState({ kind: "invalid" });
          return;
        }
        if (json.submitted || json.status === "SUBMITTED") {
          setState({ kind: "submitted" });
          return;
        }
        setState({
          kind: "ready",
          draft: json.draft ?? null,
          partnerDisplayName: json.partnerDisplayName ?? null,
        });
      } catch {
        if (!cancelled) setState({ kind: "invalid" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const saveDraft = useCallback(
    async (draft: PartnerOnboardingDraft) => {
      const res = await fetch(`/api/public/partners/onboarding/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "No se pudo guardar el borrador.");
      }
    },
    [token],
  );

  const uploadLogo = useCallback(
    async (type: DnxPartnerBrandAssetType, file: File): Promise<PartnerLogoLibraryAsset> => {
      const body = new FormData();
      body.set("file", file);
      body.set("assetType", type);
      const res = await fetch(
        `/api/public/partners/onboarding/${encodeURIComponent(token)}/logo`,
        { method: "POST", body },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        asset?: PartnerLogoLibraryAsset & { assetId?: string };
      };
      if (!res.ok || !json.ok || !json.asset) {
        throw new Error(json.message || "No se pudo subir el logo.");
      }
      return {
        type,
        assetId: json.asset.assetId,
        fileUrl: json.asset.fileUrl,
        mimeType: json.asset.mimeType,
        width: json.asset.width,
        height: json.asset.height,
      };
    },
    [token],
  );

  const submit = useCallback(
    async (submission: PartnerOnboardingSubmission) => {
      const res = await fetch(`/api/public/partners/onboarding/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "No se pudo enviar la información.");
      }
    },
    [token],
  );

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
            Partners
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ck-text sm:text-4xl">
            Completar datos
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-ck-text-secondary sm:text-base">
            Cargá la información de tu empresa, contacto y logos para la alianza con Clickatón.
          </p>
        </header>

        {state.kind === "loading" ? (
          <Card variant="outlined" className="p-6 text-sm text-ck-text-muted">
            Cargando…
          </Card>
        ) : null}

        {state.kind === "invalid" ? (
          <Card variant="outlined" className="space-y-3 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ck-text">Enlace no disponible</h2>
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              Este enlace no es válido o ya no está disponible. Si creés que es un error, pedile a
              tu contacto de Clickatón un nuevo enlace.
            </p>
          </Card>
        ) : null}

        {state.kind === "submitted" ? (
          <Card variant="outlined" className="space-y-3 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ck-text">Ya enviaste tus datos</h2>
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              Esta invitación ya fue completada. Si necesitás corregir algo, contactá al equipo de
              Clickatón.
            </p>
          </Card>
        ) : null}

        {state.kind === "ready" ? (
          <PartnerOnboardingWizard
            initialDraft={state.draft}
            partnerDisplayName={state.partnerDisplayName}
            onSaveDraft={saveDraft}
            onUploadLogo={uploadLogo}
            onSubmit={submit}
          />
        ) : null}
      </div>
    </Container>
  );
}
