# Demo escolar guiada en ComprameLaFoto: diseño

Fecha: 2026-10-24. Charla: jueves 29/10, 19 h, por Google Meet, para fotógrafos.

## Para qué

Daniel graba y presenta en vivo, de punta a punta, cómo un fotógrafo vende fotografía escolar con
ComprameLaFoto: desde su landing hasta que entrega los sobres. Necesita **las pantallas reales**
pero **datos todos falsos**: que se pueda operar casi normalmente (diseñar, cobrar, canjear,
aprobar, mandar a imprimir), y que no se pueda romper ni tocar nada real. Encima de todo va un
**cuadro guía** que dice qué se está mostrando y agrega aclaraciones para el público. El
presentador avanza y retrocede cuantas veces quiera, y alterna entre la vista del fotógrafo, la
de la familia y la del colegio.

Es la **primera de una serie**: después habrá demos así para cada función importante de todas las
plataformas. Por eso el cuadro guía se arma como pieza reutilizable: una demo nueva es solo un
guion nuevo.

## Decisiones de Daniel

- Vive **dentro de CLF de producción**, para su usuario super admin (`cuart.daniel@gmail.com`,
  id 1, rol ADMIN). Nada de entornos aparte.
- Todo falso: pago de Mercado Pago simulado, sin correos reales, sin plata real.
- El diseñador es el real: puede elegir plantillas de sistema, aplicarlas, editarlas, y lo que
  hace se guarda en la demo.
- La plantilla tiene que verse con un **listado de alumnos**.
- El circuito, en orden: landing del fotógrafo → el colegio se suma, define el % de venta,
  gestiona su perfil y ve sus ventas → el fotógrafo crea la plantilla → preventa de la familia
  con pago simulado → el fotógrafo sube las fotos → la familia vuelve, se encuentra con la selfie,
  elige, ve el librito y lo aprueba → el pedido llega al fotógrafo, que revisa todos → selecciona
  y manda a imprimir → imprime los sobres con QR y pedido → muestra los pedidos en pantalla.
- Una aclaración en el guion: **todo esto se puede configurar hablando con el bot**, y el bot
  funciona de verdad en la demo.
- **La esquina inferior derecha queda siempre libre**: ahí va la cara de Daniel en el Meet.
- Fotos: alumnos inventados generados con IA (Daniel los genera con los prompts de
  `docs/compramelafoto/demo-escolar/PROMPTS-FOTOS.md`); hasta entonces, imágenes provisorias.
  La única cara real es la de Daniel, que aparece como profesor de 6º A, para que la búsqueda por
  selfie lo encuentre a él.
- Trabajo autónomo: diseño → plan → construcción → PR → fusión si queda en verde.

## Objetivos

1. Un **panel de admin** `/admin/demos` con la demo escolar: «Preparar», «Reiniciar» y «Entrar».
2. **Datos demo** creados por código, de forma idempotente: un fotógrafo demo, un colegio demo,
   dos cursos de 20 alumnos, un usuario del colegio, un álbum escolar de prueba con packs de
   preventa, una plantilla de librito ligada al pack, y las fotos.
3. **Cambio de vista** seguro entre fotógrafo, familia y colegio, sin contraseñas, solo desde la
   sesión del super admin y solo hacia usuarios demo.
4. **Cuadro guía** reutilizable con el guion escolar, y tarjetas de aclaración entre pasos.
5. **Pago simulado** que se ve como Mercado Pago y continúa exactamente como un pago real.
6. **Piezas que faltan en el producto real** y que la demo necesita (sirven a todos los
   fotógrafos): QR en las etiquetas por lote, pantalla de pedidos, probar la plantilla con el
   listado real de un curso, y que el colegio pueda editar su perfil.
7. **Aislamiento**: nada de la demo aparece en estadísticas, informes, liquidaciones, listados
   públicos ni correos reales.

## No objetivos

- No cambia quién fija la comisión del colegio (ver "Decisiones mías").
- No hay entorno de staging, ni base aparte, ni modo demo para usuarios comunes.
- No se generan imágenes con IA desde el código.
- No se construyen todavía las otras demos de la serie (solo se deja la lista).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que un dato demo aparezca en un número real (ventas, informe diario, finanzas, liquidaciones
  del colegio, comisiones, referidos) o que salga un correo o WhatsApp a alguien.
- Que un usuario común pueda entrar a la demo o usar el cambio de vista para meterse en otra cuenta.
- Que la demo muestre carteles de "modo prueba" o montos en $0 que arruinen la grabación.
- Que algo flotante tape la esquina inferior derecha.

## Cómo se arma

### 1. Identidad demo

- Etiqueta `DEMO_PRESENTACION` en `User.tags` para los usuarios de la demo. Correos con dominio
  `@demo.compramelafoto.test`.
- Fotógrafo: «Estudio Demo Escolar», handler `estudiodemo`. Su landing es `/estudiodemo/escolar`.
- Colegio: «Escuela Demo Los Aromos», con un usuario `SCHOOL_ORGANIZER`.
- Cursos: «Sala de 5 Naranja» y «6º grado A», con 20 alumnos cada uno (nombres de los prompts).
- Álbum: «Escuela Demo Los Aromos · Fotos 2026», `isTest: true`, con fotos ocultas
  (`hiddenPhotosEnabled`) para que la familia se encuentre por selfie, identificación por listado,
  y comisión del colegio del 10 %.
- Packs de preventa: «Librito + digitales» y «Solo digitales», a precios creíbles, con el beneficio
  del librito ligado a una plantilla V2 propia del fotógrafo demo (copia de una de sistema).
- Hay un seed viejo (`fotografo.escolar.demo@…`, escuela 11). No se toca y no se reutiliza.

### 2. Preparar, reiniciar y entrar (`/admin/demos`)

- Solo para el usuario ADMIN con id 1 (constante centralizada, con el correo como respaldo).
- **Preparar**: crea lo que falte (idempotente), sube las fotos que falten y dispara el análisis
  facial del álbum.
- **Reiniciar**: borra todo lo transaccional de la demo (pedidos, preventas, selecciones, diseños,
  tokens, comisiones, consultas de la landing) y **conserva** las plantillas, las fotos, el colegio
  y los alumnos. Así el diseño que haga Daniel sobrevive.
- **Entrar**: guarda la sesión del admin en una cookie httpOnly aparte (`dnx_demo_vuelta`) y abre
  una sesión del fotógrafo demo.

### 3. Cambio de vista

- `POST /api/demo/vista` con `{ vista: "fotografo" | "familia" | "colegio" | "salir" }`. Solo
  funciona si la cookie `dnx_demo_vuelta` corresponde a una sesión viva del admin id 1, y el
  destino tiene la etiqueta demo.
- «Familia» usa la misma sesión del fotógrafo, porque un álbum de prueba solo lo puede abrir su
  dueño. En la demo se ocultan los carteles de "vista previa del dueño" para que se vea como la ve
  una familia.
- «Salir» restaura la sesión del admin y borra la cookie de vuelta.
- Al cambiar se limpian los cachés de sesión del navegador (`sessionStorage` del fotógrafo y del
  colegio).

### 4. Cuadro guía reutilizable

- Componente montado en `app/layout.tsx`, al lado de `MainLayout`. Se muestra solo si hay una demo
  activa (cookie `dnx_demo_vuelta` válida).
- Un guion es una lista de pasos: `{ id, vista, ruta, titulo, texto, aclaracion?, bot? }`. El guion
  escolar va en `lib/demos/guiones/escolar.ts`.
- **Ubicación**: abajo a la izquierda, compacto, minimizable. Nunca a la derecha.
- Controles: anterior, siguiente, ir a la pantalla del paso, índice de pasos, y selector de vista.
  Las flechas del teclado avanzan y retroceden.
- Si un paso tiene `aclaracion`, antes de mostrarlo aparece una tarjeta centrada, grande y
  legible, para el público. Se cierra con un clic o con la flecha.
- El paso actual se recuerda en el navegador, para que un recargo no pierda el lugar.
- **Esquina libre**: con la demo activa, el cuerpo de la página lleva `data-demo="1"` y una regla
  CSS mueve a la izquierda la burbuja del bot, la barra de subida y los botones flotantes del
  carrito. Las barras inferiores de ancho completo dejan un margen derecho.

### 5. Pago simulado

- En un álbum de prueba, la preventa deja de bloquear el botón. Llama a `/api/precompra/order/test`
  y va a una página nueva, `/pago-simulado/[orderId]`, que imita la pantalla de Mercado Pago con
  el monto y los botones «Pagar» y «Rechazar».
- «Pagar» llama a `/api/payments/simulated/confirm`. Esa ruta pasa a correr la misma finalización
  que un pago real, sin consultar a Mercado Pago y **sin correos, WhatsApp ni referidos**:
  comisión de plataforma, snapshot del pack, entrega digital, estados, token del pack, auditoría,
  comisión del colegio, espejo del pedido y diseños del pack. Para eso se separa de
  `finalizeAlbumOrderMercadoPagoApproved` una función común, con una opción
  `simulado: true`.
- Después sigue el mismo camino que un pago real: la página de selfies de la preventa y el link
  del pack.

### 6. Que la demo se vea real (montos y estados)

- Hoy los pedidos de prueba se ven como "DEMO" con $0, y el portal del colegio los filtra. Se
  agrega una regla de **visibilidad por dueño**: si quien mira es un usuario demo, los pedidos de
  prueba se muestran como normales (monto, estado, comisión). Las estadísticas de admin, el informe
  diario, las finanzas y los reportes no cambian: siguen excluyendo `isTest`.
- Comisión del colegio: se crea para los pedidos de prueba **solo si el álbum es de un usuario
  demo**. «Solicitar cobro» queda deshabilitado en la demo con un mensaje claro, y las listas de
  liquidaciones del admin excluyen las comisiones de pedidos de prueba.

### 7. Correos

Defensa en profundidad: los tres caminos de envío (`lib/email.ts`, `emails/send.ts`,
`lib/email-queue.ts`) descartan cualquier destinatario `*.test`, y lo registran en el log. Así,
aunque una ruta olvide revisar `isTest`, no sale nada.

### 8. Piezas nuevas del producto (para todos los fotógrafos)

- **QR en las etiquetas por lote** (`/api/fotografo/escolar/etiquetas`): cada sobre lleva un QR a
  `/escolar/entrega/[token]` además de alumno, curso, colegio y número de pedido. El token se crea
  al generar la etiqueta (`ensureFulfillmentQrTokenForPreCompraOrderItem`, que hoy nadie llama).
  Los diseños de packs cobrados por fuera, que no tienen ítem, llevan el QR del diseño.
- **Pantalla de pedidos** `/fotografo/escuelas/pedidos/pantalla`: pantalla completa para un
  televisor o para compartir en el Meet. Muestra contadores por paso de la línea de producción y
  una grilla de pedidos que rota, con alumno, curso, estado y miniatura del diseño. Se refresca
  sola cada 15 s.
- **Probar la plantilla con un listado real**: en el sandbox «Probar» de la plantilla, un selector
  de colegio y curso carga los alumnos de ese curso para el listado de la clase, y deja pasar de
  un alumno a otro para ver su nombre en la tapa.
- **Perfil del colegio**: el usuario del colegio puede editar logo, teléfono, correo, dirección y
  descripción de su escuela, pero no su nombre ni el dueño.

### 9. Fotos y selfie

- Las fotos entran con el mismo proceso que una subida real (`finalizeAlbumPhotoFromRaw`):
  previsualización con marca de agua, filas `Photo` y análisis.
- Provisorias: tarjetas generadas por código, una por alumno, con nombre y curso, y dos grupales.
- La foto de Daniel (la del flyer) entra como `6A-PROFE.jpg` y se suma a la grupal provisoria de
  6º A, recortada.
- El análisis facial del álbum se dispara al preparar (`runAnalysisPipeline` con el `albumId`).
- Para cambiar las provisorias por las de IA hay un script
  (`scripts/demos/escolar/reemplazar-fotos.ts <carpeta>`) que borra las fotos del álbum demo y sube
  las nuevas por nombre de archivo.
- **Límite conocido**: mientras las fotos sean provisorias, la selfie muestra a Daniel más todas
  las tarjetas sin cara, porque el sistema deja ver a todos las fotos sin cara, como paisajes.
  Con las fotos de IA queda bien.

### 10. Guion de la demo escolar (borrador; el texto final va en el código)

1. **Panorama** (tarjeta): qué se va a ver y que todo es de prueba.
2. Landing escolar del fotógrafo: link, QR, checklist, consultas.
3. El colegio se suma: el fotógrafo lo da de alta, carga cursos y alumnos (importar Excel), crea
   el usuario del colegio y acuerda el %. Aclaración: el bot hace todo esto conversando.
4. Vista colegio: su panel, su perfil editable, el % que cobra, y ventas (al principio en cero).
5. Plantilla: catálogo de sistema → «Usar y personalizar» → editor → probar con el listado de 6º A.
6. Pack de preventa con la plantilla y los precios.
7. Vista familia: preventa → datos del alumno → pago simulado → aprobado.
8. Vista fotógrafo: subida de fotos y análisis facial.
9. Vista familia: entra con la selfie, ve sus fotos, canjea, elige, ve el librito en 3D y aprueba.
10. Vista fotógrafo: pedidos escolares, revisar diseño, todos los pedidos.
11. Mandar a imprimir: lote, ZIP de JPG para la imprenta.
12. Sobres con QR por lote. Escanear el QR muestra la ficha de entrega.
13. Pantalla de pedidos.
14. Vista colegio: ve la venta y su comisión.
15. **Cierre** (tarjeta): resumen y aclaración del bot.

## Decisiones mías (revisalas)

- **El % lo fija el fotógrafo, no el colegio.** Hoy el sistema funciona así y cambiarlo es una
  decisión de negocio. En la demo, el guion dice "lo acordás con el colegio y lo cargás vos (o se
  lo pedís al bot)", y el colegio lo ve en su panel.
- El colegio sí puede editar su perfil. Es nuevo y vale para todos.
- La vista «Familia» usa la sesión del fotógrafo demo. Es la forma de no abrir los álbumes de
  prueba a cualquiera.
- El cuadro guía va abajo a la izquierda (arriba a la izquierda choca con la barra lateral del
  panel).
- Dos cursos, 20 alumnos cada uno, nombres argentinos inventados.

## Respuestas a la revisión (decisiones mías, 24/10 de madrugada)

1. **Prioridad.** Imprescindible para el jueves: datos demo, preparar/reiniciar/entrar, cambio de
   vista, cuadro guía con guion, pago simulado, aislamiento (correos, visibilidad, comisiones).
   Después, en este orden: QR en etiquetas, pantalla de pedidos, probar plantilla con listado,
   perfil del colegio. Todo en producción a más tardar el lunes 26/10 para que Daniel ensaye.
   Van en PR separados: primero el núcleo y después cada pieza.
2. **El colegio se muestra sobre datos ya cargados** por «Preparar». Si Daniel crea algo en vivo
   (otro curso, otro colegio, otro usuario), queda del fotógrafo demo. «Reiniciar» borra los
   colegios del fotógrafo demo que no son el sembrado, y los usuarios del colegio que no son el
   sembrado.
3. **Bot y correos reales.** Si el que actúa es un usuario demo, crear o invitar un usuario del
   colegio exige un correo `*.test`. Si no, aparece un mensaje claro: "En la demo usá un correo
   @demo.compramelafoto.test". El guard va en la librería, así lo respetan también las
   herramientas del bot. Además, el filtro de correos `*.test` corta cualquier envío.
4. **Fotos.** «Preparar» deja las fotos cargadas y analizadas. Si Daniel sube alguna en vivo, el
   análisis se puede disparar al instante con un botón «Analizar ahora» en `/admin/demos`, y el
   cron de cada 2 minutos también la procesa.
5. **El pago simulado vale solo para álbumes de prueba de usuarios demo** (etiqueta
   `DEMO_PRESENTACION`). Los álbumes de prueba de los demás fotógrafos siguen como hoy.

## Lo que queda a criterio de quien construye

Textos finales del guion, estilo visual del cuadro guía y de la página de pago simulado (que
recuerde a Mercado Pago sin copiar su marca), y precios de los packs.
