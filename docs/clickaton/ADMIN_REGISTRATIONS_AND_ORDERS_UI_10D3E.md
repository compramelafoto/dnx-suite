# Clickatón — 10D3E — UI administrativa de órdenes e inscripciones

**Estado:** UI productiva de inscripciones sobre dominio 10D1–10D2 + repos Prisma/in-memory.  
**Modo:** parcial respecto a “órdenes” — **no existe entidad `ClickatonOrder`**.  
**Fuera de alcance:** Mercado Pago, DNX Payments runtime, checkout público, webhooks, fiscal, QR, acreditación, emails reales, devoluciones monetarias.

## Alcance

Administrar:

1. Listado y detalle de `ClickatonRegistration`
2. Estados operativos y transiciones administrativas explícitas
3. Cupo (holds ACTIVE / CONSUMED / RELEASED)
4. Snapshot de productos (`ClickatonRegistrationItem`)
5. Soft refs comerciales (`paymentOrderId`, provider, external ref)
6. Observaciones internas vía auditoría `INTERNAL_NOTE`
7. Reasignación sede/entrada en estados no confirmados

## Modelo real encontrado

| Concepto pedido | Realidad en schema/dominio |
| --------------- | -------------------------- |
| Inscripción | `ClickatonRegistration` |
| Orden | **No hay tabla Order.** Soft refs a DNX Payments en la inscripción |
| Participante | Campos en Registration (`firstName`, `lastName`, `email`, …) + `userId` |
| Comprador | No separado; mismo perfil de inscripción |
| Entrada | `ticketTypeId` → `ClickatonTicketType` |
| Productos | `ClickatonRegistrationItem` con `nameSnapshot` / `skuSnapshot` |
| Cupo | `ClickatonCapacityHold` (+ conteos en disponibilidad catálogo) |
| Stock reservado | `ClickatonStockHold` (estado informativo en admin) |
| Observaciones | Sin campo Notes; audits `action=INTERNAL_NOTE` + `metadata.note` |
| Historial | `ClickatonRegistrationStatusHistory` + audits |

**Decisión UI:** solo rutas `/admin/inscripciones` (+ detalle). **No** se creó `/admin/ordenes` vacío. La sección “Comercial (soft refs DNX Payments)” vive en el detalle.

## Gaps

| Capacidad | Estado | Impacto | Resolución 10D3E |
| --------- | ------ | ------- | ---------------- |
| Listar/ver inscripciones | OK dominio+Prisma | — | UI implementada |
| Cambiar estado | OK (transiciones admin MVP) | Motivo obligatorio | Botones contextuales |
| Listar/ver órdenes | **Gap** (sin entidad) | Sin ruta órdenes | Embebido soft refs |
| Marcar pagada manual | **Gap** (no caso de uso auditable de pago manual) | No botón “Pagada” | Solo `confirm_admin` excepcional |
| Observaciones | Parcial (audit, no Notes) | Sin edición in-place | Solo agregar |
| Reactivación | Parcial | No recrea holds | Documentado |
| Snapshot kit | OK items | Riesgo si se interpreta kit vivo | Copy de riesgo en UI |
| Filtros Prisma | Lista acotada (~200) | Escala | Aceptable MVP |

## Arquitectura

```text
Server Component (página)
  → server action delgada (`lib/admin-registration/actions/*`)
  → AdminRegistrationService
  → casos de uso (list/get/transition/assignment/note)
  → ClickatonAdminRegistrationRepository (Prisma | in-memory)
```

Reglas:

- Client Components solo invocan actions / leen planes de transición (sin Prisma/`@repo/db`/repos/servicio).
- Mutaciones por POST (server actions), nunca GET.
- Permisos: `requireClickatonAdmin` en páginas + gate en actions (`hasClickatonAdminAccess`).
- Errores serializados (`toSerializableAdminRegistrationError`).

## Rutas

| Ruta | Protección | Responsabilidad |
| ---- | ---------- | --------------- |
| `/admin/inscripciones` | `requireClickatonAdmin` | Lista + filtros query |
| `/admin/inscripciones/[registrationId]` | `requireClickatonAdmin` | Detalle, acciones, notas, asignación |
| `/admin/ordenes` | — | **No creada** (sin entidad) |

## Navegación

Ítem existente **Inscripciones** (`adminRoutes.registrations`). Sin ítem Órdenes. Activo vía `isAdminNavActive` con prefijo `/admin/inscripciones`.

## Lista de inscripciones

Columnas (según datos): participante, email, documento enmascarado, edición, sede, entrada, código, estado, estado cobro, importe, fechas, #productos, ref pago (sí/no), abrir.

## Filtros

Query combinables: `editionId`, `venueId`, `ticketTypeId`, `status`, `paymentStatus`, `q`, `from`, `to`, `paymentOrder` (with/without), `notes` (with/without). Filtrado en servidor (repo).

## Lista / detalle de órdenes

Diferido. Soft refs solo lectura en detalle de inscripción.

## Detalle de inscripción

Secciones: Identidad · Evento y cupo (incluye `getCatalogAvailability`) · Comercial soft refs · Productos snapshot · Acciones · Reasignación · Observaciones · Historial.

## Estados y transiciones

| Estado actual | Acción | Estado siguiente | Efectos |
| ------------- | ------ | ---------------- | ------- |
| DRAFT, PENDING_PAYMENT, WAITLISTED | `confirm_admin` | CONFIRMED | Consume holds ACTIVE; motivo obligatorio; **no es cobro MP** |
| DRAFT, PENDING_PAYMENT, WAITLISTED, CONFIRMED | `cancel` | CANCELLED | Libera holds ACTIVE |
| CONFIRMED | `disqualify` | DISQUALIFIED | Sin tocar holds consumidos |
| CANCELLED | `reactivate` | DRAFT | No recrea holds; payment → NOT_REQUIRED |

Sin `<select>` genérico de estados. Confirmación `window.confirm` antes de mutar.

## Cupos

- Confirmación admin: valida `confirmed + (activeHolds - selfHold) < capacity`.
- Cancelación: `holdMode=release` sobre ACTIVE.
- UI muestra disponibilidad de catálogo + hold de la inscripción.
- No se simula “reservado” aparte si no hay hold.

## Productos y stock

- Se muestran ítems persistidos (snapshot).
- Lectura **no** descuenta stock.
- Transiciones solo cambian estado de holds (ACTIVE→CONSUMED/RELEASED), no el campo `stock` del producto.
- Riesgo documentado: cambiar el kit del ticket **no** debería reinterpretarse como histórico; el histórico vive en items.

## Observaciones internas

Agregar vía audit `INTERNAL_NOTE`. Autor (`actorUserId`) + fecha. Sin edición/borrado. No públicas.

## Datos personales

- Listado: documento enmascarado (`••••` + últimos 4).
- Detalle: documento completo (justificación operativa).
- Sin tokens/secretos; errores sin Prisma/SQL.

## Server actions

| Action | Caso de uso | Permiso | Revalidación |
| ------ | ----------- | ------- | ------------ |
| `listRegistrationsAction` | list | `registration.read` | — |
| `getRegistrationAction` | get | `registration.read` | — |
| `setRegistrationStatusAction` | transition | `registration.mutate_exceptional` | inscripciones + detalle + catálogo/entradas |
| `updateRegistrationAssignmentAction` | assignment | mutate | idem |
| `addInternalNoteAction` | note | mutate | idem |
| `listOrdersAction` / `getOrderAction` | — | — | **No implementadas** (sin entidad) |

Gate de permiso = admin Clickatón existente (mismo criterio que catálogo). Capabilities granulares diferidos.

## Errores

`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `INVALID_STATUS_TRANSITION`, `CAPACITY_EXCEEDED`, `EDITION_MISMATCH`, `VENUE_MISMATCH`, `TICKET_MISMATCH`, `ALREADY_CANCELLED`, `ALREADY_CONFIRMED`, …

## Accesibilidad / responsive / vacíos

Labels, `aria-describedby`, `role="alert|status"`, tablas semánticas, botones con texto, filtros apilables, scroll horizontal en tablas, estados vacíos honestos (sin inscripciones, sin resultados, sin productos, sin orden/pago, sin acciones para el estado).

## Selfcheck

```bash
pnpm --filter clickaton selfcheck:admin-registrations-orders-ui
```

In-memory: auth, filtros, detalle, transiciones válidas/inválidas, cupo, cancelación, reactivación, nota, assignment, soft refs, máscara documento, sin Prisma en client, sin hard delete, sin ruta `/admin/ordenes`.

## Prisma / Neon

- Schema **no** modificado.
- Selfcheck Prisma de catálogo puede fallar por entorno local (`127.0.0.1:55434`); no bloquea esta UI si contratos in-memory pasan.
- Sin `migrate deploy` / Neon writes.

## Riesgos pendientes

1. Sin Order local → conciliación y multi-ítem comercial limitados.
2. Reactivación sin holds → posible oversell si se confirma sin re-reservar.
3. Notas solo append-only en audit.
4. Lista Prisma con límite de filas.
5. `confirm_admin` pone payment APPROVED si hay importe — es excepción operativa, no webhook.

## Decisiones diferidas

- Entidad Order / checkout público (10D3F+)
- Pago manual auditable dedicado
- Permisos por sede/delegado
- Edición/borrado de notas
- Recreación de holds en reactivación
- Emails / QR / acreditación

## Veredicto esperado

`UI PARCIAL — GAP DE DOMINIO O SCHEMA` respecto a órdenes separadas; UI de **inscripciones** operativa para continuar a flujo público cuando el dominio lo permita.
