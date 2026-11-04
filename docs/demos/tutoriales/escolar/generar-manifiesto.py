"""Genera youtube-manifiesto.json desde los copys de esta lista.

Para sumar un video: agregalo a COPYS (capítulos sacados del audio final) y corré
    python3 docs/demos/tutoriales/escolar/generar-manifiesto.py docs/demos/tutoriales/escolar/youtube-manifiesto.json \
        apps/compramelafoto/lib/tutorials/escolar-course-details.ts
El segundo archivo es lo que muestra la página del curso en CLF (descripción, duración y capítulos).
"""
import json, pathlib, re, sys

VIDEOS = '/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/docs/demos/tutoriales/escolar/videos'
TOTAL = 23

PIE = """━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Curso de fotografía escolar de ComprameLaFoto
La herramienta definitiva para organizar tu fotografía escolar.
Clase {n} de {total}. Todo lo que ves es una demo: el colegio, los chicos y las familias son inventados y los pagos son de prueba.

👉 CREÁ TU CUENTA DE FOTÓGRAFO, GRATIS
https://www.compramelafoto.com/fotografo/registro

📚 Conocé el sistema para fotografía escolar
https://www.compramelafoto.com/landescolar

🎬 Todos los tutoriales
https://www.compramelafoto.com/tutoriales

💬 ¿Te quedó una duda? Dejala en los comentarios.
━━━━━━━━━━━━━━━━━━━━━━━━
#FotografiaEscolar #ComprameLaFoto"""

ETIQUETAS_SERIE = ['fotografia escolar', 'compramelafoto', 'curso de fotografia escolar',
                   'fotografo escolar', 'vender fotos escolares']

COPYS = [
    {
        'n': 1,
        'archivo': 'E01-la-venta-escolar-de-punta-a-punta.mp4',
        'titulo': 'La venta escolar de punta a punta | Curso de fotografía escolar, clase 1',
        'gancho': ("¿Se te va el tiempo en listados en papel, sobres armados a mano y el colegio juntando "
                   "dinero en efectivo? En esta primera clase te muestro el recorrido completo de la fotografía "
                   "escolar en ComprameLaFoto, en siete etapas: desde conseguir el colegio hasta entregar los "
                   "sobres con un código para escanear.\n\n"
                   "La idea central: primero se vende y se cobra, después se saca la foto."),
        'capitulos': [
            ('0:00', 'Qué vas a ver en este curso'),
            ('0:20', 'Lo que hoy complica la foto escolar'),
            ('0:35', 'Conseguir el colegio y acordar con él'),
            ('0:55', 'Packs y plantillas con datos variables'),
            ('1:17', 'La preventa y el día de la toma'),
            ('1:34', 'La selfie, la carpeta automática y la segunda venta'),
            ('2:03', 'Producción, entrega y la idea más importante'),
        ],
        'proxima': 'Tu página de venta para colegios',
        'etiquetas': ['preventa escolar', 'carpetas escolares', 'plantillas escolares'],
    },
    {
        'n': 2,
        'archivo': 'E02-tu-pagina-de-venta-para-colegios.mp4',
        'titulo': 'Tu página de venta para colegios | Curso de fotografía escolar, clase 2',
        'gancho': ("Para conseguir colegios necesitás algo para mostrarle al directivo. ComprameLaFoto te da una "
                   "página de venta con tu marca, que explica cómo funciona la preventa, qué cambia para el "
                   "colegio y quién se queda con qué. Te muestro dónde está, cómo compartirla por WhatsApp o con "
                   "un código QR y dónde te llegan las consultas de los colegios."),
        'capitulos': [
            ('0:00', 'Tu página de venta para colegios'),
            ('0:16', 'La dirección y el código QR'),
            ('0:28', 'Lo que le falta a tu página'),
            ('0:40', 'Lo que ve el directivo'),
            ('1:15', 'Las consultas de los colegios'),
        ],
        'proxima': 'Dar de alta un colegio',
        'etiquetas': ['conseguir colegios', 'landing escolar', 'marketing para fotografos'],
    },
    {
        'n': 3,
        'archivo': 'E03-dar-de-alta-un-colegio.mp4',
        'titulo': 'Dar de alta un colegio | Curso de fotografía escolar, clase 3',
        'gancho': ("El colegio te dijo que sí: ahora lo cargás en la plataforma. Te muestro cómo dar de alta una "
                   "institución en un minuto: logo, nombre, contacto, dirección en el mapa y tus notas internas. "
                   "Desde su ficha después vas a cargar los cursos y los alumnos, invitar al colegio y seguir sus "
                   "ventas."),
        'capitulos': [
            ('0:00', 'Cuándo dar de alta el colegio'),
            ('0:12', 'Nueva institución y datos de contacto'),
            ('0:27', 'Dirección, mapa y observaciones'),
            ('0:40', 'Crear la escuela y su ficha'),
        ],
        'proxima': 'Cursos y listado de alumnos',
        'etiquetas': ['alta de colegio', 'gestion escolar'],
    },
    {
        'n': 4,
        'archivo': 'E04-cursos-y-listado-de-alumnos.mp4',
        'titulo': 'Cursos y listado de alumnos | Curso de fotografía escolar, clase 4',
        'gancho': ("El listado de alumnos es lo que hace que todo lo demás funcione solo: la familia encuentra a su "
                   "hijo por el nombre, la carpeta escolar sale bien escrita y el mosaico del curso se arma solo. Te muestro "
                   "cómo crear un curso a mano y cómo importar de una vez el Excel o el CSV que te pasa el colegio. "
                   "Y si el archivo viene desordenado, un botón te copia el pedido listo para que ChatGPT te lo "
                   "devuelva en el formato correcto."),
        'capitulos': [
            ('0:00', 'Por qué importa el listado de alumnos'),
            ('0:22', 'Crear un curso a mano'),
            ('0:39', 'Importar el Excel o el CSV del colegio'),
            ('0:53', 'Ordenar el archivo con ChatGPT'),
            ('1:03', 'Procesar la importación y ver los alumnos'),
        ],
        'proxima': 'El usuario del colegio',
        'etiquetas': ['listado de alumnos', 'importar excel', 'gestion escolar'],
    },
    {
        'n': 5,
        'archivo': 'E05-el-usuario-del-colegio.mp4',
        'titulo': 'El usuario del colegio | Curso de fotografía escolar, clase 5',
        'gancho': ("Con su propio usuario, el colegio ve sus ventas, lo que le corresponde y sus alumnos, sin "
                   "pedirte planillas. Te muestro cómo invitar al responsable del colegio desde su ficha, cómo "
                   "seguir si ya activó la cuenta y qué ve el colegio cuando entra a su panel: sus álbumes, sus "
                   "alumnos, la conexión con Mercado Pago para cobrar su parte y las ventas que generó."),
        'capitulos': [
            ('0:00', 'Para qué sirve el usuario del colegio'),
            ('0:15', 'Invitar al responsable del colegio'),
            ('0:30', 'La activación y el panel del colegio'),
        ],
        'proxima': 'El álbum del colegio y las fotos ocultas',
        'etiquetas': ['panel del colegio', 'usuario del colegio', 'gestion escolar'],
    },
    {
        'n': 6,
        'archivo': 'E06-el-album-del-colegio.mp4',
        'titulo': 'El álbum del colegio y las fotos ocultas | Curso de fotografía escolar, clase 6',
        'gancho': ("Cada colegio tiene su álbum, y ahí pasa toda la venta. Te muestro el asistente paso a paso: el "
                   "tipo escolar, los datos de la sesión, el colegio y su comisión, y los cursos. Y el detalle más "
                   "importante cuando hay chicos: en Configuración activás «Fotos ocultas hasta selfie», para que "
                   "cada familia vea solo las fotos de su hijo, y decidís cuántos días se guarda la selfie."),
        'capitulos': [
            ('0:00', 'El asistente del álbum escolar'),
            ('0:18', 'Datos de la sesión, ventas e impresiones'),
            ('0:43', 'El colegio, la comisión y los cursos'),
            ('0:54', 'Privacidad y crear el álbum'),
            ('1:04', 'Fotos ocultas hasta selfie'),
        ],
        'proxima': 'La comisión del colegio',
        'etiquetas': ['album escolar', 'fotos ocultas', 'privacidad de menores'],
    },
    {
        'n': 7,
        'archivo': 'E07-la-comision-del-colegio.mp4',
        'titulo': 'La comisión del colegio | Curso de fotografía escolar, clase 7',
        'gancho': ("Que el colegio también gane es una de las cosas que más ayuda a cerrar con una escuela. Te "
                   "muestro dónde activás la comisión en el álbum, cómo cargás el porcentaje que acordaste y sobre "
                   "qué ventas se aplica. El sistema la calcula sola en cada compra que entra con el enlace del "
                   "colegio, y en la ficha del colegio ves lo vendido, lo pendiente y lo ya pagado. Al final te "
                   "explico el circuito del cobro: el colegio lo solicita desde su panel, vos le pagás, anotás el "
                   "medio de pago y el comprobante, y lo marcás como pagado."),
        'capitulos': [
            ('0:00', 'Por qué la comisión ayuda a cerrar'),
            ('0:11', 'Activar la comisión y el porcentaje'),
            ('0:25', 'Cómo se calcula y dónde la seguís'),
            ('0:43', 'Cuando el colegio pide su parte'),
        ],
        'proxima': 'Los packs de preventa',
        'etiquetas': ['comision escolar', 'comision del colegio', 'acuerdo con el colegio'],
    },
    {
        'n': 8,
        'archivo': 'E08-los-packs-de-preventa.mp4',
        'titulo': 'Los packs de preventa | Curso de fotografía escolar, clase 8',
        'gancho': ("En la venta escolar el orden es al revés: la familia compra primero y elige las fotos después. "
                   "Por eso lo primero es definir qué le vas a vender. Te muestro los packs de preventa del álbum, "
                   "la diferencia entre lo que cobrás vos y lo que paga la familia con la comisión de la plataforma "
                   "incluida, y cómo crear un pack nuevo: nombre, cuándo se vende, tu precio y lo que incluye."),
        'capitulos': [
            ('0:00', 'Primero se vende el pack'),
            ('0:19', 'Los packs y sus precios'),
            ('0:37', 'Crear un pack nuevo'),
            ('0:53', 'Lo que incluye el pack'),
        ],
        'proxima': 'Elegir el diseño de la carpeta escolar',
        'etiquetas': ['preventa escolar', 'packs escolares', 'precios fotografia escolar'],
    },
    {
        'n': 9,
        'archivo': 'E09-elegir-el-diseno-de-la-carpeta-escolar.mp4',
        'titulo': 'Elegir el diseño de la carpeta escolar | Curso de fotografía escolar, clase 9',
        'gancho': ("La carpeta escolar sale de una plantilla: la elegís una vez y sirve para todo el colegio. Te "
                   "muestro las plantillas del sistema (más de setenta carpetas escolares, además de diplomas, "
                   "calendarios y anuarios), cómo filtrarlas por tipo y nivel, cómo verlas en 3D pasando hoja por "
                   "hoja y cómo hacerte una copia propia. Y lo más importante: los datos variables. Podés usar el "
                   "nombre y el apellido del alumno, el nombre y el logo del colegio, el curso, el listado de los "
                   "alumnos del curso, el mosaico de compañeros, la foto individual y la grupal, la fecha del "
                   "evento, tu nombre y tu logo, y hasta el código QR del pedido para la entrega. Armás el diseño "
                   "una vez y en cada pedido el sistema completa esos datos solo."),
        'capitulos': [
            ('0:00', 'Las plantillas del sistema'),
            ('0:22', 'Filtrar y ver la carpeta en 3D'),
            ('0:39', 'Los datos variables'),
            ('1:04', 'Un diseño para todo el colegio'),
        ],
        'proxima': 'Probar la carpeta escolar con el listado real',
        'etiquetas': ['carpetas escolares', 'plantillas escolares', 'diseño de carpetas'],
    },
    {
        'n': 10,
        'archivo': 'E10-probar-la-carpeta-escolar-con-el-listado.mp4',
        'titulo': 'Probar la carpeta escolar con el listado real | Curso de fotografía escolar, clase 10',
        'gancho': ("Antes de abrir la venta, probá la plantilla con los datos del colegio. Te muestro cómo elegir el "
                   "álbum y algunas fotos como lo haría una familia, cargar la escuela y el curso, y ver la carpeta "
                   "escolar armada con el nombre real de cada chico. Pasás de un alumno a otro y la ves en 3D, "
                   "terminada, como la va a ver la familia. Se hace una vez por colegio, no una vez por chico."),
        'capitulos': [
            ('0:00', 'Probar antes de abrir la venta'),
            ('0:13', 'Las fotos y el listado del colegio'),
            ('0:27', 'La carpeta de cada alumno, en 3D'),
            ('0:43', 'Una vez por colegio'),
        ],
        'proxima': 'El día de la toma: subir las fotos',
        'etiquetas': ['carpetas escolares', 'listado de alumnos', 'plantillas escolares'],
    },
    {
        'n': 11,
        'archivo': 'E11-el-dia-de-la-toma.mp4',
        'titulo': 'El día de la toma: subir las fotos | Curso de fotografía escolar, clase 11',
        'gancho': ("Llegó el día de la sesión, y lo mejor es que no tenés que separar nada por chico. Te muestro cómo "
                   "subir todas las fotos de la jornada juntas, cómo ordenarlas en carpetas por curso o por momento "
                   "mientras se suben, y qué hace el sistema en segundo plano: reconoce las caras de cada foto, que es "
                   "lo que después le permite a cada familia encontrar las de su hijo con una selfie."),
        'capitulos': [
            ('0:00', 'No hay que separar nada por chico'),
            ('0:14', 'Subir toda la jornada junta'),
            ('0:27', 'Las caras se reconocen solas'),
        ],
        'proxima': 'La línea de producción',
        'etiquetas': ['subir fotos', 'reconocimiento facial', 'dia de la toma'],
    },
    {
        'n': 12,
        'archivo': 'E12-la-linea-de-produccion.mp4',
        'titulo': 'La línea de producción | Curso de fotografía escolar, clase 12',
        'gancho': ("¿Qué pasa con cada pedido después de que la familia paga? Te muestro Pedidos escolares, la línea "
                   "de producción en siete pasos: por canjear, revisar diseño, cambios pedidos, para imprimir, en "
                   "imprenta, para entregar y entregado. Cada pedido avanza solo a medida que vos y la familia hacen "
                   "su parte. Ves qué tenés que hacer en cada paso, filtrás por escuela y por curso, y con un botón "
                   "les volvés a avisar a las familias que todavía no eligieron sus fotos."),
        'capitulos': [
            ('0:00', 'Qué pasa después del pago'),
            ('0:14', 'Los siete pasos'),
            ('0:34', 'Pedidos, filtros y avisos a las familias'),
        ],
        'proxima': 'Revisar los diseños de corrido',
        'etiquetas': ['pedidos escolares', 'produccion escolar', 'carpetas escolares'],
    },
    {
        'n': 13,
        'archivo': 'E13-revisar-los-disenos-de-corrido.mp4',
        'titulo': 'Revisar los diseños de corrido | Curso de fotografía escolar, clase 13',
        'gancho': ("Cuando tenés muchas carpetas escolares para revisar, no las abrís una por una: las revisás de "
                   "corrido, una detrás de la otra, en minutos. Antes de empezar, el curso tiene que estar cerrado en "
                   "la pestaña Mosaico, así todas las carpetas del grado salen con el mismo mosaico. Te muestro cómo "
                   "se maneja con el teclado (la A aprueba, la C pide cambios y la E abre el editor), cómo pedirle "
                   "un cambio a la familia, que le llega por correo, y el resumen al final."),
        'capitulos': [
            ('0:00', 'Revisar en minutos y el requisito'),
            ('0:21', 'Revisar de corrido con el teclado'),
            ('0:36', 'Aprobar y pedir cambios'),
            ('0:51', 'El resumen y lo que sigue'),
        ],
        'proxima': 'Mandar a la imprenta por lotes',
        'etiquetas': ['carpetas escolares', 'revision de diseños', 'produccion escolar'],
    },
    {
        'n': 17,
        'archivo': 'E17-el-mosaico-del-curso.mp4',
        'titulo': 'El mosaico del curso | Curso de fotografía escolar, clase 17',
        'gancho': ("El mosaico es la hoja de la carpeta escolar con todo el grado: cada chico con su foto y su nombre. "
                   "Te muestro dónde está, cómo ves qué chicos ya tienen su retrato y cómo completás los que faltan "
                   "con una foto del álbum, para que nadie quede afuera. También sumás a la seño y a los directivos, "
                   "y si tenés retratos sin identificar, le mandás al colegio un enlace para que les ponga el nombre, "
                   "sin crear cuenta. Al final cerrás el curso: el mosaico ya no cambia, todas las carpetas del grado "
                   "salen iguales y recién ahí podés aprobar los diseños."),
        'capitulos': [
            ('0:00', 'Qué es el mosaico del curso'),
            ('0:13', 'El retrato de cada chico'),
            ('0:30', 'La seño, los directivos y los retratos sin nombre'),
            ('0:48', 'Cerrar el curso'),
        ],
        'proxima': 'El panel del colegio',
        'etiquetas': ['mosaico escolar', 'carpetas escolares', 'foto de curso'],
    },
    {
        'n': 14,
        'archivo': 'E14-mandar-a-la-imprenta.mp4',
        'titulo': 'Mandar a la imprenta por lotes | Curso de fotografía escolar, clase 14',
        'gancho': ("Las carpetas escolares aprobadas no se mandan de a una: se juntan en un lote de impresión, "
                   "ordenado por colegio, curso y alumno. Te muestro cómo crear el lote, cómo descargarlo en un ZIP "
                   "ya ordenado en PDF o en JPG, como te lo pida tu imprenta, y cómo marcarlo como impreso cuando "
                   "vuelve: todos esos pedidos pasan juntos a Para entregar."),
        'capitulos': [
            ('0:00', 'Las carpetas aprobadas'),
            ('0:13', 'Crear el lote de impresión'),
            ('0:23', 'Descargar, imprimir y marcar el lote'),
        ],
        'proxima': 'Sobres con QR y entrega',
        'etiquetas': ['carpetas escolares', 'imprenta', 'produccion escolar'],
    },
    {
        'n': 15,
        'archivo': 'E15-sobres-con-qr-y-entrega.mp4',
        'titulo': 'Sobres con QR y entrega | Curso de fotografía escolar, clase 15',
        'gancho': ("Cada sobre sabe de quién es. Te muestro cómo imprimir las etiquetas: un PDF en hoja A4 con "
                   "veinticuatro etiquetas por hoja, en el mismo orden que el lote. Cada una lleva el alumno, el "
                   "curso, el colegio, el número de pedido y un código QR. En el colegio escaneás el QR con el "
                   "celular y ves la ficha de entrega de ese chico, y al terminar marcás los pedidos como "
                   "entregados."),
        'capitulos': [
            ('0:00', 'Imprimir las etiquetas'),
            ('0:17', 'Qué lleva cada etiqueta'),
            ('0:27', 'Escanear y marcar entregados'),
        ],
        'proxima': 'La pantalla de pedidos del estudio',
        'etiquetas': ['etiquetas con qr', 'entrega escolar', 'sobres escolares'],
    },
    {
        'n': 16,
        'archivo': 'E16-la-pantalla-de-pedidos.mp4',
        'titulo': 'La pantalla de pedidos del estudio | Curso de fotografía escolar, clase 16',
        'gancho': ("Un video cortito: la pantalla de pedidos pensada para el televisor del estudio. Fondo oscuro, los "
                   "siete pasos y una tarjeta por cada pedido, que se actualiza sola. Tu equipo ve de un vistazo qué "
                   "hay en cada paso sin preguntarte, y también sirve para mostrarle al colegio cómo viene su "
                   "producción."),
        'capitulos': [],
        'proxima': 'El mosaico del curso',
        'etiquetas': ['pedidos escolares', 'produccion escolar', 'estudio fotografico'],
    },
    {
        'n': 18,
        'archivo': 'E18-el-panel-del-colegio.mp4',
        'titulo': 'El panel del colegio | Curso de fotografía escolar, clase 18',
        'gancho': ("Este video es para el colegio. Te muestro el panel con el que el colegio sigue toda la foto "
                   "escolar sin pedir planillas: los datos y el logo, cuántos álbumes, alumnos y preventas pagadas "
                   "tiene, quién es el fotógrafo responsable, cómo conectar la cuenta de Mercado Pago del colegio "
                   "para recibir su parte a medida que las familias pagan, y las ventas que entraron con el enlace "
                   "del colegio, con lo que le corresponde y en qué estado está."),
        'capitulos': [
            ('0:00', 'Un panel para el colegio'),
            ('0:13', 'Los datos y los números del colegio'),
            ('0:26', 'Mercado Pago y las ventas de la escuela'),
        ],
        'proxima': 'Compartir la preventa y cobrar la comisión',
        'etiquetas': ['panel del colegio', 'fotografia escolar colegios', 'comision escolar'],
    },
    {
        'n': 19,
        'archivo': 'E19-compartir-la-preventa-y-cobrar.mp4',
        'titulo': 'Compartir la preventa y cobrar la comisión | Curso de fotografía escolar, clase 19',
        'gancho': ("Para el colegio: cómo compartir la preventa con las familias y cómo pedir su parte. Te muestro "
                   "dónde copiar el enlace del colegio (las compras que entran por ahí son las que le suman) y el "
                   "mensaje de WhatsApp ya armado para pegar en el grupo de cada curso. Y cuando el colegio quiere "
                   "cobrar lo que juntó, toca Solicitar cobro: al fotógrafo le llega el pedido y, cuando le paga, el "
                   "colegio lo ve como pagado."),
        'capitulos': [
            ('0:00', 'Lo que hace el colegio'),
            ('0:11', 'El enlace y el mensaje de WhatsApp'),
            ('0:27', 'Pedir el cobro'),
        ],
        'proxima': 'Comprar en la preventa',
        'etiquetas': ['preventa escolar', 'comision escolar', 'fotografia escolar colegios'],
    },
    {
        'n': 20,
        'archivo': 'E20-comprar-en-la-preventa.mp4',
        'titulo': 'Comprar en la preventa | Curso de fotografía escolar, clase 20',
        'gancho': ("Para la familia. Si te llegó el enlace del colegio, en un par de minutos dejás resuelta la foto "
                   "escolar de tu hijo. Te muestro cómo elegir tu opción (por ejemplo, la carpeta escolar impresa "
                   "con cinco fotos digitales), cómo buscar a tu hijo en la lista del colegio para que salga bien "
                   "escrito y en su curso, y cómo pagar con Mercado Pago, con tarjeta o con el medio que prefieras. "
                   "No tenés que mandar dinero al colegio ni guardar comprobantes. En la demo, el pago es de prueba."),
        'capitulos': [
            ('0:00', 'Si te llegó el enlace del colegio'),
            ('0:11', 'Elegir el pack y a tu hijo'),
            ('0:24', 'Pagar y confirmar'),
        ],
        'proxima': 'Encontrar las fotos con una selfie',
        'etiquetas': ['preventa escolar', 'fotos del colegio', 'carpeta escolar'],
    },
    {
        'n': 21,
        'archivo': 'E21-encontrar-las-fotos-con-una-selfie.mp4',
        'titulo': 'Encontrar las fotos con una selfie | Curso de fotografía escolar, clase 21',
        'gancho': ("Para la familia. Cuando las fotos están listas, al entrar no ves ninguna, y no es un error: es "
                   "para cuidar a los chicos, nadie puede recorrer el álbum completo. Aceptás que la selfie se use "
                   "solo para buscar tus fotos, te la sacás vos o se la sacás a tu hijo, y aparecen solo las fotos "
                   "donde está él, más las grupales del curso."),
        'capitulos': [
            ('0:00', 'Por qué no ves ninguna foto'),
            ('0:17', 'La selfie que encuentra a tu hijo'),
            ('0:31', 'Solo para buscar'),
        ],
        'proxima': 'Elegir las fotos y aprobar la carpeta escolar',
        'etiquetas': ['reconocimiento facial', 'fotos del colegio', 'privacidad de menores'],
    },
    {
        'n': 22,
        'archivo': 'E22-elegir-las-fotos-y-aprobar-la-carpeta.mp4',
        'titulo': 'Elegir las fotos y aprobar la carpeta escolar | Curso de fotografía escolar, clase 22',
        'gancho': ("Para la familia. Con el enlace de tu pack elegís las fotos que más te gustan, y el contador te "
                   "dice cuántas te faltan. Enseguida ves la carpeta escolar armada con el nombre de tu hijo, en 3D "
                   "y hoja por hoja: si una foto no te convence la cambiás, y si el nombre está mal escrito en el "
                   "listado lo avisás desde ahí. Cuando está todo bien confirmás tu pack, que se imprime tal cual lo "
                   "aprobaste, y si te gustaron otras fotos las podés sumar en el momento."),
        'capitulos': [
            ('0:00', 'Elegir las fotos del pack'),
            ('0:21', 'La carpeta escolar en 3D'),
            ('0:34', 'Confirmar y sumar más fotos'),
        ],
        'proxima': 'Recuperar el pack',
        'etiquetas': ['carpeta escolar', 'fotos del colegio', 'elegir fotos'],
    },
    {
        'n': 23,
        'archivo': 'E23-recuperar-el-pack.mp4',
        'titulo': 'Recuperar el pack | Curso de fotografía escolar, clase 23',
        'gancho': ("Para la familia. ¿Borraste el correo o no encontrás el enlace de tu pack? Lo recuperás en un "
                   "minuto: entrás a recuperar el acceso a tu pack, escribís el correo con el que compraste y te "
                   "llega un enlace nuevo para seguir donde quedaste. Si con ese correo no aparece nada, probá con "
                   "otro que hayas usado o escribile a tu fotógrafo. Es la última clase del curso: gracias por "
                   "mirarlo."),
        'capitulos': [],
        'proxima': None,
        'etiquetas': ['recuperar pack', 'fotos del colegio', 'ayuda familias'],
    },
]


def descripcion(c):
    # YouTube pide al menos tres capítulos de 10 segundos; un video muy corto va sin ellos.
    partes = [c['gancho']]
    if c['capitulos']:
        partes.append('En esta clase:\n' + '\n'.join(f'{t} {x}' for t, x in c['capitulos']))
    if c.get('proxima'):
        partes.append(f"▶ Próxima clase: {c['proxima']}.")
    partes.append(PIE.format(n=c['n'], total=TOTAL))
    return '\n\n'.join(partes)


def manifiesto():
    return {
        'canal': 'DNX ESTUDIO (dnxfotografia@gmail.com)',
        'listas': {'escolar': 'PLGDPLEY4OFJQ'},
        '_nota': ('Curso de fotografía escolar de ComprameLaFoto. Se sube con '
                  'subir.py --manifiesto <este archivo>. Los copys se explican en publicacion.md.'),
        'videos': [{
            'archivo': f"{VIDEOS}/{c['archivo']}",
            'titulo': c['titulo'],
            'descripcion': descripcion(c),
            'etiquetas': ETIQUETAS_SERIE + c['etiquetas'],
            'categoria': '27',
            'lista': 'escolar',
            'portada': f"{VIDEOS}/portadas/{c['archivo'].rsplit('.', 1)[0]}.png",
        } for c in COPYS],
    }


def segundos(tiempo):
    m, s = tiempo.split(':')
    return int(m) * 60 + int(s)


def duracion(archivo):
    import subprocess
    salida = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                             f'{VIDEOS}/{archivo}'], capture_output=True, text=True, check=True).stdout
    return round(float(salida))


def detalle_para_clf():
    """Lo que muestra la página del curso en CLF: descripción, duración y capítulos de cada clase."""
    filas = []
    for c in sorted(COPYS, key=lambda c: c['n']):
        capitulos = ', '.join(f'{{ at: {segundos(t)}, label: {json.dumps(x, ensure_ascii=False)} }}'
                              for t, x in c['capitulos'])
        filas.append(f"  {c['n']}: {{\n    durationSeconds: {duracion(c['archivo'])},\n"
                     f"    description: {json.dumps(c['gancho'], ensure_ascii=False)},\n"
                     f"    chapters: [{capitulos}],\n  }},")
    return ('// Generado por docs/demos/tutoriales/escolar/generar-manifiesto.py: no editar a mano.\n'
            'import type { EscolarCourseLessonDetail } from "./escolar-course";\n\n'
            'export const ESCOLAR_COURSE_DETAILS: Record<number, EscolarCourseLessonDetail> = {\n'
            + '\n'.join(filas) + '\n};\n')


if __name__ == '__main__':
    destino = pathlib.Path(sys.argv[1])
    if len(sys.argv) > 2:
        pathlib.Path(sys.argv[2]).write_text(detalle_para_clf(), encoding='utf-8')
    m = manifiesto()
    for v in m['videos']:
        assert len(v['titulo']) <= 100, v['titulo']
        assert len(v['descripcion']) <= 5000
        assert not re.search(r'\b(plata|velocidad)\b', v['descripcion'], re.I)
        assert sum(len(t) for t in v['etiquetas']) < 450
    destino.write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(m['videos'][0]['descripcion'])
