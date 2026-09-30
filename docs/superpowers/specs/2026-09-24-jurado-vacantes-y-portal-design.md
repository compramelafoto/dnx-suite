# Vacantes de jurado y portal de calificación

*Diseño — 24/09/2026*

Dos trabajos con públicos distintos. **A** es para el organizador: declarar cuántos
jurados van a ser antes de saber quiénes son, y repartir las obras sobre esa
declaración. **B** es para quien califica: ver las obras agrupadas, mirarlas antes de
puntuar y calificar con el teclado sin salir de la fotografía.

A va primero. La cola que ve un jurado sale del reparto; construir B antes obliga a
rehacerlo.

---

## El problema

Hoy el reparto de obras se deriva de **quiénes** están asignados. Cada persona que entra
mueve el lote de todos los demás, así que nadie puede empezar hasta que estén todos.

En la práctica los jurados se confirman sobre la marcha: hay 5 comprometidos, se dieron
de alta 2, y los 2 no pueden arrancar. En la 1ª edición de Clickatón eso dejó 270 obras
esperando.

La solución es separar **cuántos** de **quiénes**.

---

## Lo que ya existe (verificado el 24/09/2026)

| Pieza | Estado |
|---|---|
| `ContestRulesJury.minJudges` / `maxJudges` | Escritos en `rules-config/types.ts`. **Nadie los lee**: `buildJuryPolicy()` no tiene llamadores |
| Validación `JURY_COUNT` → *"Cantidad de jurados no confirmada formalmente"* | Existe, con severidad `pending_human` |
| `FotorankJudgeAssignment.promptExternalId` | Columna presente, **en null en las 3 asignaciones reales** |
| `FotorankJuryScoringSession.assignmentSeed` | Se escribe al crear la sesión; **nadie la lee** |
| `seededShuffleIds()` | Escrita en `scoring-engine.ts`; sólo la usa su propio selfcheck |
| `minimumEvaluationsPerEntry` | Sale de la cantidad de jurados (rama `clickaton-revisar-avanza`, sin fusionar) |
| `repartoPorConsigna()` + la compuerta | Escritos y conectados (misma rama, sin fusionar) |
| Portal del jurado: cola de obras | 102 líneas. Grilla de 2 columnas, **no agrupa por consigna**, hay que entrar y salir por cada obra |
| Pantalla completa / atajos / modos de fondo | **No existen.** Cero apariciones en todo el portal |
| Temas de FotoRank | Uno solo, oscuro fijo (`--color-fr-bg: #050505`) |

---

# Parte A — Vacantes y reparto

## A.1 Qué se declara, y dónde

Son **dos números distintos** y viven en lugares distintos:

| | Qué es | Dónde vive |
|---|---|---|
| **La promesa de las bases** | "Cada fotografía será calificada por al menos tres integrantes del jurado" | Con las bases |
| **Las vacantes** | "Para juzgar este lote abro 5 puestos" | Con el juzgamiento |

**La promesa es por obra, no por jurado.** Al participante le importa que su foto no la
juzgue una sola persona; no le importa si el equipo son 5 o 30. Prometer una cantidad de
jurados ata al organizador: si se inscriben mil personas y hacen falta cuarenta, las
bases quedan incumplidas. Prometer tres miradas por obra no se rompe al crecer.

Por eso: **`minJudges` como piso operativo, sin máximo declarado.**

**Hoy esa promesa no está escrita en ninguna parte.** Las bases publicadas de Clickatón
no dicen cuántos jurados hay ni cuántos miran cada obra: dicen que *"los criterios y el
proceso del jurado se publicarán por edición"*. Así que la frase hay que agregarla —es
texto legal, no código, y va antes de que se abra el juzgamiento de la 2ª edición.

Las vacantes viven en `FotorankJuryScoringSession`, que ya está en la base donde ocurre
el juzgamiento —la de Clickatón para una maratón— junto a las otras decisiones del mismo
lote: `minimumEvaluationsPerEntry`, `assignmentSeed`, `rubricId`. Y como la sesión es por
lote congelado, cada edición tiene sus propias vacantes sin pisar a la anterior.

Se configura en **Clickatón → Ediciones → Jurados**, que es donde el organizador ya
asigna. Obligarlo a ir a FotoRank a decir "somos 5" y volver sería absurdo.

## A.2 La recomendación

Función pura. **Recomienda, no bloquea.**

```
juradosRecomendados({ obras, miradasPorObra, topeDeFotosPorJurado })
  → { recomendados: 5, motivo: "270 obras con 3 miradas cada una son 810 evaluaciones;
                               a 200 fotos por jurado hacen falta 5." }
```

- `topeDeFotosPorJurado` se configura por edición. **Valor de fábrica: 200.**
- El piso es `minimoDeEvaluacionesPorObra()`, que ya existe: nunca menos de 3, o todos
  los jurados si son menos de 3.
- Si el organizador abre menos vacantes que las recomendadas, la pantalla se lo dice y le
  pide una observación, que queda en la auditoría. No lo frena.

## A.3 El reparto se calcula, no se guarda

La rotación es determinista, así que no hace falta guardarla:

```
consigna i  →  vacantes i, i+1, … i+m-1   (dando la vuelta a la lista)
```

Con 11 consignas, 5 vacantes y 3 miradas, la vacante 1 recibe las consignas 1, 2, 3, 6, 7
y 11. Tenga o no tenga a alguien adentro.

Guardar el reparto crearía un estado que algún día no coincide con el cálculo. Se guardan
sólo dos cosas:

- `plannedSeats` en la sesión: cuántas vacantes hay.
- `seatNumber` en `FotorankJudgeAssignment`: qué vacante ocupa cada persona.

La compuerta `assertJudgeContestAccess` deriva las consignas del `seatNumber` en vez de
leer `promptExternalId`. Es un cambio a `consignasDelJurado()`, que ya está escrita.

**Consecuencia buscada:** sumar una persona no mueve el lote de nadie. Belén entra a la
vacante 1 y empieza hoy; el quinto entra la semana que viene y encuentra su lote hecho.

## A.4 La vacante que nunca se llena

El caso real: se declaran 5, se llenan 4, el quinto no aparece. Las obras de esa vacante
quedaron con 2 miradas en vez de 3.

**El sistema avisa y el organizador decide.** Al cerrar, el informe de cobertura —que ya
existe— dice cuántas obras quedaron cortas, y aparece un botón: *repartir el lote
huérfano entre los jurados que sí están*.

Repartir así **sí** agrega obras a gente que quizá ya terminó, y eso es exactamente por
lo que no puede ser automático: el organizador lo decide, se avisa a quienes reciben
obras nuevas, y queda en la auditoría.

Como el reparto base se calcula, la redistribución necesita anotar la excepción:

**`FotorankJurySeatPromptOverride`** — `scoringSessionId`, `seatNumber`,
`promptExternalId`, `motivo`, `createdByUserId`, `createdAt`.

El cálculo final es *rotación base + excepciones*. En el caso normal esa tabla queda
vacía; sólo se escribe cuando alguien redistribuye, y entonces queda dicho quién y por
qué.

## A.5 La pantalla

En Clickatón → Ediciones → Jurados, arriba de la lista:

```
Equipo de jurado

  ¿Cuántos jurados van a ser?   [ 5 ]

  Con 270 obras y 3 miradas cada una, recomendamos 5.
  Cada jurado calificaría 162 fotos.

  Vacante 1  ·  Belén Saldaña       consignas 1, 2, 3, 6, 7, 11
  Vacante 2  ·  Melisa Risso        consignas 2, 3, 4, 7, 8
  Vacante 3  ·  libre   [Asignar]   consignas 3, 4, 5, 8, 9
  Vacante 4  ·  libre   [Asignar]   consignas 4, 5, 6, 9, 10
  Vacante 5  ·  libre   [Asignar]   consignas 5, 6, 7, 10, 11
```

Cambiar el número **después** de que alguien calificó mueve lotes. La pantalla lo impide
si hay evaluaciones enviadas y lo advierte si hay borradores.

---

# Parte B — El portal del jurado

## B.1 Al entrar: dónde quedó

Lo primero que ve un jurado que vuelve no es una grilla de 270 miniaturas:

```
  Te faltan 158 fotos de 162.

  4 calificadas · 158 sin calificar · 1 sin terminar
```

*"Sin terminar"* son las fotos con alguna nota puesta y alguna faltante. Se cuentan
aparte porque son las que se pierden si nadie avisa.

De ahí se entra al visor, y **elegir qué ver es un filtro del visor**, no una bifurcación
de entrada:

```
  [ Todas ]  [ Sin calificar ]  [ Calificadas ]  [ Sin terminar ]
```

El filtro vale para la lista agrupada y para el recorrido con las flechas: con *Sin
calificar* puesto, avanzar salta las que ya tienen nota. Se recuerda entre sesiones, con
una salvedad: si el filtro puesto deja la vista vacía —terminó todo lo que faltaba— el
visor lo dice y vuelve a *Todas*, en vez de mostrar una pantalla en blanco.

## B.2 Las obras van agrupadas

Por **consigna** en una maratón; por **categoría** en un concurso que no tenga consignas.
El dato ya viaja hasta la pantalla y hoy no se usa.

Agrupar no es cosmético: calificar 47 fotos de la misma consigna seguidas permite
compararlas entre sí, que es lo único que hace comparable una nota.

**Dentro de cada grupo el orden sigue barajado** por el hash estable que ya existe
(`sortEntriesForJuror`), distinto para cada jurado. Eso se conserva: evita que el orden
sesgue y que se deduzca quién subió qué.

```
  Consigna 3 · "El oficio"            47 fotos    12 calificadas
  Consigna 4 · "Manos"                39 fotos     0 calificadas
  Consigna 7 · "La espera"            44 fotos     ✓ terminada
```

## B.3 La primera pasada son las flechas

Recorrer las fotos de una consigna sin calificar —para hacerse una idea del nivel antes
de poner notas— **no necesita un modo aparte**: son las flechas `←` y `→`, que pasan
directo a la foto anterior y a la siguiente salteando los criterios.

Es la misma pantalla y el mismo recorrido. El jurado mira las 47 fotos con la flecha, y
cuando quiere empezar a puntuar usa `TAB`. Un modo separado con sus propios botones sería
una pantalla más que mantener para algo que una tecla ya hace.

Queda entonces una regla simple: **las flechas miran, el `TAB` califica.**

## B.4 El visor y el teclado

```
        ┌──────────────────────────────────────────┐
        │                                          │
        │              la fotografía               │
        │                                          │
        ├──────────────────────────────────────────┤
        │ Consigna 3 · foto 12 de 47      CK-A7F2  │
        │                                          │
        │ ▸ Adecuación a la consigna    [1..0]  8  │
        │   Composición y técnica       [1..0]  –  │
        │   Creatividad y originalidad  [1..0]  –  │
        │   Impacto visual / narrativa  [1..0]  –  │
        └──────────────────────────────────────────┘
```

| Tecla | Qué hace |
|---|---|
| `→` | Foto siguiente, sin calificar |
| `←` | Foto anterior, sin calificar |
| `1` … `9` | La nota. **`0` vale 10** |
| `TAB` | Criterio siguiente. En el último, **pasa a la foto siguiente** |
| `⇧TAB` | Criterio anterior. En el primero, **vuelve a la foto anterior** |
| `F` | Pantalla completa |
| `Esc` | Salir de pantalla completa |

Las flechas y el `TAB` avanzan igual, y no se estorban: la flecha es para mirar, el `TAB`
para seguir calificando. Lo que esté puesto ya quedó guardado, así que saltear con la
flecha no pierde nada.

Ambos recorridos respetan el filtro: con *Sin calificar* puesto, la flecha salta las que
ya tienen nota.

**TAB entre criterios es el comportamiento nativo del navegador**, así que no se
secuestra la tecla: sólo se intercepta en los dos bordes. El visor le sirve igual a
alguien que navegue con lector de pantalla.

**Al elegir una nota, el foco avanza solo al criterio siguiente.** Una foto son cuatro
teclas en vez de ocho; si la nota salió mal, `⇧TAB` vuelve y se corrige.

Como `0` vale 10, los criterios **no son campos de escribir números**: son diez botones
por criterio, elegibles con el mouse o con la tecla. Las teclas habilitadas dependen de
la escala del criterio — en una rúbrica de 1 a 5, `6` a `9` y `0` no hacen nada.

## B.5 Guardar y enviar

```
cada nota          →  se escribe en la base en el momento
foto completa      →  guardada, NO bloqueada: se puede cambiar
"terminé por hoy"  →  muestra qué quedó sin terminar
enviar todo        →  recién ahí se cierra
```

Esto encaja con lo que ya existe: el motor guarda borradores sin exigir todos los
criterios (`requireAllRequired` sólo se activa al enviar) y bloquea únicamente al enviar.
Falta que la pantalla guarde **criterio por criterio** en vez de todo junto, el envío
final, y la alerta de fotos sin terminar.

Una foto sin terminar **no cuenta** para el resultado: entran sólo las enviadas. Por eso
el aviso aparece dos veces — al cerrar la tanda y al enviar todo.

## B.6 Cuánto le falta a cada uno

El visor mide cuánto tarda de verdad el jurado y le dice cuánto le queda. La tabla ya
existe sin usar: `FotorankJuryActivityHeartbeat`, con `activeSecondsAccumulated` y
`idleThresholdSeconds` en 75.

```
tiempo activo ÷ fotos calificadas = segundos por foto
segundos por foto × fotos que faltan = lo que le queda
```

**Tiempo de pantalla activa, no reloj de pared.** El latido se detiene con dos señales
distintas, y hacen falta las dos:

| Señal | Qué corta |
|---|---|
| `document.hidden` (Page Visibility) | Minimizó la ventana o se fue a otra solapa |
| Sin teclado ni mouse por 75 segundos | Dejó el visor a la vista y se levantó |

Sin la primera, cualquiera que deje la pestaña abierta toda la noche aparece trabajando
ocho horas. Sin la segunda, alcanza con dejar el visor en primer plano. El umbral de 75
segundos es el que ya trae el modelo.

**Nada se muestra hasta tener diez fotos calificadas.** Con tres, la media miente: las
primeras siempre son lentas porque la persona está entendiendo la escala. Antes de ese
mínimo el visor no arriesga ninguna estimación.

**En palabras y redondeado hacia arriba**: *"te queda alrededor de una hora y media"*,
nunca *"87 minutos"* — una estimación al minuto se lee como una promesa.

**Quién ve qué:**

| | Ve |
|---|---|
| Cada jurado | Su propia estimación, y sólo la suya |
| El organizador | El promedio del equipo y cuántas obras faltan |
| Nadie | El rendimiento individual de un jurado comparado con otro |

Esa separación es deliberada: el dato existe para que alguien sepa cuánto le falta, no
para medir a gente que muchas veces trabaja gratis.

**Y cierra el problema del tope.** La media guardada entre ediciones convierte el tope de
fotos por jurado —hoy un número elegido a ojo— en una decisión sobre el calendario: *"en
la 1ª edición un jurado tardó 18 segundos por foto; con 500 fotos son 2 h 30"*.

## B.7 Los tres fondos

**Gris neutro por omisión**, con oscuro y claro disponibles. La preferencia se recuerda
en el navegador de cada jurado.

No es una decisión estética. El fondo cambia cómo se percibe una fotografía: sobre negro
una foto oscura parece más contrastada de lo que es, sobre blanco una foto clara se
apaga. Los museos pintan las paredes de gris medio por la misma razón. Para alguien que
compara 47 fotos de la misma consigna, es que la nota no dependa del fondo.

Hoy FotoRank tiene un único tema oscuro fijo, así que los tres modos se construyen
**dentro del visor**, no en toda la aplicación.

---

## Qué no entra

- **Las dos vueltas** (descarte rápido y después criterios). Con 270 obras no hace falta.
  Se vuelve necesario alrededor de las 3.000, y la decisión de prometer *miradas por
  obra* en vez de *cantidad de jurados* deja esa puerta abierta sin tocar las bases.
- **Reasignar una obra suelta** de un jurado a otro. El conflicto de interés ya tiene su
  propio circuito.
- **Temas para toda la aplicación.** Sólo el visor.

---

## Cómo se prueba

Lógica pura con `node:test`, como el resto del módulo:

- `juradosRecomendados()`: el caso de 270 obras, el de menos obras que el tope, el de
  cero obras, y que nunca recomiende menos que el piso de 3.
- El reparto ya tiene 16 pruebas. Se suman las de **excepciones**: que una consigna
  redistribuida aparezca en la vacante nueva sin desaparecer de la original.
- La navegación por teclado: que `TAB` en el último criterio cambie de foto, que `⇧TAB`
  en el primero vuelva, que `0` valga 10, y que `6` no haga nada en una escala de 1 a 5.
- El filtro: que con *Sin calificar* las flechas salteen las que ya tienen nota, que
  *Sin terminar* muestre las de tres notas sobre cuatro, y que un filtro que deja la
  vista vacía vuelva a *Todas* en vez de mostrar una pantalla en blanco.
- El contador del resumen: que una foto con tres notas de cuatro cuente como *sin
  terminar* y no como calificada.

La verificación contra producción necesita **una sesión real de jurado**, que nunca se
hizo. Queda explícito: hasta que un jurado real entre y califique, nada de esto está
verificado de punta a punta.
