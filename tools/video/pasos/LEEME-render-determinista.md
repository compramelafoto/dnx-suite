# Render determinista (alternativa a grabar en tiempo real)

Los pasos `5b-master.mjs` + `6-armar.py` graban la página **en tiempo real** con el
grabador de Playwright. Funciona, pero en esta Mac, a 1080×1920, el grabador **no llega
a capturar 25 fotogramas por segundo y duplica cuadros**. El resultado es un video más
largo que el reloj real y, peor, **estirado de forma despareja**: en la primera parte va
casi bien y al final acumula segundos de retraso.

Se ve así: la voz dice una cosa y el subtítulo o la animación van corriéndose cada vez
más. Ningún factor único de velocidad lo arregla, porque el estiramiento no es parejo.

Estos tres pasos lo resuelven renderizando **cuadro por cuadro con reloj virtual**:
el tiempo de la página lo controla el renderizador, así que 25 fps son exactamente
25 fps, sin importar cuánto tarde la máquina en dibujar cada cuadro.

## Cómo se usa

```bash
DIR=<carpeta-del-video> node pasos/5c-render-determinista.mjs   # ~2 min, 1518 PNG
python3 pasos/6b-video-en-tramos.py <carpeta-del-video>          # video sin audio
python3 pasos/6c-mezcla-audio.py <carpeta-del-video>             # mezcla.wav
ffmpeg -i solo-video.mp4 -i mezcla.wav -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-15:TP=-1.5:LRA=11" -c:a aac -b:a 192k -movflags +faststart \
  -shortest final.mp4
```

`master.html` no cambia, salvo por dos detalles obligatorios que se explican abajo.

## Las cuatro trampas que hay que respetar

**1. La página tiene que moverse siempre, aunque no se note.**
`Page.captureScreenshot` espera un cuadro nuevo del compositor. Si la página queda
quieta, la captura **se cuelga para siempre**. Solución: un ancla de 2×2 píxeles del
color del fondo con una animación infinita.

```css
#ancla{position:fixed;left:0;top:0;width:2px;height:2px;background:#f7f4ef;z-index:1;
  animation:latido .08s steps(2) infinite}
@keyframes latido{0%{opacity:1}50%{opacity:.35}}
```

**2. La superficie no puede quedar totalmente transparente.**
Durante el tramo de la pantalla real la página sólo tiene el subtítulo encima; cuando no
hay subtítulo en pantalla, no queda nada que dibujar y la captura vuelve a colgarse. El
mismo ancla del punto 1 lo cubre (un velo con `rgba(0,0,0,0.004)` **no** sirve: el alfa
se redondea a cero y desaparece).

**3. Nada de `<video>` dentro de la página.**
Con el reloj virtual pausado, un `<video>` no puede buscar cuadros: el evento `seeked`
nunca llega y el render queda colgado. La pantalla real se compone **después**, con
ffmpeg (`6b-video-en-tramos.py`), por debajo de los PNG transparentes.

**4. El audio se arma aparte.**
Meter la secuencia larga de PNG y la cadena de audio en un mismo comando de ffmpeg lo
deja colgado escribiendo 48 bytes. Video por un lado, audio por el otro, y recién ahí
se unen.

## Otras cosas de este ffmpeg que ya costaron tiempo

- **No tiene `drawtext` ni `libass`**: los subtítulos no se pueden "quemar" con ffmpeg.
  Por eso se dibujan en HTML.
- **`tpad` no acepta `stop_duration`**: para alargar un clip hay que concatenar tramos.
- **`overlay` con `eof_action=pass` corta igual** cuando la entrada superpuesta termina.
  Por eso `6b-video-en-tramos.py` encodea tres tramos y los une, en vez de superponer
  todo en un solo grafo.
- **`sidechaincompress` termina cuando se acaba la llave**: si la llave es la voz, la
  música se corta ahí y la mezcla queda más corta que el video. Hay que rellenar la
  llave con `apad=whole_dur=<total>`.
- **La duración que declara el contenedor de un webm grabado miente.** No sirve para
  calcular velocidad; medir con marcas dentro de la imagen.

## Sobre el sonido

- La música que genera ElevenLabs vino **11 dB más fuerte que la voz** (−14,1 contra
  −25,2 LUFS). A ganancia fija tapaba la locución. Se mide en LUFS y se baja 12 dB por
  debajo de la voz, más ducking.
- Los efectos generados **pueden salir casi mudos**: el obturador salió con pico −44,6 dB
  y necesitaba +30 dB de amplificación. El paso 6c limita la ganancia a +12 dB y avisa;
  cuando avisa, hay que regenerar el efecto, no amplificarlo.

## Sobre la locución

Generar un audio por escena hace que el modelo **cierre la entonación en cada corte** y
suene a lectura de máquina. Va todo en **una sola llamada** al endpoint
`/with-timestamps`, que además devuelve el tiempo de cada carácter: con eso se arman los
subtítulos palabra por palabra y **se corta el video al ritmo de la voz**, no al revés.

La primera palabra es la que más se deforma ("Si trabajás" se escuchó "Así trabajás").
Conviene que el guion no arranque con un monosílabo.

## Cómo se escribe la marca para la voz

El modelo lee **ComprameLaFoto** como tres palabras ("cómprame la foto"), porque las
mayúsculas intercaladas le marcan los cortes. En el texto que lee la voz hay que
escribirla **`Comprámelafoto`** (todo junto, con tilde en la "á"), y en el guion declarar:

```json
"display": { "Comprámelafoto": "ComprameLaFoto" }
```

Así la voz la pronuncia bien y los subtítulos la muestran escrita como corresponde.
