# Referidos

Requisito agregado por el titular el 2026-09-11. **El documento maestro no lo menciona en
ningún capítulo**: es un agregado al alcance, no algo que estuviera escrito y se pasó por alto.

## La regla

Un fotógrafo recomienda la plataforma a otro profesional o proveedor. Cuando ese referido
vende, la plataforma cobra su fee del 15% y **el referidor se lleva la mitad de ese fee
durante 12 meses**.

Sobre una venta de $100.000:

| | |
|---|---:|
| Fee de la plataforma (15%) | $15.000 |
| Va al referidor (50% del fee) | **$7.500** |
| Queda para la plataforma | $7.500 |

El "7,5%" es respecto de la venta; en el código se expresa como **50% del fee**, que es como
está en CompraMeLaFoto y lo que hay que replicar.

## Es exactamente el mismo motor que ya existe

No hay que diseñar nada nuevo. En el schema compartido ya están:

| Modelo | Qué guarda |
|---|---|
| `ReferralCode` | El código de cada usuario. Uno por persona (`ownerUserId` es único) |
| `ReferralAttribution` | Quién refirió a quién, con `startsAt` y `endsAt`: ahí vive la ventana de 12 meses |
| `ReferralEarning` | Por venta: `platformFeeCents`, `referralAmountCents`, `platformNetCents` |
| `ReferralPayoutRequest` | Los retiros — **no se usa acá**, ver abajo |

Y la lógica en `apps/compramelafoto/lib/referral/`:

```ts
// referral-program.ts
export const REFERRAL_PROGRAM_FEE_SHARE: Record<ReferralProgram, number> = {
  [ReferralProgram.PHOTOGRAPHER_REFERRAL]: 0.5,   // ← el 7,5% sobre una venta con fee 15%
  [ReferralProgram.ORGANIZER_REFERRAL]: 0.2,
};
```

El cálculo se hace **sobre el fee efectivo**, no sobre el precio de venta:
`referralAmountCents = Math.floor(feeEfectivo * 0.5)`. Importa la distinción, porque el fee
efectivo ya descuenta promociones y descuentos aplicados a la comisión.

Al enum `ReferralProgram` habría que sumarle un valor para Subí la Foto, o reutilizar
`PHOTOGRAPHER_REFERRAL` si el reparto es el mismo. **Recomiendo un valor propio**
(`SUBILAFOTO_REFERRAL`, también al 0.5): permite cambiar el porcentaje de una plataforma sin
tocar la otra, y las dos comparten la misma tabla de ganancias.

## Se enciende recién con el split 1:N

**Decisión del titular, 2026-09-11.** El programa no se activa hasta que Mercado Pago
permita repartir un pago entre varias cuentas. Y **no se construyen solicitudes de retiro**:
con split, la parte del referidor sale directo en el momento del cobro y nadie tiene que
pedir nada.

Es la decisión correcta. Sin split, la alternativa sería acumular deuda con los referidores
y pagarla a mano por transferencia, que es justamente lo que trajo problemas en
CompraMeLaFoto.

Consecuencia a tener presente: **el split hoy está en sandbox** y los propios documentos de
DNX Payments prohíben escrituras en producción. Mientras no se homologue, este programa no
existe. No conviene prometerlo a ningún fotógrafo todavía.

## Lo único que sí hay que hacer desde el día uno

**Registrar quién refirió a quién.** La atribución es barata de guardar y imposible de
reconstruir después: si un fotógrafo trae tres colegas en octubre y el programa se enciende
en febrero, sin el registro esos tres referidos no existen.

Entonces, cuando se construya el alta del vendedor (Etapa 1) hay que:

1. Aceptar un código de referido en el enlace de alta (`?ref=CODIGO`).
2. Crear la `ReferralAttribution` al confirmarse el alta.
3. **No** generar `ReferralEarning` todavía: el devengamiento queda apagado.

### La ventana de 12 meses: cuándo empieza a correr

Acá hay una decisión con plata real en juego. Si la atribución se registra en octubre con
`endsAt` a 12 meses y el split llega en marzo, el referidor perdió cinco meses de su
beneficio sin haber hecho nada mal.

**Recomendación: la ventana arranca cuando el programa se enciende, no cuando se registra la
atribución.** En la práctica: guardar la atribución con `startsAt` nulo o en estado
`PENDING`, y fijar `startsAt` / `endsAt` el día que se active el split. Así nadie pierde
meses por una demora que no es suya, y el mensaje al fotógrafo es simple: "doce meses desde
que el programa arranca".

La alternativa —contar desde el alta— es más simple de programar y peor de explicar el día
que alguien reclame.

## Lo que falta definir antes de encenderlo

- Si el referidor cobra también sobre el **adicional de descarga**, cuyo ingreso es 100% de
  la plataforma. Mi recomendación: **sí**, con la misma mitad, porque también es fee de
  plataforma; pero hay que decidirlo antes de publicar las condiciones.
- Qué pasa si el referido deja de operar y vuelve dentro de los 12 meses.
- Si un proveedor (`DnxPartner`) puede ser referidor sin ser vendedor de la plataforma.
- El texto de las condiciones que acepta el referidor, que tiene que decir con claridad que
  son 12 meses y sobre qué se calcula.
