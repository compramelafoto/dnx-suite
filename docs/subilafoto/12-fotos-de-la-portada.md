# Las fotos de la portada

La portada tiene una franja de fotos que se desplaza sola, entre el logo y el
título. Muestra en dos segundos lo que el texto tarda un párrafo en explicar:
alguien apunta el celular a un código y su foto termina en la pantalla del salón.

**Están puestas desde el 2026-09-12.** Son siete, generadas con ChatGPT por el
titular a partir de los prompts de más abajo. No son fotografías de personas
reales, así que no hay derecho a la imagen de por medio.

## Las siete que están

| # | Archivo | Qué se ve |
|---|---|---|
| 1 | `01-escanear-el-codigo.jpg` | Una invitada escanea con el celular el código de la mesa |
| 2 | `02-la-pantalla-del-salon.jpg` | Los invitados miran el mosaico de fotos en la pantalla |
| 3 | `03-selfie-en-la-fiesta.jpg` | Dos amigas se sacan una selfie |
| 4 | `04-el-codigo-en-la-mesa.jpg` | El cartel con el código, la fiesta desenfocada detrás |
| 5 | `05-los-novios-miran-las-fotos.jpg` | Los novios se ríen mirando el celular |
| 6 | `06-festejo-en-la-pista.jpg` | Invitados festejan y señalan la pantalla |
| 7 | `07-egreso-escolar.jpg` | Dos compañeras de egreso miran las fotos |

El orden **alterna primeros planos y planos generales** a propósito: con todos
los planos parecidos, la franja se ve repetitiva al moverse.

Cada una pesa entre 109 y 127 KB (1200 × 800, JPG progresivo al 82%). Las siete
juntas, **818 KB**. Importa: la portada la abre gente con datos móviles.

## Cómo se reemplaza o se agrega una

Los archivos viven en `apps/subilafoto/public/inicio/`. Para cambiar una foto
alcanza con **pisar el archivo con el mismo nombre** — no hay que tocar código.
Para agregar una nueva sí hay que sumarla a `lib/fotos-inicio.ts` con su texto
alternativo.

Requisitos: **3:2 horizontal**, 1200 × 800 px, JPG, menos de 200 KB.

## Las tres que faltan, si alguna vez se quieren sumar

No hacen falta —con siete la franja funciona— pero agregarían variedad:

- **Una persona mayor subiendo su foto, ayudada por alguien más joven.** Es la
  más valiosa de las tres: dice sin palabras que no hace falta saber de
  tecnología, que es la objeción más común.
- Un primer plano de la mano con el celular sobre el centro de mesa.
- Un grupo visto de espaldas mirando la pantalla.

Sus prompts están más abajo, en el bloque general.

## Prompts para generarlas

Con estos se generaron las siete que están puestas. Quedan acá para rehacer
alguna que no convenza o para sumar las tres que faltan.

Van en inglés porque los generadores responden mejor así. Las partes fijas —la
luz, el estilo, la proporción— son iguales en todas a propósito: si cada foto
tiene una estética distinta, la franja se ve como un collage de banco de imágenes.

### Lo más importante: que no parezcan hechas con IA

Una foto generada se delata por ser **demasiado perfecta**: todo el mundo mirando
a cámara, peinados impecables, ropa sin una arruga, luz de estudio, composición
centrada, nadie parpadeando. En una fiesta real nada de eso pasa.

Por eso cada prompt lleva instrucciones de imperfección. **No las saques.** Son
lo que separa una foto que parece de una fiesta de una que parece de un folleto.

**Bloque base, pegar al final de cada prompt:**

> shot on a phone camera by a guest, not a professional photographer. slightly
> off-center framing, imperfect composition, mild motion blur on someone moving,
> a bit of digital noise in the shadows, mixed and uneven lighting from party
> lights, some faces partly cut off at the edges of the frame, ordinary
> everyday people with imperfect hair and slightly wrinkled clothes, natural
> unretouched skin with visible pores and shine, nobody posing for the camera,
> candid unposed moment, real Argentinian party, 3:2 aspect ratio, horizontal,
> no text, no logos, no watermarks, photorealistic, NOT a stock photo, NOT
> studio lighting, NOT everyone smiling at the camera

### Los diez prompts

Los que ya están hechos van marcados. Los tres sin marcar son los que faltan.

1. ✅ `A young woman at a wedding reception holding up her phone to scan a small printed code on the table, seen from the side, other guests blurred and talking behind her, she is mid-movement and slightly out of focus`
2. ⬜ `A group of four friends at a party looking up at a screen on the wall and laughing, seen from behind and below, only the back of their heads and shoulders visible, the screen light spilling unevenly on them`
3. ⬜ `Close-up of a hand holding a phone over a printed card on a party table, the hand is slightly blurry, dirty plates and half-empty glasses around it, harsh direct flash`
4. ✅ `A bride and groom sitting close together looking down at a phone and laughing, her makeup a little worn after hours of party, his tie loosened, warm dim light`
5. ✅ `A screen at an event venue showing a grid of small photographs, seen at an angle from the side of the room, a few silhouettes of guests in the dark foreground, the screen slightly overexposed`
6. ✅ `Two teenage girls in party dresses taking a selfie, one has her eyes half closed, colorful uneven lights behind them, phone flash washing out their faces a little`
7. ⬜ `An older woman squinting at her phone while a young man leans in to help her, both seated at a messy table after dinner, warm yellowish indoor light`
8. ✅ `A small printed sign with a square code standing on a party table, seen up close and slightly tilted, crumbs and a wine stain on the tablecloth, the celebration completely out of focus behind`
9. ✅ `A group of guests laughing and pointing at something off-camera, arms raised, one person half out of frame, dance floor lights, slight motion blur`
10. ✅ `Two high school students in graduation clothes hunched over a phone showing each other photos, one is mid-sentence with his mouth open, cluttered background of other students`

### Cómo pedírselas a ChatGPT

Una por vez, no las diez juntas: si le pedís varias en un mismo mensaje, baja la
calidad de cada una. El mensaje que le mandás es:

> Generá una fotografía con esta descripción: **[el prompt del número que toque]**
> — **[el bloque base completo]**

Si la primera sale demasiado prolija, pedile literalmente: *"hacela menos
perfecta, como una foto sacada con un celular en una fiesta, no como una foto
profesional"*.

### Qué revisar antes de darlas por buenas

- **El código nunca va a salir bien.** Ningún generador dibuja un QR que
  funcione: sale un cuadrado con manchas. A 144 px de alto no se nota, pero
  conviene que el código quede **chico y algo desenfocado**. Si en alguna foto
  se ve grande y nítido, esa foto no sirve.
- **Manos y dedos.** Es lo que peor sale. Las escenas 1, 3, 4, 7 y 10 tienen
  manos sosteniendo un celular; miralas al 100%.
- **Que no aparezca ninguna marca.** Ni de celular, ni de bebida, ni de salón.
- **Caras.** Que no se parezcan a alguien reconocible.
- **La prueba final:** miralas las diez juntas. Si parecen de la misma sesión de
  fotos, están mal. Tienen que parecer sacadas por diez personas distintas.

## Sobre usar fotos reales — POR AHORA NO

Se optó por imágenes generadas. Queda escrito el motivo por si alguna vez se
reconsidera.

Una foto real de un evento propio se ve mejor que una generada, y se nota. Pero
tiene una condición que no es negociable: **hace falta autorización escrita de
las personas que se reconozcan**. El derecho a la imagen no se cede porque alguien
haya contratado un servicio de fotografía, y publicar una cara identificable en
la portada de un producto comercial es exactamente el caso que la ley alcanza.
Es especialmente delicado acá, porque el producto que vendemos trata justamente
de fotos de personas.

Un camino intermedio, si algún día se quiere mezclar: fotos propias donde no
haya caras reconocibles —manos, nucas, el código sobre la mesa, la pantalla— y
generadas sólo donde la cara sea el punto de la escena.

## A color, no en blanco y negro — DECIDIDO

FotoRank pone su franja en escala de grises y acá **no**. No es un descuido.

Son dos productos que muestran cosas distintas. FotoRank es un concurso de
fotografía: el gris saca de en medio el color para que se mire la composición,
que es lo que se juzga. Subí la Foto vende otra cosa —el clima de una fiesta— y
eso vive justamente en las luces de colores, el vestido, la torta. En gris, diez
fotos de fiesta parecen un archivo histórico.

Hay además una razón práctica: la franja va sobre el púrpura de la marca, entre
el logo y el título. En gris quedaría una banda apagada partiendo al medio la
parte más saturada de la página.

Si alguna vez se quiere probar, es una línea: agregar `grayscale` a la clase de
la imagen en `franja-fotos.tsx`.

## Detalles técnicos de la franja

- Está en `app/components/franja-fotos.tsx`. Es componente de servidor y **no
  lleva nada de JavaScript**: el movimiento es una animación de CSS
  (`slf-desfile`, en `globals.css`).
- Va **entre el logo y el título**, dentro del hero. El logo de arriba se
  dimensiona con `max-h-[30svh]`, es decir contra el **alto** de la pantalla y
  no contra el ancho: en el hero tienen que entrar el logo, la franja y la
  promesa, y el que se queda sin lugar es siempre el último. Con un ancho fijo,
  en una notebook de 720 px de alto el título quedaba 74 px abajo del pliegue.
  Medido en tres tamaños: en 1440×900 el logo va a 210×270 y entra hasta el
  párrafo; en 1280×720 va a 168×216 y el título entra con 35 px de sobra; en un
  celular de 375×812 va a 189×244. Por eso la sección del hero
  no tiene padding horizontal —lo pone cada bloque de texto— y por eso los
  degradados de los extremos usan el mismo púrpura del fondo: así las fotos
  entran y salen sin que se vea un borde.
- **La lista se pinta cuatro veces** (`COPIAS_DEL_BUCLE`) y la pista se
  desplaza exactamente una copia, el 25% de su ancho. Cuatro y no dos porque
  con siete fotos una copia mide 1.596 px: con dos copias, en un monitor ancho
  se vería el vacío del final al reiniciar. Con cuatro quedan 4.788 px detrás,
  que tapan hasta un ultrapanorámico. Hay un test que verifica que el número de
  copias y el `translateX` del CSS coincidan — es el error más fácil de cometer
  acá y el más difícil de ver.
- El espacio entre fotos va como `padding` de cada una y no como `gap`: con
  `gap`, N fotos dejan N−1 espacios y la fracción que recorre la animación no
  cae justo en el borde de la copia. Medido en el navegador: **desfase de 0 px**,
  una copia son 1.596 px y el desplazamiento del CSS también.
- La segunda copia lleva `aria-hidden` y `alt` vacío. Si no, el lector de
  pantalla anuncia las diez fotos dos veces.
- Se detiene sola al pasar el puntero por encima o al llegar con el teclado, y
  no se mueve para quien pidió menos animación en su sistema
  (`prefers-reduced-motion`); en ese caso la franja se puede recorrer a mano.
- No usa `next/image` a propósito: cada foto se pinta dos veces por el bucle y
  el optimizador serviría dos variantes del mismo archivo sin ganancia.
