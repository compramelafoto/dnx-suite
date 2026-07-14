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
    {
      href: "/admin/aprobaciones",
      label:
        pendingApprovals > 0
          ? `Aprobaciones editoriales · ${pendingApprovals}`
          : "Aprobaciones editoriales",
      show: canApprovals,
    },
    { href: "/admin/usuarios", label: "Equipo y roles", show: canUsers },
    { href: "/admin/eventos", label: "Eventos", show: true },
    { href: "/admin/configuracion", label: "Configuración del medio", show: true },
    { href: "/admin/lanzamiento", label: "Contenido de lanzamiento", show: true },
    { href: "/admin/ayuda", label: "Cómo publicar una historia", show: true },
    { href: "/redaccion", label: "Volver a redacción", show: true },
  ].filter((item) => item.show);

  return (
    <PageShell
      title="Panel de dirección"
      description="Herramientas de administración de Info Spot."
    >
      <ul className="divide-y divide-[var(--is-border)] overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)]">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-12 items-center px-5 text-sm font-medium text-[var(--is-text)] transition-colors hover:bg-[var(--is-bg-secondary)] hover:text-[var(--is-accent)]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
