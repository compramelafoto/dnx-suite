import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireInfoSpotAdminAccess } from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const access = await requireInfoSpotAdminAccess();

  return (
    <PageShell
      title="Admin Info Spot"
      description={`Dirección: ${access.user.email}`}
    >
      <ul className="space-y-3 text-sm">
        {[
          { href: "/admin/configuracion", label: "Configuración del medio" },
          { href: "/admin/usuarios", label: "Equipo editorial" },
          { href: "/admin/lanzamiento", label: "Contenido de lanzamiento (DEMO/REAL)" },
          { href: "/admin/eventos", label: "Moderación de eventos" },
          { href: "/redaccion", label: "Redacción (noticias)" },
        ].map((item) => (
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
