# La búsqueda por dorsal es un interruptor, no una deducción

## El problema

Leer el texto de las fotos lo cobra Amazon: **USD 1 cada 1.000 fotos**. Hasta el
2026-10-09 corría en **todas**, porque el cron llamaba a
`/api/internal/analysis/run?ocr=1` cada dos minutos y ese `ocr=1` lo forzaba.

En septiembre fueron 55.722 fotos leídas y la factura dio USD 121,51 — casi exactamente
dos pasadas por foto, una de texto y una de caras. En un casamiento, un acto escolar o
un cumpleaños no hay ningún dorsal ni patente que leer, pero se pagaba igual.

## Por qué no alcanzaba con el tipo de álbum

El primer arreglo ató la lectura a `Album.type === "SPORTS"`. Funciona, pero deja un
agujero: **el fotógrafo no elige el tipo**. Se escribe solo cuando el álbum se vincula a
un `Event`, y eso pasa poco:

| Mes | Álbumes creados | Con tipo | Vinculados a evento |
|---|---|---|---|
| 2026-10 | 49 | 2 | 1 |
| 2026-09 | 156 | 11 | 8 |
| 2026-08 | 176 | 23 | 23 |

Las dos últimas columnas son casi iguales todos los meses: **el tipo es un reflejo del
evento, no una decisión**. El que cubre una carrera y crea un álbum suelto perdía la
búsqueda por dorsal sin forma de recuperarla.

Y "tipo de evento" es además una mala forma de preguntarlo: lo que importa no es si es
deportivo sino **si en esas fotos hay algo escrito que valga la pena buscar**. Una
carrera de autos, una regata, un colegio con los nombres en la camiseta: todos lo
quieren, y ninguno es obvio desde una lista de 16 tipos.

## Cómo quedó

Un interruptor en **Configuración del álbum**:

> **Búsqueda por dorsal, patente o nombre**
> Tus clientes pueden encontrarse escribiendo un número o una palabra que aparezca en la
> foto. Leer cada foto tiene un costo, así que conviene dejarlo encendido sólo cuando hay
> algo escrito.

La decisión se toma en `lib/analysis/should-run-ocr.ts`, con tres niveles del más
específico al más general:

1. **Lo pedido a mano** (`?ocr=1` / `?ocr=0`). Herramienta del operador para reprocesar
   un álbum puntual sin dejarle la configuración cambiada al fotógrafo.
2. **El interruptor** (`Album.textSearchEnabled`). Lo decide el fotógrafo.
3. **El tipo de álbum**, para los que nunca lo tocaron: sólo `SPORTS`.

`textSearchEnabled` es **nullable a propósito**: `null` significa "no lo configuré", no
"apagado". Por eso los 998 álbumes anteriores siguen comportándose igual que antes y los
121 deportivos siguen leyendo texto sin tocar una sola fila.

## Lo que ve el cliente

Donde no se leyó texto, **la pantalla del cliente deja de ofrecer el buscador por
número**: ofrecerlo sería ofrecer una búsqueda que siempre devuelve cero.

La condición mira el **texto realmente leído** (`OcrToken`) y no el interruptor, para que
los álbumes viejos —que tienen texto de antes— lo conserven aunque hoy estén apagados.

## La migración

`20261027120000_clf_interruptor_busqueda_texto`. Aditiva e idempotente: una columna
nullable que el código viejo ignora.

Aplicada a mano el **2026-10-09** en las **6 bases** que tienen la tabla `Album`:

| Base | Proyecto Neon |
|---|---|
| CompraMeLaFoto producción | `divine-hall-10689679` rama `production` |
| FOTOFFICE / FotoRank | `divine-hall-10689679` rama `development` |
| Clickatón producción | `bitter-math-56019731` |
| DNX Suite staging | `fragrant-union-80829821` |
| InfoSpot producción | `wandering-pine-79918137` |
| CompraMeLaFoto staging | `cold-silence-10115969` |

Son seis y no tres: `Album` vive en todas. Conviene preguntarle a cada base si tiene la
tabla antes de aplicar, en vez de confiar en una lista escrita de antes.

## Lo que falta

- **Correrlo contra Amazon.** La cuenta está suspendida por falta de pago desde el
  2026-10-06; nada de esto se pudo probar contra Rekognition.
- **Detección automática.** Leer el texto de las primeras ~20 fotos de un álbum nuevo y,
  si varias tienen números, ofrecerle al fotógrafo encender el interruptor. Cuesta unos
  dos centavos de dólar por álbum y resuelve el caso del que no sabe que la función
  existe, que probablemente sea la mayoría.
