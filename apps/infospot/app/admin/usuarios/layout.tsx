import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  canManageInfoSpotUsers,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";

/**
 * Solo DIRECTOR / SUPER_ADMIN.
 * REDACTOR puede entrar a /admin (eventos) pero no a Equipo editorial.
 */
export default async function EquipoEditorialLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotUsers(access.subject)) {
    redirect("/ingresar?forbidden=infospot-admin");
  }
  return children;
}
