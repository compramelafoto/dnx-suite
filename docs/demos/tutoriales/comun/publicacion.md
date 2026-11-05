# Video 1-B: «¿Cuánto cuesta ComprameLaFoto?»

Va en **todos** los cursos de CLF, justo después de la clase 1, para que de entrada se sepa cuánto se
paga. Se sube **una sola vez** a YouTube (canal DNX ESTUDIO) y se suma a cada lista en la posición 2.

- Copy, capítulos, etiquetas y portada: `generar.py` (escribe `youtube-manifiesto-comun.json` y
  `apps/compramelafoto/lib/tutorials/costo-lesson-detail.ts`).
- En CLF es una clase sin número (`lib/tutorials/costo-lesson.ts`): su link de YouTube vive en el código,
  no en el ajuste de cada curso, porque es el mismo video para todos.
- Para sumar un curso nuevo: agregar `COSTO_LESSON` a sus `extras` en `lib/tutorials/courses.ts` y sumar
  su lista a `LISTAS` en `generar.py`.

| Video | Estado | YouTube |
|---|---|---|
| 1-B ¿Cuánto cuesta ComprameLaFoto? | Listo para subir | — |
