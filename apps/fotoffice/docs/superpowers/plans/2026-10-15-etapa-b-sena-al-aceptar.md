# Etapa B · El presupuesto muestra total, seña y plan; la seña se paga al aceptar — plan

- **Spec:** `docs/superpowers/specs/2026-10-15-presupuesto-a-caja-y-estudio-design.md` §4 (y §5.1, la comisión en Caja).
- **Base:** la etapa A (PR 602): perfil con `pricingExtras` (IVA, comisión, seña, política de cancelación).
- **Sin Mercado Pago conectado** (caso de DNX Estudio hoy): sólo se ofrece transferencia o efectivo. Nada se rompe.

## Decisiones de implementación

1. **Condiciones de cobro congeladas al enviar.** Se guardan dentro de la instantánea de opciones de pago de la versión
   (`paymentOptions.cobro`, JSON, sin columna nueva). Contienen:
   - condición de IVA, IVA %, total sin IVA, IVA y total con IVA;
   - seña %;
   - descuento por transferencia % (la comisión, si se suma al precio);
   - política de cancelación.

   Las opciones se calculan sobre el **total con IVA**. Los totales del editor quedan como están (sin IVA).
2. **Medio de pago dentro de la opción.** Si hay descuento por transferencia, cada opción tiene una variante
   `"<id>~transferencia"` con el total × (1 − descuento) y las cuotas sugeridas por `TRANSFERENCIA`. La opción base
   queda como "con Mercado Pago".
   - Así la elección del cliente (`chosenPaymentOptionId`) ya dice el medio.
   - El total del pedido y el plan salen solos, con el código de siempre (`buscarOpcion`, `planDesdeOpcion`).
   - Sin Mercado Pago conectado, la página sólo muestra las variantes por transferencia (o, sin descuento, las opciones
     de siempre como "transferencia o efectivo"). La aceptación rechaza una opción de Mercado Pago si la organización
     no puede cobrar.
3. **Seña en el plan.** Con seña, la cuota 1 es la seña y vence hoy. El saldo se reparte en las cuotas de la opción,
   la primera un mes después y con el tope del evento.
4. **Política de cancelación:** se muestra dentro de «Condiciones» en el enlace y en la impresión. Aceptar las
   condiciones la incluye.
5. **Pedido automático al aceptar:**
   - interruptor `autoConfirmarPedido` en la tabla nueva `FotofficeCobroAjustes`, **apagado por omisión**;
   - si está encendido, después de aceptar se confirma el pedido como sistema (misma escritura que `confirmarPedido`,
     con `contextoDeSistema`) y el cliente pasa al enlace del pedido con la seña resaltada;
   - si falla, queda como hoy («Pedido por confirmar» + tarea).
6. **Transferencia:**
   - `FotofficeCobroAjustes` guarda alias, CBU/CVU, titular, CUIT, banco y `montoUnico`;
   - en el enlace del pedido, «Pagar por transferencia» muestra los datos y el monto exacto, y crea una
     `FotofficeEsperaPago` (estado `ESPERANDO`), que queda lista para la conciliación;
   - con monto único, a la espera se le suman de 1 a 99 pesos (el menor que no repita otra espera abierta de la
     organización; lo asegura un índice único parcial);
   - el pedido se ve "Esperando tu transferencia".
7. **Comisión real de Mercado Pago en Caja** (ítem de la etapa C, que entra acá porque es el mismo circuito):
   - con `feeArs > 0`, `aplicarCobro` escribe en la misma transacción un EGRESO `pedidos-comision` en el rubro
     "Comisiones de Mercado Pago" (lo crea si no existe);
   - `anularCobro` también anula ese EGRESO.
8. **Si la migración no está aplicada**, leer `FotofficeCobroAjustes` devuelve los valores de fábrica: no hay pedido
   automático ni transferencia, y nada más se rompe.

## SQL (una migración, sólo tablas nuevas)

`packages/db/prisma/migrations/20261117120000_fotoffice_etapa_b_cobro_al_aceptar/migration.sql`:
`FotofficeCobroAjustes` y `FotofficeEsperaPago`. **No se aplica desde el código**: va a mano antes de fusionar.

## Tareas (TDD)

| # | Prueba | Código |
|---|---|---|
| B1 | `lib/presupuestos/cobro.test.ts`: condiciones desde el perfil (IVA RI, seña, descuento = comisión si se suma, política); sin extras, null | `lib/presupuestos/cobro.ts` |
| B2 | `lib/pedidos/opciones-pago.test.ts`: variantes por transferencia, ids, totales con descuento, `medio`; filtro sin Mercado Pago; sin descuento, igual que antes | `lib/pedidos/opciones-pago.ts` |
| B3 | `lib/pedidos/plan-cuotas.test.ts`: plan con seña (contado y cuotas), medio sugerido | `lib/pedidos/plan-cuotas.ts` |
| B4 | `lib/presupuestos/envio.test.ts`: al enviar se congela `cobro` y las opciones van sobre el total con IVA | `lib/presupuestos/envio.ts` |
| B5 | `lib/presupuestos/vista-publica.test.ts`: IVA, total, seña, plan por opción, medio y política en la vista | `lib/presupuestos/vista-publica.ts`, `opciones-pago.ts` (presupuestos), componentes públicos |
| B6 | `lib/cobro-ajustes/ajustes.test.ts`: leer (sin fila o sin tabla → fábrica), validar y guardar | `lib/cobro-ajustes/ajustes.ts`, Configuración → Presupuestos |
| B7 | `lib/pedidos/confirmar.test.ts`: confirmación como sistema; `lib/presupuestos/aceptacion.test.ts`: con el interruptor, crea el pedido y devuelve su enlace; opción de Mercado Pago rechazada sin cobros | `lib/pedidos/confirmar.ts`, `lib/presupuestos/aceptacion.ts`, acción pública |
| B8 | `lib/pedidos/espera-pago.test.ts`: monto único (1–99, sin repetir), una espera abierta por cuota, sin datos de transferencia no hay | `lib/pedidos/espera-pago.ts`, enlace del pedido |
| B9 | `lib/pedidos/cobros.test.ts`: EGRESO de comisión con la cuota cobrada por Mercado Pago; anulación de los dos | `lib/pedidos/cobros.ts`, `lib/cash/constants.ts` |

## Verificación

Igual que en la etapa A:
- core;
- FOTOFFICE (pruebas + tipos con 8 GB);
- CLF (`test:bot`, ¿Cuánto Cobro?, tipos con 8 GB);
- asistente de ventas.

Sin escrituras en bases, sin llamadas reales a Mercado Pago ni a Anthropic.
