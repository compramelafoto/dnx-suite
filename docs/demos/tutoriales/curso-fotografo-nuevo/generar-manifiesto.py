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
    17: [3.2, 17.2, 25.4, 37.7, 53.3, 61.8, 75.3], 18: [3.2, 16.6, 27.0, 35.3, 41.0], 19: [3.2, 15.4, 22.4, 29.5],
    20: [3.2, 14.8, 20.4, 29.8, 33.6], 21: [3.2, 16.6, 24.6, 31.7, 42.4, 52.6], 22: [3.2, 18.2, 23.0, 34.1, 41.2, 57.1],
    23: [3.2, 10.6, 21.8, 25.7, 34.5], 24: [3.2, 9.9, 16.8, 20.4, 25.5, 30.3, 38.7, 45.7, 54.7],
    25: [3.2, 16.1, 20.5, 30.1, 33.9, 40.7, 47.2, 53.2], 26: [3.2, 18.6, 23.4, 29.9],
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
    dict(n=17, archivo='C17-historias-de-tu-album-en-instagram.mp4', titulo='Que ComprameLaFoto publique historias de tu álbum',
         gancho=("ComprameLaFoto puede publicar historias de tu álbum en su Instagram, gratis: un collage con algunas de "
                 "tus fotos, el nombre del álbum y tu etiqueta. Cargá tu Instagram en tu perfil y, en cada álbum, mirá la "
                 "casilla de «Privacidad y acceso»: viene marcada y se guarda al instante. Sumá al organizador, al club o "
                 "a los sponsors para que compartan la historia. Sólo entran los álbumes públicos, sin selfie y con más "
                 "de 50 fotos."),
         caps=[(0, 'Las historias de tu álbum'), (1, 'Tu Instagram en el perfil'), (2, 'La casilla del álbum'),
               (3, 'Cuándo se publican'), (5, 'Sumar etiquetas'), (6, 'Qué álbumes entran')],
         etiquetas=['instagram', 'historias de instagram', 'difundir album']),
    dict(n=18, archivo='C18-te-llego-una-venta.mp4', titulo='Te llegó una venta: la pantalla de pedidos',
         gancho=("Cuando alguien te compra, te llega un correo con el número de pedido, los datos del cliente y el "
                 "total. Todo lo que vendiste está en «Pedidos»: arriba ves cuántos tenés, cuántos están pagados, cuántos "
                 "se descargaron y cuántos hay que imprimir; con los filtros ves sólo lo que te interesa y con el "
                 "buscador encontrás a cualquier cliente."),
         caps=[(0, 'El correo de venta'), (1, 'La pantalla de pedidos'), (2, 'Los filtros'), (3, 'El buscador')],
         etiquetas=['pedidos', 'ventas de fotos']),
    dict(n=19, archivo='C19-la-ficha-del-pedido.mp4', titulo='La ficha del pedido',
         gancho=("Tocás un pedido y se abre su ficha: si está pagado, si la descarga está lista, si lleva impresión y "
                 "quién retira. Los datos del cliente, con WhatsApp a un toque, y la línea de tiempo con todo lo que "
                 "pasó. Abajo, las acciones para entregar."),
         caps=[(0, 'El resumen'), (1, 'Los datos del cliente'), (2, 'La línea de tiempo')],
         etiquetas=['pedidos', 'atencion al cliente']),
    dict(n=20, archivo='C20-la-entrega-de-las-fotos-digitales.mp4', titulo='La entrega de las fotos digitales',
         gancho=("La entrega digital es automática: apenas se acredita el pago, al cliente le llega un correo con «Ver "
                 "mis fotos». Ahí las baja una por una o todas juntas en un ZIP, hasta la fecha que dice «Disponible "
                 "hasta». Y si te dice que no le llegó, le mandás el link desde la ficha del pedido."),
         caps=[(0, 'El correo al cliente'), (1, 'El centro de descargas'), (3, 'Si no le llegó')],
         etiquetas=['entrega digital', 'descargar fotos']),
    dict(n=21, archivo='C21-tus-laboratorios.mp4', titulo='Tus laboratorios',
         gancho=("Si vendés fotos impresas, empezá por cargar tus laboratorios en «Impresiones → Mis laboratorios»: lo "
                 "elegís del directorio o lo cargás vos, con su correo (ahí le llegan los lotes). Si tus clientes pueden "
                 "retirar ahí, cargás la dirección y el horario. Y el que más usás queda como predeterminado."),
         caps=[(0, 'Mis laboratorios'), (1, 'Agregar un laboratorio'), (3, 'Punto de retiro'), (4, 'El predeterminado')],
         etiquetas=['laboratorio fotografico', 'fotos impresas']),
    dict(n=22, archivo='C22-precios-de-impresion-y-quien-entrega.mp4', titulo='Precios de impresión y quién entrega',
         gancho=("Hay dos formas de ponerle precio a una foto impresa: tu propia lista en «Mis productos impresos», o los "
                 "precios del laboratorio más tu margen. Y la decisión importante: si el cliente retira en el "
                 "laboratorio o si las copias vuelven a vos y las entregás vos."),
         caps=[(0, 'Tu lista de productos'), (2, 'De dónde salen los precios'), (3, 'Precios del laboratorio'),
               (4, 'Quién entrega las copias')],
         etiquetas=['fotos impresas', 'precios de impresion']),
    dict(n=23, archivo='C23-como-pide-tu-cliente-las-fotos-impresas.mp4', titulo='Cómo pide tu cliente las fotos impresas',
         gancho=("Así lo ve tu cliente: en cada foto elige digital o impresa; si es impresa, el tamaño, el acabado y "
                 "cuántas copias, y el precio se calcula solo. Puede duplicar una foto para pedirla en dos tamaños y, si "
                 "retira en un laboratorio, elige dónde."),
         caps=[(0, 'Configurar el pedido'), (1, 'Tamaño, acabado y copias'), (3, 'Dónde retirar'), (4, 'El pago')],
         etiquetas=['fotos impresas', 'comprar fotos']),
    dict(n=24, archivo='C24-la-entrega-de-las-fotos-impresas.mp4', titulo='La entrega de las fotos impresas',
         gancho=("Todo lo impreso se maneja en «Impresiones», en cuatro pasos: para imprimir, en el laboratorio, listos "
                 "para entregar y entregados. Armás un lote, lo mandás al laboratorio, ves si lo abrió y si descargó las "
                 "fotos, y con el QR de cada sobre avisás al cliente y marcás la entrega."),
         caps=[(0, 'Los cuatro pasos'), (2, 'Armar el lote'), (3, 'Enviarlo al laboratorio'), (5, 'La tarjeta del lote'),
               (7, 'El QR del sobre')],
         etiquetas=['fotos impresas', 'laboratorio fotografico', 'entrega de pedidos']),
    dict(n=25, archivo='C25-del-lote-al-laboratorio-y-el-pago.mp4', titulo='Del lote al laboratorio, y el pago al laboratorio',
         gancho=("Los pedidos de impresión siempre pasan por tu panel. Armás un lote por laboratorio y lo mandás con un "
                 "mensaje, cómo te lo entregan y la fecha en que lo necesitás. El laboratorio abre un enlace, sin cuenta, "
                 "descarga las fotos ordenadas y marca cómo avanza. Al laboratorio le pagás vos, por fuera, y lo dejás "
                 "registrado."),
         caps=[(0, 'Tu panel de impresiones'), (2, 'Enviar el lote'), (3, 'Lo que ve el laboratorio'), (7, 'El pago al laboratorio')],
         etiquetas=['laboratorio fotografico', 'fotos impresas']),
    dict(n=26, archivo='C26-cuanto-ganaste-y-cierre.mp4', titulo='Cuánto ganaste y cierre del curso',
         gancho=("Para ver cuánto ganaste entrás a «Analytics»: el neto es lo tuyo, sin la comisión, y filtrás por álbum y "
                 "por período. Con el cobro dividido, tu parte llega a tu Mercado Pago en el momento de cada venta. Y el "
                 "cierre del recorrido: ahora te toca a vos subir tu primer evento."),
         caps=[(0, 'Analytics'), (1, 'Filtrar por álbum y período'), (2, 'El dinero en Mercado Pago'), (3, 'Todo el recorrido')],
         etiquetas=['ganancias', 'mercado pago']),
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


DETALLE = pathlib.Path(__file__).resolve().parents[4] / 'apps/compramelafoto/lib/tutorials/fotografo-nuevo-course-details.ts'


def duracion(archivo):
    if not os.path.exists(f'{VIDEOS}/{archivo}'):  # video ya subido y borrado del disco: la duración que quedó anotada
        n = int(archivo[1:3])
        m = re.search(rf'\n  {n}: {{\n    durationSeconds: (\d+)', DETALLE.read_text(encoding='utf-8'))
        if m: return int(m.group(1))
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
