# La cuenta del socio: saldo a favor, cuotas adelantadas y conciliación del arrastre

Fecha: 2026-09-06 · Institución destino: SFPR

## Problema

**El sistema sabe restar pero no sumar.** `loadMemberAccount` sólo lee cargos con saldo
pendiente. Un socio que pagó de más no tiene dónde figurar.

`allocatePayment` calcula el sobrante y lo declara así:

> "Lo que sobró y no se pudo imputar a ningún cargo. **Queda a favor del socio**: no se
> descarta ni se devuelve por cuenta propia."

**Esa promesa no se cumple.** El valor termina en un único lugar —un mensaje que la
Secretaría ve una vez al confirmar el pago— y después no existe. No se guarda, el socio nunca
lo ve, y el mes siguiente se le cobra la cuota completa.

Hoy ningún socio de la SFPR tiene sobrante, así que el problema no explotó todavía. Va a
explotar la primera vez que alguien adelante cuotas. **Y ya pasó antes**: el sistema anterior
sí manejaba saldo a favor —el socio 617 transfirió de más, se le cargó a mano y se le fue
descontando mes a mes—, así que la institución ya opera con esta figura y FotoOffice no.

**Y el arrastre del sistema anterior nunca se verificó socio por socio.** Son $1.844.500 en
79 socios.

## Lo que ya se verificó del arrastre (2026-09-06)

Con el historial de pagos importado (ver `2026-09-06-cuotas-historial-carnet-design.md`) se
pudo cruzar por primera vez:

| Grupo | Socios | Resultado |
|---|---|---|
| Con pagos en la ventana 10/2025–08/2026 | 27 | 14 coinciden **al peso** con sus meses impagos; 13 tienen un arrastre *menor*; **ninguno** tiene un arrastre mayor del justificable |
| Sin pagos, arrastre = tramo consecutivo de meses | 4 | explicado |
| Sin pagos en la ventana | 48 | **no verificable con este archivo** |

**Conclusión: el arrastre no está mal, está sin verificar para 48 de 79.**

Los 13 con arrastre *menor* tienen explicación conocida: un pago anterior al 01/08/2025 pudo
cubrir meses que caen dentro de la ventana, y sus imputaciones cuelgan de ese pago viejo —
fuera del reporte. El caso del socio 617 es exactamente ese, y es la razón por la que no
aparece en ninguna fila.

Lo que falta para cerrar los 48 **no es código**: es un reporte de pagos del sistema anterior
que empiece antes del 01/08/2025.

## Decisiones tomadas

1. **El saldo a favor no lleva tabla nueva.** `schema.prisma` es compartido por cinco bases
   Neon y cada columna hay que aplicarla a mano en las cinco. El crédito es derivable:
   **lo pagado menos lo imputado**. `MembershipAllocation` ya permite imputar un pago a
   cargos creados después.
2. **De acá en adelante no se cobran importes libres desde el portal.** El socio paga
   **cuotas adelantadas ya cerradas**: períodos cuyo valor de cuota ya está definido, a ese
   precio. No elige un monto; elige cuántos meses. El saldo a favor sigue haciendo falta para
   los pagos que la Secretaría carga a mano —una transferencia por un importe redondo— que es
   justamente el caso 617.
3. **Conciliar puede confirmar, corregir y condonar**, siempre con motivo escrito y
   constancia de quién y cuándo. Sin tabla nueva: `MemberAudit` ya es inmutable por diseño.
4. **El socio ve el resultado**, con fecha y rótulo. El motivo interno no se le muestra: es
   la nota de la Secretaría, no un mensaje al socio.
5. **Un pago histórico nunca es crédito.** Ver la trampa, abajo.

## La trampa del cálculo, y cómo se contiene

Los 231 pagos históricos importados **no tienen imputaciones a propósito** — son constancia
de un cobro, no un movimiento de cuenta. Con la fórmula «pagado menos imputado» cada uno de
esos 61 socios aparecería con un saldo a favor falso, $2.213.288 en total.

Se excluyen por el prefijo `HIST:`, **en una sola función que es la única puerta al cálculo
del saldo**, con prueba dedicada. Ninguna pantalla ni consulta puede calcular saldo por su
cuenta.

Es la segunda vez que la decisión de no tocar el schema compartido obliga a un cuidado extra
(la primera fue el período del pago histórico, que viajó como texto). Queda escrito acá para
que la tercera se evalúe contra el costo de migrar las cinco bases.

## A. El saldo del socio, en las dos direcciones

`lib/membership/balance.ts`:

```
loadMemberBalance(memberId) -> {
  dueMinor,        // cargos con saldo pendiente
  creditMinor,     // pagos acreditados no imputados, excluidos los históricos
  netMinor,        // due - credit; negativo = el socio está a favor
  charges, credits // el detalle de cada lado
}
```

Reemplaza a `loadMemberAccount`, que sólo sabe restar. Sus llamadores hoy son la pantalla
`/portal/cuotas` y el registro de pago manual; los dos se migran en el mismo paso, porque
dejar uno con la vista vieja haría que el socio y la Secretaría vieran cuentas distintas.

La parte que decide qué cuenta y qué no es pura y se prueba sin base, igual que
`select-charges.ts` respecto de `account.ts`.

## B. Aplicar el crédito a los cargos nuevos

`lib/membership/apply-credit.ts`. Cuando aparece un cargo, si el socio tiene pagos sin
imputar, se imputa contra ellos **antes** de reclamarle nada. Del más viejo al más nuevo, la
misma regla que ya usa `allocatePayment`.

Corre después de la generación mensual y también a demanda desde la ficha del socio. Es
idempotente: correrlo dos veces no imputa dos veces.

## C. Cuotas adelantadas desde el portal

El socio elige **cuántos meses** adelantar, no un importe. La pantalla arma el detalle
—qué períodos, a qué valor, cuánto suma— y cobra eso.

Un período sólo se ofrece si su valor de cuota ya está definido (`MembershipFeeValue`). No se
adelanta un mes cuyo precio la institución todavía no fijó: sería cobrarle al socio un número
que después puede cambiar.

## D. Conciliación del arrastre

Pantalla en el panel, alimentada por **el reporte original**, no por los datos ya importados:
el período que cubrió cada pago histórico se guardó como texto legible para el socio
(`"Cuota social de mayo de 2026 a agosto de 2026"`), y volver a interpretarlo desde castellano
sería frágil. La Secretaría sube la planilla —la actual, y la anterior a 10/2025 cuando la
consiga— y el cruce se calcula con datos estructurados. El mismo circuito sirve para las dos.

Por socio: arrastre · meses pagados · meses impagos y cuánto suman · **veredicto sugerido**
(coincide exacto / arrastre menor / sin pagos: no verificable).

Los que coinciden al peso se confirman en bloque. Los no verificables quedan marcados como
tales: el sistema no finge que revisó lo que no pudo revisar.

Tres acciones, todas con motivo obligatorio; corregir y condonar exigen además un motivo con
sustancia. El cambio de saldo y su `MemberAudit` van **en la misma transacción**.

**Descartado:** registrar la condonación como si fuera un pago. Sería elegante para el
historial, pero el panel de cobranzas suma los pagos como «lo que entró» y una condonación de
$60.000 aparecería como plata recaudada. Es contabilidad falsa.

## E. Lo que ve cada uno

- **El socio**, en Mis cuotas: «Tenés $42.000 a favor. Se van a descontar de tus próximas
  cuotas.» Sobre el arrastre: «Deuda anterior revisada el 12/09/2026» / «corregida» /
  «condonada».
- **La Secretaría**, en la ficha: el saldo neto y de qué se compone.

## Permiso

El mismo que registrar un pago cobrado en mano: `canManageWorkspaceCollection`, dueño o
administrador. Cambiar lo que alguien debe es la misma atribución que afirmar que pagó.

## Pruebas

- Saldo: con crédito, sin crédito, con los dos, y con el socio a favor (neto negativo).
- **Un pago histórico nunca cuenta como crédito.** Es la prueba que protege la trampa.
- Imputar un crédito contra varios cargos nuevos, y que correrlo dos veces no duplique.
- Sólo se ofrecen para adelantar los períodos con valor de cuota definido.
- Conciliación: veredicto para cada uno de los tres casos, motivo vacío rechazado, y que el
  cambio de saldo y la auditoría se confirman juntos o no se confirma ninguno.
- Aislamiento por institución en todo lo que reciba un número de socio.

## Orden de entrega

**B** (tapar el agujero, es lo urgente) → **A** → **E** → **C** → **D**.

D va última: es la más grande y la única que depende de conseguir el reporte anterior a
10/2025. **Si al llegar ahí sigue sin aparecer ese reporte, D se separa en su propio plan** —
no tiene sentido construir el cruce contra un archivo que todavía no existe, y B/A/E/C ya
entregan valor por sí solas.

## Fuera de alcance

Devoluciones de dinero, intereses por mora, planes de pago en cuotas, y condonación masiva
sin revisar caso por caso. Un socio que se da de baja con crédito a favor es una decisión de
la Comisión Directiva, no una pantalla.
