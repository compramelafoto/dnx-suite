# REFERIDOS — ETAPA 01 — Atribución

**Fecha:** 2026-09-23
**Alcance:** diseño + implementación de la atribución (quién trajo a quién). El canje del beneficio queda para la Etapa 02.
**App:** Clickatón (`apps/clickaton`)
**Base:** Neon `bitter-math-56019731` (clickaton-production), rama default.

---

## Resumen ejecutivo

Clickatón **no tiene** sistema de referidos. El programa que existe en CompraMeLaFoto
(`ReferralCode` / `ReferralAttribution` / `ReferralEarning`) paga **comisiones en dinero** con
pedido de cobro, vive en otra app y está cortado desde el 24/08. Sus tablas aparecen en la base de
Clickatón porque el schema Prisma es compartido, pero están **vacías** y ningún código de Clickatón
las toca. No se reutiliza: el premio acá no es plata, es volver.

**Por qué ahora.** Los números de producción al 2026-09-23:

| | 1ª edición | 2ª edición |
|---|---|---|
| Confirmados | 31 | 12 |
| De ellos, repetidores | — | **10** |
| **Personas nuevas** | 31 | **2** |

La retención es excelente (1 de cada 3 volvió). La adquisición está en cero: **dos personas nuevas**
en toda la 2ª edición. Hay 31 personas que vivieron la experiencia y ninguna herramienta para que
traigan a un colega.

---

## 1. Modelo del programa (decidido)

### 1.1 La escalera

| Colegas traídos | Beneficio en su próxima Clickatón |
|---|---|
| 1 | 10% |
| 2 | 20% |
| 3 | 35% |
| 4 | 60% |
| **5** | **Gratis (100%)** |

El titular que se comunica es **«traé 5 colegas y tu próxima Clickatón es gratis»**. Los escalones
intermedios existen porque con una base de 31 personas casi nadie llega a 5, y un premio inalcanzable
no se comparte. El que trae uno solo ya ganó algo y vuelve a intentar.

El invitado entra con **10% de descuento**, para que compartir el link sea un regalo y no un favor.

**«Gratis» incluye el kit físico.** No se entrega media experiencia. Ese premio cuesta plata real
(remera, materiales, logística), por eso el escalón superior queda en 5 y no baja a 3.

### 1.2 Lo que se guarda es un contador de personas, no un descuento

Decisión central, y de ella se desprende todo lo demás: **no se guarda «un 10%»**. Se guarda
*a cuántos colegas trajo*. El porcentaje es sólo la traducción de ese número en el momento de pagar.

Consecuencias:

- **Lo no usado se conserva.** Si en el checkout gana un cupón mejor, el contador **no se toca**.
  Los colegas siguen contados, esperando la próxima.
- **El contador sólo baja cuando el beneficio se usa de verdad**, o cuando un pago referido se cae.
- **No vence nunca.** Si alguien tarda tres ediciones en juntar 5 colegas, igual trajo 5 personas
  que pagaron. Además evita tener que avisarle a nadie que está por perder algo.

### 1.3 Convivencia con los cupones

Los cupones **no son acumulables hoy** y no lo serán: el formulario tiene un solo campo, la
inscripción guarda un solo código (`promoCode`, singular) y en producción ninguna de las 25
redenciones tiene dos códigos sobre la misma inscripción.

El beneficio de referidos **no es un cupón**: vive en la cuenta, aparte del campo de código.

> **Regla: no se suman. Se aplica el descuento más alto de los dos.**
> **En empate gana el cupón**, para preservar los referidos del participante.

El sistema elige solo el que más convenga: nadie desperdicia referidos por no darse cuenta.

Sin esta regla, 60% por referidos + un cupón de aliado del 50% regalaría la inscripción **y** el kit
sin que nadie lo haya decidido.

### 1.4 Alcance

**Sólo participantes.** Las escuelas y tiendas aliadas siguen como hasta hoy, con su cupón manual:
a una escuela «tu próxima Clickatón gratis» no le sirve de nada porque no va a participar. Ese
segundo circuito se construye después, sobre el mismo motor.

---

## 2. Qué construye esta etapa

Sólo la **atribución**: el link, la captura, el conteo, el antifraude y la pantalla donde la persona
ve a quién trajo. **El descuento todavía no se aplica en el checkout** — eso es la Etapa 02.

Se puede desplegar así: el contador empieza a correr y a acumular mérito real desde el día uno,
mientras el canje se termina. Nada de lo que se cuenta ahora se pierde.

---

## 3. Diseño

### 3.1 El link

```
https://maratonfotografica.com/i/<codigo>
```

`/r/` ya está ocupado por el redirect de DNX Partners (tracking de sponsors) y no se toca.

El código es corto y legible (`CK-7F3K2`), derivado del usuario, sin secuencia adivinable. Se genera
**la primera vez que la persona entra a su panel**, no para todos de antemano.

### 3.2 La captura

`GET /i/<codigo>` →

1. Resuelve el código. Si no existe o está inactivo, redirige igual a la inscripción **sin cookie**
   (nunca un 404 en la cara de alguien que viene invitado) y registra el intento.
2. Deja la cookie `ck_ref` — 90 días, `httpOnly`, `SameSite=Lax`, `Secure`.
3. Redirige a la inscripción de la edición abierta.

**Cookie y no parámetro en la URL** porque el invitado va a mirar el programa, la sede y las fotos
antes de decidir; si la atribución viviera en el query string, se perdería en el primer clic.

Si ya hay una cookie de otro referidor, **gana el primero** (no se pisa). Quien trajo a la persona
al sitio hizo el trabajo.

### 3.3 Dónde se cuenta

En **`confirmPaid`** (`lib/checkout/infrastructure/prisma-checkout-mutations.ts`), dentro del bloque
`.then()` posterior a la transacción, junto a los efectos que ya viven ahí: confirmar la redención
del cupón, vincular la identidad y otorgar el pase anual.

Es el **punto único** por el que pasan los tres caminos que confirman un pago (webhook, sondeo de
estado, reconciliación). Enganchar acá cubre los tres de una vez en lugar de parchear cada uno.

Va **después** de `linkRegistrationIdentity`, que es lo que materializa el `userId` del invitado:
la inscripción se puede hacer **como invitado, sin cuenta**, y el usuario recién existe ahí.

Es **best-effort**, como sus vecinos: si la atribución falla, el pago **no** se revierte. Queda el
intento registrado y se puede reprocesar.

### 3.4 Las reglas duras

| Regla | Por qué |
|---|---|
| Cuenta con el **pago aprobado**, nunca con la inscripción | Una inscripción impaga no es un colega traído |
| **Cada persona cuenta una sola vez en su vida** | Si el invitado vuelve solo a la 3ª edición, ese mérito ya se cobró |
| No autorreferencia: mismo `userId` ni mismo email | Lo obvio |
| Si el pago se cae (reembolso, contracargo, cancelación), **el contador baja** | Un pago revertido no es un colega traído |
| **Todo intento se registra, incluso el rechazado** | En CompraMeLaFoto se descartaban en silencio y fue imposible auditarlos o recuperarlos |
| Sólo puede referir quien tenga una inscripción **CONFIRMED** | El programa premia a quien vivió la experiencia |

### 3.5 Modelo de datos

Tres tablas nuevas, propias de Clickatón:

**`ClickatonReferralCode`** — un código por usuario.
`id`, `userId` (único), `code` (único), `isActive`, `createdAt`, `updatedAt`.

**`ClickatonReferralAttribution`** — quién trajo a quién.
`id`, `referrerUserId`, `referredUserId` (**único** — una vez en la vida), `referredEmail`,
`referralCodeId`, `registrationId`, `editionId`, `status`, `earnedAt`, `revokedAt`, `revokedReason`,
`consumedAt`, `consumedRegistrationId`, `createdAt`, `updatedAt`.

`status`: `EARNED` | `CONSUMED` | `REVOKED`.

**`ClickatonReferralAttributionAttempt`** — todo intento, incluido el que no prosperó.
`id`, `code`, `referredUserId?`, `referredEmail?`, `referrerUserId?`, `registrationId?`, `outcome`,
`detail?`, `createdAt`.

`outcome`: `CREATED` | `CODE_NOT_FOUND` | `CODE_INACTIVE` | `SELF_REFERRAL` | `SAME_EMAIL` |
`ALREADY_ATTRIBUTED` | `REFERRER_NOT_ELIGIBLE` | `ERROR`.

**El contador no es una columna.** Es `count(atribuciones del referidor con status = EARNED)`. Al
canjear (Etapa 02), esas N pasan a `CONSUMED` con la inscripción donde se usaron. Así hay auditoría
completa, no hay saldo mutable que reconciliar, y «lo no usado se conserva» sale solo.

Los escalones viven en **código**, no en base: son una decisión comercial que se toca por commit y no
merece un CRUD todavía.

### 3.6 El panel

En `mi-cuenta`, una sección nueva: el link para copiar, a cuántos trajo, qué escalón alcanzó y cuánto
le falta para el siguiente. En esta etapa dice con todas las letras que el descuento se aplica **a
partir de la próxima edición**, para no prometer un canje que todavía no existe.

### 3.7 Migración

SQL a mano y `prisma migrate resolve`, como el resto de Clickatón. Son tres tablas nuevas: no tocan
ninguna lectura existente, así que aplicar el SQL antes del deploy es seguro y aplicarlo después sólo
rompe lo nuevo.

---

## 4. Fuera de alcance (Etapa 02)

- Aplicar el descuento en el checkout y la comparación contra el cupón.
- Consumir las atribuciones al canjear.
- Mostrar el beneficio en el wizard de inscripción.
- El correo que avisa «trajiste un colega».
- El circuito de aliados.

---

## 5. Hallazgos laterales (producción)

- **`FLORA`** figura «Activo» pero **ya está cerrado**: tiene límite de 1 uso y ese uso se consumió.
  El interruptor «Activo» no es el que frena; el freno real son el límite de usos y la fecha.
- **`CONQUIENSUME50`** figura «Activo» pero **venció** el 2026-09-23 a las 00:47. Para que funcione
  hay que extenderle la fecha. No tiene edición asignada: cuando se extienda, va a servir para todas
  las ediciones presentes y futuras.
