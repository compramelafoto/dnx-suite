# Quién vendió cada participación

Un organizador —y más adelante un workspace— puede vender espacios globales de
las plataformas DNX, además de su propio inventario. Cuando eso pasa, la plata y
la comisión van en un sentido o en el otro según de quién sea el inventario. Para
resolverlo hace falta saber **quién originó cada venta**.

Este documento cubre solo ese campo. El cupo, la disponibilidad y la reserva son
la etapa 2 y están definidos en el catálogo de patrocinios.

## El campo

`DnxPartnerParticipation.soldByOrganizationId`. Nulo significa que la vendió DNX
directo. Es una referencia opaca a la organización vendedora, igual que el
`organizationId` que ya existía.

Antes de esto, **nada en el esquema decía quién vendió una participación**: no
había forma de distinguir «esto lo vendió DNX» de «esto lo originó un organizador
y le corresponde comisión».

| Necesidad | Cómo la resuelve |
|---|---|
| Atribución de comisiones | Es el vendedor de cada participación |
| Que cada vendedor vea su cartera | Filtro directo, sin ver la de los demás |
| Ampliar una campaña conservando el origen | Queda registrado quién originó la ampliación |

Ese último punto es el que pide el catálogo: cuando una marca ya tiene presencia
general, no se le cobra dos veces el mismo espacio en el mismo período — se
amplía su campaña **conservando qué organizador originó la ampliación**.

## Cómo se reparte

| Inventario | Quién lo vende | La plata es de | El otro recibe |
|---|---|---|---|
| Concurso o evento propio | El organizador | El organizador | DNX comisiona |
| Espacios globales de plataforma | DNX o un organizador habilitado | DNX | El organizador comisiona |

Misma transacción, reparto invertido según de quién sea el inventario.
`packages/payments/src/distribution/` ya admite `PLATFORM` y `ORGANIZER` como
destinatarios con porcentajes configurables, así que las dos formas entran en la
maquinaria que existe.

## El fee, por ahora

Por la decisión `$04` de `partners-pending-decisions.md`, la plata queda fuera
del sistema: tarifa fija por espacio y período, de una lista que vive afuera,
facturada aparte. Un acuerdo marco por vendedor, firmado una sola vez.

Un fee porcentual exige saber cuánto cobró el vendedor — o sea, que el pago pase
por el sistema. Mientras el adaptador de la Orders API de Mercado Pago siga
escribiendo solo contra sandbox, cualquier porcentaje termina en una liquidación
a mano. Las comisiones son la **etapa 4**.

## Lo que este campo no resuelve

**No es un control de cupo.** Que exista `soldByOrganizationId` no impide que dos
organizadores prometan el mismo lugar el mismo día. Eso lo resuelve la etapa 2 —
cupo por espacio y período, tres estados de ocupación, reserva con vencimiento de
10 días y una restricción en la base de datos, porque un control en la aplicación
no alcanza cuando dos confirman a la vez.

**No bloquea por coincidencia.** Que una marca ya sea sponsor de otro concurso no
la bloquea: puede auspiciar varios a la vez. Se bloquea solo por conflicto real —
exclusividad de rubro, de territorio, de placement o de plataforma, que es la
etapa 3.

## Los contratos del workspace

Cuando llegue FotoOffice (etapa 5), los contratos viven dentro de cada workspace
sin nada nuevo en el esquema:

- `DnxPartnerParticipation` con `organizationId` = el workspace y
  `contextType: ORGANIZATION`.
- Vigencia, si requiere pago, modo, monto y valor estimado: campos que ya tiene.
- Lo que el aliado aporta cuelga como `DnxPartnerContribution`: `MONEY`,
  `DISCOUNT`, `VOUCHER`, `PRIZE`, `INSTITUTIONAL_SUPPORT`.

El aliado que da 20% de descuento, pone un premio para el sorteo y aparece en el
slideshow es **una participación con tres contribuciones**, no tres cosas
sueltas.

**La marca es global; el contrato es del workspace.** Dos instituciones pueden
tener cada una su contrato con la misma óptica sin verse entre sí. Los datos de
contacto de la marca, en cambio, son compartidos y quedan gateados por la
capability `PARTNER_CONTACT_SENSITIVE`. Hasta dónde llega eso es la decisión
P-03, todavía abierta.

## Lo que falta

1. **Aplicar la migración `20260827230000_partner_participation_sold_by`.** Está
   escrita y **sin ejecutar**: es aditiva —columna nullable, sin default, sin
   backfill— pero en este proyecto ningún build corre `prisma migrate deploy`, y
   `packages/db/.env` apunta a la misma base que producción.
2. **Guardar el vendedor al crear participaciones.** El campo existe y nadie lo
   escribe todavía.
3. **La habilitación para vender inventario ajeno.** No todo organizador debería
   poder vender la portada de InfoSpot.
