# Template Engine Core — P0-02

**Package:** `@repo/template-engine`  
**Ubicación:** `packages/template-engine`  
**Fecha:** 2026-08-01  
**Base:** auditoría `docs/template-engine/template-engine-audit.md`

---

## Propósito

Centralizar contratos, schema, bindings y resolución de variables de plantillas para toda DNX Suite, extrayendo la lógica reutilizable de Template V2 (ComprameLaFoto) **sin** migrar aún el editor visual ni el pipeline de exportación escolar.

---

## Límites del core

| En el core | Fuera del core (apps / etapas futuras) |
|---|---|
| Schema Zod versionado | Persistencia Prisma |
| Bindings seguros | R2 / uploads |
| Variable registry + plugins | Sharp / PNG / JPEG export |
| Resolve document puro | Editor React / DOM UI |
| Bridge legacy V2 | APIs `/api/template-v2/*` |
| Contratos (ports) | Implementaciones de ports |
| Plugin escolar (catálogo) | Queries PreCompraOrder / School |

Dependencias prohibidas en el package: Next.js, Prisma, React, Sharp, R2, apps/\*.

---

## Estructura

```text
packages/template-engine/src/
├── index.ts
├── core/           # constants + resolveTemplateDocument
├── schema/         # Zod TemplateDocument + blocks
├── bindings/       # parse / normalize / serialize
├── variables/      # registry, path seguro, formatters
├── plugins/school/ # definiciones + aliases escolares
├── bridge/         # from/to Legacy Template V2
├── contracts/      # TemplateRepository, AssetResolver, Renderer
├── rendering/      # re-export contratos
├── assets/         # re-export contratos
└── testing/fixtures/
```

Exports:

- `@repo/template-engine` — API pública
- `@repo/template-engine/school` — plugin escolar
- `@repo/template-engine/bridge` — bridge legacy

---

## Schema canónico

`schemaVersion: 1`

```ts
type TemplateDocument = {
  schemaVersion: 1;
  id?: string;
  name: string;
  width: number;
  height: number;
  unit: "px";
  background?: { color?: string; src?: string; fit?: "cover" | "contain" };
  print?: { dpi?: number; bleedMm?: number; safeAreaMm?: number };
  blocks: TemplateBlock[];
  bindings: TemplateVariableBinding[];
  metadata?: Record<string, unknown>;
};
```

Bloques soportados (alineados a Template V2 actual):

`BACKGROUND | PHOTO | TEXT | VARIABLE_TEXT | IMAGE | SHAPE`

**No modelado como soportado hoy:** `container` (no existe en el editor V2).

Validación runtime: **Zod** (`zod` ^4), misma familia que ComprameLaFoto.

---

## Registro de variables

```ts
const registry = createTemplateVariableRegistry([
  schoolTemplateVariablesPlugin,
]);
```

API:

- `registerVariableDefinitions`
- `getVariableDefinition`
- `listVariableDefinitions`
- `resolveTemplateVariable`
- `resolvePathFromAlias`
- `getAliases`

El core **no** hardcodea variables escolares; solo el plugin.

---

## Plugins

### Escolar (`plugins/school`)

Paths: `student.*`, `buyer.*`, `school.*`, `course.*`, `order.*`, `photographer.*`, `event.*`, `branding.*`

Aliases: `{alumno}`, `{escuela}`, `{curso}`, `{pedido}`, `{qr}`, etc.

Solo definiciones, aliases, formatters, ejemplos. Sin Prisma.

### Clickatón (`plugins/clickaton` · P0-06)

Export: `@repo/template-engine/clickaton`.

Paths: `participant.*`, `edition.*`, `event.*`, `branding.*`, `organization.*`, `sponsors.*`, `card.*`.

Helpers: `normalizeInstagramHandle`, formatters de fecha AR, `participantNumber`, `createClickatonTemplateExampleData`.

Presets oficiales en CLF: `CLICKATON_WELCOME_STORY_V1`, `CLICKATON_MEMBER_STORY_V1` (1080×1920).

Ver `docs/template-engine/clickaton-template-plugin.md`.

---

## Bridge legacy

```ts
fromLegacyTemplateV2(payload) → { document, warnings }
toLegacyTemplateV2(document) → { payload, warnings }
```

Round-trip razonable: bloques, layout, configJson, bindings, print meta, metadata.

Fixture: `src/testing/fixtures/school-folder-minimal.ts`.

La persistencia Prisma **no** se modifica.

---

## Contratos de infraestructura

```ts
interface TemplateRepository { getTemplate; saveTemplate; }
interface TemplateAssetResolver { resolveAsset; }
interface TemplateRenderer { render; }
```

Sin implementaciones en el package.

---

## Ejemplo escolar

```ts
import {
  createTemplateVariableRegistry,
  schoolTemplateVariablesPlugin,
  resolveTemplateDocument,
  fromLegacyTemplateV2,
  SCHOOL_TEMPLATE_EXAMPLE_DATA,
} from "@repo/template-engine";

const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
const { document } = fromLegacyTemplateV2(legacyFixture);
const result = resolveTemplateDocument({
  template: document,
  data: SCHOOL_TEMPLATE_EXAMPLE_DATA,
  registry,
});
```

Integración mínima en CLF (sin cambiar flujo productivo):

`apps/compramelafoto/lib/template-v2/template-engine-compat.ts`

---

## Estrategia para nuevos dominios

1. Crear plugin `TemplateVariablePlugin` (definitions + aliases).
2. Registrar con `createTemplateVariableRegistry([plugin])`.
3. Entregar `data` ya materializado (el engine no consulta DB).
4. Opcional: bridge desde el formato nativo del producto → `TemplateDocument`.

---

## APIs CLF (P0-03)

Las APIs fotógrafo viven en `apps/compramelafoto/app/api/template-v2/**` y usan este package vía:

- `lib/template-v2/services/*`
- bridge + `parseTemplateDocument` + registry escolar

Ver:

- `docs/template-engine/template-v2-api-map.md`
- `docs/template-engine/template-v2-api-contract.md`

## Pendiente post P0-06 (Clickatón)

- Generación bajo demanda desde Mi inscripción / admin (sin automatización por pago).
- Tipografías Barlow Condensed embebidas en el renderer.
- Publicación en redes / Meta (fuera de alcance).


---

## Riesgos encontrados en la extracción

1. **Triple motor visual** (DOM V2 / Konva / Sharp) sigue fuera del package — el core no unifica render.
2. **APIs `/api/template-v2/*` ausentes** — el package no las restaura.
3. **Dual placeholder** `{x}` vs `{{x\|"y"}}` — el parser admite ambos; el editor V2 usa simple.
4. **Zod defaults** pueden rellenar campos omitidos — tests cubren paths críticos.
5. **Required flags del catálogo escolar** generan `required_missing` si `data` vacío — intencional para validación; el editor seguirá usando mocks locales hasta migración.
6. Re-exports / compat CLF deben permanecer thin para no alterar comportamiento visual.

---

## Relación con la auditoría

Cumple la propuesta §11 de `template-engine-audit.md` en su fase de extracción de contratos (P0-02 / plan fase P2 parcial), sin cutover del editor ni del pipeline de pedido.
