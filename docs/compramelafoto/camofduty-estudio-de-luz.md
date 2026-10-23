# Cam Of Duty — Estudio de luz 3D

Ruta: `/camofduty/estudio` (app `compramelafoto`).

## 1. Análisis de Virtual Lighting Studio (zvork.fr/vls)

Hoy el sitio no arranca en Chrome: carga su librería (Dojo 1.7.1, de 2012) por
`http://` dentro de una página `https://`, y el navegador la bloquea por
"contenido mixto". Queda para siempre en "Cargando…". Forzando la carga de Dojo
por `https` la interfaz aparece, pero el visor principal queda negro.

Leyendo su código (`js/Application.js`, `Compositor.js`, `LightState.js`,
`CameraState.js`, `LightResponse.js`) se reconstruye todo lo que hace:

| Función | Cómo la resuelve VLS |
| --- | --- |
| Motor | **No es 3D.** Usa fotos pre-renderizadas de cada luz en cada posición y las suma en un `<canvas>` (modo `lighter`), con una curva fílmica al final. |
| Posiciones | Grilla fija: 14 ángulos horizontales × 7 verticales × 3 distancias (0,5 / 1 / 2 m). Se mueve con botones (girar, subir, bajar, acercar, alejar), no se arrastra. |
| Luces | Hasta 6 + luz ambiente. Encender, **solo**, gel de color, intensidad en EV con la rueda del mouse. |
| Modificadores | Flash pelado, snoot, ring light 25 cm, softbox 40×50, softbox 60×90 (cada uno con su pérdida en EV). |
| Medición | Modo TTL (0 = exposición correcta) o manual: número guía, EV, lux, lúmenes; cámara con obturador, diafragma, ISO. |
| Modelos | 4 cabezas (escaneo de Lee Perry-Smith y variantes). |
| Capturas | 7 ranuras para guardar y volver a un set; "Guardar como" de la miniatura. |
| Compartir | Enlace con el set serializado. |
| Esquema | Vista esquemática del estudio, intercambiable con la vista de cámara. |

Limitaciones: posiciones discretas, sin arrastre, sin sombras proyectadas al
fondo, sin reflectores, sin luz continua, sin fondo configurable, sin enseñar
qué esquema estás armando.

## 2. Lo que tomamos de Set a Light 3D

Escena 3D real con luces que se arrastran con el mouse, vista del set y vista
de cámara, planta desde arriba, modificadores visibles en el set, reflectores,
geles, balance de blancos y exportar el esquema de iluminación.

## 3. Qué construimos (la suma de las dos, mejorada)

- **Set 3D navegable**: ciclorama con curva infinita, piso, pies de luz,
  cuerpo de cámara. Girar alrededor con el mouse, rueda para acercar.
- **Arrastrar luces** en 3D por el piso; **Shift + arrastrar** sube o baja;
  **rueda sobre una luz** cambia la potencia en tercios (como en VLS).
- **Planta 2D** con luces y cámara arrastrables, haz de cada luz con el color
  del gel, campo de visión de la cámara. Se descarga como SVG.
- **Vista de cámara** con encuadre 3:2 real según la focal, y miniatura de la
  otra vista; tocarla intercambia (como en VLS).
- **15 modificadores** en cuatro grupos: duros (reflector, panal, snoot, plato
  de belleza, ring light), suaves (softbox 40×50 y 60×90, octabox 120,
  stripbox 30×120, paraguas), continuos (panel LED con temperatura, fresnel)
  y rebotes pasivos (reflector blanco, plateado y dorado, que devuelven la luz
  que les llega de las otras).
- **Sombras reales** cuyo borde se suaviza según el tamaño de la fuente y su
  distancia (la regla del "tamaño aparente").
- **Fotómetro de mano**: lectura incidente en la cara, aguja de −3 a +3 EV,
  lectura por luz, lado iluminado, relación luz/sombra (3:1, 4:1…), fondo
  respecto del sujeto e histograma con aviso de zonas quemadas o empastadas.
- **Física de exposición correcta**: ley de la inversa del cuadrado, el flash
  no depende del obturador y la luz continua sí, aviso de sincronización
  (sobre 1/250 aparece la franja negra de la cortina), luz de la sala.
- **Ajuste a la cámara (TTL)**: cada luz se puede ajustar a una exposición
  buscada (0, −1, +1 EV…), como el modo automático de VLS.
- **Entrenador**: reconoce el esquema que armaste (mariposa, loop, Rembrandt,
  split, contraluz, luz desde abajo, plana; iluminación corta o ancha) y
  explica qué hacer.
- **14 esquemas clásicos** que se arman solos con potencias calculadas:
  Loop, Rembrandt, Mariposa, Clamshell, Split, Tres puntos, Clave alta,
  Clave baja, Doble contraluz, Cine cálido/frío, Ring light, Luz de ventana,
  Iluminación corta e Iluminación ancha.
- **Escena**: 4 modelos (tres tonos de piel y busto de yeso para estudiar sólo
  formas), giro del sujeto, 6 fondos, luz de la sala.
- **Cámara**: focal 24–200 mm, diafragma, obturador, ISO, balance de blancos,
  altura, distancia y ángulo.
- **6 capturas** que guardan foto y set (quedan en el navegador), descarga en
  JPG, **compartir set** por enlace, **deshacer / rehacer** y atajos de teclado.

## 4. Archivos

- `lib/simulator/studio-light/` — lógica pura: tipos, modificadores y geles,
  fotómetro, esquemas, enlace compartible, estado. Pruebas en
  `studio-light.test.ts` (`pnpm --filter compramelafoto test:estudio-luz`).
- `components/simulator/studio-light/` — escena 3D, luces, planta, paneles.
- `public/camofduty/models/head/` — escaneo de Lee Perry-Smith
  (Infinite-Realities, CC BY 3.0), tomado del repositorio de three.js.
