# Cupo, disponibilidad y reserva — diseño

Fecha: 2026-08-27
Estado: aprobado para implementar
Rama: `feat/partners-inventory-map` (worktree `dnx-suite-wt-inventario`)
Origen: etapa 2 del catálogo de patrocinios DNX

## Problema

Entre que se arma una propuesta y el cliente responde pasan días. Sin un estado
de reserva con vencimiento, dos organizadores prometen el mismo lugar el mismo
día y uno de los dos queda mal con su cliente.

Hoy no existe ninguna noción de ocupación: el mapa de inventario dice qué
espacios hay y quién puede venderlos, pero nada dice si están libres.

## Qué construimos

Una tabla de ocupación, un módulo de dominio que calcula disponibilidad sin base
de datos, y una restricción en Postgres que hace imposible el doble booking.

**Fuera de alcance:** conectar el generador de propuestas, la pantalla de
administración, la tarea que vence las reservas, la exclusividad de rubro
(etapa 3) y los precios.

## El modelo

### `DnxPartnerInventoryBooking`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | cuid | |
| `placementKey` | String | Clave del catálogo técnico |
| `contextType` | `DnxPartnerContextType` | `GLOBAL`/`PLATFORM` para espacios globales; `EDITION`, `CONTEST`, `ALBUM` para los de contexto |
| `contextId` | String? | La edición, el concurso o el álbum. Nulo en los globales |
| `partnerId` | String | La marca que ocupa |
| `participationId` | String? | Se llena cuando el acuerdo está cerrado |
| `slotIndex` | Int | Qué lugar del cupo ocupa, desde 0 |
| `status` | `DnxPartnerBookingStatus` | `DRAFT` \| `RESERVED` \| `SOLD` \| `CANCELLED` |
| `startsAt` | DateTime | **Obligatorio** |
| `endsAt` | DateTime | **Obligatorio** |
| `reservationExpiresAt` | DateTime? | Solo con `RESERVED` |
| `reservationExtensionCount` | Int | Cuántas veces la extendió un administrador |
| `reservationExtendedAt` | DateTime? | |
| `reservationExtendedByUserId` | Int? | |
| `soldByOrganizationId` | String? | Quién originó la venta. Nulo = DNX directo |
| `notes` | String? | |
| `createdByUserId` / `updatedByUserId` | Int? | |
| `createdAt` / `updatedAt` | DateTime | |

### Por qué la vigencia es obligatoria

«Vendido» sin fecha de fin bloquea el espacio para siempre. La ocupación es
*desde X hasta Y*, y es lo que hace posible el sponsor mensual: el mismo lugar
se vuelve a vender el mes que viene.

### `slotIndex`: cómo se cuenta el cupo

Una franja de logos entra doce marcas. Una restricción de exclusión común
bloquea **cualquier** superposición, que sería correcto para cupo 1 y absurdo
para cupo 12.

La solución es numerar el lugar. Cada reserva ocupa un `slotIndex` concreto, y
la restricción impide que dos ocupaciones compartan **el mismo lugar** en
períodos que se pisan. La aplicación elige el índice libre más bajo, siempre
menor que el cupo del catálogo.

Con eso, dos vendedores que van por el último lugar eligen los dos el mismo
índice y **la base rechaza a uno**. Si quedaban dos lugares, eligen índices
distintos y entran los dos, que es lo correcto.

## La restricción

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "DnxPartnerInventoryBooking"
  ADD CONSTRAINT "DnxPartnerInventoryBooking_no_overlap"
  EXCLUDE USING gist (
    "placementKey" WITH =,
    (COALESCE("contextId", '')) WITH =,
    "slotIndex" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('RESERVED', 'SOLD'));
```

Un control en la aplicación no alcanza: si dos transacciones confirman el último
cupo al mismo tiempo, las dos leen «hay lugar» y las dos escriben. La restricción
es lo único que lo impide de verdad.

El rango es `[)` —incluye el inicio, excluye el fin— para que una ocupación que
termina el 1 de marzo y otra que arranca el 1 de marzo **no** se consideren
superpuestas.

`DRAFT` y `CANCELLED` quedan fuera del filtro: una propuesta que se está armando
no ocupa nada.

Prisma no sabe expresar restricciones de exclusión, así que va en SQL crudo
dentro de la migración. El modelo Prisma no la menciona.

### Las reservas vencidas y la restricción

La restricción no puede saber qué hora es, así que una reserva vencida sigue
ocupando hasta que algo la pase a `CANCELLED`.

El dominio, en cambio, **sí ignora las vencidas al calcular disponibilidad**. El
resultado es que la pantalla muestra el lugar libre de inmediato y la base lo
libera cuando pasa la tarea de barrido. La diferencia solo puede fallar hacia el
lado seguro: nunca sobrevende, a lo sumo rechaza una venta durante el rato que
falta para el barrido.

La tarea de barrido no entra en esta entrega. Sin ella, el sistema funciona: las
reservas vencidas dejan de mostrarse, y hay que cancelarlas a mano para liberar
el lugar en la base.

## El dominio

`packages/partners/src/inventory-booking.ts`. Sin Prisma: recibe las ocupaciones
ya cargadas y calcula.

```ts
export const RESERVATION_DAYS = 10;
export const BOOKING_OCCUPYING_STATUSES = ["RESERVED", "SOLD"] as const;

export function isBookingOccupying(booking, now): boolean;
export function rangesOverlap(a, b): boolean;
export function reservationExpiryFrom(now): Date;

export function resolveInventoryAvailability(input: {
  placementKey;
  contextId: string | null;
  range: { startsAt: Date; endsAt: Date };
  bookings: readonly InventoryBooking[];
  now: Date;
  /** Cupo comercial. Por defecto, el `maxItems` del catálogo. */
  capacity?: number;
}): InventoryAvailability;
```

`InventoryAvailability` devuelve `capacity`, `taken`, `free`, el `slotIndex`
libre más bajo, y `nextFreeAt`: cuándo se libera el primero cuando no hay lugar.

Ese último dato también es información de venta — *«se libera el 1 de marzo, ¿te
lo reservo?»*.

### El cupo comercial y la rotación

El cupo por defecto es el `maxItems` del catálogo. La decisión de que los banners
roten —varias marcas compartiendo un lugar que técnicamente es uno— multiplica
ese número, pero **cuántas rotan no está definido**, así que `capacity` queda
como parámetro explícito y el default es el técnico. No se inventa un número.

## Pruebas

En `@repo/partners`, con `node:test`, sin base de datos:

- una ocupación vendida ocupa; una en borrador o cancelada no
- una reserva vencida deja de ocupar
- rangos que se tocan en el borde no se superponen
- el cupo sale del catálogo y se puede sobrescribir
- con lugares libres devuelve el índice más bajo
- sin lugar devuelve `slotIndex: null` y el `nextFreeAt` correcto
- ocupaciones de otro espacio o de otro contexto no interfieren
- una ocupación global no bloquea la de un contexto y viceversa

## Lo que falta después

1. Aplicar la migración.
2. El repositorio Prisma y la revalidación al cerrar: nunca confiar en la
   disponibilidad que se consultó al armar la propuesta.
3. La tarea que vence las reservas.
4. Conectar el generador: sin lugar, el ítem no entra en la propuesta.
5. La habilitación explícita para vender inventario ajeno.

## Verificación contra Postgres real

2026-08-28, PostgreSQL 16.14 local y descartable. La migración corre completa,
incluida `CREATE EXTENSION btree_gist` y la restricción de exclusión. Nueve casos
funcionales:

| Caso | Resultado |
|---|---|
| Mismo lugar, períodos que se pisan | La segunda **rechazada** |
| Lugares distintos, mismo período | Las dos entran |
| Mismo lugar, períodos pegados (termina y arranca el 1-sep) | Entra: el borde no se pisa |
| Borrador sobre un lugar ocupado | Entra: un borrador no ocupa |
| Reserva sobre un lugar vendido | **Rechazada** |
| Mismo lugar y período en dos concursos distintos | Las dos entran |
| Repetir en el mismo concurso | **Rechazada** |
| Cupo de doce: los doce lugares | Los doce entran |
| El trece, reusando un lugar | **Rechazada** |

El `COALESCE("contextId", '')` funciona: los contextos quedan aislados entre sí y
de los espacios globales.
