import { requireAuth } from "@/lib/auth";

/**
 * Armazón del editor para el socio: la ventana entera, como el del panel, pero sin exigir ser
 * del equipo de una institución. Cada página decide qué puede abrir (ver
 * `portal/fotolibros/[templateId]/[versionId]/page.tsx`).
 */
export default async function EditorPortalLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <div className="h-[100dvh] overflow-hidden bg-[var(--fo-bg)]">{children}</div>;
}
