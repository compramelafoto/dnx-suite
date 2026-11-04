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
        'listas': {'escolar': ''},
        '_nota': ('Curso de fotografía escolar de ComprameLaFoto. Se sube con '
                  'subir.py --manifiesto <este archivo>. Los copys se explican en publicacion.md.'),
        'videos': [{
            'archivo': f"{VIDEOS}/{c['archivo']}",
            'titulo': c['titulo'],
            'descripcion': descripcion(c),
            'etiquetas': ETIQUETAS_SERIE + c['etiquetas'],
            'categoria': '27',
            'lista': 'escolar',
            'portada': '',
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
