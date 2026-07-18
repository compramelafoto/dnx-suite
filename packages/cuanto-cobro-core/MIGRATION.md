# Migración Etapa 11 — extracción a @repo/cuanto-cobro-core

## Archivos movidos (implementación real)

Desde `apps/compramelafoto/lib/cuantocobro/` → `packages/cuanto-cobro-core/src/`:

- `amount-format.ts`, `availability.ts`, `calculate-cuanto-cobro.ts`
- `camera-equipment.ts`, `camera-wear-policy.ts`
- `client-calculations.ts`, `client-hours.ts`
- `commercial-positioning.ts`, `commercial-presentation.ts`
- `default-expense-groups.ts`, `hourly-rates.ts`
- `normalize-quote-hours.ts`, `personal-expenses.ts`
- `quote-access.ts`, `quote-item-calculations.ts`, `quote-item-hours.ts`
- `quote-items.ts`, `quote-profitability.ts`, `types.ts`
- `equipment/*`, `payment/*`
- Fixtures + tests de caracterización

## Wrappers conservados en CLF

Cada archivo movido quedó como:

```ts
export * from "@repo/cuanto-cobro-core/<path>";
```

Así se preservan imports `@/lib/cuantocobro/...` sin sustituir toda la app.

## Imports preservados

Consumers de CLF que usaban `@/lib/cuantocobro/...` siguen sin cambios masivos.

## Deuda pendiente

- Perfil/plantillas reales del asistente (`.local.json`)
- Ejecución del motor desde el asistente (Etapa futura)
- Política de exposición de montos en HTTP
- Limpieza gradual de wrappers cuando se migren imports a `@repo/cuanto-cobro-core`

## Rollback

1. Recuperar implementaciones desde git (`HEAD` previo a la extracción).
2. Quitar dependencia `workspace:*` de CLF/asistente.
3. Restaurar tests de caracterización en `apps/compramelafoto/lib/cuantocobro/`.

No se mantienen dos implementaciones: el rollback es revertir el movimiento, no “activar copia B”.
