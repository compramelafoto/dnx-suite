# Clickatón 10D2B — Deploy controlado de migración de inscripciones

**Date:** 2026-07-19  
**Status:** **GO — MIGRACIÓN 10D2 APLICADA Y VERIFICADA**  
**Operator:** danielcuart  
**Authorization received (UTC):** 2026-07-19T05:58:05Z  

## Autorización

Frase exacta recibida (mensaje independiente) autorizando:

- Neon `ep-dawn-dew` / branch `br-old-rain-adwthzng` (development);
- backup nuevo + conservar `backup-10c4-20260718-134541` (`br-spring-lake-adpsmkjo`);
- apartar solo WIP `20260718180000_cuanto_cobro_financial_profile`;
- aplicar únicamente `20260718220000_clickaton_registrations_credentials_checkin_kits` con checksum `fba321009998740b0ba8b32320cafe5a959b61efa505481d436afa7c62a90e92`;
- sin datos de prueba, sin `migrate resolve`, sin push, sin 10D3.

## Base objetivo

| Campo | Valor |
|-------|--------|
| Proyecto Neon | `divine-hall-10689679` |
| Branch | `br-old-rain-adwthzng` (`development`) |
| Endpoint | `ep-dawn-dew-adyr8f1v.c-2.us-east-1.aws.neon.tech` |
| Database | `neondb` |
| Prisma URL usada | `DIRECT_URL` (no pooler) |

## Backups

| Backup | Branch ID | Parent | Estado | Fecha |
|--------|-----------|--------|--------|-------|
| `backup-clickaton-10d2b-20260719-055820` (**nuevo**) | `br-weathered-glitter-adwianek` | `br-old-rain-adwthzng` | ready | 2026-07-19T05:58:20Z |
| `backup-10c4-20260718-134541` (conservado) | `br-spring-lake-adpsmkjo` | `br-old-rain-adwthzng` | ready | 2026-07-18T13:45:48Z |

### Rollback conceptual

Restaurar/promover el branch `br-weathered-glitter-adwianek` (o el anterior `br-spring-lake-adpsmkjo` si se prefiere el punto 10C4). No ejecutar `DROP` manual ni migración inversa en esta etapa.

## Preflight

- Orphan `20260711160000_infospot_role_audit`: finished, checksum `59bc655d…` match.
- Gaps + editions/venues + FotoOffice: applied; 0 failed abiertas.
- Objetos 10D2 ausentes antes del deploy.
- SQL 10D2 sin `DROP TABLE`/`DROP COLUMN`.
- Con WIP presente: 2 pendientes → **no deploy**.

## WIP Cuánto Cobro

| Paso | Detalle |
|------|---------|
| Origen | `packages/db/prisma/migrations/20260718180000_cuanto_cobro_financial_profile` (untracked) |
| Temporal | `.local/audit-10d2b/wip-aside/20260718180000_cuanto_cobro_financial_profile` |
| SHA-256 | `8e83467995844db064758de69dad1128e3ef0f1cd340425576cc42adc649680a` (idéntico antes/después) |
| Restaurado | Sí, untracked, sin stage, **sin** `migrate deploy` posterior |

## Deploy

| Campo | Valor |
|-------|--------|
| Pending pre-deploy (WIP aside) | Solo `20260718220000_clickaton_registrations_credentials_checkin_kits` |
| Comando | `pnpm --filter @repo/db exec prisma migrate deploy` |
| Aplicadas | **1** |
| Finished at | 2026-07-19T05:58:59.422Z |
| Checksum DB | `fba321009998740b0ba8b32320cafe5a959b61efa505481d436afa7c62a90e92` |
| `applied_steps_count` | 1 |
| `rolled_back_at` | null |
| Segundo deploy | `No pending migrations to apply` |
| `migrate status` | `Database schema is up to date!` (con WIP aún apartado) |

## Objetos verificados

Tablas 10D2, enums (registration/payment/hold/credential/qr/kit/check-in source), uniques de `visibleCode`/`sequenceNumber`/`tokenHash`, índices parciales activos (check-in, QR, kit), montos `integer`, sin columnas clínicas, sin token QR plano.

Filas de datos: `ClickatonRegistration`/`TicketType`/`Product`/`CheckIn` = **0** (sin fixtures).

## Prohibiciones respetadas

- Sin `migrate resolve`, `db push`, SQL manual DDL, UPDATE de checksums.
- Sin inserts de prueba.
- Sin push.
- Sin 10D3.
- Migración SQL no modificada.

## Próximo paso

**CLICKATÓN — ETAPA 10D3 — CATÁLOGO ADMINISTRATIVO DE ENTRADAS, PRODUCTOS Y KITS**  
(no iniciado aquí).
