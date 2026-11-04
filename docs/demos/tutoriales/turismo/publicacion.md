# Publicación del «Curso de fotografía de turismo»

Misma metodología que el curso escolar (ver `docs/demos/tutoriales/escolar/publicacion.md`).

- **Copys:** `generar-manifiesto.py` genera `youtube-manifiesto.json` (para `subir.py --manifiesto`) y
  `apps/compramelafoto/lib/tutorials/turismo-course-details.ts` (lo que muestra la página de CLF).
- **Portadas:** `generar-portadas.py`, con el isotipo y «Curso de fotografía de turismo».
- **Página en CLF:** `/tutoriales/fotografia-de-turismo`. Las clases salen de `lib/tutorials/turismo-course.ts` y los
  links de YouTube se cargan en `/admin/tutoriales`, tarjeta «Curso de fotografía de turismo» (ajuste
  `tutorials_turismo_course`).
- **Referidos:** «Curso de fotografía de turismo (videos)» en el panel de referidos.
- **Canal:** DNX ESTUDIO. La lista de reproducción del curso todavía no existe: va en `listas.turismo`.

Reglas de Daniel para esta serie: la presentación con su nombre va solo en la primera clase, y las comisiones se
explican como si el Split 1:N ya funcionara.

## Estado

| # | Video | Duración | Copy | YouTube | CLF |
|---|---|---|---|---|---|
| T02 | Crear el álbum de la excursión | 0:55 | listo | falta el OK de Daniel | — |
| T03 | Precios y packs para turistas | 1:11 | listo | falta el OK de Daniel | — |
| T04 | Fotos ocultas hasta la selfie | 0:42 | listo | falta el OK de Daniel | — |
| T05 | El QR para el punto turístico | 0:42 | listo | falta el OK de Daniel | — |
