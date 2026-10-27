"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { InsigniaPendientes } from "@/components/website/testimonios/insignia-pendientes";

/** Menú SECUNDARIO — Historial/SEO no compiten en protagonismo con el constructor
 * (Plantillas/Secciones/Menú/Diseño, dentro de `/website`). Se accede desde acá o desde el link
 * "Volver al constructor" en cada una de estas pantallas. */
const SECONDARY_TABS = [
  { href: "/website?panel=menu", label: "Menú" },
  { href: "/website/seo", label: "SEO" },
  // Palabras clave, imagen al compartir, medición, WhatsApp flotante, redes y protección de fotos.
  { href: "/website/ajustes", label: "Ajustes" },
  { href: "/website/historial", label: "Historial" },
  { href: "/website/dominio", label: "Dominio" },
  // Las direcciones viejas (por ejemplo las de la web anterior) que llevan a las nuevas.
  { href: "/website/redirecciones", label: "Redirecciones" },
  // Los envíos de los formularios propios del sitio (y lo importado de Prosite) y el boletín.
  { href: "/website/formularios", label: "Formularios" },
  // El blog tiene su propio marco (`BlogShell`) y su ítem en el menú lateral; acá queda a mano
  // para quien llega desde la configuración del sitio.
  { href: "/website/blog", label: "Blog" },
  // Los trabajos del estudio (portfolio): también con su propio marco (`TrabajosShell`).
  { href: "/website/trabajos", label: "Trabajos" },
  // Testimonios (PR 3): el número es de los que esperan moderación.
  { href: "/website/testimonios", label: "Testimonios" },
] as const;

export function WebsiteSubNav({ pendientesTestimonios = 0 }: { pendientesTestimonios?: number }) {
  const pathname = usePathname();
  const inBuilder = pathname === "/website";

  if (inBuilder) return null;

  return (
    <div className="flex items-center justify-between border-b border-[var(--fo-border)]">
      <Link href="/website" className="flex items-center gap-1 py-2.5 text-sm font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
        <ChevronLeft className="h-4 w-4" /> Volver al constructor
      </Link>
      <nav className="flex gap-1 overflow-x-auto" aria-label="Configuración del sitio">
        {SECONDARY_TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active ? "border-[var(--fo-accent)] text-[var(--fo-text)]" : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
              ].join(" ")}
            >
              {tab.label}
              {tab.href === "/website/testimonios" ? <InsigniaPendientes cantidad={pendientesTestimonios} /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
