# Publicación del «Curso de fotografía escolar»

Cómo se publican los videotutoriales de la serie escolar de ComprameLaFoto: el copy de cada video, el llamado a
la acción, la subida a YouTube y el alta en la página de Tutoriales de CLF.

Lema del curso: **La herramienta definitiva para organizar tu fotografía escolar.**

Decidido con Daniel el 2026-11-04: van al canal **DNX ESTUDIO** (@dnxestudio, `UC7kYtrTLwKpbCrMVG-bMW8A`, el
mismo de los tutoriales que ya muestra CLF) y se publican **en público**. Todos entran en la lista
[Curso de fotografía escolar | ComprameLaFoto](https://www.youtube.com/playlist?list=PLGDPLEY4OFJQ)
(`listas.escolar` del manifiesto).

Ojo al autorizar: la cuenta `dnxfotografia@gmail.com` maneja dos canales. En la ventana de Google hay que elegir
**DNX ESTUDIO**, no «DNX Estudio de Fotografía y Video» (@dnxestudiodefotografiayvid5193). Para revisar a qué
canal quedó atado el permiso, `subir.py` imprime el nombre del canal antes de subir.

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

## Portadas

`generar-portadas.py` arma la portada de cada clase (1280×720): número de clase, un texto de cuatro palabras como
máximo, un cuadro real del video y el isotipo de ComprameLaFoto. Las deja en `videos/portadas/`, fuera de git, y
`subir.py` la sube junto con el video (campo `portada` del manifiesto). Para una clase nueva se agrega a
`PORTADAS` el segundo del cuadro y el recorte, y se corre:

```bash
python3 docs/demos/tutoriales/escolar/generar-portadas.py 6
```

Todas las clases publicadas tienen su portada.

## Cómo se sube

```bash
cd tools/video/youtube
entorno/bin/python subir.py --manifiesto ../../../docs/demos/tutoriales/escolar/youtube-manifiesto.json
```

- Sube **en privado** lo que falte (con `--publico`, en público) y anota los IDs en `tools/video/youtube/estado-youtube-manifiesto.json`.
  Volver a correrlo no duplica nada.
- Necesita `client_secret.json` y `token.json` en `tools/video/youtube/`. Ver el `LEEME.md` de esa carpeta: la
  autorización la hace Daniel una sola vez, con la cuenta dueña del canal.
- Cada video subido se agrega solo a la lista del curso (`listas.escolar`).
- Después de subir: cargar el link en `/admin/tutoriales`, tarjeta «Curso de fotografía escolar». E01 a E03 se
  cargaron directo en el ajuste `tutorials_escolar_course` de la base de producción.

## La página del curso en CLF

El curso tiene su página: **https://www.compramelafoto.com/tutoriales/fotografia-escolar**, con las 23 clases
por bloque, y la página de Tutoriales la muestra arriba de todo. Las clases sin video dicen «Próximamente».

- **Cargar un video:** en `/admin/tutoriales`, tarjeta «Curso de fotografía escolar», pegar el link en su clase
  y guardar. No hace falta desplegar nada. Si el video todavía es privado, el panel avisa que no se va a ver.
- **Referidos:** en el panel de referidos, «Curso de fotografía escolar (videos)» arma el link del curso con el
  código del referidor (`?ref=`). El fotógrafo que se registra desde el curso queda como referido suyo.
- **Títulos y resúmenes de las clases:** están en `apps/compramelafoto/lib/tutorials/escolar-course.ts`.

## La lista general de Tutoriales de CLF

La lista de abajo se carga en `/admin/tutoriales`, tarjeta «Tutoriales», pegando el link de YouTube. El panel no guarda el título ni la descripción que
uno escribe: los trae de YouTube. Eso tiene dos consecuencias:

1. **Un video privado no sirve para CLF.** YouTube no da sus datos (queda como «Video xxxx») y los visitantes
   no lo pueden reproducir. Antes de sumarlo a CLF tiene que estar **público** o **no listado**.
2. **La página muestra la descripción entera**, con los capítulos y las direcciones (como texto, sin link).

Los tutoriales nuevos se agregan al final de la lista, en el orden en que se pegan.

## Estado

| # | Video | Duración | Copy | YouTube | CLF |
|---|---|---|---|---|---|
| E01 | La venta escolar de punta a punta | 2:23 | aprobado | [público](https://youtu.be/kDdvZ92JKfo) | clase 1 |
| E02 | Tu página de venta para colegios | 1:32 | aprobado | [público](https://youtu.be/uBmMxi7d52Q) | clase 2 |
| E03 | Dar de alta un colegio | 1:01 | aprobado | [público](https://youtu.be/e5wVhLMNK7Q) | clase 3 |
| E04 | Cursos y listado de alumnos | 1:31 | publicado | [público](https://youtu.be/X-79p1_9Z1I) | clase 4 |
| E05 | El usuario del colegio | 0:55 | publicado | [público](https://youtu.be/4966Kx_hQ9I) | clase 5 |
| E06 | El álbum del colegio y las fotos ocultas | 1:28 | publicado | [público](https://youtu.be/dWYvylvHw4Q) | clase 6 |
| E07 | La comisión del colegio | 1:02 | publicado | [público](https://youtu.be/nw18jU_MUzs) | clase 7 |
| E08 | Los packs de preventa | 1:08 | publicado | [público](https://youtu.be/QIQfRYMr8Uk) | clase 8 |

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

### E04 · Cursos y listado de alumnos

**Título:** Cursos y listado de alumnos | Curso de fotografía escolar, clase 4

> El listado de alumnos es lo que hace que todo lo demás funcione solo: la familia encuentra a su hijo por el
> nombre, el librito sale bien escrito y el mosaico del curso se arma solo. Te muestro cómo crear un curso a mano
> y cómo importar de una vez el Excel o el CSV que te pasa el colegio. Y si el archivo viene desordenado, un
> botón te copia el pedido listo para que ChatGPT te lo devuelva en el formato correcto.
>
> En esta clase:
> 0:00 Por qué importa el listado de alumnos
> 0:20 Crear un curso a mano
> 0:39 Importar el Excel o el CSV del colegio
> 0:53 Ordenar el archivo con ChatGPT
> 1:03 Procesar la importación y ver los alumnos
>
> ▶ Próxima clase: El usuario del colegio.

### E05 · El usuario del colegio

**Título:** El usuario del colegio | Curso de fotografía escolar, clase 5

> Con su propio usuario, el colegio ve sus ventas, lo que le corresponde y sus alumnos, sin pedirte planillas.
> Te muestro cómo invitar al responsable del colegio desde su ficha, cómo seguir si ya activó la cuenta y qué ve
> el colegio cuando entra a su panel: sus álbumes, sus alumnos, la conexión con Mercado Pago para cobrar su parte
> y las ventas que generó.
>
> En esta clase:
> 0:00 Para qué sirve el usuario del colegio
> 0:15 Invitar al responsable del colegio
> 0:30 La activación y el panel del colegio
>
> ▶ Próxima clase: El álbum del colegio y las fotos ocultas.

### E06 · El álbum del colegio y las fotos ocultas

**Título:** El álbum del colegio y las fotos ocultas | Curso de fotografía escolar, clase 6

Ojo: el paso «Seguridad» del asistente hoy es solo una referencia. Lo que de verdad oculta las fotos es «Fotos
ocultas hasta selfie», en Configuración del álbum. El copy lo dice así.

> Cada colegio tiene su álbum, y ahí pasa toda la venta. Te muestro el asistente paso a paso: el tipo escolar,
> los datos de la sesión, el colegio y su comisión, y los cursos. Y el detalle más importante cuando hay chicos:
> en Configuración activás «Fotos ocultas hasta selfie», para que cada familia vea solo las fotos de su hijo, y
> decidís cuántos días se guarda la selfie.
>
> En esta clase:
> 0:00 El asistente del álbum escolar
> 0:18 Datos de la sesión, ventas e impresiones
> 0:43 El colegio, la comisión y los cursos
> 0:54 Privacidad y crear el álbum
> 1:04 Fotos ocultas hasta selfie
>
> ▶ Próxima clase: La comisión del colegio.

### E07 · La comisión del colegio

**Título:** La comisión del colegio | Curso de fotografía escolar, clase 7

Ojo: en la demo el pedido de cobro está bloqueado a propósito, así que el video no muestra un pago hecho. El copy
solo explica el circuito.

> Que el colegio también gane es una de las cosas que más ayuda a cerrar con una escuela. Te muestro dónde activás
> la comisión en el álbum, cómo cargás el porcentaje que acordaste y sobre qué ventas se aplica. El sistema la
> calcula sola en cada compra que entra con el enlace del colegio, y en la ficha del colegio ves lo vendido, lo
> pendiente y lo ya pagado. Al final te explico el circuito del cobro: el colegio lo solicita desde su panel, vos
> le pagás, anotás el medio de pago y el comprobante, y lo marcás como pagado.
>
> En esta clase:
> 0:00 Por qué la comisión ayuda a cerrar
> 0:11 Activar la comisión y el porcentaje
> 0:25 Cómo se calcula y dónde la seguís
> 0:43 Cuando el colegio pide su parte
>
> ▶ Próxima clase: Los packs de preventa.

### E08 a E23

Desde el E08, el título, la descripción y los capítulos de cada clase están solo en `generar-manifiesto.py`
(lista `COPYS`), para no copiarlos dos veces. Ahí se leen y se corrigen.

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
