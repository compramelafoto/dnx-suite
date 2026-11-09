# Carrito de evento con varios fotógrafos y un solo pago (Split 1:N) — Diseño

**Estado:** diseño aprobado para construir **apagado**. No se enciende hasta que Split 1:N esté
habilitado para todos los fotógrafos de CompraMeLaFoto (hoy es un piloto de un álbum).

**Depende de:** el piloto Split 1:N de álbumes (PR #985 y #986), sus módulos en
`apps/compramelafoto/lib/split-1n-piloto/` y la documentación en
`docs/payments/mp-split-1n-plan-implementacion.md` §10. Clickatón queda fuera de todo esto.

## Por qué

En un evento (por ejemplo, un partido del Club 9 de Julio) trabajan varios fotógrafos, cada uno
con su álbum. Un cliente que quiere 3 fotos de un fotógrafo y 2 de otro hoy tiene que hacer dos
compras y pagar dos veces. Queremos que elija todas las fotos del evento en un solo carrito, pague
una vez, y que Mercado Pago reparta en el momento a cada autor, al organizador, a los referidores y
a la plataforma, con las mismas reglas que ya usa la contabilidad de CLF.

## Qué existe hoy

- Cada `Order` tiene un `albumId` y cada álbum es de un fotógrafo (`Album.userId`). En producción
  (08/11/2026) ningún álbum activo tiene fotos de dos autores.
- La galería pública del evento (`/e/[shareSlug]`, `/api/public/events/[shareSlug]/gallery`) ya
  muestra fotos de todos los álbumes del evento, con su álbum y fotógrafo. Hoy cada foto lleva al
  álbum para comprar.
- El piloto cobra un pedido con una orden de Mercado Pago (Orders API + Card Payment Brick),
  reparte con montos fijos por receptor y confirma con `finalizarPedidoPiloto`.

## Objetivos

1. Un carrito por evento con fotos digitales de varios álbumes del mismo evento.
2. Un único pago con tarjeta y una única orden de Mercado Pago que reparte a todos.
3. Cada fotógrafo, organizador y referidor ve sus ventas y comisiones exactamente como si cada
   álbum se hubiese vendido por separado: mismos pedidos, mismas comisiones, mismos correos.
4. Apagado por defecto, sin cambios visibles para nadie mientras esté apagado.

## No objetivos

- Impresiones, videos, packs, preventas, escuelas, agencias.
- Mezclar eventos distintos en un carrito.
- Reembolsos automáticos (siguen a mano, como en el piloto).
- Cambiar el cobro de un álbum suelto.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que un fotógrafo cobre fotos de otro, o que el reparto no coincida con la contabilidad de CLF.
- Que alguien cobre dos veces: por el split y después por retiro o liquidación de referidos.
- Que el cliente pague y reciba sólo parte de sus fotos.

## Decisiones

**D1. Un pedido de CLF por álbum, agrupados bajo un cobro.** El carrito crea un `Order` por
álbum (como hoy), y todos llevan en `pricingSnapshot` la misma marca de grupo:
`split1nGrupo = { v: 1, grupoId, pedidos: [ids], estado, providerOrderId, reparto }`. Así no hace
falta migración, y paneles, correos, descargas y comisiones siguen funcionando por pedido.
`grupoId` es un UUID; la referencia externa en Mercado Pago es `clf-event-cart-<grupoId>`.

**D2. Una orden de Mercado Pago para todo el grupo.** El monto total es la suma de los pedidos.
El reparto de cada pedido se calcula con `calcularRepartoPiloto` (el mismo de la etapa 2) y después
se suma por receptor: si un fotógrafo, organizador o referidor aparece en varios pedidos, va una sola
vez en la orden con la suma. El organizador del evento es uno solo y cobra su porcentaje de cada
pedido. La plataforma (`owner`) cobra la suma de sus restos.

Ejemplo (fotos de $3.000, recargo 15 %, organizador 20 %, sin referidores), 3 fotos de A y 2 de B:
A $7.200, B $4.800, organizador $3.000, plataforma $2.250. Total $17.250.

**D3. Todo o nada.** El carrito sólo se cobra por split si **todos** los pedidos del grupo son
elegibles (`evaluarElegibilidadPiloto` en cada uno: fotógrafos, referidores y organizador con
consentimiento activo, sólo digital). Si alguno no lo es, el carrito ofrece pagar cada álbum por
separado con el cobro actual (la experiencia de hoy). Nunca se cobra una parte por split y otra no.

**D4. Confirmación por grupo, efectos por pedido.** Cuando la orden queda acreditada:
`ensureDigitalDelivery` de cada pedido; después cada pedido pasa a `PAID` con una escritura
condicionada (`updateMany` con estado `PENDING|FAILED`), y se corren sus efectos con las piezas del
piloto (`registrarComisiones`, avisos, auditoría). `mpPaymentId` es el mismo en todos los pedidos
del grupo. Si un pedido falla al confirmar, el aviso siguiente lo completa (idempotente). El cliente
recibe un solo correo con el enlace a todas sus descargas (centro de descargas por grupo).

**D5. Interruptores.** `DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED` (apagado por defecto) más la lista
`DNX_CLF_SPLIT_1N_CARRITO_EVENTO_IDS` para encenderlo evento por evento. Además exige que el split
esté habilitado para los fotógrafos involucrados (hoy: el mapa de receptores del piloto; mañana: los
consentimientos guardados en CLF cuando el split se abra a todos).

**D6. Tope de receptores.** No sabemos cuántos receptores admite Mercado Pago por orden (pregunta
pendiente a Mercado Pago). Hasta saberlo, `DNX_CLF_SPLIT_1N_MAX_RECEPTORES` (por defecto 10, contando
plataforma) y el carrito rechaza con un mensaje claro si se pasa, ofreciendo pagar por álbum.

**D7. Reembolsos y reclamos.** Un reembolso total devuelve a cada receptor su parte (lo hace
Mercado Pago). Un reembolso parcial (una foto) queda fuera de alcance: se hace a mano y se documenta.

## Experiencia del cliente

1. En la galería del evento, cada foto tiene "Agregar al carrito" (además de "Ver en el álbum").
2. Un carrito flotante del evento muestra fotos agrupadas por fotógrafo y el total.
3. "Comprar" pide los datos del cliente una vez y lleva a `/pagar/grupo/<grupoId>` con el mismo
   formulario de tarjeta del piloto.
4. Al acreditarse: pantalla de éxito con un botón para descargar todas las fotos.

Con el interruptor apagado no aparece nada de esto: la galería sigue llevando a cada álbum.

## Lo que queda a criterio de quien lo construya

Estructura de componentes del carrito, guardado del carrito en el navegador, textos exactos (en
español, "dinero" y nunca "plata"), y cómo reutilizar `pagarPedidoPiloto` / `finalizarPedidoPiloto`
(generalizar a "grupo de uno" es razonable si no rompe el piloto).

## Pruebas

- Automáticas (obligatorias): reparto de grupo con varios fotógrafos, organizador y referidores;
  suma por receptor repetido; todo-o-nada; tope de receptores; confirmación idempotente por pedido;
  carrito apagado = sin cambios.
- Con dinero real: **una** compra de prueba antes de encender el primer evento (dos fotógrafos y
  organizador), con reembolso. Las combinaciones restantes las cubren las pruebas automáticas.

## Preguntas abiertas para Mercado Pago

- Máximo de receptores por orden en Split 1:N.
- Pago con dinero en cuenta y tarjetas del exterior en Split 1:N.
