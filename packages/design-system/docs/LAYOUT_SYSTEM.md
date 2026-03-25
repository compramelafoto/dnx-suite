# Sistema de layout y formularios (@repo/design-system)

Base reutilizable para **Fotorank** y el resto de apps: espaciado con tokens, tipografía semántica y componentes de layout.

## 1. Spacing

- Objeto **`spacing`** en `src/design-system/tokens/spacing.ts` (exportado desde el paquete raíz y `@repo/design-system/tokens`).
- Usar solo claves `1, 2, 3, 4, 6, 8, 10, 12, 16, 20` para margin, padding y `gap`.

## 2. Tipografía

- Tokens en `typography` (`h1`, `h2`, `h3`, `body`, `muted`, `helper`, etc.).
- Componente **`Text`** con `variant`: `h1` | `h2` | `h3` | `body` | `muted` | `helper`.
- Evitar `fontSize` suelto en pantallas nuevas.

## 3. Componentes

| Componente      | Uso breve |
|----------------|-----------|
| `WizardLayout` | Flujos por pasos: header, barra de pasos, contenido centrado, footer con botones. |
| `FormSection`  | Bloque con título + descripción opcional + campos agrupados. |
| `FormField`    | Label + control + helper o error. |

## 4. Imports

```tsx
import {
  Text,
  WizardLayout,
  FormSection,
  FormField,
  spacing,
  typography,
} from "@repo/design-system";
```

Rutas opcionales del paquete:

- `@repo/design-system/components/layout`
- `@repo/design-system/components/typography`

## 5. Wizard dentro de un modal

El panel del `Modal` debe ser **columna flex** con altura limitada; `WizardLayout` como hijo con `flex: 1` y `min-height: 0` en el contenedor para que el scroll sea en la zona central. Ver comentarios en `WizardLayout.tsx`.

## 6. Formularios

Orden recomendado: `FormSection` → varios `FormField` → cada `FormField` envuelve un input con `id` / `htmlFor` alineados.


## 7. Wizards (Fotorank)

- **`wizardSpacing`** (`src/design-system/tokens/wizardSpacing.ts`): reglas semánticas (header→stepper, stepper→título, entre secciones, entre campos).
- **`WizardLayout`**: API integrada (`brand`, `organizationName`, `steps`, `currentStep`, **`title`** / **`description`** del paso actual, alias `stepTitle` / `stepDescription`, `onClose`, `footerLeft`, `footerRight`, `children`).
- Piezas sueltas: `WizardHeader`, `WizardStepper`, `WizardContent`, `WizardFooter`.
- **`WizardSection`**: bloques dentro de un paso (varias por paso).
- **`WizardField`**: un campo por control.
- **`WizardFrame`**: contenedor por slots (sin API integrada).

Demo en Fotorank: `app/wizard-demo/page.tsx`

## 8. App shell header (barra superior — FotoRank)

Documentación detallada: **[`APP_SHELL_HEADER.md`](./APP_SHELL_HEADER.md)** (incluye **HEADER LAYOUT RULE**: zonas LEFT / **CENTER vacío en FotoRank** / RIGHT, obligatorios, responsive y anti-patrones).

- **Tokens:** `appShellHeader` (`@repo/design-system`).
- **Layout:** **flexbox** — móvil dos zonas; `md+` tres columnas con **CENTER = `null`**: navegación en **FullscreenMenu** (+ sidebar en dashboard), **no** `HeaderNav` en la barra.
- **Código:** `apps/fotorank/app/components/app-header/*` + `Header.tsx` / `LandingHeader.tsx`.
- **Drawer móvil:** `sidebarViewportTop` alineado a la altura real del header (p. ej. `6.5rem` si el logo es alto).

Reglas de producto: **`.cursor/rules/design_rule.mdc`** → sección **HEADER LAYOUT RULE** bajo *Header y navegación*.

## 9. Shell público / marketing (ComprameLaFoto)

- **Componente:** `PublicMarketingHeader` (`@repo/design-system/components/layout`).
- **Tokens:** `appShellHeader.publicShell` (colores, escala de logo alineada al dashboard FotoRank, clases Tailwind opcionales).
- **Documentación:** **[`PUBLIC_MARKETING_SHELL.md`](./PUBLIC_MARKETING_SHELL.md)**.

