# Plugin Clickatón — `@repo/template-engine/clickaton`

## Objetivo

Variables de dominio Clickatón (participante, edición, marca, sponsors, placa) desacopladas del plugin escolar. Sin Prisma, Mercado Pago, Instagram API ni automatización post-pago.

## Export

```ts
import {
  clickatonTemplateVariablesPlugin,
  createClickatonTemplateExampleData,
  normalizeInstagramHandle,
} from "@repo/template-engine/clickaton";
```

También re-exportado desde `@repo/template-engine`.

## Arquitectura

```text
packages/template-engine/src/plugins/clickaton/
  index.ts
  clickaton-variable-definitions.ts
  clickaton-aliases.ts
  clickaton-example-data.ts
  clickaton-formatters.ts
  normalize-instagram.ts
```

Registry por producto en CLF: `resolveTemplateVariablePlugin(product)`.

**No mezclar** school + clickaton en el mismo registry: aliases cortos (`nombrecompleto`, `fecha`) chocan.

## Instagram

`normalizeInstagramHandle()` — puro, sin HTTP. Acepta handle, `@handle`, URLs `instagram.com/…`. Devuelve `{ handle, displayHandle }` o error estructurado.

## Fechas

Timezone default `America/Argentina/Cordoba`. Formatters: `date.short`, `date.long`, `date.longUppercase`, `date.dayMonthUppercase`.

## Número

`participantNumber` → pad 4 (`1` → `0001`). Path de presentación: `participant.numberFormatted`.

## Datos de ejemplo

`createClickatonTemplateExampleData()` — ficticios; foto fixture data-URL.

## Preview

`metadata.product === "clickaton"` → registry + example data Clickatón.

## Limitaciones

- Sin verificación de existencia de Instagram.
- Sin tipografías Barlow Condensed embebidas en Chromium (fallback Arial Narrow).
- Sin generación automática por pago ni publicación en redes.
