# Shell público / marketing (ComprameLaFoto, landings)

Barra superior para sitios **públicos** de la suite (no el dashboard con sidebar). Alineada visualmente con la landing FotoRank: fondo oscuro, acento dorado `#D4AF37`, logo **grande** a la izquierda con márgenes del contenedor.

## Componente

**`PublicMarketingHeader`** (`@repo/design-system/components/layout`)

| Zona | Contenido |
|------|-----------|
| **Izquierda** | `logo` (ReactNode): conviene envolver en `LinkComponent` hacia home con imagen usando estilos de `appShellHeader.publicShell`. |
| **Derecha** | Orden fijo (misma regla que **FotoRank landing** en `APP_SHELL_HEADER.md`): **1)** panel (`showDashboardLink`) **2)** login / logout **3)** menú dorado. Token documental: `appShellHeader.rightClusterOrder`. |

### Props clave

- **`LinkComponent`**: `next/link` (o `<a>`).
- **`showDashboardLink`**: `true` cuando hay sesión; el icono **panel** queda **a la izquierda** del control de sesión.
- **`dashboardHref`**: URL del panel (p. ej. `/dashboard` o app externa).
- **`sessionControl`**: botón login, `<form action={logout}>`, etc.
- **`position`**: `fixed` (por defecto) o `sticky`.

## Tokens

En **`appShellHeader.publicShell`**:

- Colores de barra y dorado.
- **`logoMaxHeight`** / **`logoMaxWidth`**: equivalente al logo “relajado” del dashboard FotoRank (clamp / min).
- **`tailwind.logoWordmarkRelaxed`** / **`headerInnerRelaxed`**: si la app usa Tailwind y escanea el paquete, pueden reutilizar las mismas clases que FotoRank.

## Integración Next.js

```tsx
import Link from "next/link";
import { PublicMarketingHeader } from "@repo/design-system/components/layout";
import { appShellHeader } from "@repo/design-system/tokens";

const logoStyle = {
  display: "block",
  height: appShellHeader.publicShell.logoMaxHeight,
  width: "auto",
  maxWidth: appShellHeader.publicShell.logoMaxWidth,
  objectFit: "contain" as const,
  objectPosition: "left center" as const,
};

<PublicMarketingHeader
  LinkComponent={Link}
  logo={
    <Link href="/" aria-label="Inicio">
      <img src="/marca.svg" alt="Marca" style={logoStyle} />
    </Link>
  }
  showDashboardLink={hasSession}
  dashboardHref="/dashboard"
  sessionControl={/* login o logout */}
  onMenuOpen={() => setMenuOpen(true)}
/>
```

Dejar **`padding-top`** en `body` o en el contenedor principal para compensar el header **`fixed`** (~`6.75rem`–`7.25rem` según altura del logo).

## Reglas de producto

- Con sesión: **siempre** ofrecer acceso al panel antes del logout (orden pedido por UX).
- Sin barra de enlaces horizontales en el centro: navegación en menú fullscreen / drawer si aplica (misma línea que `APP_SHELL_HEADER.md`).

Ver también **`APP_SHELL_HEADER.md`** y **`.cursor/rules/design_rule.mdc`** (header y navegación).
