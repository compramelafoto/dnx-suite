"""Genera youtube-manifiesto.json desde los copys de esta lista.

Para sumar un video: agregalo a COPYS (capítulos sacados del audio final) y corré
    python3 docs/demos/tutoriales/escolar/generar-manifiesto.py docs/demos/tutoriales/escolar/youtube-manifiesto.json
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
]


def descripcion(c):
    partes = [c['gancho'], 'En esta clase:\n' + '\n'.join(f'{t} {x}' for t, x in c['capitulos'])]
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


if __name__ == '__main__':
    destino = pathlib.Path(sys.argv[1])
    m = manifiesto()
    for v in m['videos']:
        assert len(v['titulo']) <= 100, v['titulo']
        assert len(v['descripcion']) <= 5000
        assert not re.search(r'\b(plata|velocidad)\b', v['descripcion'], re.I)
        assert sum(len(t) for t in v['etiquetas']) < 450
    destino.write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(m['videos'][0]['descripcion'])
