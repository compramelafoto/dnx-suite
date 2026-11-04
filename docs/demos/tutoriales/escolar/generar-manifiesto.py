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
            ('0:19', 'Lo que hoy complica la foto escolar'),
            ('0:35', 'Conseguir el colegio y acordar con él'),
            ('0:55', 'Packs y plantillas con datos variables'),
            ('1:17', 'La preventa y el día de la toma'),
            ('1:35', 'La selfie, el librito automático y la segunda venta'),
            ('2:02', 'Producción, entrega y la idea más importante'),
        ],
        'proxima': 'Tu página de venta para colegios',
        'etiquetas': ['preventa escolar', 'libritos escolares', 'plantillas escolares'],
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
                   "hijo por el nombre, el librito sale bien escrito y el mosaico del curso se arma solo. Te muestro "
                   "cómo crear un curso a mano y cómo importar de una vez el Excel o el CSV que te pasa el colegio. "
                   "Y si el archivo viene desordenado, un botón te copia el pedido listo para que ChatGPT te lo "
                   "devuelva en el formato correcto."),
        'capitulos': [
            ('0:00', 'Por qué importa el listado de alumnos'),
            ('0:20', 'Crear un curso a mano'),
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
            ('0:20', 'Los packs y sus precios'),
            ('0:37', 'Crear un pack nuevo'),
            ('0:54', 'Lo que incluye el pack'),
        ],
        'proxima': 'Elegir el diseño del librito',
        'etiquetas': ['preventa escolar', 'packs escolares', 'precios fotografia escolar'],
    },
    {
        'n': 9,
        'archivo': 'E09-elegir-el-diseno-del-librito.mp4',
        'titulo': 'Elegir el diseño del librito | Curso de fotografía escolar, clase 9',
        'gancho': ("El librito sale de una plantilla: la elegís una vez y sirve para todo el colegio. Te muestro las "
                   "plantillas del sistema (más de setenta libritos, además de diplomas, calendarios y anuarios), "
                   "cómo filtrarlas por tipo y nivel, cómo verlas en 3D y cómo hacerte una copia propia. Y lo más "
                   "importante: en el editor marcás los datos variables (el colegio, el curso, el nombre del alumno "
                   "y los lugares de las fotos), y en cada pedido el sistema los completa solo."),
        'capitulos': [
            ('0:00', 'Las plantillas del sistema'),
            ('0:21', 'Filtrar por tipo y nivel'),
            ('0:28', 'Ver en 3D y usar la plantilla'),
            ('1:06', 'Los datos variables en el editor'),
            ('1:24', 'Un diseño para todo el colegio'),
        ],
        'proxima': 'Probar el librito con el listado real',
        'etiquetas': ['libritos escolares', 'plantillas escolares', 'diseño de carpetas'],
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
