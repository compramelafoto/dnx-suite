# Publicación del «Curso de fotografía escolar»

Cómo se publican los videotutoriales de la serie escolar de ComprameLaFoto: el copy de cada video, el llamado a
la acción, la subida a YouTube y el alta en la página de Tutoriales de CLF.

Lema del curso: **La herramienta definitiva para organizar tu fotografía escolar.**

## Dónde está cada cosa

- **Videos terminados:** `docs/demos/tutoriales/escolar/videos/` en el checkout principal. No van a git (la
  carpeta tiene un `.gitignore` con `*`) y se suben desde ahí, sin copiarlos.
- **Copys:** `generar-manifiesto.py` (la fuente) genera `youtube-manifiesto.json` (lo que lee `subir.py`).
  Para cambiar un título o una descripción se edita el script y se vuelve a generar el manifiesto.
- **Capítulos:** salen del audio final de cada video, transcripto con ElevenLabs, no del guion. YouTube exige
  que el primero sea `0:00`, que haya al menos tres y que cada uno dure 10 segundos o más.
- **Herramienta de subida:** `tools/video/youtube/` (fuera de git, en el checkout principal).

## Llamado a la acción

Todas las descripciones terminan con el mismo bloque. Las direcciones se revisaron el 2026-11-04 y responden 200:

| Para qué | Dirección |
|---|---|
| Crear la cuenta de fotógrafo (abre el registro con «Soy fotógrafo/a» marcado) | https://www.compramelafoto.com/fotografo/registro |
| Conocer el sistema escolar (dice «Crear mi usuario gratis») | https://www.compramelafoto.com/landescolar |
| Ver todos los tutoriales | https://www.compramelafoto.com/tutoriales |

## Cómo se sube

```bash
cd tools/video/youtube
entorno/bin/python subir.py --manifiesto ../../../docs/demos/tutoriales/escolar/youtube-manifiesto.json
```

- Sube **en privado** lo que falte y anota los IDs en `tools/video/youtube/estado-youtube-manifiesto.json`.
  Volver a correrlo no duplica nada.
- Necesita `client_secret.json` y `token.json` en `tools/video/youtube/`. Ver el `LEEME.md` de esa carpeta: la
  autorización la hace Daniel una sola vez, con la cuenta dueña del canal.
- La lista de reproducción del curso va en `listas.escolar` del manifiesto. Vacío = no los agrega a ninguna.

## La página de Tutoriales de CLF

Se cargan en `/admin/tutoriales` pegando el link de YouTube. El panel no guarda el título ni la descripción que
uno escribe: los trae de YouTube. Eso tiene dos consecuencias:

1. **Un video privado no sirve para CLF.** YouTube no da sus datos (queda como «Video xxxx») y los visitantes
   no lo pueden reproducir. Antes de sumarlo a CLF tiene que estar **público** o **no listado**.
2. **La página muestra la descripción entera**, con los capítulos y las direcciones (como texto, sin link).

Los tutoriales nuevos se agregan al final de la lista, en el orden en que se pegan.

## Estado

| # | Video | Duración | Copy | YouTube | CLF |
|---|---|---|---|---|---|
| E01 | La venta escolar de punta a punta | 2:23 | listo, falta aprobar | — | — |
| E02 | Tu página de venta para colegios | 1:32 | listo, falta aprobar | — | — |
| E03 | Dar de alta un colegio | 1:01 | listo, falta aprobar | — | — |

## Copys

### E01 · La venta escolar de punta a punta

**Título:** La venta escolar de punta a punta | Curso de fotografía escolar, clase 1

**Descripción (antes del bloque común):**

> ¿Se te va el tiempo en listados en papel, sobres armados a mano y el colegio juntando dinero en efectivo? En
> esta primera clase te muestro el recorrido completo de la fotografía escolar en ComprameLaFoto, en siete
> etapas: desde conseguir el colegio hasta entregar los sobres con un código para escanear.
>
> La idea central: primero se vende y se cobra, después se saca la foto.
>
> En esta clase:
> 0:00 Qué vas a ver en este curso
> 0:19 Lo que hoy complica la foto escolar
> 0:35 Conseguir el colegio y acordar con él
> 0:55 Packs y plantillas con datos variables
> 1:17 La preventa y el día de la toma
> 1:35 La selfie, el librito automático y la segunda venta
> 2:02 Producción, entrega y la idea más importante
>
> ▶ Próxima clase: Tu página de venta para colegios.

### E02 · Tu página de venta para colegios

**Título:** Tu página de venta para colegios | Curso de fotografía escolar, clase 2

> Para conseguir colegios necesitás algo para mostrarle al directivo. ComprameLaFoto te da una página de venta
> con tu marca, que explica cómo funciona la preventa, qué cambia para el colegio y quién se queda con qué. Te
> muestro dónde está, cómo compartirla por WhatsApp o con un código QR y dónde te llegan las consultas de los
> colegios.
>
> En esta clase:
> 0:00 Tu página de venta para colegios
> 0:16 La dirección y el código QR
> 0:28 Lo que le falta a tu página
> 0:40 Lo que ve el directivo
> 1:15 Las consultas de los colegios
>
> ▶ Próxima clase: Dar de alta un colegio.

### E03 · Dar de alta un colegio

**Título:** Dar de alta un colegio | Curso de fotografía escolar, clase 3

> El colegio te dijo que sí: ahora lo cargás en la plataforma. Te muestro cómo dar de alta una institución en
> un minuto: logo, nombre, contacto, dirección en el mapa y tus notas internas. Desde su ficha después vas a
> cargar los cursos y los alumnos, invitar al colegio y seguir sus ventas.
>
> En esta clase:
> 0:00 Cuándo dar de alta el colegio
> 0:12 Nueva institución y datos de contacto
> 0:27 Dirección, mapa y observaciones
> 0:40 Crear la escuela y su ficha
>
> ▶ Próxima clase: Cursos y listado de alumnos.

### Bloque común (al final de cada descripción)

```
━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Curso de fotografía escolar de ComprameLaFoto
La herramienta definitiva para organizar tu fotografía escolar.
Clase N de 23. Todo lo que ves es una demo: el colegio, los chicos y las familias son inventados y los pagos son de prueba.

👉 CREÁ TU CUENTA DE FOTÓGRAFO, GRATIS
https://www.compramelafoto.com/fotografo/registro

📚 Conocé el sistema para fotografía escolar
https://www.compramelafoto.com/landescolar

🎬 Todos los tutoriales
https://www.compramelafoto.com/tutoriales

💬 ¿Te quedó una duda? Dejala en los comentarios.
━━━━━━━━━━━━━━━━━━━━━━━━
#FotografiaEscolar #ComprameLaFoto
```

**Etiquetas comunes:** fotografia escolar, compramelafoto, curso de fotografia escolar, fotografo escolar,
vender fotos escolares. Cada video suma dos o tres propias (ver `generar-manifiesto.py`).
