# Cantidad de disparos por modelo de cámara (modelos vistos en CLF)

Fecha: 27/11/2026. Fuente: documentación oficial de ExifTool (TagNames de Nikon, Canon, Sony y Panasonic, más su
historial de versiones en CPAN). **No se probó todavía con fotos reales**: es lo que dice la documentación.

Base: 317.533 fotos de 67 modelos en `PhotographicCameraBody` (rama Neon de prueba, copia de producción).
Hoy CLF no guarda las MakerNotes, así que ninguna foto tiene el dato cargado.

## Resumen

| Marca | Modelos con dato | Fotos con dato | Modelos sin dato o dudosos |
|---|---|---|---|
| Nikon | 31 de 31 (`ShutterCount`, 0x00a7) | 119.947 (37,8 %) | — |
| Canon | 6 de 25: R6, R6 Mark II, R8, R7, R100, R6 Mark III | 114.686 (36,1 %) | Todas las réflex, M50 Mark II y EOS R original: 67.959 fotos (21,4 %) |
| Sony | 5: 6400, A7 III, A7C, 6700, A7 V | 10.390 (3,3 %) | Dudosos: A7 IV, 6000, ZV-E10 (4.495 fotos, 1,4 %) |
| Panasonic | 0 | — | DMC-FZ100 (56 fotos) |
| **Total** | | **245.023 (77,2 %)** | |

## Detalle por modelo

| Modelo | ¿Trae disparos en JPEG? | Etiqueta de ExifTool | Versión mínima | Nota |
|---|---|---|---|---|
| Canon EOS R6 | Sí | ShutterCount (CameraInfoR6) | 12.68 | Suma electrónico y mecánico |
| Canon EOS R6 Mark II | Sí | ShutterCount (CameraInfoR6m2) | 13.08 | Suma electrónico y mecánico |
| Canon EOS R8 | Sí | ShutterCount (CameraInfoR6m2) | 13.28 | Electrónico + EFCS |
| Canon EOS R7 | Sí | ShutterCount (CameraInfoR7) | dudosa | Panorámicas guardan 0/65535 |
| Canon EOS R100 | Sí | ShutterCount (CameraInfoR100) | — | Electrónico + EFCS |
| Canon EOS R6 Mark III | Sí, con reparo | ImageCount (16 bits) | 13.43 | Vuelve a cero pasado 65.535 |
| Canon EOS 6D, 6D Mark II, 5D Mark IV, 7D, 7D Mark II, 60D, 70D, 77D, 80D, 4000D/T100, T3, T3i, T5, T5i, T6i, T7, M50 Mark II, EOS R | No | — | — | `FileNumber`/`FileIndex` no sirven: es el número de archivo |
| Nikon (D40, D90, D3100–D3500, D4, D4S, D500, D5100–D5600, D610, D7000–D7500, D750, D780, D800, D800E, D810, D850, Z5, Z5 II, Z6 II, Z6 III, Z50 II) | Sí | ShutterCount (0x00a7) | — | Los Z pueden traer además MechanicalShutterCount (0x0037) |
| Sony A6400, A7 III, A7C | Sí | ShutterCount (Tag9050b) | — | |
| Sony A6700 | Sí | ShutterCount (Tag9050d) | — | Sólo obturador mecánico |
| Sony A7 V (ILCE-7M5) | Sí | ShutterCount (Tag9050d) | 13.44 | Sólo obturador mecánico |
| Sony A7 IV | Dudoso | — | — | La documentación no lo ubica en una tabla con contador; terceros dicen que sí |
| Sony A6000 | Dudoso | Probablemente Tag9050a | — | Puede volver a cero (módulo 65536) |
| Sony ZV-E10 | Dudoso | — | — | No figura en tablas con contador |
| Panasonic DMC-FZ100 | No | — | — | Panasonic no graba contador |

## Prueba con fotos reales (27/11/2026, ExifTool 13.55)

540 fotos de la Mac de Daniel. Lectura: `ShutterCount`, `MechanicalShutterCount`, `ImageCount`, `Software`.

| Archivo | Resultado |
|---|---|
| Nikon D780, NEF (RAW) | 70 de 70 con `ShutterCount` (ej. 290.993) **y** `MechanicalShutterCount` (ej. 290.632) |
| Sony A7C, ARW (RAW) | 39 de 39 con `ShutterCount` (ej. 177.835); sin contador mecánico aparte |
| Sony A6400, ARW (RAW) | 1 de 1 con `ShutterCount` |
| Nikon D5500 y D5600, JPEG de cámara | 6 de 6 con `ShutterCount` |
| Sony A7 III, JPEG de cámara | 1 de 1 con `ShutterCount` |
| Canon EOS R, JPEG de cámara | 0 de 15 (coincide con la documentación: no graba) |
| Sony A6400, JPEG con `Software` de la cámara | 0 de 9: **sin ninguna nota de Sony**; probablemente pasaron por la app del celular |
| JPEG exportados (Capture One, Lightroom, Photoshop, Snapseed, AfterShoot) | **0 de ~400**, de todas las marcas (Nikon D780 desde Capture One: 0 de 116) |
| DNG hechos con Adobe DNG Converter (Canon 5D IV, Nikon Z5) | 0 |

Conclusiones:
- La documentación se confirma en los modelos probados: Nikon y Sony graban el dato; la Canon EOS R no.
- **Cualquier exportación o pasaje por app lo borra.** El campo `Software` con el nombre de la cámara no alcanza para
  saber si el archivo es original.
- El RAW (NEF, ARW, CR3) siempre lo conserva y es la prueba más confiable; un RAW pesa 25–60 MB, por eso se lee en el
  navegador y se manda sólo el comienzo del archivo.
- La D780 trae los dos contadores: con 290.993 totales y 290.632 mecánicos, se puede mostrar el mecánico.

## Advertencias para el diseño

- Usar siempre la **última versión de ExifTool**: los modelos nuevos se suman versión a versión.
- El dato vive en las **MakerNotes**: se pierde al exportar desde Lightroom u otros editores, o al pasar por WhatsApp
  y redes. Sólo sirve el archivo tal como sale de la cámara.
- **No todas las marcas cuentan lo mismo**: Nikon y Canon R6/R7 suman mecánico y electrónico; Sony 6700 y A7 V sólo
  mecánico. La ficha debe decir qué se contó cuando se sepa.
- Algunos contadores **vuelven a cero** (R6 Mark III, Sony Tag9050a): el control «no puede bajar respecto de lo visto
  en CLF» tiene que contemplarlo.
