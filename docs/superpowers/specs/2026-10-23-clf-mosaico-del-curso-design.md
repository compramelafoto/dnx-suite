# Carpeta del curso con mosaico de compañeros (CompraMeLaFoto)

Fecha: 23/10/2026 · Pedido de Daniel · Estado: aprobado por Daniel el 23/10

## Qué es y por qué

Un producto escolar nuevo: **una carpeta por alumno**. En una parte va el retrato grande de ese
alumno (a veces recortado, sin fondo, apoyado sobre las ilustraciones de la plantilla). En la otra
va el **mosaico del curso**: los retratos chicos de todos los compañeros, cada uno con su nombre,
más la maestra y el título del curso, el año y el colegio.

Hoy un fotógrafo arma esto a mano en Photoshop, alumno por alumno: pega 25 caras, escribe 25
nombres y repite todo para cada carpeta. Daniel quiere que **la plantilla haga la magia**: el
fotógrafo saca las fotos, la familia elige la suya y el sistema arma la carpeta de cada chico con
el mosaico ya lleno. Daniel lo ve como una línea de negocio aparte. Sobre la misma base (un
retrato por alumno y un curso cerrado) salen después calendarios del curso, diplomas con foto,
credenciales, pósters, anuario y el álbum de figuritas.

Referencias que mandó Daniel (diseños rusos tipo «виньетка» / «папка-трюмо», orlas turcas): pizarrón
con útiles, fondo celeste con estrellas, gráfico azul y amarillo sobrio, tríptico con dos páginas
de mosaico, chicos recortados sentados dentro de cajas de cartón con su nombre en una pizarrita.

## Decisiones de Daniel

1. **Una sola foto por chico alcanza**: de plano medio y de frente. El fotógrafo igual saca varias.
2. **La familia elige la foto grande** de su hijo entre todas las que hay; la plantilla hace el resto.
3. **La plantilla decide si se le quita el fondo** a una foto (un hueco marcado «quitar fondo»).
   Funciona mejor con fondo liso.
4. **El dueño de la carpeta no aparece en su propio mosaico** (decidido el 15/10).
5. **Los chicos que no compraron aparecen igual** en el mosaico de los demás.
6. **Los nombres los pone el colegio**, no el fotógrafo, que no conoce a los chicos (15/10). El
   fotógrafo sólo revisa.
7. **Daniel arma las plantillas de sistema** (al menos 20, para todo tipo: jardín infantil y
   colorido, primaria, egresados sobrios). Los fotógrafos las usan tal cual o las copian y adaptan.
8. **El mosaico es una pieza del editor** con estilos: recuadros de todo tipo (cuadrados,
   redondeados, círculos, con marco), separados o pegados, distancias configurables. Así cada
   fotógrafo se arma su plantilla.
9. **Álbum de figuritas**: producto nuevo, aparte (ver «Después»).

## Objetivos

- Que una plantilla con mosaico se llene sola para cada alumno del curso, en pantalla y en el PDF
  de impresión, con el mismo resultado en los dos lados.
- Que el mosaico se adapte a cursos de 15 a 40 chicos sin que nadie mueva nada.
- Que el recorte sin fondo y el encuadre de la cara sean automáticos, con revisión antes de imprimir.
- 20 plantillas de sistema o más, variadas, listas para usar.

## Fuera de alcance (por ahora)

- Reconocimiento facial automático para saber quién es quién (AWS está bloqueado desde el 06/10).
  Mientras tanto, el vínculo foto–alumno se hace a mano (fotógrafo y colegio).
- El álbum de figuritas (es la etapa siguiente; ver «Después»).
- Fotos de cuerpo entero «dentro de cajas» con pose libre: se puede imitar con el recorte, pero no
  es objetivo de esta etapa tener poses distintas por chico.

## Lo que no puede pasar (anti-objetivos)

- Que en una carpeta impresa aparezca un compañero con el nombre de otro. Un nombre mal puesto en
  un producto que el chico guarda para siempre es peor que un recuadro vacío.
- Que salga a imprimir un recorte feo (pelo comido, medio brazo) sin que nadie lo haya visto.
- Que el mosaico se vea distinto en la vista previa que en el papel.
- Que el fotógrafo tenga que tocar 25 carpetas una por una.

## Cómo es hoy (lo que ya existe)

- **Editor de plantillas nuevo** (TemplateV2 / design-studio). Bloques: fondo, foto, texto, dato
  variable, imagen, forma y QR (`enum TemplateV2BlockType`).
- **«Listado del curso»** (`packages/template-engine/src/plugins/school/class-list.ts`): es un bloque
  de dato variable con la clave `course.studentList`, **sin tipo de bloque nuevo, a propósito**, para
  no migrar el enum en todas las bases. La lista viaja como JSON en el valor. El lienzo del editor,
  la vista previa y la impresión la reparten con la misma cuenta. **El mosaico debe seguir este
  mismo camino.**
- **Padrón del álbum** (`AlbumStudentRosterEntry`): los alumnos de cada curso del álbum, con nombre
  y curso. Las precompras se atan a una fila del padrón.
- **Las fotos no están atadas a ningún alumno.** No hay columna que diga «esta foto es de Juan».
  Esa es la pieza base que falta.
- **Huecos de foto del cliente**: `photo_individual`, `photo_group`, `photo_teacher`,
  `photo_friends` y `photo_extra`. El canje se las pide a la familia por su nombre.
- **50 libritos de sistema** generados por código (`apps/compramelafoto/scripts/plantillas-sistema/`),
  con fondos en R2 y carga por SQL.

## Cómo funciona (diseño)

### 1. Retrato oficial por alumno (la base)

Cada fila del padrón del álbum tiene un **retrato oficial**: la foto que se usa para ese chico en
el mosaico de todos sus compañeros. Es la misma en todas las carpetas.

- **Quién lo elige** (Daniel, 23/10): **la familia**. Cuando elige la foto de su hijo para la
  carpeta, esa misma foto queda como retrato oficial del chico, y con eso el chico queda
  identificado (nombre + foto). En el mosaico de los compañeros se ve **encuadrada en la cara**. No
  se elige una segunda foto.
- **Chicos que nadie compró**: quedan «sin identificar». Antes de imprimir se habilita un enlace
  para el colegio (sin cuenta) que muestra una foto por chico no identificado y deja elegir de la
  lista del curso a quién corresponde. Para que el colegio no mire fotos sueltas, el fotógrafo sube
  una por chico o el sistema las agrupa por chico según el orden de toma (a definir al construir).
  El fotógrafo revisa y confirma.
- El fotógrafo puede corregir cualquier retrato oficial (por ejemplo, si una familia eligió una foto
  donde no se le ve bien la cara).
- **Desde el cierre del curso nadie cambia el retrato oficial**, para que todas las carpetas salgan
  iguales.
- **Curso cerrado**: el fotógrafo marca el curso como «listo para mosaico» cuando todos tienen
  retrato y nombre. Antes de eso, el sistema avisa cuántos faltan y no deja mandar a imprimir
  carpetas con mosaico. Un chico sin retrato sale con un recuadro con su nombre y una silueta
  neutra (*decisión de Claude*), nunca con la foto de otro.
- Esto necesita guardar el vínculo foto–alumno (por ejemplo, una columna en el padrón con la foto
  oficial). Es cambio de esquema: **migración a mano en las bases que comparten el esquema**, según
  la regla del proyecto.

### 2. Dos versiones automáticas de cada foto

A partir de una foto de plano medio:

- **Cara para el mosaico**: un encuadre de cabeza y hombros. Si la foto ya tiene detección de caras
  guardada, se usa; si no, un encuadre fijo para plano medio (tercio superior, centrado). Se puede
  corregir a mano en la revisión.
- **Sin fondo**: sólo cuando la plantilla tiene un hueco marcado «quitar fondo». Se calcula una vez
  por foto, se guarda en R2 y se reutiliza. Se muestra en la revisión del fotógrafo. Si salió mal,
  el fotógrafo puede descartarlo y la carpeta usa la foto entera dentro de su marco, o pedir a la
  familia otra foto.
- **Con qué se quita el fondo** queda para quien lo construya, con estas condiciones: costo bajo por
  foto (en pesos), calidad buena en el borde del pelo y nada que pese en las funciones de Vercel.
  El servidor de trabajos pesados de CLF (`apps/compramelafoto-workers`, que ya procesa videos) es
  un candidato natural. Cualquier dependencia nueva respeta el lockfile compartido.

### 3. El bloque «Mosaico del curso» en el editor

Un bloque que el diseñador dibuja como un rectángulo. Al llenarse, reparte adentro a los compañeros
del dueño de la carpeta, cada uno con su retrato oficial y su nombre.

- **Sin tipo de bloque nuevo** (*decisión de Claude, siguiendo el listado*): un bloque existente con
  una clave propia (por ejemplo, `course.mosaic`) y sus opciones en `configJson`. Así no hay que
  migrar el enum.
- **Opciones de estilo** (lo que pidió Daniel: «recuadros de todo tipo»):
  - forma del recuadro: rectángulo, redondeado, círculo, óvalo, polaroid, hexágono, con imagen de
    marco propia (PNG del diseñador);
  - proporción del recuadro (3:4, cuadrado, etc.);
  - separación horizontal y vertical, desde 0 (pegados) hasta lo que quiera;
  - borde, color y grosor; sombra; leve giro alternado (tipo fotos pegadas);
  - nombre: debajo, encima, sobre una cinta, dentro del recuadro o sin nombre; tipografía, cuerpo,
    color; nombre y apellido en una o dos líneas;
  - orden: por apellido o por nombre;
  - alineación del sobrante en la última fila: izquierda, centro, derecha.
- **Se adapta solo a la cantidad**: el sistema elige cuántas columnas y filas entran para que los
  recuadros salgan lo más grandes posible dentro del rectángulo, respetando la proporción.
- **Varios bloques encadenados**: para mosaicos que esquivan un cartel («Mi curso 4.° A») o que se
  parten en dos páginas, el diseñador dibuja dos o más rectángulos y les pone un número de orden. Los
  chicos llenan el primero y siguen en el siguiente. Cada uno puede tener una capacidad máxima.
- **Celdas reservadas**: además de encadenar bloques, el diseñador puede marcar dentro de la grilla
  un bloque de celdas libres (por ejemplo, 2×2 al centro) para un cartel del curso. Es el patrón más
  repetido en las referencias.
- **Maestra**: sigue siendo el hueco `photo_teacher`, aparte del mosaico. Como opción, el mosaico
  puede ponerla en una celda del doble de lado, al principio o al final de la grilla. En las
  referencias aparecen también la directora y la auxiliar: se tratan igual que la maestra.
- **Nombre según el nivel**: sólo el nombre de pila (jardín) o nombre y apellido; ya existe esta
  opción en el listado del curso y se reutiliza.
- **El dueño no está**: el mosaico de la carpeta de Juan lleva a todos menos a Juan.
- **Igual en pantalla y en papel**: la misma cuenta de reparto se usa en el lienzo del editor, en la
  vista previa de la familia y en el PDF, como hace hoy el listado. Se recomienda que el puente al
  motor de render convierta el mosaico en recuadros, fotos y textos comunes, así el render no cambia.
- **En el editor y en las demos**: con alumnos de ejemplo (las 28 fotos de demo en R2 alcanzan) para
  que el diseñador vea cómo queda con 18, 25 o 35 chicos.

### 4. Cómo se arma cada carpeta

Hay dos formas de venderla, y el diseño tiene que servir para las dos:

- **Lo compra la familia**: elige la foto grande (hueco `photo_individual`) y, al pagar o canjear,
  se arma la carpeta de su hijo con el mosaico de sus compañeros.
- **Lo encarga el colegio o el fotógrafo para todo el curso**: con el curso cerrado, el fotógrafo
  toca «armar las carpetas del curso» y sale una carpeta por alumno, con su retrato oficial como
  foto grande. Para imprimir todas juntas.

### 5. Plantillas de sistema (20 o más)

Mismo método que los libritos: generador en `apps/compramelafoto/scripts/plantillas-sistema/`,
fondos en R2, carga por SQL, `metaJson` con filtros. Hay que agregar el filtro «con mosaico».
Repartidas así, como mínimo:

- **Jardín** (6): colorido e infantil, animalitos, cuentos, crayones, nubes y arcoíris, figuritas.
- **Primaria** (7): pizarrón con útiles, cuaderno rayado, celeste estrellado, «cajas» con chicos
  recortados, pizarritas con nombre, escolar clásico, fiesta de fin de año.
- **Egresados y secundaria** (5): sobrio azul y amarillo, minimalista blanco, tipo revista, negro y
  dorado, orla clásica con óvalos.
- **Religiosas** (2): colegio católico, comunión del curso.

Formatos: lámina única A4 o A3, díptico (carpeta abierta 30×20 como los libritos) y tríptico.
Algunas con el alumno recortado sobre las ilustraciones y otras con el alumno en marco.

Catálogo de estilos de referencia (investigación del 23/10, 28 estilos; elegir de acá): bosque de
animalitos, cuento ilustrado, arcoíris y nubes, globos, cajas de cartón, crayones, mundo marino o
espacial, pizarrón verde, cuaderno rayado, útiles escolares, pizarritas, lápices de colores,
diploma, minimal blanco, negro y dorado, revista, collage moderno, redes sociales, póster de cine,
cómic, pasaporte, celeste y blanco con cruz, comunión, orla universitaria con óvalos, paspartú
vintage, figuritas, polaroids en soga, colmena de hexágonos.

Patrones que salen de la investigación:
- **Díptico típico**: en la cara A va el retrato grande con el título; en la cara B, el mosaico y
  la maestra. El tríptico suma una hoja con la foto grupal o con más compañeros.
- **Foto grupal**: muchas plantillas le dejan lugar además del mosaico (hueco `photo_group`).
- **Cursos**: de 5 a 35 chicos en jardín y de 18 a 35 en primaria.
- **Margen de seguridad**: 5 mm al corte.

### 6. Respuestas de Daniel a la revisión (23/10, «sí a todo»)

- **Maestra, directora y auxiliar**: el fotógrafo las carga una vez por curso (foto, nombre y
  cargo), iguales en todas las carpetas. El colegio puede corregir los nombres desde su enlace. El
  hueco `photo_teacher` de la plantilla se llena con esto cuando existe.
- **Privacidad**: antes de pagar, la vista previa muestra el mosaico chico y con marca de agua, y
  sólo a familias del mismo curso. El enlace del colegio muestra los retratos sólo para nombrarlos y
  vence a los 15 días.
- **Quitar fondo**: se permite un servicio externo siempre que no guarde las fotos ni las use para
  entrenar.
- **Carpetas de todo el curso**: es un pedido único del colegio o del fotógrafo, fuera del circuito
  de la familia. En esta etapa sólo genera los archivos para imprimir y no cobra dentro del sistema.

### 7. Reglas decididas por Claude (revisables)

- **El mosaico exige padrón.** Sólo se ofrece en álbumes con padrón y con la carpeta atada a una
  fila del padrón (`albumRosterEntryId`). En álbumes que sólo tienen el Excel de packs no hay dónde
  guardar el retrato oficial, y sacar al dueño por coincidencia de nombre puede fallar.
- **Quién entra**: los alumnos activos del curso propio. No entran los dados de baja ni los marcados
  como desactualizados. En esta etapa no se pueden sumar otros cursos.
- **El mosaico no se congela**: se arma de nuevo al imprimir con los datos del padrón de ese momento.
  Así, una corrección de nombre o de retrato llega a todas las carpetas que todavía no se imprimieron.
- **Compra antes del cierre**: se puede comprar (precompra) antes de la sesión de fotos. Mientras el
  curso no esté cerrado, la vista previa muestra el mosaico con siluetas y los nombres que haya, y la
  carpeta no pasa a impresión hasta el cierre.

## Después (no entra en esta etapa)

- **Álbum de figuritas del curso**: el sistema saca dos archivos. Uno es el álbum, con los recuadros
  vacíos y el nombre de cada compañero debajo. El otro es la plancha de figuritas para recortar, sin
  nombres. Los chicos juegan a pegarlas y a recordar quién es quién. Se apoya en el mismo bloque
  (opción «sin foto, sólo nombre» para el álbum y «sin nombre» para la plancha) y en el mismo
  retrato oficial.
- Calendario del curso, diplomas con foto, credenciales, pósters, anuario.
- Reconocimiento facial para atar las fotos a los alumnos solo, cuando AWS vuelva.

## Etapas sugeridas

1. Retrato oficial por alumno, encuadre de cara y portal del colegio para nombrar.
2. Bloque «Mosaico del curso» en el editor (lienzo, vista previa y PDF iguales).
3. Quitar fondo como opción del hueco de foto.
4. Armado de carpetas: por compra de la familia y para todo el curso.
5. 20 plantillas de sistema o más.
6. Álbum de figuritas (aparte).

## Lo que queda para quien lo construya

- Dónde se guarda exactamente el vínculo foto–alumno y el estado «curso cerrado».
- El servicio para quitar fondos, dentro de las condiciones de arriba.
- La cuenta de reparto (columnas y filas) y cómo se dibujan las formas.
- Cómo se generan las ilustraciones de las plantillas (por código, como los libritos, o con imágenes
  hechas aparte).
