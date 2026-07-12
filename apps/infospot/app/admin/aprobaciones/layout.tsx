import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  canReviewInfoSpotApprovals,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";

export const dynamic = "force-dynamic";

export default async function AdminAprobacionesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await requireInfoSpotAdminAccess();
  if (!canReviewInfoSpotApprovals(access.subject)) {
    redirect("/ingresar?forbidden=infospot-admin");
  }
  return children;
}
