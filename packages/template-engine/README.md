# `@repo/template-engine`

Núcleo compartido de plantillas para DNX Suite (schema canónico, bindings seguros, registro de variables, resolución pura y bridge Template V2).

## Límites del core

**Incluye**

- Schema versionado `TemplateDocument`
- Parser/normalizador de bindings (`{alumno}`, `{student.fullName}`)
- Registro extensible de variables + plugins
- Plugin escolar (definiciones/aliases/ejemplos)
- `resolveTemplateDocument`
- Bridge `fromLegacyTemplateV2` / `toLegacyTemplateV2`
- Contratos de infraestructura (repository, assets, renderer)

**No incluye**

- Next.js, React, Prisma, R2, Sharp
- Editor visual DOM
- APIs HTTP
- Plantillas Clickatón (pendiente)
- Lógica de pedidos escolares / PreCompraOrder

## Ejemplo mínimo

```ts
import {
  createTemplateVariableRegistry,
  schoolTemplateVariablesPlugin,
  resolveTemplateDocument,
  fromLegacyTemplateV2,
} from "@repo/template-engine";

const registry = createTemplateVariableRegistry([
  schoolTemplateVariablesPlugin,
]);

const { document } = fromLegacyTemplateV2(legacyPayload, { name: "Demo" });

const result = resolveTemplateDocument({
  template: document,
  data: {
    student: {
      fullName: "Nombre de ejemplo",
    },
    school: { name: "Escuela Ejemplo" },
    course: { displayName: "3.º B" },
  },
  registry,
});

console.log(result.document, result.warnings, result.errors);
```

## Scripts

```bash
pnpm --filter @repo/template-engine check-types
pnpm --filter @repo/template-engine test
pnpm --filter @repo/template-engine lint
```

## Documentación

Ver `docs/template-engine/template-engine-core.md`.
