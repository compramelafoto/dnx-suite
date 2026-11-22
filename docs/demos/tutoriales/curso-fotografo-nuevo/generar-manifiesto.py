"""Genera el manifiesto de YouTube (y el detalle para CLF) del curso «Empezá a vender en ComprameLaFoto».

    python3 docs/demos/tutoriales/curso-fotografo-nuevo/generar-manifiesto.py \
        docs/demos/tutoriales/curso-fotografo-nuevo/youtube-manifiesto-fotografo-nuevo.json \
        apps/compramelafoto/lib/tutorials/fotografo-nuevo-course-details.ts

Misma estructura que docs/demos/tutoriales/turismo/generar-manifiesto.py. Los capítulos salen de TOMAS: el segundo
en que empieza cada toma del video (lo calcula el motor, motor/montar.py). Para sumar una clase: agregala a COPYS y a
TOMAS.
"""
import json, os, pathlib, re, subprocess, sys

VIDEOS = os.path.expanduser('~/Downloads/Curso-CLF-videos')
LISTA = 'PLYLyzIsXfhfA'  # «Empezá a vender en ComprameLaFoto | Curso para fotógrafos», canal DNX ESTUDIO

PIE = """━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Empezá a vender en ComprameLaFoto · curso para fotógrafos
Desde crear tu cuenta hasta entregar el pedido, con las pantallas reales.
Clase {n}. Lo que ves en pantalla es una cuenta demo: los clientes son inventados y los pagos son de prueba.

👉 CREÁ TU CUENTA DE FOTÓGRAFO, GRATIS
https://www.compramelafoto.com/registro

🎬 El curso completo
https://www.compramelafoto.com/tutoriales/empeza-a-vender

💬 ¿Te quedó una duda? Dejala en los comentarios.
━━━━━━━━━━━━━━━━━━━━━━━━
#ComprameLaFoto #FotografiaDeEventos"""

ETIQUETAS_SERIE = ['compramelafoto', 'vender fotos online', 'curso para fotografos', 'fotografia de eventos',
                   'fotografia deportiva']

# Segundo en que empieza cada toma del video (incluye la apertura de 3,2 s).
TOMAS = {
    1: [3.2, 19.5, 29.3, 38.0, 45.5, 56.1, 67.6], 2: [3.2, 19.2, 28.2, 34.7, 49.9, 61.8],
    3: [3.2, 11.9, 19.0, 31.9, 43.8, 52.5, 66.8], 4: [3.2, 18.2, 30.1, 41.6],
    5: [3.2, 8.7, 20.3, 31.0, 41.8, 54.7, 62.0], 6: [3.2, 16.6, 24.3, 30.5, 40.9, 49.9, 60.0],
    7: [3.2, 18.9, 29.1, 47.7, 52.5, 61.6, 69.9], 8: [3.2, 19.2, 29.1, 42.3, 58.6],
    9: [3.2, 12.3, 21.3, 24.2, 34.3, 39.7], 10: [3.2, 17.1, 25.7, 37.9], 11: [3.2, 13.1, 16.2, 20.9, 24.3],
    12: [3.2, 9.9, 20.4, 27.5, 40.4], 13: [3.2, 10.0, 13.9, 27.0, 38.8, 41.9, 46.5],
    14: [3.2, 11.9, 16.7, 25.2, 32.1, 45.3, 62.5], 15: [3.2, 10.5, 17.4, 22.7, 31.0, 33.3, 37.2, 48.1],
    16: [3.2, 10.7, 18.5, 20.9, 27.3, 30.7, 35.1],
}

COPYS = [
    dict(n=1, archivo='C01-crea-tu-cuenta-de-fotografo.mp4', titulo='Creá tu cuenta de fotógrafo',
         gancho=("Arrancamos desde cero. En este curso te acompaño a crear tu cuenta, conectar Mercado Pago, armar tu "
                 "primer álbum, venderlo y entregar el pedido. En esta primera clase creás tu cuenta de fotógrafo: "
                 "elegís «Soy fotógrafo/a», tu país, cargás tus datos o entrás directo con Google, y verificás tu "
                 "correo. Al entrar, el panel ya te avisa lo que falta."),
         caps=[(0, 'Qué vas a aprender'), (1, 'La página de registro'), (3, 'Tus datos y la contraseña'),
               (5, 'Verificar el correo'), (6, 'Tu panel')],
         etiquetas=['crear cuenta', 'registro de fotografo']),
    dict(n=2, archivo='C02-tu-perfil-y-tu-marca.mp4', titulo='Tu perfil y tu marca',
         gancho=("Dejá tu perfil listo para que tus clientes sepan quién sos: tus datos y tu WhatsApp, el nombre de tu "
                 "estudio y tus redes, tu ciudad y hasta dónde viajás. En «Marca y diseño» elegís tu propia dirección "
                 "(compramelafoto.com/tunombre), subís tu logo y elegís tus colores."),
         caps=[(0, 'Tus datos y tu WhatsApp'), (1, 'Tu estudio y tus redes'), (3, 'Tu página con tu nombre'),
               (4, 'Tu logo y tus colores')],
         etiquetas=['perfil de fotografo', 'marca personal']),
    dict(n=3, archivo='C03-conecta-tu-mercado-pago.mp4', titulo='Conectá tu Mercado Pago',
         gancho=("Sin Mercado Pago no se puede crear un álbum, subir fotos ni vender. Te muestro dónde se conecta, un "
                 "consejo sobre los plazos de acreditación, cómo se autoriza (la contraseña la ponés en Mercado Pago, "
                 "nunca en ComprameLaFoto) y qué hacer cuando, cada seis meses, Mercado Pago pide renovar el permiso."),
         caps=[(0, 'Por qué es obligatorio'), (2, 'Los plazos de acreditación'), (3, 'Conectar y autorizar'),
               (5, 'Cuando se vence la conexión')],
         etiquetas=['mercado pago', 'cobrar fotos']),
    dict(n=4, archivo='C04-que-es-el-cobro-dividido.mp4', titulo='Qué es el cobro dividido',
         gancho=("Cuando alguien compra tus fotos, Mercado Pago reparte el pago en ese mismo momento: tu parte va directo "
                 "a tu cuenta, sin esperar liquidaciones ni pedir transferencias. Si en la venta participa un club o un "
                 "colegio, cada uno recibe lo suyo en su propia cuenta. Tus precios y las comisiones no cambian."),
         caps=[(0, 'El cobro dividido'), (1, 'Cada uno recibe lo suyo'), (2, 'Qué cambia y qué no')],
         etiquetas=['cobro dividido', 'mercado pago']),
    dict(n=5, archivo='C05-quien-lo-autoriza-en-cada-venta.mp4', titulo='Quién autoriza el cobro dividido',
         gancho=("Depende de quién participa en la venta. En tu álbum, autorizás vos. Con un organizador que cobra "
                 "comisión, como un club, una liga o una empresa de turismo, también el organizador; en la venta escolar, "
                 "el colegio; y si varios fotógrafos venden juntos en un carrito, todos. El laboratorio no autoriza nada. "
                 "Mi consejo: activalo siempre, el primer día."),
         caps=[(0, 'Depende de la venta'), (2, 'Con un organizador'), (4, 'Varios fotógrafos'), (6, 'Activalo siempre')],
         etiquetas=['cobro dividido', 'organizadores de eventos']),
    dict(n=6, archivo='C06-activa-el-cobro-dividido.mp4', titulo='Activá el cobro dividido',
         gancho=("Son dos pasos y se hacen una sola vez. Primero aceptás el anexo de los términos. Después pedís la "
                 "invitación con el correo de tu cuenta de Mercado Pago y la aceptás allá. Tocás «Ya acepté, revisar» y "
                 "queda activo: desde ahí, en cada venta, tu parte llega en el momento."),
         caps=[(0, 'Los dos pasos'), (1, 'Aceptar el anexo'), (2, 'El permiso en Mercado Pago'), (5, 'Cobro dividido activo')],
         etiquetas=['cobro dividido', 'mercado pago']),
    dict(n=7, archivo='C07-tu-primer-album-tipo-y-datos.mp4', titulo='Tu primer álbum: tipo y datos',
         gancho=("Creamos el primer álbum con el asistente paso a paso. Te muestro los seis pasos, cómo elegir el tipo "
                 "(evento o deporte, álbum simple o colaborativo) y cómo cargar un título claro, el lugar en el mapa, la "
                 "fecha y el horario."),
         caps=[(0, 'El asistente paso a paso'), (2, 'El tipo de álbum'), (4, 'Título y lugar'), (6, 'Fecha y horario')],
         etiquetas=['crear album', 'album de fotos']),
    dict(n=8, archivo='C08-el-precio-de-tus-fotos-digitales.mp4', titulo='El precio de tus fotos digitales',
         gancho=("Lo más importante del álbum: el precio. Marcá «Vender fotos digitales» (viene desmarcada), escribí el "
                 "precio de cada foto y mirá el simulador: la comisión de la plataforma se suma arriba de tu precio y "
                 "vos recibís tu precio entero. Y dejá activo el mensaje de espera para quien llega antes que las fotos."),
         caps=[(0, 'Lo más común en un evento'), (1, 'Vender fotos digitales'), (2, 'El precio y el simulador'),
               (3, 'El mensaje de espera')],
         etiquetas=['precio de fotos', 'cuanto cobrar una foto']),
    dict(n=9, archivo='C09-vende-tambien-fotos-impresas.mp4', titulo='Vendé también fotos impresas',
         gancho=("Si querés vender fotos en papel, activás las impresiones: elegís si los precios salen de tu lista o de "
                 "un laboratorio, ponés tu margen de ganancia y el simulador te muestra cuánto paga el cliente y cuánto "
                 "te queda. También elegís quién retira las copias y si regalás la versión digital con la impresa."),
         caps=[(0, 'Ofrecer impresiones'), (1, 'De dónde salen los precios'), (3, 'Tu margen de ganancia'),
               (4, 'Retiro y versión digital')],
         etiquetas=['fotos impresas', 'laboratorio fotografico']),
    dict(n=10, archivo='C10-seguridad-y-privacidad-del-album.mp4', titulo='Seguridad y privacidad del álbum',
         gancho=("Quién puede ver el álbum: público, para que lo encuentre cualquiera; no listado, solo con el enlace; o "
                 "privado con identificación, donde cada persona ve solo sus fotos después de sacarse una selfie. Es lo "
                 "recomendado cuando hay chicos."),
         caps=[(0, 'Público'), (1, 'No listado'), (2, 'Privado con selfie')],
         etiquetas=['privacidad', 'reconocimiento facial']),
    dict(n=11, archivo='C11-revisa-y-crea-el-album.mp4', titulo='Revisá y creá el álbum',
         gancho=("El último paso del asistente: revisás el resumen con el tipo, el título, el lugar, la fecha, las ventas "
                 "y la seguridad, aceptás los términos y tocás «Crear álbum». Después vas a poder afinar los packs y los "
                 "productos."),
         caps=[], etiquetas=['crear album']),
    dict(n=12, archivo='C12-subi-las-fotos.mp4', titulo='Subí las fotos',
         gancho=("Cómo subir las fotos del evento: sueltas, arrastrándolas o una carpeta completa, con sus subcarpetas. "
                 "Mientras se procesan seguís trabajando y la marca de agua se pone sola. Dos consejos: hasta 10 MB por "
                 "foto, y desde el celular, con buena señal."),
         caps=[(0, 'Los próximos pasos'), (1, 'Fotos sueltas o una carpeta'), (2, 'La marca de agua'),
               (3, 'Dos consejos')],
         etiquetas=['subir fotos', 'marca de agua']),
    dict(n=13, archivo='C13-vende-mas-descuentos-y-packs.mp4', titulo='Vendé más: descuentos y packs',
         gancho=("Para que el cliente se lleve más fotos: descuentos por cantidad (para 5, 10 y 20 fotos) y packs. El que "
                 "mejor funciona en eventos es «Todas mis fotos»: un precio fijo y el cliente se lleva todas las fotos en "
                 "las que aparece. Abajo, una lista te dice qué falta para que la venta esté activa."),
         caps=[(0, 'El precio digital'), (2, 'Descuentos por cantidad'), (3, 'El pack «Todas mis fotos»'),
               (5, 'Venta activa')],
         etiquetas=['packs de fotos', 'descuentos']),
    dict(n=14, archivo='C14-selfie-dorsal-y-aviso-de-fotos-nuevas.mp4', titulo='Selfie, dorsal y aviso de fotos nuevas',
         gancho=("Las opciones para que cada cliente encuentre sus fotos: fotos ocultas hasta la selfie y búsqueda por "
                 "dorsal, ideal en carreras. La protección al ampliar muestra una marca de agua dinámica, una franja que "
                 "se mueve y no deja hacer capturas. Y quienes dejan sus datos antes de que subas las fotos reciben un "
                 "aviso y aparecen en Interesados, para escribirles por WhatsApp."),
         caps=[(0, 'Fotos ocultas hasta la selfie'), (2, 'Búsqueda por dorsal'), (3, 'La marca de agua dinámica'),
               (5, 'Los interesados')],
         etiquetas=['busqueda por dorsal', 'fotografia deportiva', 'marca de agua']),
    dict(n=15, archivo='C15-publica-y-difundi-tu-album.mp4', titulo='Publicá y difundí tu álbum',
         gancho=("Tu álbum se publica cuando compartís el enlace. Te muestro dónde copiarlo y descargar el QR, el "
                 "instructivo para tus clientes (con tu logo y el QR, en PDF o por WhatsApp) y los carteles y tarjetas "
                 "para el día del evento, que es lo que más vende."),
         caps=[(0, 'El enlace y el QR'), (3, 'El instructivo para tus clientes'), (6, 'Carteles y tarjetas'),
               (7, 'Hasta cuándo se ve')],
         etiquetas=['codigo qr', 'compartir album']),
    dict(n=16, archivo='C16-como-compra-tu-cliente.mp4', titulo='Cómo compra tu cliente',
         gancho=("Así ve tu álbum el cliente desde el celular: encuentra sus fotos con una selfie o con su número, elige "
                 "las que quiere, revisa el resumen, deja su nombre, su correo y su WhatsApp (sin crearse una cuenta) y "
                 "paga. En ese momento el dinero se reparte y tu parte va a tu cuenta."),
         caps=[(0, 'El álbum en el celular'), (1, 'Encontrar sus fotos'), (2, 'Elegir y comprar'),
               (5, 'El pago y el reparto')],
         etiquetas=['comprar fotos', 'mercado pago']),
]
SIGUIENTE = {c['n']: COPYS[i + 1]['titulo'] if i + 1 < len(COPYS) else None for i, c in enumerate(COPYS)}


def fmt(s):
    s = int(round(s)); return f'{s // 60}:{s % 60:02d}'


def capitulos(c):
    """Capítulos de YouTube: el primero en 0:00, al menos tres, cada uno de 10 segundos o más."""
    if not c['caps']: return []
    out = []
    for i, (toma, txt) in enumerate(c['caps']):
        t = 0 if i == 0 else TOMAS[c['n']][toma]
        if out and t - out[-1][0] < 10: continue
        out.append((t, txt))
    return out if len(out) >= 3 else []


def titulo(c): return f"{c['titulo']} | Empezá a vender en ComprameLaFoto, clase {c['n']}"


def descripcion(c):
    partes = [c['gancho']]
    caps = capitulos(c)
    if caps: partes.append('En esta clase:\n' + '\n'.join(f'{fmt(t)} {x}' for t, x in caps))
    if SIGUIENTE[c['n']]: partes.append(f"▶ Próxima clase: {SIGUIENTE[c['n']]}.")
    partes.append(PIE.format(n=c['n']))
    return '\n\n'.join(partes)


def manifiesto():
    return {
        'canal': 'DNX ESTUDIO (dnxfotografia@gmail.com)',
        'listas': {'fotografo-nuevo': LISTA},
        '_nota': 'Curso «Empezá a vender en ComprameLaFoto». Se sube con tools/video/youtube/subir.py --manifiesto <este archivo>.',
        'videos': [{
            'archivo': f"{VIDEOS}/{c['archivo']}", 'titulo': titulo(c), 'descripcion': descripcion(c),
            'etiquetas': ETIQUETAS_SERIE + c['etiquetas'], 'categoria': '27', 'lista': 'fotografo-nuevo',
            'portada': f"{VIDEOS}/portadas/{c['archivo'].rsplit('.', 1)[0]}.png",
        } for c in COPYS],
    }


def duracion(archivo):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                          f'{VIDEOS}/{archivo}'], capture_output=True, text=True, check=True).stdout
    return round(float(out))


def detalle_para_clf():
    filas = []
    for c in COPYS:
        caps = ', '.join(f'{{ at: {round(t)}, label: {json.dumps(x, ensure_ascii=False)} }}' for t, x in capitulos(c))
        filas.append(f"  {c['n']}: {{\n    durationSeconds: {duracion(c['archivo'])},\n"
                     f"    description: {json.dumps(c['gancho'], ensure_ascii=False)},\n    chapters: [{caps}],\n  }},")
    return ('// Generado por docs/demos/tutoriales/curso-fotografo-nuevo/generar-manifiesto.py: no editar a mano.\n'
            'import type { CourseLessonDetail } from "./course";\n\n'
            'export const FOTOGRAFO_NUEVO_COURSE_DETAILS: Record<number, CourseLessonDetail> = {\n'
            + '\n'.join(filas) + '\n};\n')


if __name__ == '__main__':
    m = manifiesto()
    for v in m['videos']:
        assert len(v['titulo']) <= 100, v['titulo']
        assert len(v['descripcion']) <= 5000
        assert not re.search(r'\b(plata|velocidad)\b', v['descripcion'], re.I)
        assert sum(len(t) for t in v['etiquetas']) < 450
    pathlib.Path(sys.argv[1]).write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if len(sys.argv) > 2: pathlib.Path(sys.argv[2]).write_text(detalle_para_clf(), encoding='utf-8')
    print(m['videos'][0]['titulo']); print(m['videos'][0]['descripcion'])
