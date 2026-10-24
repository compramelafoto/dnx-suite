# Mosaico del curso — Etapa 1: retratos, colegio y maestra — Plan

**Goal:** que el mosaico de una carpeta real se llene con los compañeros del padrón, cada uno con su
retrato oficial, y que no se imprima hasta que el curso esté cerrado.

**Spec:** `docs/superpowers/specs/2026-10-23-clf-mosaico-del-curso-design.md` (sección 1 y respuestas de Daniel).

## Decisiones

- **Retrato oficial** = columnas nuevas en `AlbumStudentRosterEntry`: `mosaicPhotoId` (FK a `Photo`, `SET NULL`),
  `mosaicPhotoAspect` (ancho ÷ alto de la foto), `mosaicPhotoCrop` (Json `{zoom,x,y}`, encuadre de la cara),
  `mosaicPhotoSource` (`FAMILY` | `PHOTOGRAPHER` | `SCHOOL`), `mosaicPhotoNeedsReview` (lo puso el colegio y el
  fotógrafo no lo confirmó).
- **Estado del curso** = tabla nueva `AlbumCourseMosaic` (una por álbum y curso del padrón, clave
  `rosterCourseKey`): `closedAt`, `closedByUserId`, `staffJson` (maestra, directora, auxiliar: `{role, name, photoId}`),
  `unidentifiedPhotoIdsJson` (retratos que el fotógrafo subió sin saber de quién son), `schoolTokenHash`,
  `schoolTokenExpiresAt` (enlace del colegio, 15 días).
- **La familia define el retrato**: al crear el diseño de un pedido de preventa con dueño en el padrón, la foto del
  hueco `photo_individual` pasa a ser el retrato del chico (fuente `FAMILY`), salvo que el curso esté cerrado o que el
  fotógrafo ya haya puesto otra (`PHOTOGRAPHER`).
- **Encuadre de la cara**: con la detección de caras guardada (`FaceDetection.bbox`, fracciones 0–1), la cara queda
  arriba del centro; sin detección, encuadre fijo de plano medio (zoom 1,3, corrido hacia arriba).
- **Compañeros**: los activos del mismo curso del padrón, sin el dueño. Con retrato: `photoId`, `photoUrl` (vista
  pública con marca de agua), `crop`, `sourceAspect`. Sin retrato: sólo el nombre (silueta).
- **Cuándo se calcula**: al crear el diseño y otra vez al aprobarlo (los retratos se completan después). `course.mosaic`
  queda **fuera de la huella** de la autorización de la familia: es del curso, no de la familia, y si no cambiar a un
  compañero anularía su autorización.
- **Bloqueo**: un diseño con mosaico no se aprueba mientras su curso no esté cerrado.
- **Maestra**: si la plantilla tiene `photo_teacher` y el curso tiene foto de la maestra, al aprobar se pone esa.
- **Colegio**: enlace sin cuenta `/escolar/mosaico/<token>`. Ve los retratos sin identificar y la lista del curso, y
  asigna nombres; también corrige los nombres de la maestra y directivos. Las fotos se sirven por una ruta propia que
  valida el token y devuelve la vista con marca de agua.
- **Fotógrafo**: pestaña nueva «Mosaico» en el área Escuela del álbum. Por curso: alumnos con su retrato (fuente y
  aviso de «puesto por el colegio, confirmar»), elegir o cambiar retrato, subir retratos sin identificar, maestra y
  directivos, enlace del colegio, cerrar y reabrir el curso.
- Sin padrón (canje externo del Excel) no hay mosaico, como dice el spec.

## Tareas

1. Migración + `schema.prisma` (aplicada a mano en las bases que comparten el esquema, con su fila en `_prisma_migrations`).
2. Lógica pura con pruebas: `lib/mosaico/encuadre-de-cara.ts`, `lib/mosaico/companeros.ts` (armado del valor),
   `lib/mosaico/token-del-colegio.ts`.
3. Lógica con base: cargar compañeros, registrar el retrato de la familia, estado del curso (cerrar, staff, token,
   sin identificar, asignar).
4. Integración: `loadSchoolDesignContext` → `courseMosaic`; registrar retrato al crear el diseño; huella sin
   `course.mosaic`; refresco y bloqueo en `approveDesignProject`; maestra en `photo_teacher`.
5. APIs y pantalla del fotógrafo.
6. Portal del colegio (página, APIs, foto por token).
7. Pruebas, tipos, revisión final, PR, fusión, migración en producción.
