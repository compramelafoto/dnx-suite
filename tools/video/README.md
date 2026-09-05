# Videos de DNX Suite

Cadena para producir videos **verticales (1080×1920) y horizontales (1920×1080)** con
locución propia, subtítulos animados, música, efectos de sonido y **pantallas reales del
producto** filmadas del sitio en vivo.

Con esto se hicieron los videos de *protección de menores*, *programa de referidos* y el
tutorial de *creación de álbum* de ComprameLaFoto.

---

## 1. Cómo pedirlo

No hace falta saber nada de lo que sigue: alcanza con pegar un pedido con esta forma.
Cuanto más completo, menos vueltas.

```
Hacé un video vertical para CLF sobre <TEMA>.

- Idea / gancho: <qué quiero que sienta quien lo ve en los primeros 3 segundos>
- Qué tiene que quedar claro: <2 a 4 ideas, en orden>
- Pantalla real a mostrar: <URL pública, o "no hay, usá animaciones">
- Duración: <30 s para redes / 60-70 s para explicar bien>
- Música: <calma / rítmica / la misma que el video de X>
- Antes de grabar, pasame el guion para aprobarlo.
```

**Dos cosas que conviene pedir siempre:**

1. **"Pasame el guion antes de grabar."** Renderizar cuesta varios minutos; corregir
   una palabra en el guion cuesta segundos. Los tres videos que salieron bien se
   aprobaron en texto primero.
2. **"Verificá en el código todo lo que afirma el video."** Es la regla más importante
   de todas y está explicada abajo.

### Verificar antes de afirmar

Un video es una promesa pública. Antes de escribir el guion hay que leer el código y,
si hace falta, consultar la base de producción por MCP. En estos tres videos ese paso
evitó publicar cuatro cosas falsas o riesgosas:

- Se iba a decir que el fotógrafo elige cuántos días se guarda la selfie. Es cierto que
  existe la opción, pero en producción **no la usa casi nadie**, y decirlo debilitaba la
  promesa. Se sacó.
- Se iba a decir "IP anónima". Es **pseudónima**: no se puede leer, pero sí verificar
  contra una IP sospechada. La redacción correcta es la que quedó en el video.
- Se iba a invitar a recomendar organizadores como si pagaran comisión. El programa
  existe pero **nunca generó una sola comisión**; se agregó un cartel aclaratorio.
- El video de referidos dice que la comisión se acredita sola en Mercado Pago. Eso
  **todavía no pasa**: depende del split 1:N. El video está hecho, pero no se publica
  hasta que esté en producción.

---

## 2. Qué necesita la máquina

| Requisito | Cómo se resuelve |
|---|---|
| `ffmpeg` | `brew install ffmpeg` (ya instalado en esta Mac) |
| Playwright | Se toma de `apps/compramelafoto/node_modules`; se puede apuntar a otro con `PLAYWRIGHT_PKG` |
| Clave de ElevenLabs | En `~/.elevenlabs.env`, línea `ELEVENLABS_API_KEY=` |
| Python 3 y Node | Ya están |

Un video de 70 segundos consume unos 1.000 caracteres del plan de ElevenLabs (de
300.000 mensuales) más la generación de música y efectos.

---

## 3. La cadena, paso a paso

Todo trabaja sobre una carpeta de trabajo (`DIR`) que contiene `guion.json`.

```bash
export DIR=/ruta/a/mi-video
export ELEVENLABS_API_KEY=$(grep '^ELEVENLABS_API_KEY=' ~/.elevenlabs.env | cut -d= -f2-)

python3 pasos/1-voz.py    $DIR   # locución + tiempos de cada palabra
python3 pasos/2-audio.py  $DIR   # música y efectos de sonido
python3 pasos/3-plan.py   $DIR   # duración de cada escena, derivada de la voz
DIR=$DIR node pasos/5a-producto.mjs   # filma la pantalla real (si el guion la pide)
python3 pasos/4-master.py $DIR   # arma master.html con escenas y subtítulos
DIR=$DIR node pasos/5b-master.mjs     # graba todo en una sola pasada
python3 pasos/6-armar.py  $DIR   # mezcla video + voz + música + efectos

ffmpeg -i $DIR/crudo.mp4 -c:v copy -af "loudnorm=I=-15:TP=-1.5:LRA=11" \
  -c:a aac -b:a 192k -movflags +faststart $DIR/final.mp4
```

**La idea central:** el video se corta al ritmo de la voz, no al revés. Primero se
graba la locución completa, se miden los tiempos exactos de cada frase y recién
entonces se decide cuánto dura cada escena. Al revés — que fue como empezamos — la voz
queda cortada o con silencios.

En `ejemplos/` hay dos `guion.json` reales para copiar.

---

## 4. Reglas de estilo

Respetarlas es lo que hace que los videos parezcan de la misma familia.

**Colores** (los de la marca CLF):

| Token | Valor | Uso |
|---|---|---|
| `--crema` | `#f7f4ef` | Fondo de todas las escenas |
| `--tinta` | `#1f1c19` | Texto principal y fondo de subtítulos |
| `--naranja` | `#c27b3d` | Palabra destacada, kickers, acentos |
| `--naranja-claro` | `#e8a56d` | Palabra que se está diciendo en el subtítulo |
| `--verde` | `#4fa85f` | Plata, confirmaciones, "todo bien" |
| `--gris` | `#6f6a63` | Texto secundario |

**Tipografía:** títulos de 76 px en peso 800 con interlineado 1,08. Nunca más de dos
líneas. La palabra clave va en naranja dentro de un `<em>`.

**Subtítulos:** bloques de 3 a 4 palabras, cortando siempre en la puntuación. Chip
oscuro al 94 % de opacidad, 62 px, a 180 px del borde inferior. La palabra que se está
pronunciando se pinta en naranja claro. Las escenas de cierre pueden ir sin subtítulo
cuando la placa ya dice el mensaje.

**Espacio reservado:** las escenas llevan `padding-bottom: 430px` para que nada choque
con los subtítulos.

**Audio, con números y no a ojo:**

- Música **12 dB por debajo de la voz** (se mide con `ebur128`, no se estima), más
  compresor lateral para que baje sola cuando se habla.
- Efectos normalizados por pico: clics a −22 dB, avisos a −18, acreditaciones a −14,
  golpe de logo a −13.
- Mezcla final a −15 LUFS con techo en −1,5 dB.

**Ritmo:** intro de 2,5 s con el isotipo, una idea por escena, cierre de 6 a 8 s. Entre
60 y 70 segundos para explicar algo completo; 30 para redes.

---

## 5. Las trampas (esto es lo que más tiempo ahorra)

Cada una de estas costó una vuelta entera de producción.

**De la voz**

1. **Una sola lectura, nunca por partes.** Generar un audio por escena hace que el
   modelo cierre la entonación en cada corte y arranque en frío el siguiente. Suena
   troceado y artificial. Se genera todo junto y se usan los tiempos para cortar el video.
2. **La primera palabra siempre sale deformada.** "Si trabajás" se escuchaba "Así
   trabajás". La solución es generar con la palabra `Bueno.` adelante y cortarla con los
   tiempos que devuelve la API. Está automatizado en `1-voz.py`.
3. **El camello se lee como palabras sueltas.** `ComprameLaFoto` sonaba "Comprame La
   Foto". Al motor se le manda `Comprámelafoto` y el subtítulo muestra la marca bien
   escrita, gracias al mapa `display` del guion.
4. **Acentuación rioplatense, siempre.** Sin acento, el modelo dice "cómpramelafoto" y
   "recomendanos" a la española. Hay que escribirle las tildes: `comprámelafoto`,
   `recomendános`.
5. **Una frase por párrafo.** Separar las frases con línea en blanco es la señal más
   fuerte para que respete el punto final. Con estabilidad 0,62 y estilo 0,08 la lectura
   respeta la puntuación; con estilo alto se entusiasma y encadena oraciones.

**Del video**

6. **Este ffmpeg no tiene `drawtext` ni `libass`.** Los subtítulos no se pueden quemar
   con ffmpeg: se hacen en el navegador, que además permite animarlos palabra por palabra.
7. **El Chromium de Playwright no reproduce H.264.** El clip de la pantalla real que se
   inserta en el `master.html` tiene que ser **WebM (VP8)** o queda en blanco.
8. **El render sale más lento que el reloj.** Grabar una página pesada estira el video
   entre un 5 % y un 14 %. Por eso cada script informa su reloj real y el ensamblado
   corrige la velocidad. Sin esa corrección, la voz se desincroniza de a poco.
9. **`white-space: pre` rompe el salto de línea.** Se usaba para conservar los espacios
   entre palabras del subtítulo, pero desactiva el ajuste y los bloques largos se salen
   del cuadro. Va `pre-wrap`.
10. **Los adornos tapan el texto.** Todo elemento decorativo posicionado va con
    `z-index: 0` y los textos con `z-index: 3`.
11. **La grabación empieza antes que la animación.** Playwright graba desde que se crea
    la página; hay que anotar el desfasaje y recortar desde ahí, o el video arranca con
    varios segundos de pantalla en blanco.

**Del audio generado**

12. **Los efectos a veces salen mudos.** La API devolvió un obturador con pico de
    −44 dB, que amplificar habría llenado de ruido. `2-audio.py` verifica el pico y
    reintenta; `6-armar.py` nunca amplifica más de 12 dB.

**De marcas de terceros**

13. **No dibujar logos ajenos.** Si hace falta el logo de Mercado Pago o de cualquier
    otro, se usa el archivo oficial. Una marca reproducida de memoria queda peor que no
    ponerla.

---

## 6. Qué queda pendiente para el próximo

- La toma de pantalla real (`5a-producto.mjs`) es distinta en cada video: la URL, el
  encuadre y los clics salen del bloque `pantalla` del guion, pero la coreografía
  concreta se ajusta a mano.
- Las pantallas detrás de login todavía no se pueden filmar. La salida limpia es abrir
  un navegador con perfil persistente, que el dueño inicie sesión una vez y grabar
  después con esa sesión.
- Para que los videos se parezcan menos a una plantilla: falta movimiento de cámara
  (un zoom lento sobre la pantalla del celular), fundidos cortos entre escenas y una
  pizca de grano.

---

## 7. Trampas del formato largo (tutoriales de 2+ minutos)

Aparecieron haciendo el tutorial de creación de álbum. Son distintas de las de los videos
cortos y cuestan caro si se descubren tarde.

14. **La grabación del navegador NO corre a velocidad constante, y el desfasaje no es
    uniforme.** En un video de 2:36 el archivo salió 15 % más largo que el reloj, pero el
    atraso medido fue +0,2 s a los 27 segundos, +1,4 a los 57, **+2 a los 110** y de nuevo
    +0,5 al final. Corregir con un factor único deja las escenas bien pero **descoordina los
    subtítulos**, porque el error se acumula dentro de cada escena.

    La solución que funciona: **una marca de sincronismo**. Un cuadrado de 30 px en la esquina
    inferior derecha que cambia de negro a blanco en cada cambio de escena (`4-master-*.py` ya
    lo incluye). Después, `7-final.py` lee esa esquina del video ya renderizado, detecta los
    cambios y **ancla cada frase de la locución al segundo real donde su escena aparece**. La
    marca se elimina con `crop=1872:1053:8:8,scale=1920:1080`, un 2 % de zoom imperceptible.
    Deja de ser una estimación y pasa a ser una medición.

15. **La música tiene que durar más que el video.** Parece obvio y se pasa por alto: una pista
    de 145 s en un video de 156 s deja los últimos once segundos —el cierre— en silencio, y el
    desvanecido programado cae donde ya no hay audio. Pedir la música **después** de saber la
    duración final, con margen, y desvanecer sobre los últimos 6 segundos.

16. **Las escenas que llevan dos frases necesitan trato especial.** Al anclar por escena, las
    dos frases de una misma escena caerían en el mismo punto. La segunda tiene que conservar
    su pausa original respecto de la primera, o la voz se adelanta al subtítulo.

17. **Ninguna frase puede empezar antes de que termine la anterior.** Como los anclajes salen
    de una medición, una escena puede resultar más corta de lo planeado y su frase montarse
    sobre la siguiente. `7-final.py` aplica `inicio = max(deseado, fin_anterior + 0.35)` y avisa
    cuántas frases tuvo que correr. Es preferible una frase 0,9 s tarde que dos voces encimadas.

18. **Los tutoriales necesitan aire.** Una lectura corrida suena acelerada. `1b-pausas.py` corta
    la locución en frases usando los tiempos de la API e intercala 0,85 s de silencio, **sin
    regenerar la voz**: cada frase conserva su entonación original.

### Formato horizontal

`4-master-horizontal.py` arma el lienzo de 1920x1080: `padding-bottom: 250px` reservado para
subtítulos, títulos de 66 px, subtítulos de 48 px a 62 px del borde inferior y tarjetas en fila
en vez de apiladas. El resto de la cadena es igual.
