"use client";

import { useState } from "react";
import type { WelcomeAdminScopeKind } from "@repo/partners";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { WelcomeContextPicker } from "./WelcomeContextPicker";
import { linkWelcomeParticipationFormAction } from "@/lib/admin/partners/welcome-admin-mutations";

const SCOPES_BY_APP: Record<string, WelcomeAdminScopeKind[]> = {
  CLICKATON: ["GLOBAL", "PLATFORM", "EDITION"],
  FOTO_RANK: ["GLOBAL", "PLATFORM", "CONTEST"],
  COMPRAME_LA_FOTO: ["GLOBAL", "PLATFORM", "ALBUM"],
  INFO_SPOT: ["GLOBAL", "PLATFORM"],
};

const SCOPE_LABELS: Record<WelcomeAdminScopeKind, string> = {
  GLOBAL: "Global (explícito)",
  PLATFORM: "Plataforma (explícito)",
  EDITION: "Evento / edición (Clickatón)",
  CONTEST: "Concurso (FotoRank)",
  ALBUM: "Álbum (ComprameLaFoto)",
};

export function WelcomeScopeLinkForm({
  partnerId,
  campaignId,
  application,
}: {
  partnerId: string;
  campaignId: string;
  application: string;
}) {
  const allowed = SCOPES_BY_APP[application] ?? ["GLOBAL", "PLATFORM"];
  const [scopeKind, setScopeKind] = useState<WelcomeAdminScopeKind>(allowed[0] ?? "GLOBAL");
  const needsEntity =
    scopeKind === "EDITION" || scopeKind === "CONTEST" || scopeKind === "ALBUM";

  return (
    <form action={linkWelcomeParticipationFormAction} className="space-y-4">
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <Field id={`scope-${campaignId}`} label="Alcance de la activación">
        <Select
          name="scopeKind"
          value={scopeKind}
          onChange={(e) => setScopeKind(e.target.value as WelcomeAdminScopeKind)}
        >
          {allowed.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      {needsEntity ? (
        <Field id={`ctx-${campaignId}`} label="Entidad contextual">
          <WelcomeContextPicker
            scopeKind={scopeKind as Extract<WelcomeAdminScopeKind, "EDITION" | "CONTEST" | "ALBUM">}
          />
        </Field>
      ) : (
        <p className="text-xs text-ck-text-secondary">
          Se creará una participación GLOBAL/PLATFORM explícita (no huérfana).
        </p>
      )}
      <Button type="submit">Vincular alcance / participación</Button>
    </form>
  );
}
