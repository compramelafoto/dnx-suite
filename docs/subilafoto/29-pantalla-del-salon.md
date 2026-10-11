# La pantalla del salón

Todo lo que se proyecta en la fiesta, y quién lo maneja.

## Qué se ve, y en qué orden

Las fotos pasan **de a una**, siete segundos cada una, con un fundido. Cada **diez fotos**
la pantalla se vuelve entera el **código QR** durante doce segundos.

El QR se intercala y no vive en una esquina por dos razones: chico y encima de una foto,
a tres metros, no lo escanea nadie; y una sola vez al principio tampoco sirve, porque la
gente llega durante toda la noche.

**Con cero fotos la pantalla es el QR todo el tiempo.** Es el momento más importante —el
salón llegando y nadie subió nada— y si ahí la pantalla no muestra el código, el evento
no arranca nunca.

Los **mensajes** se intercalan entre las fotos, dibujados como un globo de chat.

## Los tres carteles

| Momento | Qué muestra |
|---|---|
| Antes de la ventana | "Ya podés ir sacando fotos" + invitación al QR |
| Durante | Las fotos, el QR intercalado y los mensajes |
| Después | El texto de cierre del fotógrafo, o "Gracias por la noche" |

Son **tres y no dos**. Hasta el 2026-10-09 se decidía mirando `puedeSubir`, que es falso
*antes* y *después*: enchufar el televisor media hora antes mostraba "Gracias por la
noche" a un salón que recién se estaba llenando.

## Las reacciones

El invitado toca uno de **seis emojis** y sube volando por la pantalla en menos de dos
segundos, con un contador arriba a la izquierda.

**La lista es cerrada y por eso puede pasar sin moderación.** Si se aceptara texto libre,
la pantalla sería un cartel abierto donde cualquiera con el QR escribe lo que quiera,
proyectado en grande y sin nadie revisando. Esa es la razón de que no haya ningún campo
de texto en la barra de reacciones, y conviene que siga así.

Dos frenos, para dos problemas distintos:

- **Un segundo entre reacción y reacción**, para que una persona apoyada en el botón no
  llene la pantalla.
- **200 por invitado en toda la noche**, para que el contador no termine midiendo quién
  tuvo más paciencia.

El recorrido tiene deriva y giro sorteados por emoji: uno que sube derecho se lee como una
animación, uno que se bambolea se lee como alguien reaccionando.

### Por el canal

Las reacciones sueltas y el contador van **separados** a propósito: las sueltas son la
animación y se pueden perder sin consecuencia; el contador es el número que se proyecta y
tiene que ser el de verdad. Por eso llega completo cada diez segundos.

Como máximo 30 reacciones por vuelta: en el brindis pueden llegar cientos en un segundo y
mandarlas todas haría una nube ilegible.

## Los mensajes

El invitado escribe hasta **140 caracteres**. No es por el costo: un párrafo proyectado a
tres metros no lo lee nadie y siete segundos no alcanzan.

**Siempre esperan al fotógrafo.** Un emoji puede pasar sin moderar porque no puede decir
nada; un texto puede decir cualquier cosa, y Rekognition mira imágenes, no juzga texto.
El estado inicial lo decide `validarMensaje`, no quien la llama: no hay forma de que la
ruta publique uno sola. Hay una prueba cuyo único trabajo es fallar si alguien cambia eso.

Se aprueban en **Moderación**, donde se muestra el texto entero —no un recuadro de "vista
no disponible"— porque aprobar sin poder leer el final sería aprobar a ciegas.

### En la descarga

Los mensajes entran al ZIP **como imagen**, con el mismo globo. Un `.txt` suelto entre
trescientas fotos no lo abre nadie.

**Limitación conocida:** los emojis salen monocromos o como cuadraditos, según las fuentes
del servidor. Resolverlo pide empaquetar una fuente de emojis en la función.

## El mando del DJ

La pantalla **no tiene botones a la vista**: serían una barra gris proyectada en la pared
toda la noche. **Se maneja con el teclado** de la computadora conectada al televisor.

Hubo dos intentos antes de llegar acá. El primero fue una franja invisible en el borde
izquierdo, que no encontraba nadie ni sabiéndolo. El segundo, una pestaña tenue que decía
"CONTROLES": se encontraba, pero seguía siendo una caja gris al lado de las fotos durante
toda la fiesta, y había que ir a buscarla con el mouse o con el dedo.

| Tecla | Qué hace |
|---|---|
| Barra espaciadora | Pausa y reanuda. Deja fija la foto que está, para el brindis. |
| Flecha derecha, o `N` | Pasa a la siguiente sin esperar. |
| `A` | Alterna entre pasar en orden y pasar al azar. |
| `H` o `?` | Muestra los atajos, por si se olvidaron. |

Con `Ctrl`, `Cmd` o `Alt` apretado no hacemos nada: `Cmd+A` es "seleccionar todo" y
`Ctrl+N` abre una ventana. Robarle esas teclas al navegador en la máquina que maneja la
proyección es la forma más rápida de que alguien no pueda hacer algo urgente a mitad de
la fiesta.

**Cada tecla deja un cartelito abajo a la izquierda** que dice en qué quedó —«En pausa»,
«Pasa al azar»— y se borra a los cuatro segundos. No es decoración: sin botonera, es la
única señal de que la tecla llegó. Apretar la barra y que no pase nada visible es
indistinguible de un televisor colgado. Por lo mismo, el cartel arranca mostrando los
atajos al abrir la pantalla: un mando invisible que nadie sabe que existe es un mando que
no existe.

**El precio**: sin teclado no hay control. Si el televisor se maneja sólo con control
remoto, la pantalla funciona igual sola —pasa las fotos e intercala el QR— pero no se
puede pausar ni adelantar.

**No se guarda.** Si el televisor se reinicia a mitad de la fiesta vuelve solo a
reproducir en orden, en vez de quedarse en pausa por algo que alguien tocó hace dos horas.

### Por qué el azar no es sortear cada turno

Sortear turno por turno haría que toque tres veces la misma foto mientras otras no
salieron. Se baraja la lista entera y se recorre; al terminar, se vuelve a barajar.

Todo determinista desde una semilla sacada del código del evento: **la pantalla se
redibuja muchas veces por minuto y un sorteo inestable cambiaría la foto en cada
repintado.**

## Cómo se la pasa al DJ

En el panel, **Pantalla y proyección**: el enlace con un botón para copiarlo, los pasos de
pantalla completa para Windows y Mac, y la explicación del mando.

El enlace de la pantalla **no es el de los invitados** y no se comparte con ellos: ellos
usan el QR.

### La pestaña tiene que quedar adelante

La rotación la lleva un `setTimeout` en el navegador, y **los navegadores frenan los
temporizadores de las pestañas que nadie está mirando**. Si esa ventana queda tapada por
otra, o la computadora apaga la pantalla, o entra el protector de pantalla, las fotos
dejan de pasar hasta que alguien vuelva a la ventana.

Comprobado el 2026-10-10 midiendo la pantalla de producción con el panel del navegador
oculto: **cien segundos sin que cambiara nada**. Con el panel a la vista, el mismo ciclo
dio 14,8 s de fotos y 21,3 s de QR, que es lo que corresponde al ritmo de arranque.

No se puede arreglar desde el código —es el comportamiento del navegador, y además es el
correcto para no gastar batería—. Está avisado en el instructivo del panel, en un recuadro
al lado de los pasos de pantalla completa, porque es la causa número uno de que la pantalla
*parezca* colgada.

## Dónde está cada cosa

| Archivo | Qué |
|---|---|
| `app/pantalla/[codigo]/page.tsx` | Qué cartel toca y qué datos bajan |
| `app/pantalla/[codigo]/proyeccion.tsx` | La proyección, el mando y los emojis |
| `lib/pantalla-cartel.ts` | Los tres momentos |
| `lib/pantalla-ritmo.ts` | Cuándo toca el QR |
| `lib/pantalla-reproduccion.ts` | Orden o azar |
| `lib/reacciones.ts` | Emojis válidos, frenos y contador |
| `lib/mensajes.ts` | Validación y limpieza del texto |
| `lib/paquete/mensaje-a-imagen.ts` | El globo dibujado para el ZIP |
| `app/api/e/[codigo]/vivo/route.ts` | El canal en vivo |
