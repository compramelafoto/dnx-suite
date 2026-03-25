import Link from "next/link";
import type { AppHeaderNavItem } from "./types";
import { appHeaderNavLinkClassName } from "./navLinkStyles";

type HeaderNavProps = {
  items: AppHeaderNavItem[];
  ariaLabel?: string;
};

/**
 * Navegación horizontal estática (sin “Más” ni medición). Solo visible desde `md` vía contenedor padre.
 * Gap 12px → 16px según breakpoint.
 *
 * **FotoRank:** no usar en `AppHeaderFlexZones` (landing/dashboard); `center` debe ser `null` y el menú va en
 * `FullscreenMenu`. Reservado para páginas excepcionales si se documenta. Ver `APP_SHELL_HEADER.md`.
 */
export function HeaderNav({ items, ariaLabel = "Principal" }: HeaderNavProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-3 lg:gap-4">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={appHeaderNavLinkClassName}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
