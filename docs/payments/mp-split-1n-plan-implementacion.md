# Split 1:N — Plan de implementación de la app centralizada

**Fecha:** 2026-09-03
**Estado:** **CONGELADO — a la espera de Mercado Pago.** Nada de esto se ejecuta todavía.
**Decisión que lo origina:** [`mp-split-1n-mercadopago-confirmations.md`](./mp-split-1n-mercadopago-confirmations.md)

> **Actualización 2026-11-08.**
>
> - **Homologación cerrada de nuestro lado.** La orden productiva de cierre se hizo y se
>   reembolsó (ver [runbook](./mp-split-1n-runbook-cierre-homologacion.md)); el Order ID se
>   envió a Mercado Pago.
> - **Clickatón queda fuera.** Por decisión de Daniel, sobre Clickatón no se hace **ninguna**
>   modificación: ni código, ni merge, ni deploy, ni configuración, y **no se le aplica el
>   Split 1:N**. No es una plataforma que se siga usando por el momento. La §6.1 queda como
>   registro histórico, no como tarea.
> - **Orden de adopción:** Comprame la Foto con un solo álbum piloto → organizadores de
>   eventos en CLF → FOTOFFICE, si corresponde.

Este documento existe para que, el día que llegue el OK de Mercado Pago, la implementación
sea ejecutar una lista y no volver a razonar la arquitectura.

---

## 1. Qué destraba el arranque

No se toca **nada** hasta tener las tres respuestas pendientes del ticket:

**Actualizado el 2026-09-03: casi todo destrabado.**

| # | Pendiente | Estado | Bloquea |
|---|---|---|---|
| 1 | Renombrar la app → "DNX Suite" | ✅ **RESUELTO.** Sin impacto: el tracking de MP es por ID de aplicación, que no cambia | — |
| 2 | La homologación cubre a todos los productos | ✅ **RESUELTO.** Las homologaciones son por cuenta + aplicación; MP registra la cuenta y la app DNX Suite | — |
| 3 | Varias notification URLs en la misma app | ⚠️ **RESUELTO POR DESCARTE.** No se puede declarar más de una en el panel. Queda **una sola URL + ruteo interno**. MP consulta si `notification_url` puede ir por request, porque cree que **está deshabilitado en Orders** | Detalle de §5.1 |
| 4 | **Checklist de homologación adaptado a Split 1:N** | ✅ **RECIBIDO 2026-09-03.** Auditado en [`mp-split-1n-checklist-oficial-auditoria.md`](./mp-split-1n-checklist-oficial-auditoria.md) — quedan 3 bloqueantes, ver ahí | Cierre de homologación |
| 5 | Contrastar `external_reference` contra la captura de estructura que envió MP | ⏳ Nuestro | Nada — nuestra convención ya evita PII |

**Las fases 1, 2 y 3 ya pueden ejecutarse.** Lo único que sigue esperando a Mercado Pago es el
cierre de la homologación (checklist) y el detalle de cómo mandar la notification URL.

Hay además una deuda propia, que **no depende de Mercado Pago** y conviene saldar primero:
portar el trabajo del webhook `order` que quedó en una rama. Ver §2.b.

---

## 2. Principios que no se negocian

Están ya implementados y el plan no debe erosionarlos:

- **Fail-closed.** Escrituras productivas bloqueadas mientras `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` ≠ `true`.
- **`GET /v1/orders/{id}` es la fuente de verdad.** El webhook dispara la reconciliación; no confirma estado. Confirmado por MP el 2026-08-26.
- **Tópico de webhook: sólo `order`.** `payment` queda para Checkout Pro.
- **`external_reference` sin PII.** `buildOpaqueExternalReference()` rechaza email, nombre y apellido, teléfono y documento. No relajar esa validación.
- **El guard de FotoOffice es una constante, no un env.** Un env mal seteado no puede encender split por accidente.
- **Los montos y la elegibilidad se reconstruyen del lado del servidor.** Nunca se confía en el importe que manda el browser.

---

## 2.b Deuda previa: trabajo del webhook que nunca llegó a `main` — ✅ SALDADA

> **Portado a `main` el 2026-09-03.** El endpoint receptor de CLF y las dos correcciones
> fail-closed ya están en el árbol principal, con tests en verde. Detalle en
> [`mp-split-1n-checklist-oficial-auditoria.md`](./mp-split-1n-checklist-oficial-auditoria.md) §8.
> Lo que sigue queda como registro de por qué hubo que hacerlo.

**Verificado el 2026-09-03.** El commit `65f4e663` (2026-08-26) "recibir el webhook `order` de
Mercado Pago para la homologación" vive **sólo** en la rama `feat/clf-mp-webhook-order-v2`.
Existe una v1 hermana, `feat/clf-mp-webhook-order` (`4f5fbdbd`), con la misma punta sobre otra
historia. **Ninguna de las dos está en `main`.**

### Qué aporta que `main` hoy no tiene

| Aporte | Por qué importa |
|---|---|
| `apps/compramelafoto/app/api/webhooks/dnx-payments/route.ts` | Es el endpoint que recibe el webhook `order` en CLF, que es donde vive la superficie de homologación. **Sin esto no se puede hacer la prueba punta a punta que le prometimos a MP.** En `main` sólo Clickatón tiene ese endpoint |
| Corrección fail-closed en el reintento de webhook | Un reintento duplicado cortaba antes del `GET` y asumía `APPROVED`: acreditaba sin confirmar el estado real |
| Corrección `GET_ORDER_NOT_CONFIGURED` | Sin callback de `GET` configurado, el pipeline devolvía "processed" con cero discrepancias y auditaba `SUCCEEDED`. Un no-op que parecía éxito y que en una corrida de evidencia se habría leído como validación |
| `docs/payments/mp-split-1n-webhook-order-live-test.md` | El protocolo de la prueba live |

Las dos correcciones son de **seguridad**, no cosméticas: ambas hacían que algo sin verificar
pareciera verificado. Verificado que `GET_ORDER_NOT_CONFIGURED` no existe en `main`.

### Cómo tratarlo

**No mergear la rama.** Está muy atrasada respecto de `main` (más de mil archivos de
diferencia), así que un merge traería regresiones. Corresponde **portar los cambios** en un
trabajo propio, antes o en paralelo a la Fase 1.

**Ojo con un conflicto de nombre:** esa rama trae su propia versión de
`docs/payments/mp-split-1n-mercadopago-confirmations.md` (189 líneas, fechada 2026-08-26), que
ocupa el mismo path que el doc actual. La de la rama quedó **superada** en lo que respecta a la
arquitectura de aplicaciones —la daba como `PENDING`— pero es **más rica** en dos cosas que
conviene rescatar: la auditoría de `category_id` y el gap analysis de señales antifraude para la
industria "Aplicaciones y plataformas online". Al portar, fusionar contenidos; no pisar uno con
el otro.

---

## 3. Fase 1 — Panel de Mercado Pago

**Ya está destrabada** (§1, puntos 1 a 3).

1. Renombrar la aplicación: **"Comprame la Foto" → "DNX Suite"**. El `client_id` / app_id no cambia, y MP confirmó que su tracking va por ese ID: el renombre no tiene impacto.
2. Declarar las redirect URIs de cada producto en esa app.
3. Declarar **una única** notification URL — no se admite más de una. Elegir el host más estable (§5.1).
4. Suscribir **únicamente** el tópico `order`.
5. Separar credenciales TEST y PROD.
6. Cerrar el pedido de habilitación abierto por la app de FotoOffice (`5350262556971123`).
   No se abren los de Clickatón ni FotoRank.

**No se crean aplicaciones nuevas.** Ese es el punto de todo el cambio.

---

## 4. Fase 2 — Credenciales y variables de entorno

### Inventario actual del flujo Split (sandbox)

| Variable | Uso |
|---|---|
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Token del flujo Orders 1:N |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | Card Payment Brick |
| `MERCADOPAGO_TEST_OWNER_USER_ID` | Owner/collector de la Order (numérico) |
| `MERCADOPAGO_TEST_PARTNER_EMAIL` / `_2` | Cuentas TEST de partners |
| `MERCADOPAGO_TEST_PARTNER_RECEIVER_ID` / `_2` | Receivers con consentimiento ACTIVE |
| `MERCADOPAGO_TEST_DEVICE_ID`, `MERCADOPAGO_TEST_PAYMENT_TOKEN` | Fixtures de smoke |
| `DNX_PAYMENTS_WEBHOOK_SECRET`, `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` | Webhook firmado |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | Vault de credenciales |

### Flags de control

| Flag | Función | Estado destino |
|---|---|---|
| `DNX_MP_ORDERS_1N_STAGING_ENABLED` | Habilita Orders 1:N en staging | `true` sólo en staging |
| `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | **Escrituras productivas** | `false` hasta cierre de homologación |
| `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` | Observación de webhooks | `true` para la prueba punta a punta |
| `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` | Invitaciones de consentimiento en PROD | `false` hasta tener receptores reales |
| `DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED` | Superficie de homologación en CLF | `true` sólo mientras dure |
| `DNX_CONFIRM_STAGING`, `DNX_CONFIRM_ORDERS_TEST` | Confirmaciones explícitas de escritura | Sin cambios |

### Qué hacer

Las variables del flujo Split pasan a ser **de plataforma, no de producto**. Hoy ya lo son de
hecho (`MERCADOPAGO_TEST_*` es un juego único), así que el trabajo es sobre todo **no
crear** variantes por producto al sumar FotoOffice, Clickatón y FotoRank.

**No se tocan** las de Checkout Pro, que siguen siendo por producto y por aplicación:
`MP_ACCESS_TOKEN` (CLF), `FOTORANK_MP_ACCESS_TOKEN`, las de cursos de FotoOffice y las
`CLICKATON_MP_*` del OAuth owner ya construido.

> Si al implementar se decide renombrar el juego del flujo nuevo a un prefijo explícito
> (`DNX_PAYMENTS_MP_*`), hacerlo **en un cambio aparte** del resto del plan, para que un
> problema de credenciales no se mezcle con un problema de arquitectura.

---

## 5. Fase 3 — Cambios de código

Todos son de bajo riesgo y ninguno abre cobros.

| # | Cambio | Archivo | Riesgo |
|---|---|---|---|
| 1 | ~~Eliminar `integratorId`~~ | — | ✅ **HECHO 2026-09-03.** `integration_data` salió del payload |
| 2 | Evaluar `category_id: "virtual_goods"` en lugar de `"others"` | `providers/mercado-pago/orders/order-items.ts` y los consumidores que hoy pasan `"others"` | Bajo — es sugerencia de MP, no requisito |
| 3 | Ruteo de webhook por producto | Diseño decidido (§5.1); falta elegir el host | Medio |
| 4 | Reactivar el guard de FotoOffice | `apps/fotoffice/lib/payments/split-1n.ts` + su test | Ver §6.2 |
| 5 | ~~Datos ampliados del pagador~~ | — | ✅ **HECHO 2026-09-03.** `orders/payer-profile.ts`, opcional por producto |

**No hace falta tocar** `buildOpaqueExternalReference()`, `DnxPaymentIntent.sourceProduct`, el
índice único de `DnxSplitConsent` ni `createMercadoPagoProviderConfig()`. Ya soportan el
esquema centralizado.

### 5.1 Ruteo del webhook — DECIDIDO (2026-09-03)

MP confirmó que **no se puede declarar más de una notification URL en el panel**, y que el
parámetro `notification_url` por request estaría **deshabilitado en Orders** (lo están
verificando). Entonces:

**Un endpoint receptor único para toda la suite, con ruteo interno por producto.**

La secuencia, que no cambia respecto de lo ya validado:

```
webhook (trae sólo data.id)
  → GET /v1/orders/{id}          ← fuente de verdad
  → leer external_reference       ← de la Order, NO del body de la notificación
  → derivar sourceProduct del prefijo
  → despachar al producto correspondiente
```

Consecuencias de diseño que hay que asumir explícitamente:

| Consecuencia | Detalle |
|---|---|
| El endpoint es **cross-producto** | Una Order creada por Clickatón notifica a una URL que puede vivir en el dominio de otro producto. El receptor debe poder reconciliar Orders de **cualquier** producto |
| Técnicamente funciona | Es una sola app, una sola cuenta y un solo token: el `GET` resuelve cualquier Order de esa cuenta |
| Hay que elegir **dónde vive** ese endpoint | Conviene el host más estable, no el del producto que más cambia. Decisión pendiente al implementar |
| El **webhook secret es compartido** | Rotarlo afecta a todos los productos a la vez: coordinar, no rotar de a uno |
| Si un producto está caído, no se pierde el evento | El `GET` de reconciliación sigue siendo la red: el webhook nunca fue la fuente de verdad |

> **Efecto lateral bueno:** desaparece el cruce de cuentas que complicó la prueba de agosto
> —un webhook registrado en la app de CLF apuntando a Clickatón staging, que usaba el token de
> otra cuenta de prueba, con lo cual el `GET` devolvía "Order not found"—. Con una sola app y
> una sola cuenta, ese problema no puede reproducirse.

Hoy sólo Clickatón expone `apps/clickaton/app/api/webhooks/dnx-payments/route.ts`; el de CLF
está en la rama sin portar (§2.b).

---

## 6. Fase 4 — Alta de cada producto

Un producto está listo para Split 1:N cuando cumple estos cinco puntos. No alcanza con
"conectar" el paquete.

| # | Requisito |
|---|---|
| 1 | Depende de `@repo/payments` |
| 2 | Tiene definido el acuerdo económico: quién es owner y qué porcentaje va a cada receptor |
| 3 | Sus receptores tienen consentimiento **ACTIVE** antes de crear la Order |
| 4 | Expone (o comparte) el endpoint de webhook y lo tiene declarado |
| 5 | Genera `external_reference` con su prefijo vía `buildOpaqueExternalReference()` |

### 6.1 Clickatón — FUERA DE ALCANCE (decisión 2026-11-08)

**No se toca.** Ni código, ni merge, ni deploy, ni configuración, ni Split 1:N. Lo que sigue
describe el estado al 2026-09-03 y se conserva sólo como registro. Si un cambio en un
paquete compartido (`packages/payments`, `packages/db`) afectara a Clickatón, se avisa; no se
adapta ni se prueba Clickatón por eso.

El más avanzado: ya consume el paquete, tiene el bridge de Orders 1:N, el endpoint de
webhook y el collector configurado (`providerUserId 97484805`, PA `pa_ba733fa7a35f4326`).

Le falta apuntar al token de la app centralizada y encender los flags. Cuando se haga,
**revisar si el OAuth owner sigue teniendo sentido**: conecta por OAuth la misma cuenta que
es dueña de la aplicación, es decir, la cuenta se conecta a sí misma. Funciona, pero es un
rodeo. Simplificarlo es opcional y va en un cambio aparte.

### 6.2 FotoOffice

**El guard sigue activo y no se levanta con este plan.** Lo que cambió es que desapareció el
obstáculo administrativo, no el motivo de fondo: FotoOffice todavía no tiene un caso
productivo que requiera repartir un cobro entre varios destinatarios.

Cuando exista ese caso, la secuencia es:

1. Definir el caso de negocio (punto 2 de la tabla de arriba).
2. `FOTOFFICE_SPLIT_1N_ENABLED = true` y actualizar `lib/payments/split-1n.test.ts`.
3. Agregar `@repo/payments` a las dependencias de la app.
4. Gestionar los consentimientos de los receptores.

Usa la app centralizada, **no** la suya (`5350262556971123`).

### 6.3 FotoRank

**Hoy no necesita Split 1:N.** Organizador y receptor son la misma cuenta, así que cobra con
Checkout Pro sin split. Adoptar split ahí es una decisión de negocio —que aparezcan
receptores de terceros—, no un trabajo de cableado. Mientras no exista, no se toca.

---

## 7. Fase 5 — Verificación

Antes de declarar nada terminado:

1. **Preflight de sandbox** — `packages/payments/src/sandbox/preflight.ts` valida presencia y formato de las credenciales TEST.
2. **Smoke de Orders 1:N** — creación con owner + 2 partners, estado `processed / accredited`, `GET` de reconciliación.
3. **Refunds** — total y parcial, con idempotencia.
4. **Webhook punta a punta** — con el endpoint público registrado. El endpoint receptor ya está en `main` (§2.b). Si aparece una notificación esperada que no llega, reportar el `order_id` a MP (pendiente comprometido en el ticket).
5. **Trazabilidad** — que cada Order de prueba se pueda atribuir a su producto sólo por el `external_reference`.
6. **Producción sigue apagada** — `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` ≠ `true` al terminar.

---

## 8. Rollback

El cambio es de configuración, así que revertir es barato:

| Si falla… | Se revierte… |
|---|---|
| El renombre de la app | Se vuelve al nombre anterior; el `client_id` nunca cambió |
| La habilitación no cubre a otro producto | Se pide habilitación para la app de ese producto y se vuelve al esquema multi-app. El código soporta ambos: el `accessToken` se inyecta por app |
| El webhook compartido | Se separa en endpoints por producto |

**Lo único con costo de vuelta atrás son los tiempos de habilitación de MP.** Por eso el
plan no crea aplicaciones nuevas: no hay nada que deshacer del lado de ellos.

---

## 9. Lo que este plan NO toca

- Checkout Pro de Comprame la Foto (`marketplace_fee`), en producción.
- Checkout Pro de cursos presenciales de FotoOffice.
- Checkout Pro de FotoRank.
- Inscripciones de Clickatón, mientras `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED` siga en `false`.
- La consecuencia contable de Split 1:N (en Checkout Pro el cobrador es el receptor; en 1:N es la plataforma). **Lo determina el flujo, no la app.** Revisarlo con el contador antes de operar volumen.

---

## 10. Piloto en un álbum de CLF (2026-11-08)

Primer uso real del Split 1:N en el cobro de Comprame la Foto. Código en
`apps/compramelafoto/lib/split-1n-piloto/` y la página `app/pagar/[orderId]`. Plan:
`docs/superpowers/plans/2026-11-08-clf-split-1n-piloto-album.md`.

**Qué hace.** Un pedido de un álbum de la lista, con sólo fotos digitales y cuyo fotógrafo (y
referidor, si tiene) aceptó el consentimiento, no va a Checkout Pro: la ruta de pedidos lo marca
(`pricingSnapshot.split1nPiloto`) y lo manda a `/pagar/<id>`, donde se paga con el Card Payment
Brick. El servidor crea la orden con el token de la plataforma, montos fijos y
`external_reference = clf-album-order-<id>`: el fotógrafo cobra el precio, el 15 % de recargo se
reparte mitad referidor y mitad plataforma. Con la orden acreditada, el pedido queda `PAID` con la
misma entrega y avisos que Checkout Pro, y la comisión del referidor nace **pagada**
(`ReferralEarning.paidOutAt`) porque Mercado Pago ya se la depositó. El aviso `order` que llega a
`/api/webhooks/dnx-payments` confirma igual si el comprador cerró la página.

**Todo lo demás no cambia:** otros álbumes, carritos con impresiones o videos, canjes y demos
siguen con Checkout Pro. Un error del piloto nunca frena una venta: cae al cobro de siempre.

**Variables (Vercel, proyecto de CLF, Production):**

| Variable | Valor |
|---|---|
| `DNX_CLF_SPLIT_1N_PILOTO_ENABLED` | `true` para encender, cualquier otra cosa apaga |
| `DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS` | ids de álbum separados por coma |
| `DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS` | `userId:receiverId` separados por coma (el `receiver_id` lo da `prod-split-consent-invite.ts`) |
| `DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID` | `97484805` |
| `DNX_MP_PLATFORM_ACCESS_TOKEN` | token productivo de la app DNX Suite |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | public key productiva de DNX Suite |

**Apagar:** `DNX_CLF_SPLIT_1N_PILOTO_ENABLED` distinto de `true`. Los pedidos ya pagados no se
tocan; los pendientes del piloto dan 404 en `/pagar` y el comprador vuelve a empezar.

**Reembolso (a mano por ahora):** `POST /v1/orders/{id}/refund` con cuerpo vacío y
`X-Idempotency-Key`, con el token de la plataforma. El Order ID está en
`pricingSnapshot.split1nPiloto.providerOrderId` del pedido. Después, marcar el pedido como
corresponda en el panel.

**Etapa 2 — organizadores (plan `docs/superpowers/plans/2026-11-08-clf-split-1n-piloto-organizador.md`).**
Un álbum de un evento entra al piloto si el organizador (`Event.creatorId`) y su referidor del
programa de organizadores, cuando tienen parte, están en `DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS`.
Reparto con `base = total − recargo`: organizador `round(base × %)`, fotógrafo `base − organizador`,
referidor del fotógrafo 50 % del recargo, referidor del organizador 20 % del recargo, plataforma el
resto. Al confirmar, la comisión del organizador queda `PAID_DIRECT_TO_ORGANIZER` (no suma a su
saldo de retiro) y las de los referidores que cobraron por el split nacen pagadas. Quedan fuera:
eventos al 100 %, álbumes escolares, impresiones, videos y preventas. Si una cuenta cumple dos
roles, va una sola vez en la orden con la suma.

**Clickatón no participa** (ver la nota al principio de este documento).

### 10.1 Carrito de evento: varios fotógrafos, un solo pago (construido APAGADO)

Diseño: `docs/superpowers/specs/2026-11-08-clf-carrito-evento-split-1n-design.md` (D1–D7). Plan:
`docs/superpowers/plans/2026-11-08-clf-carrito-evento-split-1n.md`. Código en
`apps/compramelafoto/lib/split-1n-carrito-evento/`, la ruta `POST /api/public/events/[shareSlug]/carrito`
y la página `app/pagar/grupo/[grupoId]`.

**Qué hace (encendido).** En la galería del evento (`/e/<shareSlug>`), las fotos elegidas de
varios álbumes se pagan juntas. Se crea un `Order` por álbum con la ruta de pedidos de siempre
(cortada antes de cualquier cobro) y todos llevan `pricingSnapshot.split1nGrupo` con el mismo
`grupoId`. Una sola orden de Mercado Pago (`external_reference = clf-event-cart-<grupoId>`) reparte:
cada pedido con `calcularRepartoPiloto` y después sumado por cuenta (el organizador y quien aparece
en varios pedidos van una sola vez con la suma). Todo o nada: si un álbum no puede (sin
consentimiento, escolar, foto de otro autor, demasiados receptores), no se crea nada y se ofrece
pagar cada álbum por separado. Al acreditarse, cada pedido pasa a `PAID` con sus comisiones como en
el piloto y el comprador recibe **un solo** correo con el enlace a `/pagar/grupo/<grupoId>`, que ya
pagado muestra las descargas de cada fotógrafo. El aviso `order` y la visita a la página confirman
igual (idempotente por pedido).

**Variables (además de las del piloto, que tiene que estar encendido):**

| Variable | Valor |
|---|---|
| `DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED` | `true` para encender; ausente o cualquier otra cosa apaga |
| `DNX_CLF_SPLIT_1N_CARRITO_EVENTO_IDS` | ids de `Event` separados por coma |
| `DNX_CLF_SPLIT_1N_MAX_RECEPTORES` | tope de cuentas por orden contando la plataforma; por defecto 10, se acota a 2–11 |

Los fotógrafos, referidores y organizador tienen que estar en `DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS`;
los álbumes **no** necesitan estar en `DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS` (el permiso es por evento).

**Apagado (estado actual):** la galería sigue llevando a cada álbum, la ruta del carrito y
`/pagar/grupo/*` dan 404, y la ruta de pedidos de álbum se comporta igual que antes.

**Antes de encender el primer evento:** una compra real de prueba (dos fotógrafos y organizador)
con reembolso, y preguntar a Mercado Pago el máximo de receptores por orden y si acepta dinero en
cuenta y tarjetas del exterior en Split 1:N.

**Reembolso:** total, igual que el piloto (`POST /v1/orders/{id}/refund`); el Order ID está en
`pricingSnapshot.split1nGrupo.providerOrderId` de cualquier pedido del grupo, y hay que marcar
todos los pedidos del grupo. Reembolso parcial (una foto): fuera de alcance, a mano.

**Protecciones contra el cobro doble fuera del carrito:** los pedidos del grupo no tienen la marca
del piloto (`/pagar/<id>` da 404), la ruta de pedidos no los reutiliza, `create-preference` y el
reintento de pago los rechazan, y el aviso de "pedido abandonado" los saltea. Si un grupo cobrado
no se puede confirmar, `/api/webhooks/dnx-payments` responde 503 para que Mercado Pago reintente;
la página del grupo concilia en cada visita y sigue andando aunque el carrito se apague.

**Pendientes conocidos (antes de encender):**
- No hay conciliación programada de grupos trabados (`COBRANDO`/`EN_REVISION`): hoy dependen del
  aviso de Mercado Pago y de la visita a la página. Si Mercado Pago rechaza un pago que estaba en
  revisión, el grupo queda trabado y se destraba a mano.
- El filtro por `pricingSnapshot.split1nGrupo` no tiene índice; con volumen conviene una columna.
- El comprobante es uno por grupo; la entrega por WhatsApp y el correo de "ZIP listo" siguen
  saliendo por pedido.
- Los mismos huecos de `create-preference`, reintento y "pedido abandonado" existen para pedidos
  del piloto de un álbum (no se tocaron acá).
