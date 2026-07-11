import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canViewInfoSpotPublishedEvents,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /admin: DIRECTOR (settings) o panel de eventos (DIRECTOR + REDACTOR lectura).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  const canEnter =
    canAccessInfoSpotAdmin(subject) || canViewInfoSpotPublishedEvents(subject);
  if (!canEnter) {
    redirect("/ingresar?forbidden=infospot-admin");
  }
  return children;
}
