# Publicación del «Curso de fotografía de turismo»

Misma metodología que el curso escolar (ver `docs/demos/tutoriales/escolar/publicacion.md`).

- **Copys:** `generar-manifiesto.py` genera `youtube-manifiesto.json` (para `subir.py --manifiesto`) y
  `apps/compramelafoto/lib/tutorials/turismo-course-details.ts` (lo que muestra la página de CLF).
- **Portadas:** `generar-portadas.py`, con el isotipo y «Curso de fotografía de turismo».
- **Página en CLF:** `/tutoriales/fotografia-de-turismo`. Las clases salen de `lib/tutorials/turismo-course.ts` y los
  links de YouTube se cargan en `/admin/tutoriales`, tarjeta «Curso de fotografía de turismo» (ajuste
  `tutorials_turismo_course`).
- **Referidos:** «Curso de fotografía de turismo (videos)» en el panel de referidos.
- **Canal:** DNX ESTUDIO, lista [Curso de fotografía de turismo | ComprameLaFoto](https://www.youtube.com/playlist?list=PLKqgKVjrkXso) (`listas.turismo`).
- **Foto de la tarjeta en /tutoriales:** `public/images/tutoriales/curso-turismo.jpg` (Caminito, foto libre de Pexels).

Reglas de Daniel para esta serie: la presentación con su nombre va solo en la primera clase, y las comisiones se
explican como si el Split 1:N ya funcionara.

## Estado

| # | Video | Duración | Copy | YouTube | CLF |
|---|---|---|---|---|---|
| T01 | La fotografía de turismo de punta a punta | 1:18 | publicado | [público](https://youtu.be/k20z2Wj6UDQ) | clase 1 |
| T02 | Crear el álbum de la excursión | 0:55 | publicado | [público](https://youtu.be/iQmkG7fBxGQ) | clase 2 |
| T03 | Precios y packs para turistas | 1:11 | publicado | [público](https://youtu.be/XBDfFcJUET0) | clase 3 |
| T04 | Fotos ocultas hasta la selfie | 0:42 | publicado | [público](https://youtu.be/oKPJX_xTuII) | clase 4 |
| T05 | El QR para el punto turístico | 0:42 | publicado | [público](https://youtu.be/avqC9UDXbmY) | clase 5 |
| T06 | Los interesados: el turista deja su contacto | 0:43 | publicado | [público](https://youtu.be/Y6T5tmdwxZc) | clase 6 |
| T07 | Subir las fotos del paseo | 0:41 | publicado | [público](https://youtu.be/QAklfcLxRI0) | clase 7 |
| T08 | El turista encuentra sus fotos con una selfie | 0:40 | publicado | [público](https://youtu.be/LHJ9FIc0GJU) | clase 8 |

La serie pasó a 13 clases (se sumó T10 «Empresas de turismo y agencias: cómo se organizan»).

**Pendiente para cuando vuelva la cuota de YouTube (se agotó el 2026-11-04; se renueva a las 0 h del Pacífico, 5 h en
Argentina):** subir T09 a T13 (copys y portadas listos), poner T01 primero en la lista, actualizar las descripciones de
T02 a T08 («Clase N de 12» → «de 13») y la de la lista («12 clases»), y cargar T09 a T13 en `tutorials_turismo_course`.

Los links están cargados en `tutorials_turismo_course` (producción). La página los muestra cuando se despliega el PR 941.
