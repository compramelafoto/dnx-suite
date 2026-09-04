# Mercado Pago — Split 1:N: confirmaciones y arquitectura de aplicaciones

**Fecha de la definición:** 2026-08-31 (arquitectura) · 2026-09-03 (confirmaciones de ejecución)
**Fuente:** respuestas del área técnica de Mercado Pago (Marilyn) al pedido abierto el 2026-08-26
**Estado:** **RESUELTO** — reemplaza a `PENDING` en los docs que apuntaban acá
**Alcance:** flujo **Checkout API + Orders API + Split 1:N**. No toca Checkout Pro.

---

## 1. Lo que confirmó Mercado Pago

### 1.a Arquitectura (2026-08-31)

| Pregunta | Respuesta |
|---|---|
| ¿Una sola aplicación puede representar a todos los productos de la suite? | **Sí.** No hay restricción técnica para centralizar Comprame la Foto, FotoOffice, Clickatón y FotoRank bajo una misma aplicación homologada |
| ¿Dónde vive la vinculación del partner (consentimiento)? | **A nivel de cuenta / collector, no de aplicación.** El `app_id` con el que se crean las Orders es indistinto para ese proceso |
| ¿Cómo se identifica el producto de origen de cada Order? | Con **`external_reference`**, manteniendo prefijo por producto. Alcanza incluso para reportes |
| ¿Sirve `integrator_id` como agrupador? | **No.** MP lo descartó: identifica al integrador / software provider, no agrupa productos de una misma cuenta |
| ¿Afecta a Checkout Pro? | **No.** En Checkout Pro la vinculación **sí** es por aplicación (cada app con su `client_id` / `client_secret`). Se mantiene como está, sin conflicto |

**Lo que NO cambió:** la **habilitación** de split sigue siendo **por aplicación**. Si se
elige una app por producto, cada una hay que pedirla habilitada por separado.

### Confirmaciones técnicas previas del mismo hilo (2026-08-26)

| Tema | Definición de MP | Estado en el código |
|---|---|---|
| Ubicación de `items[]` | **Nivel superior del body**, no bajo `additional_info.items` (nodo deprecado en Orders API). El HTTP 400 que veíamos era el comportamiento esperado | Correcto — `order-items.ts` |
| `category_id` | Campo libre, sin enum obligatorio. `"others"` es válido | Enviamos `"others"` en todos los consumidores |
| Sugerencia antifraude | Industria **"Aplicaciones y plataformas online"**; para venta de fotos digitales, `virtual_goods` del catálogo `GET /item_categories` podría ajustar mejor. **Sugerencia, no requisito** | Sin adoptar — evaluar |
| Tópico de webhook | **Solo `order`.** `payment` corresponde a la arquitectura anterior | El parser soporta ambos; `payment` queda para Checkout Pro |
| Fuente de verdad | **`GET /v1/orders/{id}`**, siempre. El webhook avisa que algo pasó y trae solo un `data.id`: dispara la reconciliación, no confirma el estado | Ya implementado y validado en sandbox |
| `platform_id` / `integrator_id` | Ninguno de los dos aplica como agrupador | `integratorId` a eliminar; `platformId` sin uso funcional |

### 1.c Confirmaciones de ejecución (2026-09-03)

Respuesta a las tres consultas que hicimos antes de tocar nada:

| Consulta | Respuesta de MP | Consecuencia |
|---|---|---|
| **Renombrar la app** a "DNX Suite" | **Sin impacto.** El tracking de MP es siempre por **número (ID) de aplicación**, que no se modifica. Solo cambiaría si centralizáramos en una app **nueva** — no es el caso | **Desbloqueado.** Se puede renombrar |
| **Alcance de la homologación** | Las homologaciones son **por registro de cuenta y aplicación**. Con una sola app, MP registra la cuenta y la app de **DNX Suite**, y eso cubre a todos los productos. Con varias apps el proceso cambia: habría que incluir todos los identificadores de app | **Desbloqueado.** Una sola homologación |
| **Varias notification URLs** | **No.** No sería posible declarar más de una URL en el panel. MP está consultando internamente si puede hacerse por request con `notification_url`, porque tiene información de que **ese parámetro está deshabilitado en Orders** | **Decidido por descarte:** una sola URL + ruteo interno nuestro. Ver §5.1 del plan |
| **Checklist de homologación** | Reconocido el olvido; se comparte **hoy (2026-09-03)** | A la espera |

Sobre `external_reference`, MP no objetó nuestra convención: solo insistió en respetar la
estructura recomendada y **evitar PII** (correos, documentos, cualquier dato personal). Nuestro
`buildOpaqueExternalReference()` ya rechaza email, nombre y apellido, teléfono y documento.

> **Nota:** Marilyn adjuntó una captura de pantalla con la estructura recomendada que **no está
> incorporada a este documento**. Antes de dar por cerrado el punto, contrastar nuestra
> convención contra esa imagen.

### Pendientes del hilo

| Pendiente | De quién | Estado |
|---|---|---|
| ~~**Checklist de homologación adaptado a Split 1:N**~~ | — | ✅ **RECIBIDO 2026-09-03** — auditado en [`mp-split-1n-checklist-oficial-auditoria.md`](./mp-split-1n-checklist-oficial-auditoria.md) |
| ~~Si `notification_url` puede enviarse por request en Orders~~ | — | ✅ **RESUELTO** — no existe la capacidad, ni en panel ni por request. Una sola URL para toda la suite |
| Confirmar a MP que no manejamos captura manual (`processing_mode`) | Nosotros | Respuesta: correcto, es `automatic` fijo |
| Contrastar la convención de `external_reference` contra la captura que envió MP | Nosotros | Pendiente |
| Prueba de webhook punta a punta con endpoint público registrado; si falta una notificación, reportar el `order_id` | Nosotros | Requiere portar la rama del webhook |
| ~~Confirmar que renombrar la app no afecta la habilitación~~ | — | **RESUELTO** — sin impacto |
| ~~Alcance de la homologación con app centralizada~~ | — | **RESUELTO** — una sola |

---

## 2. Los tres niveles, que no hay que confundir

Esta es la corrección más importante respecto de lo que creíamos antes del 2026-09-03.

| Concepto | Nivel | Se repite… |
|---|---|---|
| **Habilitación de split** | **Aplicación** | Una vez por aplicación, pedida a soporte |
| **Consentimiento del receptor** | **Cuenta / collector** | Una vez por cuenta receptora, sirve para cualquier app del mismo collector |
| **Vinculación OAuth del receptor** | Cuenta | Una vez por cuenta |

El doc [`mercadopago-split-habilitacion.md`](./mercadopago-split-habilitacion.md) afirmaba que
el consentimiento era por aplicación. **Era incorrecto.** Ya está corregido allí.

---

## 3. Decisión DNX: una sola aplicación para Split 1:N

**Decidido el 2026-09-03.** El flujo nuevo (Checkout API + Orders + Split 1:N) se centraliza en
**una única aplicación de Mercado Pago** para toda la suite. Checkout Pro se mantiene repartido
por aplicación, tal como está hoy.

### El hecho que la sustenta

**Todos los productos cobran a la misma cuenta de Mercado Pago:** `dnxfotografia@gmail.com`,
`providerUserId = 97484805`. Esa cuenta es dueña de varias aplicaciones:

| Aplicación | Habilitada para split | Qué cobra hoy |
|---|---|---|
| ComprameLafoto | **Sí** — única habilitada | Checkout Pro con `marketplace_fee` |
| FotoOffice (`5350262556971123`) | No | Checkout Pro de cursos presenciales |
| Clickatón (dedicada) | No | Inscripciones; collector = la misma cuenta |
| FotoRank | No | Checkout Pro, sin split |

Con una sola cuenta cobradora, "una app por producto" no compra aislamiento real: la plata cae
en el mismo lugar y el dueño es el mismo. Lo único que agrega es trámite.

### Por qué centralizar

1. **Cero pedidos de habilitación.** La app de ComprameLafoto ya está habilitada; se puede
   operar sin esperar a soporte. Ir app por producto son **tres pedidos** con tiempos que no
   controlamos — eso ya bloqueó a FotoOffice una vez.
2. **Un solo access token** para el flujo nuevo, sin lógica de múltiples tokens en paralelo
   (el costo operativo que la propia MP señaló para la opción multi-app).
3. **Un receptor consiente una vez** y vale para todos los productos, porque el collector es
   el mismo.
4. **El código ya está preparado** (ver §5).

### Qué asumimos a cambio

| Costo | Detalle | Mitigación |
|---|---|---|
| Webhook secret compartido | Un solo secreto para los endpoints de todos los productos en el flujo nuevo | Rutear por `external_reference`; rotación coordinada |
| Radio de impacto | Si MP suspende esa app, cae el Split de toda la suite | Los Checkout Pro quedan en apps separadas: los cobros **actuales** no dependen de ella |
| Redirects compartidos | Cada producto declara su redirect URI en la misma app | Lista explícita, documentada en §6 |
| Trazabilidad propia | Distinguir el producto depende de nuestros identificadores, no del proveedor | `external_reference` con prefijo + `DnxPaymentIntent.sourceProduct` |

---

## 4. Convención de `external_reference`

Se mantiene la que **ya está implementada**, que cumple lo que pide MP y es más legible en
reportes que abreviaturas:

```
<producto>-<entidad>-<idOpaco>
```

Generada por `buildOpaqueExternalReference(sourceProduct, entity, id)` en
`packages/payments/src/providers/mercado-pago/orders/external-reference.ts`.

| Producto | Prefijo | Ejemplo |
|---|---|---|
| Clickatón | `clickaton-` | `clickaton-registration-ckt_9f2a…` |
| FotoOffice | `fotoffice-` | `fotoffice-enrollment-fo_41b7…` |
| Comprame la Foto | `compramelafoto-` | `compramelafoto-albumorder-clf_02c8…` |
| FotoRank | `fotorank-` | `fotorank-entry-fr_7d31…` |

El builder rechaza PII (email, nombre y apellido, teléfono / documento) antes de mandar la
referencia al proveedor. **No relajar esa validación** para meter datos legibles.

---

## 5. Estado del código

### Ya resuelto — no requiere cambios

- `buildOpaqueExternalReference()` implementa la convención de prefijos.
- `DnxPaymentIntent.sourceProduct` con `@@unique([sourceProduct, externalReference])`: el
  producto de origen ya es una dimensión de primera clase en la base.
- `createMercadoPagoProviderConfig()` recibe el `accessToken` inyectado por cada app —
  `@repo/payments` no asume ninguna aplicación en particular.
- Índice único de `DnxSplitConsent` `(provider, environment, providerReceiverId)`: **correcto**.
  Con una sola cuenta collector no puede haber colisión entre productos.

### Pendiente

| Tarea | Detalle |
|---|---|
| Renombrar la aplicación | "ComprameLafoto" pasa a llamarse **DNX Suite**, por ser la app de split de toda la suite. El `client_id` / app_id **no cambia**. A confirmar con MP antes de ejecutar (§6) |
| Unificar variables de entorno | El flujo nuevo pasa a un juego único (`DNX_PAYMENTS_MP_*`). Las de Checkout Pro (`FOTORANK_MP_*`, `MP_ACCESS_TOKEN`, cursos de FotoOffice) **no se tocan** |
| Declarar redirects y notification URLs | Uno por producto, en la app centralizada |
| Eliminar `integratorId` | Muerto por definición de MP. Está en `MercadoPagoProviderConfig` y en el mapper de Orders; **ninguna app lo setea**, así que sacarlo no rompe nada |
| Reactivar Split 1:N en FotoOffice | Cuando haya caso real. Ver [`fotoffice-split-1n-disabled.md`](./fotoffice-split-1n-disabled.md) §6 |

### Deuda menor, no urgente

El OAuth owner de Clickatón (`CLICKATON_MP_CLIENT_ID` y compañía) conecta por OAuth la misma
cuenta que es dueña de la aplicación — es decir, la cuenta se conecta a sí misma. En este
esquema alcanza con el access token propio de la app. Está construido y funcionando; se
simplifica cuando haya motivo para tocarlo, no antes.

---

## 6. Plan de ejecución

> Los pasos de abajo son el resumen. El detalle ejecutable —fases, variables, flags,
> verificación y rollback— está en
> [`mp-split-1n-plan-implementacion.md`](./mp-split-1n-plan-implementacion.md).

1. **Confirmar con MP** (pendiente de respuesta): que renombrar la aplicación no afecta la
   habilitación de split ya otorgada sobre ese `app_id`.
2. Renombrar la app en el panel de Developers: **"ComprameLafoto" → "DNX Suite"**.
   Nombre elegido el 2026-09-03; sujeto al punto 1.
3. Declarar en esa app las redirect URIs y notification URLs de cada producto.
4. Unificar las variables de entorno del flujo nuevo.
5. Cerrar cualquier pedido de habilitación pendiente para las apps de FotoOffice, Clickatón y
   FotoRank: ya no se piden.
6. Limpiar `integratorId` del paquete.

**Ningún paso abre cobros.** Los flags de producción de Orders 1:N siguen apagados
(`DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` ≠ `true`).

---

## 7. Consecuencia contable, sin cambios

Sigue vigente lo anotado en [`mercadopago-split-habilitacion.md`](./mercadopago-split-habilitacion.md):
en Checkout Pro con `marketplace_fee` **el cobrador es el receptor**; en Split 1:N **el cobrador
es la plataforma**. No es lo mismo a efectos fiscales y de facturación. Centralizar la
aplicación no altera esto en ningún sentido — lo determina el flujo, no la app. Corresponde
revisarlo con el contador antes de operar volumen.

---

## Docs relacionados

- [`mp-split-1n-runbook-cierre-homologacion.md`](./mp-split-1n-runbook-cierre-homologacion.md) — **el paso a paso para cerrar la homologación**
- [`mp-split-1n-checklist-oficial-auditoria.md`](./mp-split-1n-checklist-oficial-auditoria.md) — el checklist oficial de MP auditado contra nuestro código
- [`mp-split-1n-plan-implementacion.md`](./mp-split-1n-plan-implementacion.md) — el plan de ejecución
- [`mercadopago-split-habilitacion.md`](./mercadopago-split-habilitacion.md) — los tres roles y el trámite de habilitación
- [`fotoffice-split-1n-disabled.md`](./fotoffice-split-1n-disabled.md) — guard de FotoOffice
- [`mp-split-1n-homologation-package.md`](./mp-split-1n-homologation-package.md) — paquete de homologación
- [`../clickaton/MERCADO_PAGO_OWNER_PRODUCTION_CONNECTION_10D3I_I1.md`](../clickaton/MERCADO_PAGO_OWNER_PRODUCTION_CONNECTION_10D3I_I1.md) — conexión owner de Clickatón (§1 superada por este doc)
