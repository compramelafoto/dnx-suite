# Sistema de sidebar (@repo/design-system)

## Configuración dinámica

Definí secciones en tu app (por producto / tenant) y opcionalmente filtrá por rol:

```ts
import type { SidebarSectionConfig } from "@repo/design-system";
import { filterSidebarByRoles } from "@repo/design-system";

const sections: SidebarSectionConfig[] = [
  {
    title: "Concursos",
    items: [
      { label: "Listado", href: "/concursos", icon: "dashboard" },
      { label: "Nuevo", href: "/concursos/nuevo", icon: "plus", roles: ["admin", "editor"] },
    ],
  },
];

const visible = filterSidebarByRoles(sections, user.roles);
```

Los tipos se llaman `SidebarItemConfig` / `SidebarSectionConfig` (el componente visual se llama `SidebarItem`).

## Next.js (App Router)

Pasá `Link` como componente de enlace y la ruta actual con `usePathname()`:

```tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppLayout,
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarNavFromConfig,
  SidebarFooter,
  type SidebarLinkComponent,
} from "@repo/design-system";

const SidebarLink: SidebarLinkComponent = ({ href, className, style, children, onClick, ...rest }) => (
  <Link href={href} className={className} style={style} onClick={onClick} {...rest}>
    {children}
  </Link>
);

const pathname = usePathname();

<SidebarNavFromConfig sections={visible} activePath={pathname} LinkComponent={SidebarLink} />;
```

## Layout responsive

`AppLayout` recibe `mobileSidebarOpen` y `onMobileSidebarClose` para el drawer; el botón hamburguesa vive en tu `header`.

Si el header es **`sticky`/`fixed` en viewport**, el drawer móvil (`position: fixed; top: 0`) puede quedar **bajo la barra**. Pasá **`sidebarViewportTop`** (string CSS, p. ej. `"7rem"`) para desplazar el panel hacia abajo y alinearlo con el borde inferior del header.
