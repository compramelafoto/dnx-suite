# Las fotos de la portada

La portada tiene una franja de diez fotos que se desplaza sola. Muestra en dos
segundos lo que el texto tarda un párrafo en explicar: alguien apunta el celular
a un código y su foto termina en la pantalla del salón.

**Hoy están puestos diez marcadores de posición**, no fotos. Se ven violetas, con
el número y la frase "FOTO PENDIENTE". Funcionan para que la franja se pueda
mirar y ajustar, pero **no pueden salir a producción así**.

## Cómo se reemplazan

Cada archivo vive en `apps/subilafoto/public/inicio/`. Para cambiar una foto
alcanza con **pisar el archivo con el mismo nombre**. No hay que tocar código:
la lista de `lib/fotos-inicio.ts` apunta a esos nombres y el texto alternativo
ya está escrito.

Requisitos de cada archivo:

| | |
|---|---|
| Proporción | 3:2 horizontal |
| Tamaño | 1200 × 800 px es suficiente; se muestran a 184 px de alto |
| Formato | JPG |
| Peso | Menos de 200 KB cada una. Los diez juntos no deberían pasar de 1,5 MB |

El peso importa más de lo que parece: la portada la abre gente con datos móviles.

## Las diez escenas

El orden no es casual — alterna primeros planos y planos generales para que la
franja no se vea repetitiva al moverse.

| # | Archivo | Qué tiene que verse |
|---|---|---|
| 1 | `01-escanear-qr-en-la-mesa.jpg` | Una invitada apunta la cámara del celular al código de la mesa |
| 2 | `02-mirar-la-pantalla-del-salon.jpg` | Un grupo de amigos se reconoce en la pantalla grande |
| 3 | `03-celular-sobre-el-centro-de-mesa.jpg` | Primer plano: celular escaneando el centro de mesa impreso |
| 4 | `04-los-novios-miran-las-fotos.jpg` | Los novios se ríen mirando juntos las fotos |
| 5 | `05-mosaico-en-la-pantalla.jpg` | La pantalla del salón con un mosaico de fotos |
| 6 | `06-selfie-en-el-cumpleanos-de-quince.jpg` | Dos amigas se sacan una selfie en un quince |
| 7 | `07-abuela-subiendo-su-foto.jpg` | Una señora sube su foto, ayudada por un joven |
| 8 | `08-el-codigo-en-la-mesa.jpg` | El cartel con el código en foco, la fiesta desenfocada detrás |
| 9 | `09-festejo-frente-a-la-pantalla.jpg` | Invitados festejan cuando aparece su foto |
| 10 | `10-egreso-escolar-compartiendo.jpg` | Dos compañeros de egreso se muestran las fotos |

## Prompts para generarlas

Van en inglés porque los generadores responden mejor así. Las partes fijas —la
luz, el estilo, la proporción— son iguales en las diez a propósito: si cada foto
tiene una estética distinta, la franja se ve como un collage de bancos de imagen.

**Base común, pegar al final de cada prompt:**

> candid documentary event photography, warm ambient party lighting at night,
> string lights and bokeh in the background, natural skin tones, shallow depth
> of field, 35mm lens look, photorealistic, no text, no logos, no watermarks,
> 3:2 aspect ratio, horizontal

1. `A young woman at a wedding reception holding up her phone to scan a small printed code standing on the table, seen slightly from the side, other guests blurred behind her`
2. `A group of four friends at a party looking up and laughing at a large screen on the wall, seen from behind and slightly below, the screen glow lighting their faces`
3. `Close-up of a hand holding a phone over an elegant printed table centerpiece card, the phone screen showing the camera view, festive table setting around`
4. `A bride and groom sitting close together looking at a phone screen and laughing, warm evening light, reception in the background`
5. `A large screen at an event venue showing a grid of many small photographs, a few guests visible in the foreground from behind, dark room`
6. `Two teenage girls in party dresses taking a selfie together at a quinceañera celebration, colorful lights behind them`
7. `An older woman smiling while a young man helps her use her phone at a family celebration, both seated at a decorated table`
8. `Close-up of a small elegant printed sign with a square code on a party table, sharp focus on the sign, the celebration completely out of focus behind`
9. `A group of guests cheering and pointing at something off-camera at a party, arms raised, joyful expressions, dance floor lighting`
10. `Two high school students in formal clothes showing each other photos on a phone at a graduation party, warm indoor lighting`

### Lo que hay que revisar antes de darlas por buenas

- **El código nunca va a salir bien.** Ningún generador dibuja un QR que
  funcione: sale un cuadrado con manchas. A 184 px de alto no se nota, pero
  conviene que el código quede **chico y algo desenfocado** en la escena. Si en
  alguna foto se ve grande y nítido, esa foto no sirve.
- **Manos y dedos.** Es lo que peor sale. Las escenas 1, 3, 4, 7 y 10 tienen
  manos sosteniendo un celular; miralas al 100%.
- **Que no aparezca ninguna marca.** Ni de celular, ni de bebida, ni de salón.
- **Caras.** Que no se parezcan a alguien reconocible.

## La alternativa que recomiendo

Sos fotógrafo de eventos: **una sola foto real vale más que las diez generadas**,
y se nota. Si tenés material propio de casamientos, quinces o egresos que sirva
para estas escenas, usalo.

Con una condición que no es negociable: **hace falta autorización escrita de las
personas que se reconozcan**. El derecho a la imagen no se cede porque alguien
haya contratado un servicio de fotografía, y publicar una cara identificable en
la portada de un producto comercial es exactamente el caso que la ley alcanza.
Es especialmente delicado acá, porque el producto que vendemos trata justamente
de fotos de personas.

Un camino intermedio y rápido: fotos propias donde no haya caras reconocibles
—manos, nucas, el código sobre la mesa, la pantalla— y generadas sólo donde la
cara sea el punto de la escena.

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
- Va **entre el logo y el título**, dentro del hero. Por eso la sección del hero
  no tiene padding horizontal —lo pone cada bloque de texto— y por eso los
  degradados de los extremos usan el mismo púrpura del fondo: así las fotos
  entran y salen sin que se vea un borde.
- La lista se pinta dos veces y la pista se desplaza el 50% de su ancho. Para
  que el salto sea invisible, el espacio entre fotos va como `padding` de cada
  una y no como `gap`: con `gap`, veinte fotos dejan diecinueve espacios y la
  mitad del ancho no cae justo en el borde de la copia. Verificado: desfase de
  0 px.
- La segunda copia lleva `aria-hidden` y `alt` vacío. Si no, el lector de
  pantalla anuncia las diez fotos dos veces.
- Se detiene sola al pasar el puntero por encima o al llegar con el teclado, y
  no se mueve para quien pidió menos animación en su sistema
  (`prefers-reduced-motion`); en ese caso la franja se puede recorrer a mano.
- No usa `next/image` a propósito: cada foto se pinta dos veces por el bucle y
  el optimizador serviría dos variantes del mismo archivo sin ganancia.
