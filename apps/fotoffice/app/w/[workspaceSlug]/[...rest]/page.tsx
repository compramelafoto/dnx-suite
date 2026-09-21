import { notFound } from "next/navigation";

/**
 * Captura todas las rutas bajo /w/[workspaceSlug] que no coinciden con páginas definidas.
 * Necesario para que el `not-found.tsx` del segmento se dispare cuando un visitante
 * intenta acceder a una página que no existe.
 */
export default function CatchAllRoute() {
  notFound();
}
