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
