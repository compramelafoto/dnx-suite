# Info Spot — reparación cadena Prisma (staging Neon)

## Entorno auditado

- Host: `ep-dawn-dew-adyr8f1v*.neon.tech` / DB `neondb`
- Evidencia de **staging** (no producción):
  - Docs ops ya documentan este fallo (`compramelafoto-staging-seed.md`)
  - Conteos: `User=11`, `Album=0`, `Event=0`, `Order=0`
  - Sin tablas/enums de comisión de organizador

## Causa raíz

`20260708150000_organizer_direct_mp_commission_ledger` solo hacía:

```sql
ALTER TYPE "EventOrganizerCommissionStatus" ADD VALUE IF NOT EXISTS '...';
```

En staging el enum **nunca existió** (ni la tabla `EventOrganizerCommission`): faltaba una migración base previa en la cadena del monorepo. Resultado:

- `_prisma_migrations`: fila con `finished_at IS NULL`, `applied_steps_count = 0`
- Ningún objeto de esa migración creado
- Prisma bloquea deploys posteriores (Info Spot incluido)

## Reparación aplicada

1. Reescribir el SQL de `20260708150000` de forma **idempotente** (crear enums/tablas si faltan + `ADD VALUE IF NOT EXISTS`).
   - Seguro porque la migración **no se aplicó correctamente** (`applied_steps_count=0`).
2. `prisma migrate resolve --rolled-back 20260708150000_organizer_direct_mp_commission_ledger`
3. `prisma migrate deploy` (aplica 08150000 reparada, 09120000 user gap, 09210000 Info Spot)

## Riesgo / deuda

- Si **producción** ya aplicó el SQL corto original de `20260708150000`, el checksum de Prisma puede diferir al deployar allí: validar checksum/`migrate deploy` en prod por separado (no asumir staging = prod).
- Sigue existiendo drift más amplio schema↔Neon (otros gaps CLF); esta reparación solo desbloquea comisión + Info Spot.
