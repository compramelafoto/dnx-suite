"""Portadas de YouTube (1280x720) del Curso de fotografía de turismo.

Cada portada lleva el número de clase, un texto corto, un cuadro real del video y el
isotipo de ComprameLaFoto. Se arma en HTML y se fotografía con Google Chrome sin ventana
(como tools/video/miniaturas.py, que usa Playwright). Las portadas quedan junto a los videos, fuera de git.

    python3 docs/demos/tutoriales/turismo/generar-portadas.py            # todas
    python3 docs/demos/tutoriales/turismo/generar-portadas.py 4 5        # sólo esas clases

Para sumar una clase: agregala a PORTADAS con el segundo del cuadro y el recorte
(x, y, ancho, alto sobre el cuadro de 1920x1080, en proporción 16:9).
Reglas: máximo cuatro palabras grandes, y la esquina inferior derecha libre (ahí YouTube
pone la duración).
"""
import base64, os, pathlib, subprocess, sys

RAIZ = pathlib.Path('/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite')
VIDEOS = RAIZ / 'docs/demos/tutoriales/turismo/videos'
SALIDA = VIDEOS / 'portadas'
ISOTIPO = pathlib.Path(__file__).resolve().parents[4] / 'apps/compramelafoto/public/demos/isotipo-clf.png'
CHROME = os.environ.get('CHROME') or '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

PORTADAS = {
    2: ('T02-crear-el-album-de-la-excursion.mp4', 15, (130, 240, 1420, 799),
        'El álbum<br><em>del paseo</em>'),
    3: ('T03-precios-y-packs-para-turistas.mp4', 60, (480, 200, 1380, 776),
        'Precios<br><em>para turistas</em>'),
    4: ('T04-fotos-ocultas-hasta-la-selfie.mp4', 18, (480, 180, 1380, 776),
        'Cada turista,<br><em>sus fotos</em>'),
    5: ('T05-el-qr-para-el-punto-turistico.mp4', 23, (0, 0, 1920, 1080),
        'Un QR<br><em>en el paseo</em>'),
    6: ('T06-los-interesados.mp4', 18, (720, 0, 480, 900),
        'El turista<br><em>te deja</em><br><em>su contacto</em>'),
    7: ('T07-subir-las-fotos-del-paseo.mp4', 29, (480, 100, 1380, 776),
        'Subí<br><em>el paseo</em>'),
    8: ('T08-encontrar-las-fotos-con-una-selfie.mp4', 22, (720, 0, 480, 1080),
        'Sus fotos,<br><em>con una selfie</em>'),
}

CSS = """
:root{--crema:#f7f4ef;--tinta:#1f1c19;--naranja:#c27b3d;--gris:#6f6a63;--linea:#e6e0d7}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:var(--crema);
  font-family:'Helvetica Neue',system-ui,-apple-system,sans-serif;color:var(--tinta);-webkit-font-smoothing:antialiased}
.fondo{position:absolute;inset:0;background:radial-gradient(circle at 78% 30%,rgba(194,123,61,.16),transparent 58%)}
.num{position:absolute;left:60px;top:56px;background:var(--naranja);color:#fff;border-radius:999px;
  padding:10px 26px;font-size:28px;font-weight:800;letter-spacing:.14em}
h1{position:absolute;left:60px;top:150px;width:520px;font-size:86px;line-height:1.0;font-weight:800;
  letter-spacing:-.03em}
h1 em{font-style:normal;color:var(--naranja)}
.marca{position:absolute;left:60px;bottom:52px;display:flex;align-items:center;gap:18px}
.marca img{width:92px;height:92px}
.marca b{display:block;font-size:30px;font-weight:800;letter-spacing:-.01em}
.marca span{display:block;font-size:22px;font-weight:600;color:var(--gris);margin-top:2px}
.pantalla{position:absolute;left:576px;top:92px;width:672px;height:378px;border-radius:18px;
  background:#fff;border:4px solid #fff;box-shadow:0 30px 70px rgba(31,28,25,.22);overflow:hidden;
  transform:rotate(2deg)}
.pantalla div{position:absolute;inset:0;background-repeat:no-repeat}
.pantalla.celular{left:auto;right:150px;top:70px;border:10px solid var(--tinta);border-radius:34px;transform:rotate(3deg)}
"""


def cuadro(archivo, segundo, destino):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(segundo), '-i', str(VIDEOS / archivo),
                    '-frames:v', '1', '-q:v', '2', str(destino)], check=True)


def html(n, titulo, cuadro_b64, recorte):
    x, y, w, h = recorte
    # Un recorte vertical (las clases grabadas en vista de celular) va en un marco de teléfono.
    vertical = h > w
    escala = (540 / h) if vertical else (672 / w)
    marco = (f' class="pantalla celular" style="width:{w * escala:.0f}px;height:{h * escala:.0f}px"'
             if vertical else ' class="pantalla"')
    fondo = (f"background-image:url(data:image/jpeg;base64,{cuadro_b64});"
             f"background-size:{1920 * escala:.1f}px {1080 * escala:.1f}px;"
             f"background-position:-{x * escala:.1f}px -{y * escala:.1f}px")
    iso = base64.b64encode(ISOTIPO.read_bytes()).decode()
    return f"""<!doctype html><meta charset="utf-8"><style>{CSS}</style>
<div class="fondo"></div>
<div class="num">CLASE {n}</div>
<h1>{titulo}</h1>
<div{marco}><div style="{fondo}"></div></div>
<div class="marca"><img src="data:image/png;base64,{iso}">
  <div><b>ComprameLaFoto</b><span>Curso de fotografía de turismo</span></div></div>"""


def main():
    pedidas = [int(a) for a in sys.argv[1:]] or sorted(PORTADAS)
    SALIDA.mkdir(parents=True, exist_ok=True)
    lista = []
    for n in pedidas:
        archivo, segundo, recorte, titulo = PORTADAS[n]
        jpg = SALIDA / f'_cuadro-{n:02d}.jpg'
        cuadro(archivo, segundo, jpg)
        pagina = SALIDA / f'_portada-{n:02d}.html'
        pagina.write_text(html(n, titulo, base64.b64encode(jpg.read_bytes()).decode(), recorte), encoding='utf-8')
        lista.append([str(pagina), str(SALIDA / f'{archivo.rsplit(".", 1)[0]}.png')])
    for pagina, png in lista:
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                        '--force-device-scale-factor=1', '--window-size=1280,720',
                        f'--screenshot={png}', f'file://{pagina}'],
                       check=True, capture_output=True)
        print('  ' + png)
    for pagina, _ in lista:
        pathlib.Path(pagina).unlink()
    for jpg in SALIDA.glob('_cuadro-*.jpg'):
        jpg.unlink()


if __name__ == '__main__':
    main()
