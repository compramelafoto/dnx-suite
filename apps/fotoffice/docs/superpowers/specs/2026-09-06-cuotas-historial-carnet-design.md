# Cuotas societarias: habilitación, historial de pagos y carnet impreso

Fecha: 2026-09-06 · Institución destino: SFPR

## Problema

Tres cosas, encadenadas por la misma pantalla.

**El socio ve "Mis cuotas — PRÓXIMAMENTE" aunque la pantalla esté hecha.** El menú del
portal condiciona la sección al módulo `membership-dues`, y ese módulo figura como
`PLANNED` en el registro. `getEnabledModuleKeysForWorkspace` filtra por los `AVAILABLE`,
así que hoy **no existe forma de encenderlo** desde el panel: la pantalla existe, funciona
y es inalcanzable.

**El menú promete "qué debés, qué pagaste y cómo pagar" y la pantalla sólo muestra lo que
debe.** Los pagos están en la base (`MembershipPayment` + `MembershipAllocation`) y ninguna
superficie los muestra al socio. La ficha del socio en el panel tampoco: su "Historial" es
el registro de auditoría institucional, no los pagos.

**Los pagos anteriores a FotoOffice no existen en ningún lado.** La migración dejó un único
cargo `APERTURA` por socio, sin desglose. `registerManualPayment` imputa sólo contra cargos
abiertos, así que un pago de 2024 no tiene contra qué imputarse.

**El carnet no le avisa a nadie que su credencial física puede estar vencida.** Quien nunca
registró una tarjeta impresa ve un ofrecimiento neutro, sin ninguna señal sobre la vigencia.

## Decisiones tomadas

1. **El historial retroactivo es informativo.** Los pagos anteriores se cargan como
   comprobantes visibles y **no tocan la deuda ni el saldo de apertura**. El arrastre
   `APERTURA` queda exactamente como está. Razón: ese arrastre no reconcilia para buena
   parte de los 80 socios; imputarle pagos con datos incompletos produciría saldos peores
   que los de hoy.
2. **Los pagos históricos entran sólo por planilla.** Sin formulario de carga suelta.
3. **La importación nunca crea socios.** El padrón ya está completo. Una fila cuyo número
   de socio no exista en el workspace se rechaza con su motivo; no da de alta a nadie.
4. **La advertencia de carnet le aparece a quien no tiene tarjeta impresa registrada.**
   No a todos, y no sólo a los que están por vencer.
5. **Nada de columnas nuevas en `schema.prisma`.** El schema es compartido por cinco bases
   Neon y cada campo nuevo hay que aplicarlo a mano en las cinco o rompe las escrituras de
   las otras apps. La marca de "pago histórico" viaja en `method`, con prefijo `HIST:`.

## A. Habilitar el módulo

- `membership-dues` pasa de `PLANNED` a `AVAILABLE` en `lib/modules/registry.ts`, con
  `route: "/members/cuotas"` (la pantalla administrativa ya existe).
- Se actualiza `registry.test.ts`, que fija la lista exacta de módulos `AVAILABLE`.
- La habilitación por institución se hace desde `/admin/workspace-modules`. Ningún otro
  workspace se ve afectado: cada uno necesita su fila en `WorkspaceFeatureModule`.

Efecto: "Mis cuotas" pasa de *En camino* a *Tu espacio* en el portal.

## B. Historial de pagos

`lib/membership/payment-history.ts` — lectura pura sobre Prisma:

```
loadMemberPaymentHistory(memberId, { limit }) -> PaymentHistoryEntry[]
```

Cada entrada: fecha de pago, importe en centavos, medio legible, referencia, si es
histórico, y a qué períodos se imputó (vía `allocations`). Sólo pagos `ACREDITADO`: un
pago pendiente o rechazado en la lista de "lo que pagaste" es una afirmación falsa.

Superficies:
- **Portal**, sección "Lo que pagaste" en `/portal/cuotas`. Se muestra también cuando el
  socio está al día — hoy ese caso no tiene nada que mirar.
- **Panel**, bloque "Pagos" en la ficha del socio, junto al formulario de pago manual.

Los históricos se rotulan "Registrado del sistema anterior" y no muestran imputación,
porque no la tienen.

## C. Importación de pagos históricos

Calcado del importador de socios (`lib/members/import/`), que ya resolvió el problema:
columnas en un archivo, prompt generado a partir de ellas, parseo con errores por fila.

`lib/membership/history-import/`:
- `columns.ts` — `memberNumber`, `paidAt`, `amountArs` obligatorias; `method`, `period` y
  `reference` opcionales. Tope de 5000 filas: acá una fila es un pago, no una persona.
- `amount.ts` — el punto más peligroso de la importación. El último punto o coma es decimal
  si lo siguen dos dígitos y separador de miles si lo siguen tres; cualquier otra cosa se
  rechaza. Confundirlos registra un pago mil veces más grande o más chico que el real.
- `prompt.ts` — texto para pegar en ChatGPT junto al archivo desordenado. Sin datos
  personales del padrón: sólo metadata del formato.
- `parse.ts` — valida formato y devuelve filas buenas + errores con número de línea.
- `import.ts` — escritura. Resuelve cada `memberNumber` contra el padrón **de ese
  workspace**; las filas sin socio se rechazan. Crea `MembershipPayment` con
  `status: ACREDITADO`, `platformFeeArs: 0`, `method: "HIST:<medio>"` y **sin
  allocations**.

**Reimportar el mismo archivo no duplica nada.** `providerPaymentRef` es único en la base, así
que se usa como clave natural del pago: `HIST:<workspace>:<socio>:<día>:<importe>`. Dos cobros
genuinamente iguales el mismo día se numeran (`#2`) en vez de perderse, con aviso en la
previsualización.

**Dónde va el período.** No hay campo para él y no se le agrega uno al schema. Como estos
pagos no se imputan a ninguna cuota, no existe un cargo al que apuntar: el período es una
nota sobre qué cubría el cobro, y viaja con la referencia en el texto que ve el socio
(`Cuota de marzo de 2024 · recibo 1234`). Se trata como lo que es —una nota— y no como un
vínculo que no existe.

`platformFeeArs` en cero es deliberado: la plata nunca pasó por la plataforma, así que no
corresponde devengarle comisión a la institución por un cobro de 2024.

Pantalla `/members/cuotas/historial` con previsualización antes de confirmar.

## D. Advertencia y renovación en Mi carnet

`lib/carnet/printed-warning.ts` — función pura, sin base ni reloj más que por parámetro:

- **Sin tarjeta impresa registrada** → advertencia: no nos consta que la tengas, revisá la
  vigencia de la que tengas en mano.
- **Tarjeta vencida** → se dice la fecha en que venció y el botón pasa a "Pedir
  renovación".
- **En camino** → se informa el estado y no se ofrece pedir otra: ya la pidió.
- **Entregada y vigente** → no se advierte nada, pero el ofrecimiento de pedir otra **no
  desaparece**: se cambia de categoría, se muda o la pierde. Ese caso ya funcionaba y no
  podía perderse al introducir el aviso.

`printedCardOffer` ya decide *si* se ofrece; esto decide *qué se dice*. Quedan separadas:
una es la regla de cobro, la otra es el texto.

## Pruebas

- `printed-warning.test.ts`: cada estado dice algo cierto.
- `payment-history.test.ts`: no cuenta pendientes ni rechazados; los históricos se
  reconocen por el prefijo.
- `history-import/parse.test.ts`: filas mal formadas, importes con coma, fechas inválidas.
- `history-import/isolation.test.ts`: un número de socio de otra institución se rechaza.

## Orden de entrega

A (efecto inmediato) → D → B → C.
