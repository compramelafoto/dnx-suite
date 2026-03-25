# App shell header (FotoRank — regla canónica)

## HEADER LAYOUT RULE

Toda barra superior se modela con **tres zonas** (`AppHeaderFlexZones`):

| Zona | Rol |
|------|-----|
| **LEFT** | Logo + controles mínimos (p. ej. toggle del panel lateral en dashboard). |
| **CENTER** | **En FotoRank: siempre vacío** (`center={null}`). No tira de enlaces en la barra. |
| **RIGHT** | Acciones en orden fijo (ver abajo): **panel** (solo con sesión) → **sesión** → **menú fullscreen** (`HeaderMenuToggle`). |

### Navegación global (FotoRank)

- **Landing:** anclas y CTAs viven en **`FullscreenMenu`** (`getLandingMenuLinks` / `landingNavAnchors` en `FullscreenMenu.tsx`), no en el header.
- **Dashboard (app):** enlaces de sección en **`FullscreenMenu`** + **sidebar** (`AppLayout` / `SidebarNavFromConfig`). Misma regla: **sin** `HeaderNav` en la barra superior.

El componente **`HeaderNav`** queda disponible solo para **casos excepcionales** (p. ej. marketing one-off) si se documenta; **no** usarlo en los shells por defecto.

### Obligatorio

- **Padding horizontal mínimo:** **16px** mobile / **24px** desktop (`px-4` / `md:px-6`).
- **Max width** del contenido útil centrado (`max-w-[1280px] mx-auto` en FotoRank); **no** full bleed del contenido salvo casos especiales documentados.
- **Ningún** control sin contenedor de zona definida.
- **No** `overflow-x-auto` + scroll horizontal visible en una “tira” de enlaces en el header (anti-patrón). Si hiciera falta espacio, la navegación no va en barra; va al menú fullscreen.
- **No** centrar con márgenes manuales sueltos: usar **flex** (tres zonas) y `justify-*` / `flex-1` coherentes.

### Franja alineada al sidebar (`alignLeftWithSidebarBand`)

En **dashboard** y **Home (landing)** FotoRank: `AppHeaderFlexZones` con **`alignLeftWithSidebarBand`**. La primera columna tiene ancho fijo **`SIDEBAR_WIDTH_PX` (280px)** y **`justify-center`**: el **logo + X/hamburguesa** quedan **centrados sobre el panel lateral** (misma anchura que el drawer). El resto del header es `flex-1` vacío + zona derecha con acciones. Misma clase de logo: **`dashboardWordmarkLogoClassName`**.

### Responsive

- **Mobile:** con band: columna izquierda con ancho `min(280px, calc(100vw - 7rem))` y contenido centrado; **RIGHT** con `flex-1` y `justify-end`.
- **Sin band:** solo **LEFT** + **RIGHT**; **CENTER** no se usa como tira de enlaces.
- **Desktop (`md+`):** con band: **[280px centrada][flex-1][derecha]**; sin band: tres columnas `flex-1` si aplica layout legacy.

### Anti-patrones (prohibidos)

- **`HeaderNav`** en **CENTER** en landing o dashboard shell (duplica el menú dorado y provoca overflow).
- Centrado con `margin` / `transform` sin estructura de zonas.
- Texto **“Más”** flotando sin menú (dropdown/drawer) acotado.
- Contenido útil pegado a borde de viewport.
- Saltos inconsistentes de distribución entre breakpoints.

### Orden de iconos en zona **RIGHT** (landing y shells públicos)

De **izquierda a derecha** dentro de `HeaderActions` (u homólogo):

| Paso | Visible si | Rol |
|------|------------|-----|
| 1 | **Sesión iniciada** | Enlace al **panel** (`LayoutDashboard` o equivalente), `size-11`, estilo outline dorado (`text-[#D4AF37]`, hover `bg-[#D4AF37]/10`). Destino: p. ej. **`/dashboard`** (organizador) o **`/jurado/panel`** (solo jurado) — ver `LandingHeader` (`panelHref`). |
| 2 | Siempre (según estado) | **Iniciar sesión** o **Cerrar sesión** (mismo hit area ~44px). |
| 3 | Siempre | **Menú fullscreen** circular relleno dorado (`HeaderMenuToggle`). |

Sin sesión: **no** mostrar el icono de panel (evitar `/dashboard` para anónimos). Misma regla en **`PublicMarketingHeader`** (`showDashboardLink`).

### FotoRank (implementación)

- **LEFT:** logo + toggle panel lateral (dashboard, `md+` junto al logo; móvil el control del drawer en **RIGHT**).
- **CENTER:** `null`.
- **RIGHT:** ver tabla de orden arriba; código: `LandingHeader.tsx`, `Header.tsx` (drawer), `AppHeaderFlexZones`, `HeaderContainer`.

---

## Contenedor

- **`max-width: 1280px`**, `margin-inline: auto`.
- **Padding:** `16px` / `24px` desde `md`.
- **Altura de fila:** **landing** `64px` (`h-16`); **dashboard** con logo grande: `relaxedHeight` + `rowClassName` (ver `Header.tsx`).

## Estructura (flexbox)

### Móvil (`< md`)

- Fila única: **`justify-between`**, **`align-items: center`**, **`gap`** 12px.
- **Izquierda:** logo (+ controles si aplica).
- **Derecha:** acciones (drawer / FullscreenMenu / sesión).

### Desktop (`md+`)

- Tres zonas **`flex-1 basis-0`**: inicio / centro (vacío en FotoRank) / fin.
- **Sin** menú **“Más”** automático en el centro.

## Tokens

`appShellHeader` en `src/design-system/tokens/appShellHeader.ts`.

## Código

`apps/fotorank/app/components/app-header/` — `HeaderContainer`, `AppHeaderFlexZones`, `HeaderActions`, `HeaderMenuToggle`, `HeaderNav` (uso excepcional).

Regla de producto duplicada en **`.cursor/rules/design_rule.mdc`** → *Header y navegación*.

---

## Shell público (ComprameLaFoto, landings sin sidebar)

**`PublicMarketingHeader`** + tokens **`appShellHeader.publicShell`** — ver **[`PUBLIC_MARKETING_SHELL.md`](./PUBLIC_MARKETING_SHELL.md)** (logo grande, dashboard con sesión, menú dorado).
