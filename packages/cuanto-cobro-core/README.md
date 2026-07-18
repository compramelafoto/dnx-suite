# @repo/cuanto-cobro-core

Núcleo puro de cálculo de **¿Cuánto Cobro?** — fuente única de verdad dentro del monorepo DNX Suite.

## Propósito

Ejecutar `calculateCuantoCobro(profile, quote)` sin acoplarse a ComprameLaFoto, React, Next.js ni Prisma.

## Origen

Extraído en Etapa 11 desde `apps/compramelafoto/lib/cuantocobro/` (dominio puro). ComprameLaFoto conserva wrappers delgados que reexportan este package.

## Fuente única de verdad

- Las fórmulas viven **solo** aquí.
- No duplicar el motor en apps.
- Wrappers/reexports están permitidos; reimplementaciones no.

## API pública (`src/index.ts`)

Mínimo:

- `calculateCuantoCobro`
- `CuantoCobroProfileInput`
- `CuantoCobroQuoteInput`
- `CuantoCobroCalculationResult`
- `CuantoCobroCalculationComplete`

También se exportan helpers estables usados por CLF (posicionamiento comercial, availability, hourly rates, fixtures de caracterización vía subpath).

Los exports por subpath (`@repo/cuanto-cobro-core/hourly-rates`, etc.) existen para compatibilidad con imports históricos de CLF.

## Pureza

Sin:

- React / Next.js / Prisma / `@repo/db` / next-auth
- localStorage / sessionStorage
- rutas bajo `apps/`
- PDF, email, UI, auth, pagos

Dependencias runtime: **ninguna** (TypeScript + APIs estándar de JavaScript).

## Consumidores actuales

| Consumidor | Uso |
|------------|-----|
| `apps/compramelafoto` | Productivo vía wrappers en `lib/cuantocobro/` |
| `apps/dnx-sales-assistant` | Dependencia técnica + puente tipado; **no** ejecuta el motor en HTTP |

## Tests de caracterización

```bash
pnpm --filter @repo/cuanto-cobro-core test
# o
pnpm cuantocobro:test:characterization
```

Incluyen goldens numéricos congelados. Cualquier cambio de fórmula requiere decisión explícita — **no** actualizar goldens para “hacer pasar” tests.

## Política de cambios de fórmulas

1. Documentar el motivo.
2. Actualizar caracterización conscientemente.
3. Coordinar impacto en CLF y futuros consumidores.

## Versionado futuro

Hoy el package es `private` dentro del monorepo. No hay API pública estable fuera del repo.

## Prohibición

No copiar este dominio a otra app ni mantener dos implementaciones independientes.
