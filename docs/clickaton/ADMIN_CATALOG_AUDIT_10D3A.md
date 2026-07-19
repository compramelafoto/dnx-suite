# Clickatón 10D3A — Auditoría del catálogo administrativo

**Date:** 2026-07-19  
**Status:** **PLAN APROBABLE — LISTO PARA 10D3B**  
**Scope:** auditoría / diseño / contratos — sin UI productiva, sin endpoints, sin Prisma changes, sin Neon writes  
**Depends on:** 10D2B GO (`55abb21`) · modelo `REGISTRATION_DATA_MODEL_10D2.md`

Contratos: `apps/clickaton/lib/admin-catalog/design/`  
Selfcheck: `pnpm --filter clickaton selfcheck:admin-catalog-design`

---

## 1. Resumen ejecutivo

El panel admin ya tiene CRUD sólido de **ediciones** y **sedes** (server actions + validation + Prisma). El **catálogo comercial** (entradas / productos / variantes / composición) existe en schema Prisma (10D2) y en dominio de registration, pero **no tiene UI ni casos de uso admin**.

El MVP de catálogo **no requiere nueva migración**: `ClickatonTicketType` + `Product` + `ProductVariant` + `TicketTypeItem` cubren entrada sola, entrada+remera y kits como composición. No se introduce `ClickatonKit`.

Arquitectura recomendada: hub `/admin/catalogo/*` filtrado por edición (patrón Sedes), capas use-case → repository → Prisma, reutilizando shell/auth/forms del admin actual.

---

## 2. Estado actual

| Ítem | Estado |
|------|--------|
| HEAD auditado | `55abb21` (10D2B docs) |
| Migración 10D2 | Aplicada en Neon (GO 10D2B) |
| WIP Cuánto Cobro | Untracked; no tocado |
| UI catálogo | **Ausente** |
| Neon writes esta etapa | **0** |

---

## 3. Inventario del admin

| Área | Ruta | Archivos | Patrón | Reutilizable | Riesgos |
|------|------|----------|--------|--------------|---------|
| Auth | `/admin/*`, `/login` | `lib/admin/auth.ts`, `access.ts`, `middleware.ts` | Guard layout + allowlist/SUPER_ADMIN | Sí (mismo gate) | Sin roles granulares; middleware no autentica |
| Ediciones | `/admin/ediciones…` | `lib/admin/editions/*`, `EditionForm`, actions | RSC + `useActionState` + mutations | **Plantilla CRUD** | Hard delete DRAFT |
| Sedes | `/admin/sedes…` | `lib/admin/venues/*`, `VenueForm` | Idem + soft `isActive` + filtros GET | **Deactivate + filtros** | Delete rules flojas |
| Inscripciones | `/admin/inscripciones` | placeholder | Empty state | Copy UX | Menciona entradas sin CRUD |
| Sponsors | `/admin/sponsors` | placeholder | Empty | Bajo | — |
| Config / Integraciones | `/admin/configuracion`, `/integraciones` | read-only | Cards | Bajo | Allowlist visible |
| Catálogo | — | `lib/registration/domain/*` | Solo dominio | Contratos disponibilidad | No hay nav item |
| Shell | `(panel)/layout` | `AdminShell`, nav, flash, table | DS local `ck-*` | Alto | No `@repo/design-system` |

---

## 4. Modelos

### Tabla campo a campo (resumen)

| Modelo | Campo | Editable | Visible | Validación | Regla de negocio |
|--------|-------|---------:|--------:|------------|------------------|
| TicketType | name | sí | sí | required | Display; warn si hay regs |
| TicketType | description | sí | sí | max len | Siempre editable |
| TicketType | code | sí* | sí | unique(edition) | *bloquear si hay regs |
| TicketType | priceAmount | sí* | sí | int ≥0 | *bloquear si CONFIRMED; snapshot en reg |
| TicketType | currency | sí* | sí | ARS MVP | *bloquear con regs |
| TicketType | capacity | sí | sí | int≥1 o null | Warn si reduce bajo confirmados |
| TicketType | holdMinutes | sí | sí | 5–120 | Warn con regs pending |
| TicketType | salesStartAt/EndAt | sí | sí | end≥start | Warn con ventas |
| TicketType | venueId | sí* | sí | sede∈edición | null=toda edición; *bloquear con regs |
| TicketType | isActive | sí | sí | bool | Soft close; no borrar |
| TicketType | id/createdAt/updatedAt | no | parcial | — | Sistema |
| Product | name/code/description/isActive | sí | sí | unique code | Soft deactivate |
| Product | editionId | create-only | sí | required | No mover entre ediciones |
| Variant | name/code/sku/stock/price?/currency?/isActive | sí | sí | sku unique; stock≥0 | Soft deactivate; no hard delete si usado |
| Variant | reservedStock | no UI directa | sí (read) | int≥0 | Persistido 10D2; UI muestra derivado disponible |
| TicketTypeItem | productId/variantId?/qty/requiresVariantChoice | sí (replace set) | sí | coherencia edición | Bloquear replace si hay CONFIRMED |
| Edition/Venue | — | vía módulos existentes | — | — | Catálogo solo referencia |

**Calculados (no persistir como soldCount):** confirmados, holds activos, disponible cupo, stock disponible.

**No exponer:** passwords, payment secrets, token QR plaintext, PII de participantes en pantallas de catálogo.

---

## 5. Definiciones comerciales

| Concepto | Definición | Modelo |
|----------|------------|--------|
| **Entrada** | Oferta comercial que habilita inscripción | `ClickatonTicketType` |
| **Producto** | Ítem físico/digital vendible o incluible | `ClickatonProduct` |
| **Variante** | SKU concreto (talle/color/tamaño/…) | `ClickatonProductVariant` |
| **Kit** | Composición de productos dentro de una entrada | `TicketType` + `TicketTypeItem` (sin entidad Kit) |

---

## 6. Arquitectura recomendada

```
UI (RSC + client forms)
  → app/admin/(panel)/catalogo/**/actions.ts  (thin: auth redirect flash)
  → lib/admin/catalog/use-cases/*            (orquestación)
  → lib/admin/catalog/validation/*           (schemas)
  → lib/admin/catalog/repositories/*         (puertos)
  → adapters/prisma/*                        (Prisma)
  → audit logger (estructurado; ver §15)
```

**No** acoplar reglas de negocio solo en server actions.  
**No** llamar Prisma desde componentes client.

---

## 7. Rutas recomendadas

**Elegido:** hub top-level filtrado por edición (como Sedes).

```text
/admin/catalogo                          → picker / redirect última edición
/admin/catalogo/entradas?editionId=
/admin/catalogo/entradas/nueva
/admin/catalogo/entradas/[ticketTypeId]
/admin/catalogo/entradas/[ticketTypeId]/editar
/admin/catalogo/productos?editionId=
/admin/catalogo/productos/nuevo
/admin/catalogo/productos/[productId]
```

Atajo desde edición: `?editionId=` (ver `design/routes.ts`).  
Rechazado como único modelo: catálogo solo bajo `/ediciones/[id]/catalogo` (rompe patrón Sedes y filtros globales).

Nav: agregar ítem **Catálogo** en `config/admin/navigation.ts` (10D3C/D).

---

## 8–11. Flujos

### Entradas (lista / crear / editar)

Columnas: nombre, código, sede, precio (`$ X ARS`), cupo, confirmados, holds, disponible, ventas, activo.  
Acciones: crear, editar, duplicar, activar/desactivar, ver composición, disponibilidad.  
Crear: agrupación Identidad → Precio/cupo → Ventas → Composición → Estado.

### Productos / variantes

Lista con stock total/reservado/disponible agregados.  
Variantes genéricas (no solo remera): nombre libre + código + SKU.

### Composición (kit)

MVP: productos incluidos, qty, variante fija **o** `requiresVariantChoice`, sin costo extra.  
Diferido: add-ons pagos, multi-sede M:N, entidad Kit standalone.

---

## 12. Cupo

```text
disponible = capacidad - confirmados - holds ACTIVE no vencidos
capacidad null → ilimitado
```

UI refresh on load + tras mutaciones; sin caché agresiva en MVP. Concurrencia real = motor holds (etapa posterior). Admin: advertir si `capacidad < confirmados`.

---

## 13. Stock

En variante: `stock`, `reservedStock` (persistidos 10D2).  
UI: `disponible = max(0, stock - reservedStock)`.  
Futuro: evaluar derivar `reservedStock` solo de holds (no cambiar schema ahora).  
Advertir si `stock < reservedStock` al reducir.

---

## 14. Precios

- Storage: `Int` minor units; **nunca float**.
- Display AR: **`$ 40.000 ARS`** (símbolo + monto local + código) — evita ambigüedad del `$` solo.
- Precio 0 = cortesía / free (`paymentStatus NOT_REQUIRED` en inscripción).
- Variant `priceAmount` null = incluido en precio del ticket (MVP).
- Add-on de pago = fase futura.

---

## 15. Sedes

| `venueId` | Significado |
|-----------|-------------|
| `null` | Válida para toda la edición |
| seteado | Exclusiva de esa sede |

Limitación MVP: **una sede o todas** — sin M:N. Cubre edición mono/multi-sede con entradas por sede. Multi-sede por un mismo ticket type → duplicar o evolución futura.

---

## 16. Reglas con inscripciones existentes

| Situación | Política |
|-----------|----------|
| Sin regs | Edición amplia |
| Solo DRAFT/PENDING | Warn en precio/cupo/fechas; block code/venue/currency |
| Hay CONFIRMED | Block precio, moneda, composición; warn name/fechas/cupo/activo; **duplicar** para nueva oferta |
| Product/variant usados | `isActive=false` solamente; snapshots intactos |

Inscripciones conservan snapshot: el catálogo puede evolucionar para **nuevas** ventas.

---

## 17. Permisos

MVP: `hasClickatonAdminAccess` = `ADMIN_GENERAL` (todas las capabilities de catálogo).  
Futuro `VENUE_ADMIN`: read + availability (+ stock local); **no** precios ni otras sedes.  
No ampliar allowlist en silencio.

---

## 18. Casos de uso

| Use case | Permiso | Tx | Errores clave |
|----------|---------|----|---------------|
| list/get TicketType | read | — | not_found |
| create/update TicketType | ticket.mutate | sí | validation, unique code, venue mismatch |
| duplicateTicketType | ticket.mutate | sí | source missing |
| setTicketTypeActive | activate | — | warn if sales |
| list/get/create/update Product | product.mutate | — | unique code |
| create/update Variant | variant.mutate | — | sku unique, stock |
| setProduct/VariantActive | activate | — | used → soft only |
| replaceTicketTypeItems | composition | sí | block if confirmed; variant mismatch |
| getCatalogAvailability | availability | — | — |

Auditoría: ver §20.

---

## 19. Validaciones

Ver `design/validation-rules.ts`: enteros, fechas, unicidad, sede∈edición, SKU, coherencia `requiresVariantChoice`.

---

## 20. Auditoría administrativa

`ClickatonRegistrationAudit` es **específico de inscripción** (`registrationId` obligatorio) → **no reutilizar** para catálogo sin migración.

**10D3B:** log estructurado (acción, actorUserId, entityType, entityId, requestId, metadata) en logger app; flash UI.  
**Futuro:** propuesta `ClickatonAdminAudit` genérico (etapa schema aparte).

Eventos: ticket/product/variant created|updated|duplicated|activated|deactivated; stock changed; composition replaced.

---

## 21. UX y accesibilidad

Estados: loading (`Button pending`), empty (`AdminEmptyState`), errors en `Field`, sin edición, edición cerrada, sin variantes, cupo/stock agotado, rango ventas inválido.  
Confirmaciones antes de desactivar con ventas, bajar stock/cupo peligrosamente.  
A11y: labels `Field`, errores asociados, teclado en forms, contraste `ck-*`, tablas con scroll horizontal en móvil, no solo color para estado. Notebook/tablet first.

---

## 22. Reutilización

| Componente/patrón | Origen | Directo | Adaptar | No |
|-------------------|--------|--------:|--------:|---:|
| AdminShell / nav / flash / table / form / Field | Clickatón admin | ✓ | | |
| CRUD editions/venues stack | Clickatón | | ✓ catalog | |
| Soft deactivate venues | Clickatón | ✓ | | |
| `requireClickatonAdmin` | Clickatón | ✓ | | |
| Registration domain catalog port | Clickatón registration | | ✓ admin repo | |
| FotoRank forms / FR spacing | FotoRank | | | ✓ (DS distinto) |
| Copiar Prisma en UI | — | | | ✓ |

---

## 23. Matriz de tests

Ver `design/test-matrix.ts` (dominio, repo, seguridad, UI, integración local sin Neon).

---

## 24. Fases siguientes

| Etapa | Entrega |
|-------|---------|
| **10D3B** | Backend: validation + use-cases + Prisma repos + selfchecks (sin UI completa) |
| **10D3C** | UI productos + variantes |
| **10D3D** | UI entradas + composición |
| **10D3E** | Disponibilidad/stock UI + endurecimiento gates |
| **10D4** | Inscripción pública |
| **10D5** | Checkout + DNX Payments |
| **10D6** | QR / credenciales |
| **10D7** | Check-in + kit desk |

---

## 25. Riesgos

- Allowlist hardcodeada / sin RBAC sede.
- `reservedStock` vs holds: posible desync hasta job de reconciliación.
- Limitación 1 sede por ticket type.
- Admin DS compacto (`space-y-2`) distinto a FotoRank — mantener consistencia Clickatón.
- Placeholder Inscripciones puede confundir si catálogo demora.
- No tocar WIP Cuánto Cobro al implementar 10D3B.

---

## 26. Veredicto

**PLAN APROBABLE — LISTO PARA 10D3B**

El modelo 10D2 soporta el MVP sin migración nueva. Los patrones admin de ediciones/sedes son compatibles. No se requiere escritura Neon ni cambios de schema en esta etapa.
