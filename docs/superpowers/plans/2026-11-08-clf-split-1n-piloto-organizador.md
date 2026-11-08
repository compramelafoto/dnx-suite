# Piloto Split 1:N — etapa 2: organizadores — Plan

> Para agentes: se ejecuta en línea (superpowers:executing-plans), TDD en `lib/split-1n-piloto/piloto.test.ts`.

**Objetivo:** que el piloto Split 1:N de CLF cobre también álbumes de un evento con organizador,
pagándole en el momento al organizador y al referidor del organizador, además del fotógrafo,
su referidor y la plataforma.

**Base:** etapa 1 (PR #985). Mismo interruptor, misma lista de álbumes y mismo mapa de receptores
(`DNX_CLF_SPLIT_1N_PILOTO_*`). Sin migraciones.

## Reparto (igual que hoy en la contabilidad de CLF)

Con `total`, `fee` = recargo de la plataforma y `base = total − fee`:

| Rol | Monto | Origen en CLF |
|---|---|---|
| organizador | `round(base × % / 100)` | `ensureEventOrganizerCommissionSnapshotForPaidOrder` |
| fotógrafo | `base − organizador` | `photographerNetAmount` |
| referidor del fotógrafo | `floor(fee × 0,5)` | `PHOTOGRAPHER_REFERRAL` |
| referidor del organizador | `floor(fee × 0,2)` | `ORGANIZER_REFERRAL` (coexiste con el anterior) |
| plataforma | `fee − referidores` | resto |

Ejemplo $3.450 (fee 450), organizador 20 %: 2.400 / 600 / 225 / 90 / 135.

## Reglas de elegibilidad nuevas

- Organizador = `Event.creatorId` del álbum. Porcentaje = `organizerCommissionPercentage` si
  `organizerCommissionEnabled`, si no 0.
- Evento al 100 % (el organizador ya es el cobrador): fuera (`organizador_cobra_todo`).
- Porcentaje > 0 y organizador sin receptor: fuera (`organizador_sin_consentimiento`).
- Organizador con referidor activo (`ORGANIZER_REFERRAL`) sin receptor: fuera
  (`referidor_organizador_sin_consentimiento`). Igual criterio que el referidor del fotógrafo.
- Álbum escolar (`schoolId`): fuera (`album_escolar`), tiene su propia comisión.
- Una misma cuenta con dos roles: un solo receptor en la orden con la suma de ambos montos.

## Al confirmar

- La comisión del organizador se registra con el cálculo de siempre y nace como
  `PAID_DIRECT_TO_ORGANIZER` / `ORGANIZER_AS_COLLECTOR`: no suma a su saldo para retiro.
- La comisión del referidor del organizador nace pagada, como la del referidor del fotógrafo.

## Tareas

1. Elegibilidad con organizador y escuela (pruebas de cada motivo nuevo).
2. Reparto de cinco partes (ejemplo de la tabla, sin organizador = etapa 1, redondeos).
3. `prepararCobro` con roles nuevos y fusión de receptores repetidos.
4. `buscarOrganizador(eventId)`; desvío, pago y marca usan organizador.
5. `finalizarPedidoPiloto`: comisión del organizador directa y referidor del organizador pagado.
6. Documentación (§10 del plan de implementación).

## Fuera de alcance

Escuelas, agencias, preventas, impresiones, videos, eventos al 100 %. Clickatón no se toca.
