# Split 1:N — Ventana de consentimiento al iniciar sesión

Diseño, 2026-10-28. No implementado todavía.

Complementa `mp-split-1n-plan-implementacion.md` (fases de infraestructura) y
`mercadopago-split-habilitacion.md` (los tres niveles: habilitación, consentimiento,
vinculación). Este documento cubre una sola cosa: **cómo conseguir que cientos de
fotógrafos otorguen el consentimiento**, que es el cuello de botella real de la etapa 1.

## 1. El problema

El consentimiento de Split 1:N lo otorga el receptor, una vez por cuenta de Mercado Pago, y
**se otorga del lado de Mercado Pago**. La plataforma solo puede mandar la invitación y
después consultar el estado.

Eso significa que el split no se enciende con un despliegue: se enciende cuando las personas
hacen clic. Con 328 fotógrafos vinculados, un canal que dependa de que abran un correo no
alcanza.

### El dato que obliga a repensarlo

Consulta a la base de producción de CompraMeLaFoto, 2026-10-28:

| | Fotógrafos |
|---|---|
| Con Mercado Pago vinculado (`mpUserId` no nulo) | 328 |
| Vinculación de más de 6 meses — **caducada** | 98 |
| Entre 5 y 6 meses — por caducar | 41 |

Mercado Pago caduca la vinculación OAuth a los 6 meses si no se renueva. Casi un tercio de
la base tiene el vínculo muerto y nadie se enteró, porque hoy nada lo mira.

Si se enciende el split sin resolver esto, a esas 98 personas el cobro les falla y el
síntoma aparece en el momento de una venta real, no antes.

## 2. Qué resuelve la ventana y qué no

**Resuelve:** el reparto del enlace y la detección del vínculo caducado. En lugar de un
correo que puede no abrirse, el pedido aparece cuando la persona ya está adentro y mirando.

**No resuelve:** el consentimiento en sí. El clic final ocurre en una pantalla de Mercado
Pago. Un tilde en nuestra pantalla no produce consentimiento — Mercado Pago rechazaría el
cobro igual. Está dicho en el código, en
`packages/payments/src/providers/mercado-pago/split-consent/production-flag.ts`.

La ventana es un canal de distribución, no un atajo al consentimiento.

## 3. Los tres estados que tiene que distinguir

El error a evitar es tratar todo como "falta consentir". Son tres situaciones distintas y
piden textos distintos:

| Estado | Cómo se detecta | Qué pide la ventana |
|---|---|---|
| **Vínculo caducado** | `mpConnectedAt` + 6 meses < hoy, o el refresh falla | Reconectar Mercado Pago (OAuth de nuevo) |
| **Sin consentimiento** | Vínculo vigente y no hay `DnxSplitConsent` ACTIVE | Autorizar el cobro dividido |
| **Consentimiento pendiente** | Hay `DnxSplitConsent` en PENDING | Volver a abrir el enlace, o reenviarlo |

Un vínculo caducado **no** puede saltar al consentimiento: la invitación necesita el token
del receptor para resolver su correo, y sin vínculo vigente no hay token.

## 4. Flujo

1. La persona inicia sesión en CompraMeLaFoto.
2. El servidor evalúa el estado (tabla de arriba). Si está todo bien, no aparece nada.
3. La ventana explica en una frase por qué conviene: **cobrar las comisiones directo a su
   Mercado Pago, sin esperar transferencia manual**.
4. Un botón.
   - Caducado → va al flujo OAuth que ya existe.
   - Sin consentimiento → el servidor pide la invitación a Mercado Pago y abre el
     `inviteUrl` que devuelve.
5. La persona acepta en Mercado Pago y vuelve.
6. Al volver, el servidor consulta el estado del consentimiento y lo persiste.

### Postergar sí, pero con límite

La ventana tiene que poder cerrarse: bloquear el acceso a alguien que vino a mirar sus
ventas es hostil y genera bajas. Pero "después" no puede ser infinito. Propuesta: se puede
postergar, y vuelve a aparecer a los 7 días. En el panel de cobros queda siempre visible,
sin ventana, para quien lo quiera hacer por su cuenta.

## 5. De dónde sale el correo — PENDIENTE DE VERIFICAR

La API de consentimiento acepta **únicamente** `seller_email`
(`packages/payments/src/providers/mercado-pago/split-consent/contracts.ts`). No acepta el
`user_id` que ya tenemos de OAuth.

Y el correo de la cuenta de Mercado Pago puede no ser el mismo con el que la persona se
registró en CompraMeLaFoto. Preguntárselo en la ventana agrega un campo de texto justo en el
paso donde más gente abandona.

`GET /users/me` devuelve el correo real de la cuenta, y la llamada ya está escrita en
`packages/payments/src/partner-onboarding/owner-oauth/mp-client.ts`. Pero esa función
**enmascara** el correo antes de devolverlo (`emailMasked`), a propósito, para que no llegue
a la interfaz. El enmascarado es nuestro, no de Mercado Pago, así que del lado del servidor
debería ser recuperable.

> **No está verificado.** El comentario en
> `apps/fotoffice/lib/payments/connect/consent-invite.ts` afirma que el correo "viene
> enmascarado a propósito, así que no se puede deducir" — esa afirmación mezcla nuestro
> enmascarado con una supuesta limitación del proveedor. Falta comprobar con un token real
> si `/users/me` trae el correo con los scopes que pedimos
> (`offline_access payments write`). Hasta comprobarlo, el diseño mantiene el campo manual
> como respaldo.

**Decisión:** intentar `/users/me` del lado del servidor; si no viene correo, recién
entonces pedirlo. Así la mayoría no ve ningún campo y nadie queda trabado.

## 6. Lo que esta ventana no hace

- No mueve dinero ni cambia quién cobra. Eso es la inversión del cobrador, decisión
  separada y pendiente de revisión contable.
- No reemplaza el panel de cobros. La ventana empuja; el panel es donde se consulta.
- No sirve para la orden de cierre de homologación. Para dos personas el enlace va por
  WhatsApp. Construir esto primero frenaría el cierre sin necesidad.

## 7. Orden de implementación

1. **Verificar `/users/me`** con un token real. Define si hay campo manual o no, y es
   media hora de trabajo que condiciona el resto.
2. **Detección de estado** del lado del servidor, con las tres situaciones. Sin interfaz
   todavía: primero saber cuánta gente cae en cada caso.
3. **Ventana**, con los tres textos.
4. **Saneamiento de los 98 vencidos.** Acá la ventana sola no alcanza: alguien que no entra
   nunca no la ve. Hace falta además un aviso por fuera.

El paso 2 tiene valor por sí mismo aunque la ventana se postergue: hoy no tenemos forma de
saber cuántos fotógrafos podrían cobrar por split si lo encendiéramos.
