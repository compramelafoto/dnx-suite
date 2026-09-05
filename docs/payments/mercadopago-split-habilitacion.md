# MercadoPago: habilitación de cobro dividido por aplicación

**Fecha:** 2026-08-25
**Aplica a:** todo producto del monorepo que use split (Orders 1:N) de MercadoPago

---

## El hecho

**MercadoPago habilita el cobro dividido por aplicación, no por cuenta.**

Tener una aplicación habilitada no habilita a las demás de la misma cuenta. Cada aplicación
nueva arranca sin permiso para operar splits, y hay que pedirlo a soporte.

## Cómo se descubrió

Al conectar la cuenta de la SFPR en FotoOffice, la vinculación OAuth funcionó, pero la
invitación al consentimiento de split fue rechazada por MercadoPago.

La causa: la habilitación que soporte había otorgado estaba asociada a la aplicación
**ComprameLafoto**. **FotoOffice** (número `5350262556971123`) es una aplicación distinta,
creada después, y no la heredó.

## Los tres roles, que no hay que confundir

| Rol | Quién | Qué necesita | Cuántas veces |
|---|---|---|---|
| **Cobrador** | La plataforma (DNX) | Que **su aplicación** esté habilitada para split | Una vez por aplicación |
| **Receptor** | La institución, el fotógrafo, el docente | **Consentir** recibir su parte | Una vez por cuenta receptora |
| **Vinculación** | El receptor | Autorizar la app por OAuth | Una vez por cuenta |

Son tres cosas distintas y ninguna reemplaza a otra. Un receptor puede estar vinculado por
OAuth y aun así no poder cobrar, porque falta su consentimiento; y todos los consentimientos
del mundo no sirven si la aplicación cobradora no está habilitada.

## Qué pedirle a soporte

> Solicito habilitar **cobro dividido (split de pagos / Orders 1:N)** para la aplicación
> **<nombre>**, número **<id>**, de la misma cuenta que ya tiene habilitada la aplicación
> ComprameLafoto.

## Antes de integrar split en un producto nuevo

1. Crear la aplicación en el panel de MercadoPago
2. **Pedir la habilitación de split a soporte** ← el paso que se olvida
3. Cargar `<PRODUCTO>_MP_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`, `_ACCESS_TOKEN`
4. Encender `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`
5. Recién ahí, invitar receptores a consentir

El paso 2 tiene tiempos de MercadoPago que no controlamos. **Conviene iniciarlo apenas se
crea la aplicación**, no cuando el código ya está listo: es lo que bloqueó a FotoOffice.

## Al aplicarlo en compramelafoto

Compramelafoto hoy cobra con el modelo de **dos vías** (`marketplace_fee`): el fotógrafo es
el cobrador y la plataforma retiene su comisión. En ese modelo **ningún fotógrafo consiente
nada**.

Si se migra a 1:N —decisión ya tomada, para poder repartir a tres partes— cada fotógrafo va
a necesitar consentir una vez. Con el panel de consentimiento ya construido eso es un botón
dentro de la aplicación, no un trámite en el panel de MercadoPago.

## Una consecuencia contable que conviene revisar

En el modelo de dos vías, **el cobrador es el receptor**: la operación es del fotógrafo o de
la institución, y la plataforma solo retiene comisión.

En **1:N el cobrador es la plataforma**. Cada receptor recibe su parte acreditada
directamente —no queda en el saldo de DNX— pero la operación se procesa con credenciales de
DNX y DNX es el comercio de la transacción.

**No es lo mismo a efectos fiscales y de facturación.** Corresponde revisarlo con el
contador antes de operar volumen, no después.

## Diagnóstico si algo falla

El motivo real queda registrado, saneado, con estos prefijos:

- `[fotoffice][mp-connect]` — vinculación OAuth
- `[fotoffice][split-consent]` — invitación y consulta de consentimiento

Los tokens y códigos de autorización se enmascaran antes de registrarse. Un mensaje genérico
sin detalle vuelve indistinguible un rechazo del proveedor de un error propio: eso ya costó
dos vueltas en esta integración.

## Actualización: 2 de septiembre de 2026 — resuelto

Mercado Pago respondió. **Se centraliza el flujo nuevo en una sola aplicación.**
Definición completa: [`mp-split-1n-mercadopago-confirmations.md`](./mp-split-1n-mercadopago-confirmations.md).
Plan de ejecución paso a paso: [`mp-split-1n-plan-implementacion.md`](./mp-split-1n-plan-implementacion.md).

### Una corrección a este documento

Arriba se afirma que la habilitación es por aplicación. **Sigue siendo cierto.** Lo que no era
cierto es la extensión que hicimos de esa idea al consentimiento del receptor.

| | Nivel real | Antes creíamos |
|---|---|---|
| Habilitación de split | Aplicación | Aplicación ✅ |
| Consentimiento del receptor | **Cuenta / collector** | Aplicación ❌ |

Un fotógrafo que ya consintió para la cuenta cobradora **no vuelve a consentir** aunque la
Order se cree desde otra aplicación de esa misma cuenta. El `app_id` es indistinto para el
consentimiento.

### La decisión

Todos los productos de la suite cobran a la **misma cuenta** de Mercado Pago
(`dnxfotografia@gmail.com`, `providerUserId 97484805`). Siendo así, una aplicación por producto
sólo agrega trámite: tres pedidos de habilitación con tiempos que no controlamos —el paso que
bloqueó a FotoOffice— sin ganar aislamiento real, porque la plata cae en el mismo lugar.

Entonces: **el flujo nuevo (Checkout API + Orders + Split 1:N) va en una sola aplicación**, la
que ya está habilitada. **Checkout Pro se mantiene repartido por aplicación**, sin tocar nada:
Mercado Pago confirmó que ahí la vinculación sí es por app y que no hay conflicto entre ambos
esquemas.

### Qué implica, en concreto

| Consecuencia | Detalle |
|---|---|
| No se piden más habilitaciones | Se cierra el pedido pendiente de la app de FotoOffice (`5350262556971123`) y no se abren los de Clickatón ni FotoRank |
| Credenciales compartidas en el flujo nuevo | `FOTOFFICE_MP_CLIENT_ID` y sus equivalentes por producto dejan de tener sentido para Split; pasan a un juego único de plataforma. Las de Checkout Pro no se tocan |
| Un receptor consiente una vez para todo | Por cuenta cobradora, no por aplicación |
| Una revocación afecta a todo el Split | Si MP suspende esa aplicación, cae el Split de toda la suite. Los Checkout Pro, al estar en apps separadas, siguen cobrando |
| La URL de redirección se comparte | Cada producto declara la suya en la lista de la app centralizada |
| La trazabilidad la sostenemos nosotros | Vía `external_reference` con prefijo por producto (`clickaton-`, `fotoffice-`, …), que ya genera `buildOpaqueExternalReference()`. Mercado Pago confirmó que alcanza, incluso para reportes |
| `integrator_id` queda descartado | MP lo revisó internamente: identifica al integrador / software provider, no agrupa productos de una misma cuenta |

**Pendiente antes de ejecutar:** confirmar con MP que **renombrar** la aplicación —de
"ComprameLafoto" a **"DNX Suite"**, por pasar a ser la app de split de toda la suite— no afecta
la habilitación ya otorgada. El `client_id` no cambia, así que no debería, pero se pregunta
antes de tocar nada.
