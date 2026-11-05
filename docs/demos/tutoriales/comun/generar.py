"""Video 1-B, «¿Cuánto cuesta ComprameLaFoto?»: va en todos los cursos de CLF, después de la clase 1.

Se sube una sola vez a YouTube y se suma a la lista de cada curso en el segundo lugar. Este script
arma las tres cosas que salen del mismo copy:

    python3 docs/demos/tutoriales/comun/generar.py
      -> docs/demos/tutoriales/comun/youtube-manifiesto-comun.json   (lo lee subir.py)
      -> apps/compramelafoto/lib/tutorials/costo-lesson-detail.ts    (la página del curso en CLF)
      -> la portada, junto al video (fuera de git)

La portada sigue las reglas de las de cada curso: cuatro palabras grandes como mucho y la esquina
inferior derecha libre (ahí YouTube pone la duración).
"""
import base64, json, os, pathlib, re, subprocess

AQUI = pathlib.Path(__file__).resolve().parent
REPO = AQUI.parents[3]
RAIZ = pathlib.Path('/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite')
VIDEOS = RAIZ / 'docs/demos/tutoriales/comun/videos'
ARCHIVO = '01B-cuanto-cuesta-compramelafoto.mp4'
ISOTIPO = REPO / 'apps/compramelafoto/public/demos/isotipo-clf.png'
CHROME = os.environ.get('CHROME') or '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

TITULO = '¿Cuánto cuesta ComprameLaFoto? Cero pesos por mes, sin abono'
GANCHO = ('Antes de seguir con el curso, la pregunta que todos hacen: ¿cuánto cuesta ComprameLaFoto? '
          'Por mes pagás cero pesos: no hay abono, no hay plan y no hay permanencia. La plataforma cobra '
          'un 15 % sobre lo que vendés, y ese 15 % lo paga el cliente. Si la foto vale 10.000 pesos, el '
          'cliente paga 11.500 y vos recibís tus 10.000 pesos completos, directo en tu cuenta de Mercado '
          'Pago en el momento de la compra, sin esperar transferencias.\n\n'
          'Si no vendés, el costo es cero aunque subas miles de fotos. Si lo usás una vez cada tres meses, '
          'los demás meses no pagás nada. Y si estás arrancando, no tenés que invertir todos los meses en '
          'un sistema: el costo aparece recién cuando vendés, y lo cubre tu cliente.')
CAPITULOS = [
    ('0:00', 'Cero pesos por mes'),
    ('0:17', 'Un 15 % que paga el cliente'),
    ('0:27', 'El ejemplo: una foto de 10.000 pesos'),
    ('0:52', 'Si no vendés, no pagás'),
    ('1:21', 'Pensado para fotógrafos'),
]
PIE = """━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Cursos en video de ComprameLaFoto
Este video va en todos los cursos, justo después de la clase 1. Todo lo que ves es una demo: los pagos son de prueba.

👉 CREÁ TU CUENTA DE FOTÓGRAFO, GRATIS
https://www.compramelafoto.com/fotografo/registro

🎬 Curso de fotografía escolar
https://www.compramelafoto.com/tutoriales/fotografia-escolar

🎬 Curso de fotografía de turismo
https://www.compramelafoto.com/tutoriales/fotografia-de-turismo

💬 ¿Te quedó una duda? Dejala en los comentarios.
━━━━━━━━━━━━━━━━━━━━━━━━
#ComprameLaFoto #FotografiaEscolar #FotografiaDeTurismo"""
ETIQUETAS = ['compramelafoto', 'cuanto cuesta compramelafoto', 'vender fotos online', 'plataforma para fotografos',
             'fotografia escolar', 'fotografia de turismo', 'vender fotos sin abono', 'cobrar con mercado pago']
# Las listas de cada curso: el video va en la posición 2 (índice 1), después de la clase 1.
LISTAS = {'escolar': 'PLGDPLEY4OFJQ', 'turismo': 'PLKqgKVjrkXso'}

# Segundo del cuadro y recorte (x, y, ancho, alto sobre 1920x1080, en 16:9): «El cliente paga» y «Tu cuenta de Mercado Pago».
PORTADA = (44, (100, 56, 1720, 968), '¿Cuánto<br><em>cuesta?</em>')

CSS = """
:root{--crema:#f7f4ef;--tinta:#1f1c19;--naranja:#c27b3d;--gris:#6f6a63}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:var(--crema);
  font-family:'Helvetica Neue',system-ui,-apple-system,sans-serif;color:var(--tinta);-webkit-font-smoothing:antialiased}
.fondo{position:absolute;inset:0;background:radial-gradient(circle at 78% 30%,rgba(194,123,61,.16),transparent 58%)}
.num{position:absolute;left:60px;top:56px;background:var(--naranja);color:#fff;border-radius:999px;
  padding:10px 26px;font-size:28px;font-weight:800;letter-spacing:.14em}
h1{position:absolute;left:60px;top:150px;width:520px;font-size:86px;line-height:1.0;font-weight:800;letter-spacing:-.03em}
h1 em{font-style:normal;color:var(--naranja)}
.cero{position:absolute;left:60px;top:345px;font-size:30px;font-weight:700;color:var(--gris)}
.cero b{color:var(--tinta)}
.marca{position:absolute;left:60px;bottom:52px;display:flex;align-items:center;gap:18px}
.marca img{width:92px;height:92px}
.marca b{display:block;font-size:30px;font-weight:800;letter-spacing:-.01em}
.marca span{display:block;font-size:22px;font-weight:600;color:var(--gris);margin-top:2px}
.pantalla{position:absolute;left:576px;top:92px;width:672px;height:378px;border-radius:18px;
  background:#fff;border:4px solid #fff;box-shadow:0 30px 70px rgba(31,28,25,.22);overflow:hidden;transform:rotate(2deg)}
.pantalla div{position:absolute;inset:0;background-repeat:no-repeat}
"""


def segundos(tiempo):
    m, s = tiempo.split(':')
    return int(m) * 60 + int(s)


def duracion():
    salida = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                             str(VIDEOS / ARCHIVO)], capture_output=True, text=True, check=True).stdout
    return round(float(salida))


def descripcion():
    capitulos = 'En este video:\n' + '\n'.join(f'{t} {x}' for t, x in CAPITULOS)
    return '\n\n'.join([GANCHO, capitulos, PIE])


def manifiesto():
    return {
        'canal': 'DNX ESTUDIO (dnxfotografia@gmail.com)',
        'listas': LISTAS,
        '_nota': ('Video común a todos los cursos de ComprameLaFoto. subir.py no lo suma a ninguna lista: '
                  'va en la posición 2 de cada una y eso se hace aparte (ver publicacion.md).'),
        'videos': [{
            'archivo': str(VIDEOS / ARCHIVO),
            'titulo': TITULO,
            'descripcion': descripcion(),
            'etiquetas': ETIQUETAS,
            'categoria': '27',
            'portada': str(VIDEOS / 'portadas' / ARCHIVO.replace('.mp4', '.png')),
        }],
    }


def detalle_para_clf():
    capitulos = ', '.join(f'{{ at: {segundos(t)}, label: {json.dumps(x, ensure_ascii=False)} }}'
                          for t, x in CAPITULOS)
    return ('// Generado por docs/demos/tutoriales/comun/generar.py: no editar a mano.\n'
            'import type { CourseLessonDetail } from "./course";\n\n'
            'export const COSTO_LESSON_DETAIL: CourseLessonDetail = {\n'
            f'  durationSeconds: {duracion()},\n'
            f'  description: {json.dumps(GANCHO, ensure_ascii=False)},\n'
            f'  chapters: [{capitulos}],\n'
            '};\n')


def portada():
    segundo, (x, y, w, h), titulo = PORTADA
    salida = VIDEOS / 'portadas'
    salida.mkdir(parents=True, exist_ok=True)
    jpg, pagina = salida / '_cuadro-01B.jpg', salida / '_portada-01B.html'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(segundo), '-i', str(VIDEOS / ARCHIVO),
                    '-frames:v', '1', '-q:v', '2', str(jpg)], check=True)
    escala = 672 / w
    fondo = (f"background-image:url(data:image/jpeg;base64,{base64.b64encode(jpg.read_bytes()).decode()});"
             f"background-size:{1920 * escala:.1f}px {1080 * escala:.1f}px;"
             f"background-position:-{x * escala:.1f}px -{y * escala:.1f}px")
    iso = base64.b64encode(ISOTIPO.read_bytes()).decode()
    pagina.write_text(f"""<!doctype html><meta charset="utf-8"><style>{CSS}</style>
<div class="fondo"></div>
<div class="num">ANTES DE EMPEZAR</div>
<h1>{titulo}</h1>
<p class="cero"><b>$ 0</b> por mes, sin abono</p>
<div class="pantalla"><div style="{fondo}"></div></div>
<div class="marca"><img src="data:image/png;base64,{iso}">
  <div><b>ComprameLaFoto</b><span>Cursos en video</span></div></div>""", encoding='utf-8')
    png = salida / ARCHIVO.replace('.mp4', '.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    '--window-size=1280,720', f'--screenshot={png}', f'file://{pagina}'],
                   check=True, capture_output=True)
    pagina.unlink()
    jpg.unlink()
    return png


if __name__ == '__main__':
    m = manifiesto()
    v = m['videos'][0]
    assert len(v['titulo']) <= 100, v['titulo']
    assert len(v['descripcion']) <= 5000
    assert not re.search(r'\b(plata|velocidad|split)\b', v['descripcion'] + ' '.join(v['etiquetas']), re.I)
    assert sum(len(t) for t in v['etiquetas']) < 450
    (AQUI / 'youtube-manifiesto-comun.json').write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n',
                                                         encoding='utf-8')
    (REPO / 'apps/compramelafoto/lib/tutorials/costo-lesson-detail.ts').write_text(detalle_para_clf(),
                                                                                    encoding='utf-8')
    print(portada())
    print(v['descripcion'])
