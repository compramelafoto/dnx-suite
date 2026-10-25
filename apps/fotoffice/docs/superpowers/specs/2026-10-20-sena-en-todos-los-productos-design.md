# Seña en todos los productos del Cobrador — diseño

Fecha: 20/10/2026 · Pedido por: Daniel

## Por qué

Hoy el Cobrador (`app/(shell)/ventas/pos.tsx`) sólo acepta seña en los productos "con proceso",
es decir, los que tienen una regla «Proyecto que genera» (`FotofficeProductoProyecto`). Todo lo
demás, como las fotos instantáneas, se cobra como venta común y hay que pagarlo entero. En el
local pasa otra cosa: el cliente deja seña por fotos instantáneas, el equipo las imprime y las
deja listas, y el cliente vuelve a pagar el resto y retirarlas. Ese recorrido hoy no existe en
FOTOFFICE, y los trabajos con proceso se pueden entregar aunque tengan deuda.

## Objetivos

1. **Cualquier producto** del ticket se puede marcar «Deja seña» en el Cobrador.
2. Un producto con seña sale de la venta común y pasa a ser **pedido para retirar**, con el
   recuadro que ya existe (cliente obligatorio, fecha de entrega, seña/paga todo, «al retirar $…»).
   Se reusa `cobrarConPedidoAction` (`app/(shell)/ventas/pedido-actions.ts`).
3. Cada producto del pedido **genera un trabajo con flujo**. Si el producto no tiene regla propia,
   el trabajo usa el flujo estándar **«Para retirar»**: *Recibido → En preparación → Listo para
   retirar → Entregado*.
4. **El candado del saldo vale para TODOS los pedidos** (también los de hoy y los que vienen de
   presupuestos): mientras el pedido tenga saldo, ninguno de sus trabajos se puede pasar a la fase
   «Entregado» ni cerrar como terminado. **Sin excepciones**: ni el dueño ni un administrador lo
   pueden saltear (decisión de Daniel). Cuando se cobra el saldo, se libera.
5. **Stock apartado:** si el producto controla stock, las unidades se descuentan en el momento de
   la seña (quedan apartadas para ese cliente). Si el pedido se cancela, vuelven.

## Lo que NO cambia

- Los productos que ya tienen proceso siguen entrando como pedido solos, igual que hoy.
- Un producto sin proceso y **sin** «Deja seña» sigue siendo venta común, pagada entera.
- El aviso «Listo para retirar» al cliente, el correo «Recibimos tu pedido», el cobro del saldo
  desde el Cobrador y el registro en Caja siguen como están.

## Anti-objetivos

- Que el candado se pueda esquivar por otra puerta: el tablero «En curso», la ficha del trabajo,
  el cambio de etapa en lote, el cierre del recorrido o la importación. Tiene que estar en el
  servidor, en el movimiento de etapa, no sólo en la pantalla.
- Que un pedido cancelado quede trabado (saldo de un cancelado = 0, como ya hace `en-curso.ts`).
- Descontar stock dos veces: un producto que va al pedido no pasa también por la venta común.

## Cómo funciona

### Cobrador

- Cada renglón del ticket cuyo producto **no** tiene proceso muestra un interruptor chico
  «Seña» / «Para retirar». Si se activa, el renglón se marca con la etiqueta «Pedido», igual que
  los que tienen proceso, y entra al recuadro «Pedido para retirar».
- Los renglones con proceso ya vienen marcados y no se pueden desmarcar (como hoy).
- Renglones a mano (sin `productId`) también pueden ir con seña: el trabajo usa el flujo estándar.
- La acción del servidor recibe en cada línea la marca `paraRetirar: boolean` (o la lista de
  índices). `cobrarConPedidoAction` separa: van al pedido las líneas con proceso **o** marcadas;
  el resto es venta común. Hoy rechaza el ticket si no hay nada con proceso; pasa a rechazarlo si
  no hay nada que vaya al pedido.
- La fecha de entrega sugerida para un producto sin regla: el último plazo usado para ese producto
  si lo hay; si no, 1 día (decisión del constructor si conviene otro número; las fotos
  instantáneas se preparan rápido).

### El flujo estándar «Para retirar»

- Es un `FotofficeCircuit` de clase `TRABAJO`, con las cuatro etapas de arriba. Los colores
  tienen que hacer que `faseDeEtapa` (`lib/proyectos/en-curso-puro.ts`) los ponga en
  RECIBIDO / EN_PROCESO / LISTO (amarillo) / ENTREGADO (verde).
- Se crea **solo, la primera vez que hace falta**, en la misma transacción del pedido, y se
  reconoce después por una marca estable (columna nueva, por ejemplo `systemKey = "PARA_RETIRAR"`,
  con único por workspace). No se reconoce por el nombre, porque el estudio lo puede renombrar.
- Es editable como cualquier flujo (nombre, días, tareas). Si alguien lo archiva o le borra las
  etapas, la próxima seña lo vuelve a crear activo con las etapas por defecto (o lo reactiva; el
  constructor decide cuál es más simple, mientras no queden dos activos).
- Si el módulo Proyectos está apagado en la institución, hoy `crearProyectosDelPedido` no crea
  nada. Se mantiene ese comportamiento: el pedido y la seña se registran igual, sin trabajo y sin
  tablero. Es una decisión del constructor que el Cobrador lo avise con un texto chico.

### Generación del trabajo

- En `planificarProyectos` / `crearProyectosDelPedido` (`lib/proyectos/crear.ts`), un ítem del
  pedido cuyo producto no tiene ninguna regla, y que vino marcado «para retirar» desde el
  Cobrador, genera **un** trabajo con el flujo estándar, con el nombre `«Producto» · Cliente`
  (misma plantilla por defecto que las reglas sin `nameTemplate`).
- La marca de «para retirar» tiene que sobrevivir en los ítems guardados del pedido para que la
  creación sea idempotente y para que la vista previa de "Confirmar pedido" de presupuestos **no**
  empiece a generar trabajos estándar para todo. Sólo el Cobrador la pone.

### Candado del saldo

- Regla única, en el servidor: **un trabajo atado a un pedido con saldo > 0 no puede entrar a una
  etapa de fase ENTREGADO ni cerrarse como terminado.** Saldo = total del pedido − cobros vigentes,
  con la misma cuenta que `lib/proyectos/en-curso.ts`; pedido cancelado = saldo 0.
- Se aplica en `moverEnTransaccion` y `cerrarEnTransaccion` (`lib/circuitos/recorridos.ts`) cuando
  el sujeto es un proyecto con `pedidoId`. Error en lenguaje simple: «El pedido N debe $X. Cobrá
  el saldo antes de entregar.»
- Los trabajos sin pedido (creados a mano sin pedido) no tienen candado.
- En la pantalla: la tarjeta del tablero «En curso» y la ficha del trabajo muestran
  «Retenido · debe $X» y el botón «Entregado» deshabilitado con ese motivo. En el Cobrador, al
  buscar el cliente, el pedido muestra «Debe $X · retenido hasta pagar».
- Al cobrar el saldo no se mueve nada solo: se libera, y alguien toca «Entregado».
- Actualizar las guías: `trabajos-retiro-y-saldo.ts` (hoy dice que se puede entregar con deuda) y
  `trabajos-tomar-con-sena.ts` (hoy dice que sólo los productos con proceso llevan seña).

### Stock apartado

- Al crear el pedido desde el Cobrador, cada línea del pedido con producto que controla stock
  escribe un `StockMovement` negativo con `reason = "PEDIDO"`, `sourceModule = "pedidos"`,
  `sourceRef = pedidoId` (y `variantId` si tiene talle). Hoy el stock sólo baja por la venta común.
- Al cancelar el pedido se escribe el movimiento inverso (`reason = "DEVOLUCION"`, mismo
  `sourceRef`), una sola vez.
- Que no se duplique si el alta del pedido se reintenta (clave del cobro).

## Decisiones tomadas tras la revisión (criterio de Claude, para que Daniel las revise)

1. **Qué líneas apartan stock:** sólo las que se marcan «Deja seña» y antes iban a la venta común
   (productos sin regla). Los productos con proceso siguen sin tocar el stock, como hoy, porque
   muchos son servicios (sesiones, álbumes) con `tracksStock` encendido de fábrica
   (`schema.prisma`, `Product.tracksStock`) que quedarían en negativo.
2. **Alta del pedido idempotente:** hoy un doble envío crea dos pedidos (`crearPedidoManual` no
   recibe clave). Se agrega una clave de alta al pedido (columna con único por workspace, la misma
   `clave` del Cobrador). Un reintento devuelve el pedido ya creado y no vuelve a apartar stock.
   El movimiento de stock además queda atado a `pedidoId` + línea.
3. **Cancelar un pedido:** vuelve el stock sólo de las líneas cuyo trabajo **no** llegó a la fase
   ENTREGADO. Lo que el cliente ya se llevó no se suma de nuevo.
4. **Combos:** si el producto o alguno de sus componentes tiene regla, se usan las reglas como
   hoy. El trabajo estándar sólo aparece cuando no se genera ningún trabajo por reglas.
5. **`cambiarDeCircuito` y el cambio en lote también tienen candado:** si el flujo destino deja el
   trabajo en una etapa de fase ENTREGADO (por ejemplo, un flujo de una sola etapa), se rechaza
   con el mismo mensaje. Lo mismo para cualquier otro camino que cambie la etapa (importación,
   lote de `lib/service-leads/lote.ts`).
6. **Nombre único del flujo** (`@@unique([workspaceId, name])`): se busca primero por
   `systemKey`. Si hay que crearlo y «Para retirar» ya existe sin la marca, se usa ese mismo
   flujo si es de clase TRABAJO, está activo y tiene etapas (se le pone la marca). Si no, se crea
   como «Para retirar (FOTOFFICE)». El alta del flujo nunca puede tumbar el pedido.
7. **Motivo `PEDIDO` en el stock:** se agrega a `STOCK_REASONS` (`lib/sales/constants.ts`) con su
   etiqueta («Apartado para pedido»), y se revisan las pantallas e informes que filtran por motivo.
8. **Talle y renglones a mano:** el `variantId` se pasa al ítem del pedido y al movimiento. Los
   renglones a mano (sin `productId`) con seña generan el trabajo estándar: hay que quitar el
   salteo de `productId` nulo en `planificarProyectos` / `proyectosDelPedido` **sólo** para los
   ítems marcados «para retirar».

## Restricciones

- Sin staging en FOTOFFICE: va directo a producción. La migración se aplica a mano y se registra
  con `resolve` (ver práctica del repo).
- Next.js de este repo tiene cambios: leer `node_modules/next/dist/docs/` antes de tocar rutas.
- Importes del Mostrador en centavos (`minor`); los del pedido, en pesos (`Decimal`).
- Pruebas con la base en memoria (`lib/circuitos/base-en-memoria.ts`), como las de `crear.test.ts`
  y `recorridos.test.ts`.

## Lo que queda a criterio del constructor

- La forma exacta del interruptor en el renglón del ticket.
- Cómo se guarda la marca «para retirar» en el ítem del pedido.
- Si el flujo estándar se reactiva o se recrea cuando lo archivan.
- El plazo por defecto de un producto sin regla.
