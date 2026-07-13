import type { ReactNode } from "react";
import { getAuthUser } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canManageInfoSpotUsers,
  canReviewInfoSpotApprovals,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { RedaccionShellClient } from "@/components/redaccion/redaccion-shell-client";

export async function RedaccionShell({
  title,
  description,
  actions,
  header,
  focusActions,
  variant,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Si se pasa, reemplaza el bloque título / descripción / acciones. */
  header?: ReactNode;
  /** Acciones del header de concentración (guardar, preview, CTA). */
  focusActions?: ReactNode;
  /** `editor` fuerza chrome de concentración; si se omite, se detecta por pathname. */
  variant?: "default" | "editor";
  children: ReactNode;
}) {
  const user = await getAuthUser();
  const membership = user ? await getInfoSpotMembership(user.id) : null;
  const subject = user ? toPermissionSubject(user, membership) : null;
  const showAdmin = canAccessInfoSpotAdmin(subject);
  const showUsers = canManageInfoSpotUsers(subject);
  const showApprovals = canReviewInfoSpotApprovals(subject);

  const label = user?.name?.trim() || user?.email || "";
  const initial = (label.trim()[0] || "?").toUpperCase();

  return (
    <RedaccionShellClient
      variant={variant}
      title={title}
      description={description}
      actions={actions}
      header={header}
      focusActions={focusActions}
      showAdmin={showAdmin}
      showUsers={showUsers}
      showApprovals={showApprovals}
      userLabel={label}
      userInitial={initial}
      userAvatarUrl={user?.avatarUrl ?? null}
    >
      {children}
    </RedaccionShellClient>
  );
}
