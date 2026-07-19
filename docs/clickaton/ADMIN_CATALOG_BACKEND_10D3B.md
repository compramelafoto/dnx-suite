# Clickatón 10D3B — Backend administrativo del catálogo

**Date:** 2026-07-19  
**Status:** **BACKEND APROBABLE — LISTO PARA 10D3C**  
**Scope:** use-cases, repos, Prisma adapter, validation, auth, logs, selfchecks — sin UI productiva  
**Depends on:** 10D3A · schema 10D2 (sin cambios)

## 1. Arquitectura

```
lib/admin-catalog/
  design/           # 10D3A (contratos)
  domain/           # tipos, errores, money, availability, repository port
  auth/             # AdminCatalogAuthorization
  validation/       # parsers (sin Zod; mismo estilo editions)
  application/      # CatalogService + logger
  infrastructure/   # in-memory + Prisma adapters
  testing/          # domain + prisma selfchecks
```

UI futura → thin actions → `createCatalogService` → repository port → Prisma.

## 2. Casos de uso

Implementados en `application/catalog-service.ts`: list/get/create/update/duplicate/setActive ticket; replaceItems; getAvailability; list/get/create/update/setActive product; create/update/setActive variant; adjustVariantStock; getVariantStockView.

## 3. Autorización

`createAdminCatalogAuthorization()` reutiliza `hasClickatonAdminAccess` (SUPER_ADMIN | allowlist). Capabilities de diseño 10D3A. Sin venue scope aún.

## 4. Stock (política MVP)

- Fuente principal de disponible: `stock - reservedStock` (persistido).
- `activeHoldQuantity` de `ClickatonStockHold` ACTIVE no vencidos = **diagnóstico** (no se resta otra vez → evita doble conteo).
- `adjustVariantStock`: update condicional `reservedStock <= newStock`.
- Endurecimiento futuro: reconciliar `reservedStock` con holds en flujo de inscripción.

## 5. Disponibilidad cupo

`disponible = capacidad - confirmados - holds ACTIVE con expiresAt > now`.  
`capacity null` → ilimitado. Sin `soldCount`.

## 6. Reglas con inscripciones

- CONFIRMED: block price/currency/venue/code/composition.
- DRAFT/PENDING: block code/venue/currency; composition replace permitido (logueado).
- Duplicar: copia catálogo; `isActive=false`; no copia regs/holds.

## 7. Logs

`[clickaton.catalog]` JSON estructurado. No usa `ClickatonRegistrationAudit`. Persistencia genérica = migración futura.

## 8. Prisma / Neon

- Schema y migraciones **sin cambios**.
- Selfcheck Prisma solo `127.0.0.1` (abort Neon).
- Cero escrituras Neon en esta etapa.

## 9. Actions UI

Diferidas a 10D3C (evitar actions huérfanas). El servicio ya es invocable desde actions futuras.

## 10. Próximo paso

**10D3C — Interfaz administrativa de productos y variantes**
