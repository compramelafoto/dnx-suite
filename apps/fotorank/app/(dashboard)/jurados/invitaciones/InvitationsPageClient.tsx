"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  FormField,
  FormSection,
  radius,
  spacing,
  useResolvedTheme,
} from "@repo/design-system";
import {
  listJudgeInvitationsForOrg,
  regenerateJudgeInvitationLink,
  revokeJudgeInvitation,
  sendJudgeInvitation,
} from "../../../actions/judges";

export type InvitationRow = {
  id: string;
  email: string;
  contestId: string;
  contestTitle: string;
  categoryId: string | null;
  categoryName: string | null;
  invitationStatus: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  judgeLabel: string | null;
};

type ContestOption = {
  id: string;
  title: string;
  categories: Array<{ id: string; name: string }>;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Borrador",
    SENT: "Enviada",
    OPENED: "Vista",
    ACCEPTED: "Aceptada",
    REJECTED: "Rechazada",
    EXPIRED: "Vencida",
    REVOKED: "Revocada",
  };
  return map[status] ?? status;
}

async function copyRegistrationUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function InvitationsPageClient({
  contests,
  initialInvitations,
}: {
  contests: ContestOption[];
  initialInvitations: InvitationRow[];
}) {
  const router = useRouter();
  const theme = useResolvedTheme();
  const [invitations, setInvitations] = useState<InvitationRow[]>(initialInvitations);
  const [selectedContestId, setSelectedContestId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    setInvitations(initialInvitations);
  }, [initialInvitations]);

  const categoriesForContest = useMemo(() => {
    const c = contests.find((x) => x.id === selectedContestId);
    return c?.categories ?? [];
  }, [contests, selectedContestId]);

  const controlStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: radius.button,
    border: `1px solid ${theme.border.subtle}`,
    background: theme.surface.base,
    color: theme.text.primary,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: "0.95rem",
    outline: "none",
  };

  async function refreshList() {
    const res = await listJudgeInvitationsForOrg();
    if (res.ok && res.data) setInvitations(res.data as InvitationRow[]);
    router.refresh();
  }

  async function onCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    setPendingUrl(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const categoryRaw = String(fd.get("categoryId") ?? "").trim();
    const res = await sendJudgeInvitation({
      email: String(fd.get("email") ?? ""),
      contestId: String(fd.get("contestId") ?? ""),
      categoryId: categoryRaw || undefined,
      expiresInDays: Number(fd.get("expiresInDays") ?? 7),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setFormOk(
      "Invitación creada. El enlace de registro solo se muestra ahora: copiálo y compartilo por un canal seguro (email, etc.). No guardamos el token en pantalla."
    );
    if (res.data?.registrationUrl) {
      setPendingUrl(res.data.registrationUrl);
      await copyRegistrationUrl(res.data.registrationUrl);
    }
    await refreshList();
  }

  async function onRegenerate(id: string) {
    if (
      !window.confirm(
        "Se generará un nuevo enlace y el anterior dejará de funcionar. ¿Continuar?"
      )
    ) {
      return;
    }
    setRowBusy(id);
    setFormError(null);
    const res = await regenerateJudgeInvitationLink(id);
    setRowBusy(null);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    if (res.data?.registrationUrl) {
      const ok = await copyRegistrationUrl(res.data.registrationUrl);
      setFormOk(
        ok
          ? "Nuevo enlace generado y copiado al portapapeles."
          : "Nuevo enlace generado. Usá «Copiar último enlace» si hace falta."
      );
      setPendingUrl(res.data.registrationUrl);
    }
    await refreshList();
  }

  async function onRevoke(id: string) {
    if (!window.confirm("¿Revocar esta invitación? El enlace dejará de ser válido.")) return;
    setRowBusy(id);
    setFormError(null);
    const res = await revokeJudgeInvitation(id);
    setRowBusy(null);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setFormOk("Invitación revocada.");
    setPendingUrl(null);
    await refreshList();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {formError ? (
        <p style={{ color: "#fca5a5", margin: 0 }} role="alert">
          {formError}
        </p>
      ) : null}
      {formOk ? (
        <p style={{ color: "#86efac", margin: 0 }} role="status">
          {formOk}
        </p>
      ) : null}

      {pendingUrl ? (
        <Card>
          <p style={{ margin: 0, fontSize: "0.9rem", color: theme.text.secondary }}>
            Último enlace generado en esta sesión (el token no se muestra solo): podés copiarlo de nuevo para pegarlo en tu proveedor de email.
          </p>
          <div style={{ marginTop: spacing[3], display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const ok = await copyRegistrationUrl(pendingUrl);
                setFormOk(ok ? "Enlace copiado al portapapeles." : "No se pudo copiar automáticamente.");
              }}
            >
              Copiar último enlace
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPendingUrl(null)}>
              Ocultar
            </Button>
          </div>
        </Card>
      ) : null}

      <form onSubmit={onCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
        <FormSection title="Nueva invitación" style={{ marginBottom: 0 }}>
          <FormField label="Email del jurado" htmlFor="inv-email" required>
            <input id="inv-email" name="email" type="email" required style={controlStyle} />
          </FormField>
          <FormField label="Concurso" htmlFor="inv-contest" required>
            <select
              id="inv-contest"
              name="contestId"
              required
              style={controlStyle}
              value={selectedContestId}
              onChange={(e) => setSelectedContestId(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Categoría (opcional)" htmlFor="inv-category">
            <select id="inv-category" name="categoryId" style={controlStyle} disabled={!selectedContestId}>
              <option value="">Todas / sin categoría específica</option>
              {categoriesForContest.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Expira en (días)" htmlFor="inv-expires">
            <input id="inv-expires" name="expiresInDays" type="number" min={1} max={90} defaultValue={7} style={controlStyle} />
          </FormField>
        </FormSection>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando…" : "Crear invitación"}
        </Button>
      </form>

      <div>
        <h2 className="text-xl font-semibold text-fr-primary" style={{ marginBottom: spacing[4] }}>
          Invitaciones recientes
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${theme.border.subtle}` }}>
                <th style={{ padding: spacing[2] }}>Email</th>
                <th style={{ padding: spacing[2] }}>Concurso</th>
                <th style={{ padding: spacing[2] }}>Categoría</th>
                <th style={{ padding: spacing[2] }}>Estado</th>
                <th style={{ padding: spacing[2] }}>Expira</th>
                <th style={{ padding: spacing[2] }}>Creada</th>
                <th style={{ padding: spacing[2] }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: spacing[4], color: theme.text.secondary }}>
                    No hay invitaciones todavía.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  const canRotate =
                    !expired &&
                    inv.invitationStatus !== "ACCEPTED" &&
                    inv.invitationStatus !== "REVOKED" &&
                    inv.invitationStatus !== "REJECTED";
                  const canRevoke = inv.invitationStatus !== "ACCEPTED" && inv.invitationStatus !== "REVOKED";
                  return (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                      <td style={{ padding: spacing[2], verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{inv.email}</div>
                        {inv.judgeLabel ? (
                          <div style={{ fontSize: "0.8rem", color: theme.text.secondary }}>{inv.judgeLabel}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: spacing[2], verticalAlign: "top" }}>{inv.contestTitle}</td>
                      <td style={{ padding: spacing[2], verticalAlign: "top" }}>
                        {inv.categoryName ?? "—"}
                      </td>
                      <td style={{ padding: spacing[2], verticalAlign: "top" }}>
                        {statusLabel(inv.invitationStatus)}
                        {expired ? (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#fca5a5" }}>
                            Vencida
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: spacing[2], verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {formatDate(inv.expiresAt)}
                      </td>
                      <td style={{ padding: spacing[2], verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {formatDate(inv.createdAt)}
                      </td>
                      <td style={{ padding: spacing[2], verticalAlign: "top" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canRotate || rowBusy === inv.id}
                            onClick={() => onRegenerate(inv.id)}
                          >
                            Nuevo enlace
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canRevoke || rowBusy === inv.id}
                            onClick={() => onRevoke(inv.id)}
                          >
                            Revocar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
