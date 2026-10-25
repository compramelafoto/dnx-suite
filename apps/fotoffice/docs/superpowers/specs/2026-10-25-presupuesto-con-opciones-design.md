# Presupuesto con opciones (Básico, Intermedio, Premium)

> 25/10/2026 · Pedido de Daniel (DNX Estudio). Hasta hoy estaba fuera de alcance («Alternativas A/B/C dentro
> del mismo presupuesto», `2026-10-07-etapa-2-catalogo-y-presupuestos-design.md` §1). **Sin staging. Sin
> migración.**

## 1. Qué resuelve

Para un 15 años (o una boda) DNX quiere mandar un solo presupuesto con varias opciones —Básico, Intermedio y
Premium— y que el cliente **elija una** en la página pública, la acepte y pague la seña de esa opción.

## 2. Qué hace

- Un presupuesto (y una propuesta modelo) puede tener **de 1 a 4 opciones**. Cada una: nombre, descripción
  corta, sus ítems (del catálogo, de texto libre o calculados con ¿Cuánto Cobro?), su total y la marca «la más
  elegida» (como mucho una).
- **Sin opciones, todo funciona exactamente como hoy**: ni un campo nuevo en los JSON (presupuestos
  existentes, borrador automático, Telegram, DNX Bot y la migración de Alboom).
- **Editor de presupuestos y de la propuesta modelo**: «Ofrecer varias opciones» arma la Opción 1 con lo que
  ya había y una Opción 2 vacía; pestañas con el total (y el margen, con permiso de costos) de cada una;
  renombrar, describir, marcar «la más elegida», ordenar (antes / después), borrar (con sus ítems; si queda
  una, vuelve a ser un presupuesto común), y en cada ítem «Mover a…» y «Copiar a…» otra opción.
- **Página pública**: las opciones lado a lado (en el celular, una debajo de otra), qué incluye cada una, el
  precio total (con IVA si corresponde), el plan en cuotas sin interés más largo (del plan de pagos que ya
  existe) y la seña; botón «Elegir esta». El formulario de aceptación pide la opción y muestra las formas de
  pago de esa opción. Ya aceptado, se ve sólo la elegida.
- **Aceptar** fija la opción: la seña, el plan de cuotas y el pedido salen de la elegida. **El pedido lleva sólo
  los ítems de la opción elegida.**
- **Telegram y «Esperando aprobación»**: cada opción con su precio, su costo y su margen.
- El correo de envío, con opciones, dice el total «desde» la más barata.

## 3. Dónde se guarda (sin migración)

Todo en los JSON que ya existen de `FotofficePresupuestoVersion` y `FotofficePropuestaModelo`:

| Dónde | Qué |
| --- | --- |
| `items[].alternativaId` | La opción del ítem (sólo si hay opciones). |
| `totals.alternativas` | `[{ id, nombre, descripcion, masElegida, totales }]`. Los totales de arriba son los de la **principal** (la más elegida o la primera), así todo lo que ya leía `totals.total` sigue andando. |
| `totals.alternativaElegidaId` | La que eligió el cliente (al aceptar). |
| `costSnapshot.alternativas` | Costo y margen de cada opción. Interno: nunca sale al público. |
| `paymentOptions.porAlternativa` | Al enviar, las formas de pago congeladas sobre el total de cada opción (con IVA y seña). |
| `FotofficePropuestaModelo.items` | La lista de siempre, o `{ alternativas, items }` si tiene opciones. Lo de antes se lee igual. |

**Al aceptar** (misma escritura condicional de siempre): totales, formas de pago y costos de arriba pasan a ser
los de la elegida (`fijarAlternativa`), y se guarda `alternativaElegidaId`. Desde ahí el pedido, la seña, los
avisos, la ficha del pedido y los informes leen la elegida sin saber nada de opciones. La forma de pago se
valida contra las de **esa** opción.

**Reglas**:
- Con varias opciones hay que elegir una al aceptar; con una sola, va ésa.
- Un ítem que llega sin opción (por ejemplo, de DNX Bot) o con una que ya no está, va a la principal. Guardar
  sin el campo `alternativas` conserva las guardadas.
- Una opción sin ítems no se puede enviar.
- Nombres de opción únicos, hasta 60 caracteres; descripción hasta 300.

## 4. Fuera de alcance

- Ítems comunes a todas las opciones (hoy se copian con «Copiar a…»).
- Opciones de pago distintas por opción (son las mismas, calculadas sobre el total de cada una).
- Informes por opción elegida.

## 5. Código

`lib/presupuestos/alternativas.ts` (puro: validación, totales, costos, fijar la elegida, operaciones del
editor). Lo usan `versiones.ts` (normalizar), `presupuestos.ts` (guardar), `envio.ts` (congelar),
`aceptacion.ts`, `lib/pedidos/confirmar.ts`, `vista-publica.ts`, `propuestas-modelo.ts`,
`instanciar-propuesta.ts`, `lib/presupuesto-automatico/` (resumen y pendientes) y los editores.
