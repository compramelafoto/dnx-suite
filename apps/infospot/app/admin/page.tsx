import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import { PageShell } from "@/components/page-shell";
import {
  canManageInfoSpotUsers,
  canReviewInfoSpotApprovals,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireInfoSpotAdminAccess();
  const canUsers = canManageInfoSpotUsers(access.subject);
  const canApprovals = canReviewInfoSpotApprovals(access.subject);

  const pendingApprovals = canApprovals
    ? await prisma.infoSpotArticle.count({ where: { status: "IN_REVIEW" } })
    : 0;

  const links = [
    { href: "/admin/configuracion", label: "Configuración del medio", show: true },
    { href: "/admin/usuarios", label: "Equipo editorial", show: canUsers },
    {
      href: "/admin/aprobaciones",
      label:
        pendingApprovals > 0
          ? `Aprobaciones editoriales · ${pendingApprovals}`
          : "Aprobaciones editoriales",
      show: canApprovals,
    },
    { href: "/admin/lanzamiento", label: "Contenido de lanzamiento (DEMO/REAL)", show: true },
    { href: "/admin/eventos", label: "Moderación de eventos", show: true },
    { href: "/redaccion", label: "Redacción (noticias)", show: true },
  ].filter((item) => item.show);

  return (
    <PageShell
      title="Admin Info Spot"
      description={`Dirección: ${access.user.email}`}
    >
      <ul className="space-y-3 text-sm">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
