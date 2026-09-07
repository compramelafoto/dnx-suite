# Recomendados: cuotas bonificadas por traer un socio nuevo

**Fecha:** 2026-09-07 · **Aplicación:** FOTOFFICE · **Estado:** aprobado para implementar

## El problema

La SFPR crece de boca en boca: un socio le cuenta a un colega y el colega se asocia. Hoy eso
no deja rastro en ninguna parte y no tiene ningún reconocimiento. Queremos que recomendar sea
una acción concreta dentro del portal y que tenga una recompensa clara.

## Qué se construye

Cada socio activo tiene un enlace propio para invitar colegas. Quien se asocia entrando por
ese enlace queda vinculado a quien lo recomendó, **de forma automática y para siempre**.
Cuando ese socio nuevo termina de pagar su ingreso, el recomendante gana una **cuota
bonificada**: un porcentaje del valor de su cuota mensual, configurado por la institución.

El beneficio **nunca es dinero**. Se traduce exclusivamente en menos pesos a pagar en una
cuota mensual. No hay retiro, no hay saldo a favor, no hay canje.

## Vocabulario

En todo el código, la base y las pantallas se dice **recomendación**, **recomendado** y
**recomendante**. La palabra «referido» no aparece en ningún lado.

- **Recomendante:** el socio que comparte su enlace y gana la bonificación.
- **Recomendado:** la persona que se asocia entrando por ese enlace.
- **Bonificación:** el descuento ganado, aplicado sobre una cuota mensual concreta.

## Decisiones tomadas

| Decisión | Resolución |
|---|---|
| Cuándo se gana | Cuando el recomendado **termina de pagar su ingreso** (la solicitud pasa a `COMPLETADA`). No al aprobar: hay altas aprobadas que nunca se pagan. |
| Cómo se vincula | **Automático por enlace personal.** El vínculo queda además guardado en la ficha del socio nuevo, visible para la Secretaría. |
| Cómo se usa | **Automático.** La bonificación se aplica sola sobre la cuota mensual impaga más antigua; si no hay ninguna, espera a la cuota del mes siguiente. |
| Tope y vencimiento | **Ninguno.** Se acumulan sin límite y no caducan. |
| Acumulación | **Una bonificación por cuota.** Dos recomendados al 50% dan dos cuotas a mitad de precio, no una gratis. |
| Configuración | El admin enciende el módulo y fija el porcentaje (0 a 100) de la cuota que se bonifica. |

## Arquitectura: el descuento vive en la cuota, no en el checkout

La bonificación **no se calcula en el momento de pagar**. Se aplica sobre el cargo apenas se
gana: baja el saldo de esa cuota y ahí queda.

Esto es lo que hace al diseño barato y seguro:

- **No se toca ni una línea del circuito de cobro.** Mercado Pago, el cobro en efectivo y la
  pantalla del portal ven una cuota que sencillamente vale menos.
- **No hay crédito que reservar y devolver.** Si el descuento se calculara al abrir el
  checkout, un socio que abandona el pago dejaría una bonificación consumida sin pagar nada, y
  habría que inventar la devolución. Acá el problema no existe.
- **La comisión de la plataforma se resuelve sola.** Tanto `dues-payment.ts` como
  `manual-payment.ts` calculan el fee sobre lo efectivamente imputado. Si la cuota vale menos,
  la comisión es menor. Nadie cobra comisión sobre plata que no entró. Queda fijado con un test.

## Modelo de datos

Cuatro cambios en `packages/db/prisma/schema.prisma`.

### 1. `Member`: el código y el vínculo

```prisma
/// Código del enlace de recomendación de este socio. Se genera la primera vez que lo pide.
recommendationCode     String? @unique
/// Quién lo recomendó, si llegó por el enlace de otro socio. Queda para siempre en la ficha.
recommendedByMemberId  String?
```

Autorrelación `recommendedBy` / `recommendations` con `onDelete: SetNull`: dar de baja al
recomendante no puede borrar la historia del recomendado.

### 2. `MembershipApplication`: quién lo recomendó

```prisma
/// Socio que lo recomendó, tomado del enlace por el que entró.
recommenderMemberId String?
```

**No se reutiliza `presenterMemberId`.** Ese campo es el socio que *presenta* al aspirante
cuando el estatuto lo exige: es otra cosa, con otro efecto jurídico. Mezclarlos haría que un
requisito estatutario y un beneficio comercial compartan columna.

### 3. `MembershipRecommendationBenefit`: la bonificación

```prisma
model MembershipRecommendationBenefit {
  id             String @id @default(cuid())
  workspaceId    String
  /// Socio que gana la bonificación.
  memberId       String
  /// Socio nuevo que la originó. Único: un alta bonifica una sola vez, pase lo que pase.
  originMemberId String @unique

  /// Porcentaje congelado al ganarla: cambiar la configuración no reescribe el pasado.
  percent Decimal @db.Decimal(5, 2)
  status  MembershipRecommendationBenefitStatus @default(PENDIENTE)

  /// Cargo sobre el que se aplicó. Único: una cuota recibe una sola bonificación.
  appliedChargeId  String?   @unique
  appliedAmountArs Decimal?  @db.Decimal(12, 2)
  appliedAt        DateTime?

  voidedAt       DateTime?
  voidedByUserId Int?
  voidReason     String?
}

enum MembershipRecommendationBenefitStatus { PENDIENTE APLICADA ANULADA }
```

`originMemberId @unique` es el árbitro de la idempotencia: si el webhook de Mercado Pago
entra dos veces, la segunda no puede crear una segunda bonificación.

### 4. `MembershipDuesSettings`: la configuración

```prisma
/// Módulo de recomendaciones encendido. Apagado por defecto.
recommendationEnabled        Boolean @default(false)
/// Porcentaje de la cuota que se bonifica por cada recomendado.
recommendationBenefitPercent Decimal @default(100) @db.Decimal(5, 2)
```

## Los flujos

### El enlace

El socio entra al portal y ve la tarjeta «Recomendá a un colega». La primera vez, el sistema
le genera un código opaco y lo guarda. El enlace es
`https://…/w/<slug>/asociarse?rec=<CODIGO>`.

### El alta

`/w/[workspaceSlug]/asociarse?rec=CODIGO` resuelve el código contra el padrón:

- Si corresponde a un socio **activo del mismo workspace**, el formulario muestra arriba
  «Te recomienda: Juan Pérez» y lleva el código en un campo oculto.
- Si el código no existe, es de otra institución o el socio está de baja, **se ignora en
  silencio**: el formulario se muestra normal, sin mensajes de error. Un enlace viejo no puede
  romperle el alta a nadie.

La solicitud se guarda con `recommenderMemberId`.

### La aprobación

`approve.ts` copia `recommenderMemberId` de la solicitud a `recommendedByMemberId` del socio
nuevo. Desde ese momento la ficha responde «¿lo recomendó alguien?» sin depender de la
solicitud. La Secretaría ve el dato en la pantalla de solicitudes **antes** de aprobar, y
puede corregirlo o quitarlo mientras la solicitud siga pendiente.

### La acreditación

`completeApplicationIfPaid` —el mismo lugar donde hoy se cierra un alta pagada— dispara la
bonificación cuando se cumplen todas estas condiciones:

1. El módulo está encendido en esa institución.
2. El socio nuevo tiene `recommendedByMemberId`.
3. El recomendante sigue **activo**.
4. El recomendante no es el propio socio nuevo.
5. No existe ya una bonificación para ese `originMemberId`.

Se crea la bonificación con el porcentaje vigente y se intenta aplicarla en el acto.

Como todo lo que cuelga de `completeApplicationIfPaid`, es **silenciosa**: si algo falla, se
registra en consola y no se propaga. Un pago acreditado es un hecho consumado y no puede
deshacerse porque falle una bonificación o un email.

### La aplicación del descuento

`applyPendingBenefits(memberId)` busca las bonificaciones `PENDIENTE` del socio y, para cada
una, el cargo mensual impago más antiguo que todavía no tenga bonificación:

- **Sólo cargos `MENSUAL`.** Quedan afuera el ingreso, la credencial impresa y el arrastre del
  sistema anterior (`APERTURA`). El beneficio es sobre la cuota, y sólo sobre la cuota.
- El descuento es `percent%` del `amountArs` del cargo, **acotado al saldo pendiente**: nunca
  deja el saldo en negativo ni genera saldo a favor.
- Baja `balanceArs`, marca la bonificación `APLICADA` y guarda cargo e importe.

Se la llama en dos momentos: al ganar la bonificación, y al final de
`generateMonthlyCharges`, para los socios con bonificaciones pendientes. Así, quien estaba al
día cuando la ganó la ve aplicada en la cuota del mes siguiente, sin intervención de nadie.

### La anulación

La Secretaría puede anular una bonificación desde la ficha del socio, con motivo obligatorio.
Si el cargo sigue impago, el importe vuelve al saldo. **Si el cargo ya fue pagado, no se
puede anular**: revertir una cuota cobrada convertiría a un socio al día en deudor de algo que
ya pagó.

## Pantallas

**Portal del socio**
- Tarjeta «Recomendá a un colega» en el inicio, con el enlace para copiar y compartir.
- `/portal/recomendados`: el enlace, la lista de colegas que se asociaron gracias a él y el
  estado de cada bonificación.
- En «Tus cuotas», la cuota bonificada muestra el precio original tachado y la leyenda
  «Bonificada por tu recomendación a Fulano».

**Panel de la institución**
- Solicitudes: «Recomendado por: N° 412 · Juan Pérez», con opción de corregir o quitar.
- Ficha del socio: a quién recomendó, quién lo recomendó, y sus bonificaciones con estado.
- Cuotas → Configuración: bloque «Recomendaciones» con el interruptor y el porcentaje.

Todo lo del portal aparece **sólo si el módulo está encendido**.

## Email

Una clave nueva en `MEMBERSHIP_EMAIL_KEYS`:
`RECOMMENDATION_EARNED: "fotoffice.membership.recommendation-earned"`. Le avisa al
recomendante que su colega se asoció y que su próxima cuota viene con descuento. Mismo patrón
que el resto: `sendAndLogEmail`, registrado también cuando falla.

## Pruebas

Reglas de plata y de vínculo, con tests automáticos:

1. La bonificación no toca el ingreso, ni la credencial impresa, ni el arrastre `APERTURA`.
2. El descuento nunca deja el saldo en negativo: se acota al saldo pendiente.
3. El webhook entrando dos veces acredita **una sola** bonificación.
4. Un socio no puede recomendarse a sí mismo.
5. El enlace de un socio dado de baja no otorga nada, y el alta se completa igual.
6. Un código de otra institución se ignora en silencio.
7. La cuota bonificada devenga comisión **sólo sobre lo efectivamente pagado**.
8. Dos bonificaciones del 50% caen en dos cuotas distintas, no se suman en una.
9. Anular una bonificación aplicada a un cargo impago devuelve el importe al saldo.
10. Anular una bonificación cuyo cargo ya se pagó es rechazado.
11. Sin bonificaciones pendientes y con el módulo apagado, nada del circuito actual cambia.

## Riesgo conocido: las cinco bases

`schema.prisma` está compartido por las cinco aplicaciones del monorepo, y la migración **no
se aplica sola** en las cinco bases de Neon. Si se despliega FOTOFFICE con estos campos y las
otras bases quedan atrás, las escrituras de las otras aplicaciones fallan. La migración se
aplica a mano en las cinco antes de desplegar.

## Fuera de alcance

Topes anuales, vencimiento de bonificaciones, canje por dinero, recomendaciones entre
instituciones distintas, ranking público de recomendantes y premios que no sean la cuota.
