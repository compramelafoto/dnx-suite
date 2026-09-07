import { LogOut } from "lucide-react";
import { fotofficeLogoutAction } from "@/app/actions/auth";

/**
 * Cerrar sesión desde el portal del socio.
 *
 * Es el mismo botón del panel —misma acción, mismo ícono, mismos colores— pero acá muestra
 * solo la flecha hasta que la pantalla da para la palabra. El encabezado del portal ya lleva
 * la foto, el nombre, el número de socio, la categoría y el isotipo de la institución: en un
 * teléfono, "Cerrar sesión" escrito al lado de todo eso empuja el nombre fuera de la pantalla.
 *
 * El texto no desaparece para quien no ve la flecha: `aria-label` lo dice siempre, y el lector
 * de pantalla no lee dos veces porque el ícono va oculto y la palabra visible es la misma.
 */
export function PortalLogout() {
  return (
    <form action={fotofficeLogoutAction} className="shrink-0">
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--fo-accent)]/35 bg-[var(--fo-accent-muted)] px-2.5 text-sm font-medium text-[var(--fo-accent)] transition-colors hover:bg-[var(--fo-accent)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-accent)]/45 sm:px-3"
      >
        <LogOut className="size-4" aria-hidden />
        <span className="hidden sm:inline">Cerrar sesión</span>
      </button>
    </form>
  );
}
