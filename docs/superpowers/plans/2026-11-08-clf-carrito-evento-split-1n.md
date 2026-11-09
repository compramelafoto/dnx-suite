# Carrito de evento con varios fotógrafos y un solo pago (Split 1:N) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un cliente elige fotos digitales de varios álbumes de un mismo evento, paga una sola vez con
tarjeta y Mercado Pago reparte en el momento a cada fotógrafo, organizador, referidores y plataforma.
Todo apagado por defecto.

**Architecture:** Módulo nuevo `apps/compramelafoto/lib/split-1n-carrito-evento/` que se apoya en el
piloto (`lib/split-1n-piloto/`): la elegibilidad por pedido es `evaluarElegibilidadPiloto`, el reparto
por pedido es `calcularRepartoPiloto`, y la suma por receptor y la distribución salen de helpers que se
extraen de `prepararCobro` (sin cambiar su resultado). Cada álbum sigue siendo un `Order`, creado por el
mismo código de `POST /api/a/[id]/orders` (movido a `lib/orders/pedido-album-handler.ts` con una opción
`carritoEvento` que corta antes de cualquier cobro). Los pedidos del grupo llevan en `pricingSnapshot`
la marca `split1nGrupo` (no la del piloto: `/pagar/[orderId]` y `pagarPedidoPiloto` no los ven).

**Tech Stack:** Next.js (app router, server actions), Prisma, `@repo/payments` (Orders API, Card
Payment Brick), `node:test` con `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-08-clf-carrito-evento-split-1n-design.md` (D1–D7).

## Global Constraints

- `DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED` distinto de `true` ⇒ nada cambia para nadie.
- Encendido por evento con `DNX_CLF_SPLIT_1N_CARRITO_EVENTO_IDS` (ids de `Event`, separados por coma).
- Además exige el piloto encendido (`DNX_CLF_SPLIT_1N_PILOTO_ENABLED=true`): usa su token, su owner y su
  mapa de receptores (`DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS`). No exige que los álbumes estén en
  `DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS`: el permiso viene del evento.
- `DNX_CLF_SPLIT_1N_MAX_RECEPTORES`: por defecto 10, contando la plataforma; se acota a [2, 11]
  (`MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS` = 10 socios + owner).
- Referencia externa: `clf-event-cart-<grupoId>`; `grupoId` = `crypto.randomUUID()`.
- Montos en pesos enteros (`totalCents` guarda pesos). Textos en español, "dinero", nunca "plata".
- Sin migraciones. Clickatón no se toca. El piloto de un álbum y el cobro normal no cambian de comportamiento.

## Review Focus

- Pagar el mismo pedido por dos caminos (álbum suelto y grupo): los pedidos del grupo no llevan la marca del
  piloto y el cobro normal no los reutiliza → test "un pedido de grupo no es del piloto".
- Doble clic / dos pestañas en `/pagar/grupo/<id>`: la reserva de todos los pedidos es una transacción todo o nada
  → test de `decidirReservaGrupo` / reserva.
- Aviso de Mercado Pago y página llegando a la vez, o un pedido que falló al confirmar: confirmación idempotente
  por pedido → test de `decidirFinalizacionGrupo` con pedidos mezclados PAID/PENDING.
- Un mismo usuario en dos roles o en varios pedidos (organizador referidor de un fotógrafo, fotógrafo con dos
  álbumes): una sola regla con la suma → test de suma por receptor.
- Foto de un autor distinto al dueño del álbum: no entra en el carrito (anti-objetivo "cobrar fotos de otro")
  → test `album_con_varios_autores`.

---

### Task 1: Configuración y marca de grupo

**Files:**
- Create: `apps/compramelafoto/lib/split-1n-carrito-evento/config.ts`
- Create: `apps/compramelafoto/lib/split-1n-carrito-evento/marca.ts`
- Test: `apps/compramelafoto/lib/split-1n-carrito-evento/carrito.test.ts`
- Modify: `apps/compramelafoto/package.json` (script `test:split-1n-piloto` también corre `carrito.test.ts`)

**Interfaces — Produces:**
- `CARRITO_FLAG = "DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED"`
- `type CarritoConfig = { enabled: boolean; eventIds: Set<number>; maxReceptores: number }`
- `resolveCarritoConfig(env?): CarritoConfig`
- `carritoActivoParaEvento(carrito: CarritoConfig, piloto: PilotoConfig, eventId: number | null): boolean`
- `type MarcaGrupo = { v: 1; grupoId: string; pedidos: number[]; estado: EstadoPiloto; providerOrderId?: string; intento?: number; cobro?: { referidorUserId: number | null; organizadorUserId: number | null; referidorOrganizadorUserId: number | null; reparto: RepartoPiloto } }`
- `leerMarcaGrupo(snapshot): MarcaGrupo | null`, `marcarSnapshotGrupo(snapshot, cambios): Record<string, unknown>` (clave `split1nGrupo`)
- `referenciaGrupo(grupoId)`, `grupoIdDesdeReferencia(ref): string | null` (sólo UUID), `claveIntentoGrupo(grupoId, intento)`
- `marcaComoPiloto(marca: MarcaGrupo): MarcaPiloto` (para reutilizar `registrarComisiones`)

- [ ] Tests: apagado sin la bandera; `"TRUE"` con espacios enciende; ids mal escritos se ignoran; máximo por
  defecto 10, `"50"` → 11, `"1"` → 2, `"x"` → 10; activo sólo con bandera + piloto encendido + evento en lista;
  la marca se agrega sin pisar `split1nPiloto` ni el resto; `leerMarcaPiloto` de un snapshot con sólo marca de
  grupo da `null`; referencia ida y vuelta; referencia del piloto (`clf-album-order-12`) no es de grupo.
- [ ] Correr `npm run test:split-1n-piloto` → falla; implementar; pasa. Commit.

### Task 2: Reparto y cobro de grupo (sin red)

**Files:**
- Modify: `apps/compramelafoto/lib/split-1n-piloto/cobro.ts` — extraer `partesDelPedido(reparto, receivers): ParteReparto[]` y `armarDistribucion({ totalPesos, plataformaPesos, partes })`; `prepararCobro` los usa y da exactamente lo mismo (los 59 tests del piloto lo prueban).
- Create: `apps/compramelafoto/lib/split-1n-carrito-evento/cobro-grupo.ts`
- Test: `carrito.test.ts`

**Interfaces — Produces:**
- `type ParteReparto = { rol: string; receptor: string; pesos: number }`
- `armarDistribucion(...)`: suma por receptor (el primero que aparece le da el `recipientId`; si el rol ya lo usa
  otro receptor, `rol_2`, `rol_3`…) y devuelve `{ total, distribution, partnerReceiverIds }`.
- `prepararCobroGrupo({ pedidos: PedidoDelGrupo[]; estadoGrupo: EstadoPiloto | null; payerEmail; correosReceptores; maxReceptores })`
  con `PedidoDelGrupo = { pedidoId; estadoPedido; totalPesos; feePesos; basePesos?; porcentajeOrganizador; receivers: ReceptoresCobro }`
  → `{ ok: true; repartos: Map<number, RepartoPiloto>; total; distribution; partnerReceiverIds; receptores: number }`
  o `{ ok: false; codigo: "GRUPO_VACIO" | "YA_PAGADO" | "ORDEN_EN_CURSO" | "PAGADOR_ES_RECEPTOR" | "DEMASIADOS_RECEPTORES" }`.
- `contarReceptores(receivers: ReceptoresPiloto[]): number` (distintos + plataforma).

- [ ] Tests con el ejemplo del diseño: 3 fotos de A ($10.350 de total, recargo $1.350, base $9.000) y 2 de B
  ($6.900, $900, $6.000), organizador 20 %, sin referidores → A 7.200, B 4.800, organizador 3.000, plataforma
  2.250, total 17.250 en centavos; el organizador aparece una sola vez con 3.000; fotógrafo con dos álbumes cobra
  la suma en una regla; organizador que además es referidor de B → una regla; con referidores de A y del
  organizador los montos coinciden con `calcularRepartoPiloto` pedido por pedido; 11 receptores con máximo 10 →
  `DEMASIADOS_RECEPTORES`; un pedido `PAID` → `YA_PAGADO`; estado de grupo `COBRANDO` → `ORDEN_EN_CURSO`;
  pagador receptor → `PAGADOR_ES_RECEPTOR`; la distribución suma el total.
- [ ] Rojo → implementar → verde (incluidos los 59 del piloto). Commit.

### Task 3: Elegibilidad de grupo (todo o nada) y decisión de confirmación

**Files:**
- Create: `apps/compramelafoto/lib/split-1n-carrito-evento/elegibilidad-grupo.ts`
- Create: `apps/compramelafoto/lib/split-1n-carrito-evento/decidir-grupo.ts`
- Test: `carrito.test.ts`

**Interfaces — Produces:**
- `evaluarElegibilidadGrupo({ piloto: PilotoConfig; carrito: CarritoConfig; eventId: number; albumes: AlbumDelCarrito[] })`
  con `AlbumDelCarrito = Omit<ElegibilidadInput, "config"> & { eventId: number | null; autoresDeFotos: Array<number | null> }`
  → `{ ok: true; receivers: Map<albumId, ReceptoresPiloto>; receptores: number }` o
  `{ ok: false; motivos: Array<{ albumId: number | null; motivo: string }> }`. Llama a
  `evaluarElegibilidadPiloto` con `{ ...piloto, albumIds: new Set([albumId]) }` (no duplica reglas). Motivos
  propios: `carrito_apagado`, `carrito_vacio`, `album_de_otro_evento`, `album_con_varios_autores`,
  `demasiados_receptores`.
- `decidirFinalizacionGrupo({ grupoId; refGrupoId; mpStatus; mpStatusDetail; pedidos: Array<{ id; status }> })`
  → `{ accion: "referencia_distinta" | "no_acreditada" | "confirmar"; aConfirmar: number[]; yaPagados: number[] }`
  (`aConfirmar` = PENDING|FAILED; con orden no acreditada nunca confirma).

- [ ] Tests: carrito apagado no deja pasar nada; un álbum sin consentimiento hace caer a todo el grupo (y el motivo
  dice cuál); álbum de otro evento; foto de otro autor; álbum escolar; tope de receptores; dos álbumes
  elegibles devuelven los receptores de cada uno sin necesitar `PILOTO_ALBUM_IDS`; decisión: referencia de otro
  grupo, no acreditada, mezcla PAID/PENDING/FAILED → confirma sólo los pendientes, todos pagados → `aConfirmar` vacío.
- [ ] Rojo → verde. Commit.

### Task 4: Pedidos del carrito (handler de pedidos con modo carrito) y API del evento

**Files:**
- Create: `apps/compramelafoto/lib/orders/pedido-album-handler.ts` — el cuerpo actual de `POST` movido tal cual como
  `manejarPedidoAlbum(req, albumId, opciones?: { carritoEvento?: boolean })`.
- Modify: `apps/compramelafoto/app/api/a/[id]/orders/route.ts` — `POST` sólo parsea el id y delega.
- Create: `apps/compramelafoto/lib/split-1n-carrito-evento/crear.ts` — `cotizarCarrito`, `crearCarritoEvento`.
- Create: `apps/compramelafoto/app/api/public/events/[shareSlug]/carrito/route.ts` — `POST`.

En modo `carritoEvento` (y sólo ahí): álbum de demostración → 409 `ALBUM_DEMO`; no reutiliza pedidos recientes; ignora
canje, videos y packs; devuelve `{ id, totalCents, carritoEvento: true }` justo después de la auditoría de términos,
antes del pago simulado, el piloto y Checkout Pro (no crea preferencia).

`POST /api/public/events/[shareSlug]/carrito` body `{ accion: "cotizar" | "comprar", fotos: number[], buyerEmail, buyerName, buyerPhone, termsAccepted }`:
404 si el carrito no está activo para el evento. Agrupa las fotos por álbum (sólo álbumes públicos del evento),
evalúa el grupo **antes** de crear pedidos. Si no es elegible → `{ modo: "por_album", albumes: [{ albumId, fotografo, url: "/a/<id>/comprar?photoIds=…" }] }`.
`cotizar` → `{ modo: "grupo", total, porFotografo: [...] }` usando `computeCheckoutTotals` (sin crear nada).
`comprar` → crea un pedido por álbum con `manejarPedidoAlbum(..., { carritoEvento: true })`, les pone la marca de
grupo `PENDIENTE` y devuelve `{ modo: "grupo", url: "/pagar/grupo/<grupoId>" }`. Si falla la creación de alguno,
los ya creados pasan a `FAILED` y se responde error (nunca un grupo incompleto).

- [ ] `tsc` limpio sobre los archivos tocados; los tests de pagos (`npm run test:payments`) siguen verdes. Commit.

### Task 5: Cobro, confirmación, aviso y correo del grupo

**Files:**
- Modify: `apps/compramelafoto/lib/split-1n-piloto/finalizar.ts` — extraer `confirmarPedidoPagado(...)` (entrega ya
  hecha → `updateMany` condicionado → auditoría, comisiones, avisos, `webhookEvent`) con parámetros para la marca
  final y `omitirComprobanteComprador`; exportar `registrarComisiones`. `finalizarPedidoPiloto` queda igual por fuera.
- Modify: `apps/compramelafoto/lib/mercadopago/finalize-album-order-mp-approved.ts` — `runAlbumOrderPaidSideEffects`
  acepta `omitirComprobanteComprador?: boolean` (por defecto `false`: nada cambia).
- Create: `lib/split-1n-carrito-evento/cargar.ts` (`cargarGrupo(grupoId)` por `pricingSnapshot.split1nGrupo.grupoId`),
  `pagar-grupo.ts` (`"use server"`, `pagarGrupo({ grupoId, cardPayment })`), `finalizar-grupo.ts`
  (`finalizarGrupo({ grupoId, providerOrderId })`), `correo.ts` (`armarComprobanteGrupo` puro +
  `encolarComprobanteGrupo(grupoId)`, clave `order_confirmed_event_cart_<grupoId>`).
- Modify: `lib/split-1n-piloto/webhook.ts` — si la referencia es de grupo, `finalizarGrupo`.
- Modify: `lib/cron/reencolar-confirmaciones-pedido.ts` — los pedidos con marca de grupo no reciben el comprobante
  por pedido; se asegura el del grupo.

`pagarGrupo`: vuelve a evaluar el grupo; consentimientos `ACTIVE`; pagador ≠ receptor; `prepararCobroGrupo`; reserva
todos los pedidos `PENDIENTE → COBRANDO` en una transacción (si uno no pasa, ninguno); `createSplitOrder` con
`clf-event-cart-<grupoId>` y clave `…-<intento>`; mismo manejo de rechazo / incierto / en revisión que el piloto.
`finalizarGrupo`: GET de la orden, `decidirFinalizacionGrupo`, `ensureDigitalDelivery` de todos los pendientes,
después `confirmarPedidoPagado` de cada uno (mismo `mpPaymentId`), comisiones re-aseguradas en los ya pagados, y el
correo único del grupo.

- [ ] Tests de `armarComprobanteGrupo` (un enlace por fotógrafo, total en pesos, sin "plata") y del filtro del cron.
- [ ] Rojo → verde; piloto, pagos y bot verdes. Commit.

### Task 6: Pantallas

**Files:**
- Create: `app/pagar/grupo/[grupoId]/page.tsx` (404 si el carrito no está activo para el evento; conciliación al
  visitar; con todo pagado muestra un botón de descarga por fotógrafo: es el centro de descargas del grupo).
- Modify: `app/pagar/[orderId]/PagarClient.tsx` — prop opcional `grupoId`: si está, llama a `pagarGrupo`.
- Modify: `app/e/[shareSlug]/page.tsx` y `EventGallery.tsx` — calculan y pasan `carritoEvento` sólo si está activo.
- Modify: `app/g/[shareSlug]/EventGalleryGrid.tsx` — prop opcional `carritoEvento?: { shareSlug: string }`; si está,
  el resumen de la selección muestra `CarritoEventoResumen` (fotos por fotógrafo, total cotizado, datos del
  comprador una vez, "Pagar").
- Create: `app/g/[shareSlug]/CarritoEventoResumen.tsx`.

- [ ] Sin la prop todo se ve igual que hoy. `tsc` real (con memoria extra, verificando que chequea). Commit.

### Task 7: Documentación, verificación y PR

- [ ] `docs/payments/mp-split-1n-plan-implementacion.md` §10: sección del carrito de evento (cómo se enciende, qué
  falta: compra real de prueba, preguntas a Mercado Pago).
- [ ] `npm run test:split-1n-piloto`, `npm run test:payments`, `npm run test:bot`,
  `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (confirmar que corre de verdad).
- [ ] Revisión final con subagente (opus); corregir; PR a `main`.
