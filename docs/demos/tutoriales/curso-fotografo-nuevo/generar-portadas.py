"""Portadas de YouTube (1280x720) del curso «Empezá a vender en ComprameLaFoto». Copia de turismo/generar-portadas.py.

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

VIDEOS = pathlib.Path.home() / 'Downloads/Curso-CLF-videos'
SALIDA = VIDEOS / 'portadas'
ISOTIPO = pathlib.Path(__file__).resolve().parents[4] / 'apps/compramelafoto/public/demos/isotipo-clf.png'
CHROME = os.environ.get('CHROME') or '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

PORTADAS = {
    1: ('C01-crea-tu-cuenta-de-fotografo.mp4', 34, (240, 60, 1440, 810), 'Tu cuenta<br><em>de fotógrafo</em>'),
    2: ('C02-tu-perfil-y-tu-marca.mp4', 52, (240, 100, 1440, 810), 'Tu perfil<br><em>y tu marca</em>'),
    3: ('C03-conecta-tu-mercado-pago.mp4', 48, (240, 100, 1440, 810), 'Conectá<br><em>Mercado Pago</em>'),
    4: ('C04-que-es-el-cobro-dividido.mp4', 22, (0, 0, 1920, 1080), 'Cobrá<br><em>al instante</em>'),
    5: ('C05-quien-lo-autoriza-en-cada-venta.mp4', 25, (0, 0, 1920, 1080), '¿Quién<br><em>autoriza?</em>'),
    6: ('C06-activa-el-cobro-dividido.mp4', 20, (0, 0, 1920, 1080), 'Activalo<br><em>en 2 pasos</em>'),
    7: ('C07-tu-primer-album-tipo-y-datos.mp4', 35, (100, 40, 1720, 968), 'Tu primer<br><em>álbum</em>'),
    8: ('C08-el-precio-de-tus-fotos-digitales.mp4', 33, (100, 80, 1600, 900), 'El precio<br><em>de tus fotos</em>'),
    9: ('C09-vende-tambien-fotos-impresas.mp4', 28, (100, 80, 1600, 900), 'Fotos<br><em>impresas</em>'),
    10: ('C10-seguridad-y-privacidad-del-album.mp4', 30, (100, 40, 1720, 968), '¿Quién<br><em>ve tus fotos?</em>'),
    11: ('C11-revisa-y-crea-el-album.mp4', 22, (100, 40, 1720, 968), 'Creá<br><em>el álbum</em>'),
    12: ('C12-subi-las-fotos.mp4', 24, (480, 100, 1440, 810), 'Subí<br><em>las fotos</em>'),
    13: ('C13-vende-mas-descuentos-y-packs.mp4', 32, (240, 60, 1440, 810), 'Vendé<br><em>más</em>'),
    14: ('C14-selfie-dorsal-y-aviso-de-fotos-nuevas.mp4', 36, (240, 0, 1440, 810), 'Selfie<br><em>y dorsal</em>'),
    15: ('C15-publica-y-difundi-tu-album.mp4', 39, (240, 100, 1440, 810), 'Difundí<br><em>tu álbum</em>'),
    16: ('C16-como-compra-tu-cliente.mp4', 22, (682, 40, 556, 1000), 'Así compra<br><em>tu cliente</em>'),
    17: ('C17-historias-de-tu-album-en-instagram.mp4', 8, (0, 0, 1920, 1080), 'Tu álbum<br><em>en Instagram</em>'),
    18: ('C18-te-llego-una-venta.mp4', 16, (240, 60, 1440, 810), 'Te llegó<br><em>una venta</em>'),
    19: ('C19-la-ficha-del-pedido.mp4', 10, (480, 60, 1440, 810), 'La ficha<br><em>del pedido</em>'),
    20: ('C20-la-entrega-de-las-fotos-digitales.mp4', 6, (0, 0, 1920, 1080), 'Entrega<br><em>digital</em>'),
    21: ('C21-tus-laboratorios.mp4', 30, (240, 60, 1440, 810), 'Tus<br><em>laboratorios</em>'),
    22: ('C22-precios-de-impresion-y-quien-entrega.mp4', 40, (240, 60, 1440, 810), 'Precios de<br><em>impresión</em>'),
    23: ('C23-como-pide-tu-cliente-las-fotos-impresas.mp4', 15, (682, 40, 556, 1000), 'Así pide<br><em>impresas</em>'),
    24: ('C24-la-entrega-de-las-fotos-impresas.mp4', 20, (240, 60, 1440, 810), 'Entregá<br><em>las impresas</em>'),
    25: ('C25-del-lote-al-laboratorio-y-el-pago.mp4', 37, (240, 60, 1440, 810), 'El lote<br><em>al laboratorio</em>'),
    26: ('C26-cuanto-ganaste-y-cierre.mp4', 9, (240, 60, 1440, 810), 'Cuánto<br><em>ganaste</em>'),
    27: ('C27-laboratorios-recibir-el-lote-y-bajar-las-fotos.mp4', 38, (240, 0, 1440, 810), 'Para<br><em>laboratorios</em>'),
    28: ('C28-laboratorios-etiquetas-clientes-y-entrega.mp4', 33, (240, 270, 1440, 810), 'Retira<br><em>el cliente</em>'),
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
  <div><b>ComprameLaFoto</b><span>Empezá a vender · curso para fotógrafos</span></div></div>"""


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
