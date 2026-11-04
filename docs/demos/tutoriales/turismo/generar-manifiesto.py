"""Genera youtube-manifiesto.json (y el detalle para CLF) del Curso de fotografía de turismo.

Para sumar un video: agregalo a COPYS (capítulos sacados del audio final) y corré
    python3 docs/demos/tutoriales/turismo/generar-manifiesto.py docs/demos/tutoriales/turismo/youtube-manifiesto.json \
        apps/compramelafoto/lib/tutorials/turismo-course-details.ts
Misma estructura que docs/demos/tutoriales/escolar/generar-manifiesto.py.
"""
import json, pathlib, re, sys

VIDEOS = '/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/docs/demos/tutoriales/turismo/videos'
TOTAL = 12

PIE = """━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Curso de fotografía de turismo de ComprameLaFoto
Vendé las fotos de cada paseo: el turista las encuentra con una selfie y las paga en el momento.
Clase {n} de {total}. Todo lo que ves es una demo: los turistas son inventados y los pagos son de prueba.

👉 CREÁ TU CUENTA DE FOTÓGRAFO, GRATIS
https://www.compramelafoto.com/fotografo/registro

🎬 El curso completo
https://www.compramelafoto.com/tutoriales/fotografia-de-turismo

💬 ¿Te quedó una duda? Dejala en los comentarios.
━━━━━━━━━━━━━━━━━━━━━━━━
#FotografiaDeTurismo #ComprameLaFoto"""

ETIQUETAS_SERIE = ['fotografia de turismo', 'compramelafoto', 'curso de fotografia de turismo',
                   'fotografo de excursiones', 'vender fotos a turistas']

COPYS = [
    {
        'n': 2,
        'archivo': 'T02-crear-el-album-de-la-excursion.mp4',
        'titulo': 'Crear el álbum de la excursión | Curso de fotografía de turismo, clase 2',
        'gancho': ("Cada paseo tiene su álbum. Te muestro cómo crearlo con el asistente para un city tour por "
                   "Caminito y San Telmo: el tipo Evento, un título que el turista reconozca, el lugar en el mapa y "
                   "la fecha del paseo. Activás la venta de fotos digitales y, en Seguridad, elegís Público, para "
                   "que cualquiera que pasó por el paseo encuentre el álbum."),
        'capitulos': [
            ('0:00', 'El álbum de cada paseo'),
            ('0:10', 'Tipo, título, lugar y fecha'),
            ('0:23', 'Fotos digitales y álbum público'),
            ('0:38', 'Crear el álbum'),
        ],
        'proxima': 'Precios y packs para turistas',
        'etiquetas': ['album de excursion', 'city tour', 'fotografia de eventos'],
    },
    {
        'n': 3,
        'archivo': 'T03-precios-y-packs-para-turistas.mp4',
        'titulo': 'Precios y packs para turistas | Curso de fotografía de turismo, clase 3',
        'gancho': ("Precios pensados para el turista. Te muestro cómo cargar el precio de cada foto digital (en la "
                   "demo, tres mil pesos), cómo sumar descuentos por cantidad para que se lleve más y dónde ves el "
                   "precio final que paga, con el costo de la plataforma incluido. Y el pack estrella para turismo: "
                   "«Todas mis fotos», todas las fotos donde aparece el turista, las que encuentra con su selfie, a "
                   "un precio fijo."),
        'capitulos': [
            ('0:00', 'El precio de cada foto'),
            ('0:17', 'Descuentos y precio final'),
            ('0:39', 'El pack «Todas mis fotos»'),
        ],
        'proxima': 'Fotos ocultas hasta la selfie',
        'etiquetas': ['precios de fotos', 'packs de fotos', 'vender fotos online'],
    },
    {
        'n': 4,
        'archivo': 'T04-fotos-ocultas-hasta-la-selfie.mp4',
        'titulo': 'Fotos ocultas hasta la selfie | Curso de fotografía de turismo, clase 4',
        'gancho': ("Cada turista ve solo sus fotos. Te muestro cómo activar «Fotos ocultas hasta selfie» en la "
                   "configuración del álbum: quien lo abre no ve la galería completa, se saca una selfie y el "
                   "sistema le muestra solo las fotos donde aparece. El paseo es público, pero las fotos de cada "
                   "familia son solo suyas."),
        'capitulos': [
            ('0:00', 'Cada turista ve solo sus fotos'),
            ('0:09', 'Activar las fotos ocultas'),
            ('0:23', 'Ideal para turismo'),
        ],
        'proxima': 'El QR para el punto turístico',
        'etiquetas': ['reconocimiento facial', 'privacidad', 'fotos ocultas'],
    },
    {
        'n': 5,
        'archivo': 'T05-el-qr-para-el-punto-turistico.mp4',
        'titulo': 'El QR para el punto turístico | Curso de fotografía de turismo, clase 5',
        'gancho': ("La forma más simple de que el turista llegue a sus fotos: un QR. Te muestro dónde copiar el "
                   "enlace del álbum para mandarlo por WhatsApp y cómo descargar el QR listo para imprimir. Lo ponés "
                   "en un cartel en el punto de encuentro, en la combi o en la mesa del guía, y el turista lo escanea "
                   "con el celular y entra directo a la excursión."),
        'capitulos': [
            ('0:00', 'El enlace del álbum'),
            ('0:15', 'Descargar el QR e imprimirlo'),
            ('0:28', 'Otros QR para compartir'),
        ],
        'proxima': 'Los interesados: el turista deja su contacto',
        'etiquetas': ['codigo qr', 'punto turistico', 'compartir album'],
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
        'listas': {'turismo': ''},
        '_nota': ('Curso de fotografía de turismo de ComprameLaFoto. Se sube con '
                  'subir.py --manifiesto <este archivo>. Los copys se explican en publicacion.md.'),
        'videos': [{
            'archivo': f"{VIDEOS}/{c['archivo']}",
            'titulo': c['titulo'],
            'descripcion': descripcion(c),
            'etiquetas': ETIQUETAS_SERIE + c['etiquetas'],
            'categoria': '27',
            'lista': 'turismo',
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
    return ('// Generado por docs/demos/tutoriales/turismo/generar-manifiesto.py: no editar a mano.\n'
            'import type { CourseLessonDetail } from "./course";\n\n'
            'export const TURISMO_COURSE_DETAILS: Record<number, CourseLessonDetail> = {\n'
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
