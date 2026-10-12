# Sorteos: nadie gana el mismo premio dos veces en 6 meses

Fecha: 2026-10-12. Pedido por Daniel después del primer sorteo de la SFPR (11/10/2026).

## Lo que se pidió

Quien ganó un premio no puede volver a ganar **ese mismo premio** durante los 6 meses
siguientes. Sí puede ganar otro premio distinto (opción A, elegida por Daniel; la B —quedar
afuera de todos los premios— se descartó).

## Reglas

- **Mismo premio** = misma serie mensual (`RafflePrize.commitmentId`). Un premio suelto, sin
  serie, es "el mismo" que otro cuando coinciden aliado (`partnerId`, o el nombre si no hay id)
  y título (sin mayúsculas ni espacios de más).
- **Ventana**: el premio ganado en un sorteo con acto (`drawsAt`) en `D` bloquea los sorteos cuyo acto
  (`drawsAt`) sea anterior a `D + N meses`. Se cuenta desde la hora del acto, no desde
  `drawnAt` (que llega segundos después y correría la ventana un mes). Ganó el 11/10 20:00 → bloqueado de noviembre a marzo;
  desde el sorteo del 11/04 20:00 vuelve a poder ganarlo.
- **Cuenta como ganado** todo premio adjudicado salvo `ANULADO`. `NO_RETIRADO` cuenta: tuvo el
  premio y no lo retiró.
- **Configuración**: `RaffleSettings.samePrizeCooldownMonths` (0 = apagada, por defecto). SFPR: 6.
- **Sin nadie habilitado**: si para un premio todos los que quedan en la bolsa están excluidos,
  ese premio se sortea entre todos los que quedan (la regla cede; el sorteo no se traba).

## Verificabilidad (lo que no se puede romper)

- Las exclusiones se calculan **al sellar el padrón** (24 h antes, antes de que exista el número
  de drand) y se guardan en `RaffleEntry.excludedPrizeOrders` (órdenes de premio de ESTE sorteo).
- Entran en la huella. Formato v2, sólo cuando algún participante tiene exclusiones:

  ```
  SHA256("fotoffice-raffle-v2\n" + idDelSorteo + "\n" +
         participantes.map(p => p.posicion + ":" + p.numeroDeSocio + ":" +
                                p.excluidos.ordenadosAsc.join(",")).join("\n"))
  ```

  Sin exclusiones se usa la v1 de siempre. La versión se deduce de los datos publicados, sin
  columna nueva: los sorteos ya hechos (todos sin exclusiones) siguen verificando igual.
- La extracción no cambia de etiqueta (`fotoffice-raffle-draw-v1`). Lo único nuevo: para cada
  premio, la bolsa es la de los que todavía no ganaron **menos los excluidos de ese premio**, en
  el mismo orden ascendente. Si queda vacía, se usa la bolsa entera. Sin exclusiones el
  resultado es idéntico al de hoy.
- La pantalla de verificación muestra, por participante, de qué premios quedó afuera, la cuenta
  escrita con la v2, y el control automático la rehace.

## Cambios

- Esquema: `RaffleEntry.excludedPrizeOrders Int[] @default([])`,
  `RaffleSettings.samePrizeCooldownMonths Int @default(0)`. Migración aplicada a mano en las
  bases que tienen las tablas de sorteos, antes de fusionar.
- `lib/raffles/repeat-rule.ts` (puro): clave de serie, ventana, cálculo de exclusiones.
- `entrants.ts`: huella v1/v2. `draw.ts`: exclusiones opcionales. `verification.ts`: ídem, con
  implementación propia de la huella (como hoy).
- `seal.ts`: carga ajuste e historial, calcula y guarda exclusiones. `resolve.ts`: las pasa.
- Pantalla de verificación del portal: columna "No participa por" y pseudocódigo v2.
- Test de verificación independiente nuevo para v2, con valores calculados por un script
  aparte (no por este código).
- SFPR: `samePrizeCooldownMonths = 6` por SQL. Texto sugerido para el anuncio de noviembre:
  "Quien ganó un premio no puede volver a ganar ese mismo premio durante 6 meses."

## Fuera de alcance

Pantalla para editar el ajuste (los ajustes de sorteos no tienen pantalla todavía); aviso en el
portal al socio excluido.
