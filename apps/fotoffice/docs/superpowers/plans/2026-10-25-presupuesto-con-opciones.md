# Plan · Presupuesto con opciones

Spec: `docs/superpowers/specs/2026-10-25-presupuesto-con-opciones-design.md`. Sin migración.

1. **Módulo puro** `lib/presupuestos/alternativas.ts`: tipos, validación (1 a 4, nombres únicos, una «más
   elegida»), asignar ítems, totales y costos por opción, lectura de lo guardado, `fijarAlternativa`,
   `alternativaAceptada`, `itemsQueValen`, `totalParaMensaje` y las operaciones del editor. `alternativaId`
   opcional en `ItemPresupuesto` (sólo se guarda si hay).
2. **Guardar**: `normalizarBorrador` recibe `alternativas` (o conserva las guardadas); `guardarBorrador` y la
   firma del control de concurrencia (también la de DNX Bot) las incluyen sólo si hay.
3. **Propuesta modelo**: `{ alternativas, items }` en la misma columna; instanciar conserva la opción de cada
   ítem; el presupuesto que nace (a mano, borrador automático, Telegram) las trae.
4. **Enviar**: formas de pago congeladas por opción (`paymentOptions.porAlternativa`); una opción vacía frena el
   envío; el correo dice «desde».
5. **Aceptar**: pide la opción, valida la forma de pago contra la suya y fija la elegida en la misma escritura.
6. **Pedido**: sólo los ítems de la elegida.
7. **Vista pública**: tarjetas lado a lado con qué incluye, precio, cuotas sin interés y «Elegir esta»; el
   formulario elige opción y forma de pago.
8. **Editores**: pestañas de opciones, renombrar, describir, «la más elegida», ordenar, borrar, mover y copiar
   ítems; total (y margen) de cada una.
9. **Interno**: la vista de una versión enviada agrupa por opción; Telegram y «Esperando aprobación» muestran
   precio, costo y margen de cada opción.
10. **Pruebas**: `alternativas.test.ts` (puras) y `alternativas-circuito.test.ts` (base en memoria: guardar,
    enviar, abrir, aceptar, pedido, seña y compatibilidad sin opciones).
11. Verificar: `tsc`, vitest, `pnpm build`.
