# Motor de los videos del curso «Empezá a vender en ComprameLaFoto»

Arma cada clase con la voz grabada por Daniel, la pantalla real filmada sobre la cuenta demo y placas propias.
Se corre desde una carpeta de trabajo fuera del repo (los audios, las filmaciones y la sesión no se versionan).

1. **Audios:** bajar `Cxx.m4a` de `gdrive:Audios ads clf/` a `audios/` y convertirlos a `wav/` (16 kHz, mono).
2. **Transcribir** con `whisper-cli` (modelo `ggml-large-v3-turbo`): por segmentos a `tx/` y palabra por palabra
   (`-ml 1 -sow`) a `txw/`. Buscar «vamos de nuevo», «corrección» o «punto N»: ahí Daniel repitió el párrafo.
3. **Limpiar** (`limpiar.py`): en `CORTES` van los tramos repetidos (se corta en los silencios) y en `POSTCORTES` los
   que aparecen al transcribir el audio limpio. Siempre se queda la última toma, la buena. Verificar re-transcribiendo
   `limpio/` palabra por palabra a `txl/`.
4. **Filmar** (`filmar/*.mjs`): Playwright con la sesión de la demo (`login.mjs` abre Chrome para que Daniel inicie
   sesión; guarda `sesion.json`, que dura 12 h). Cada `h.toma(n)` cambia el color de un cuadradito en la esquina, y el
   montaje lo detecta para sincronizar sin desfase. Nunca se toca «Crear álbum», «Crear cuenta», «Pedir invitación»
   ni «Desconectar».
5. **Placas** (`placas.py`): apertura y cierre de cada clase, y las pantallas que la demo no puede mostrar (Mercado Pago
   sin conectar o vencido, el cartel del cobro dividido) con los textos reales del código.
6. **Montar** (`montar.py C01 …`): cada toma de `clases.py` empieza donde la voz dice su «ancla». El video se acelera
   (hasta 2,5×) o se congela para durar lo mismo que la voz. Música `tutorial-calmo.mp3` muy baja. `revisar.py` arma
   una grilla con un cuadro por toma para controlar.
