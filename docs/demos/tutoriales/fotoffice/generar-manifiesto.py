"""Genera el manifiesto de YouTube y el detalle para la página de los cursos en video de FOTOFFICE.

Tres cursos: «FOTOFFICE para tu negocio de fotografía» (N), «FOTOFFICE para tu sociedad o fotoclub» (S)
y «Cuánto cobrar como fotógrafo» (P). Los capítulos salen del AUDIO FINAL de cada mp4 (transcripción
de ElevenLabs), no del guion: si un video se vuelve a montar, hay que rehacer sus tiempos.

    python3 docs/demos/tutoriales/fotoffice/generar-manifiesto.py \
        docs/demos/tutoriales/fotoffice/youtube-manifiesto-fotoffice.json \
        apps/fotoffice/lib/tutoriales/detalles.ts

Se sube con tools/video/youtube/subir.py --manifiesto <el json>. Los links quedan en
tools/video/youtube/estado-youtube-manifiesto-fotoffice.json y se cargan en la página desde
/admin/tutoriales (o directo en SystemSettings, claves `fotoffice_tutoriales_*`).
"""
import json, pathlib, re, subprocess, sys

RAIZ = '/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/docs/demos/tutoriales'
SITIO = 'https://fotoffice.com'

# Una lista de reproducción pública por curso, en el canal DNX ESTUDIO. subir.py agrega cada video nuevo a la
# de su curso (los 32 primeros ya están cargados en orden).
LISTAS = {
    'negocio-de-fotografia': 'PLZVxgw5VcRso',
    'sociedad-o-fotoclub': 'PLNkngpYpvcTs',
    'cuanto-cobrar': 'PLQ_BwUEashjM',
}

CURSOS = {
    'negocio-de-fotografia': {
        'carpeta': f'{RAIZ}/fotoffice-negocio/videos',
        'nombre': 'FOTOFFICE para tu negocio de fotografía',
        'lema': 'La caja, el stock, la tienda, los pedidos y tu equipo, todo en un mismo lugar.',
        'demo': 'Todo lo que ves es una demo: el Estudio Demo, sus clientes y sus ventas son inventados.',
        'total': 18,
        'hashtags': '#FOTOFFICE #NegocioDeFotografia',
        'etiquetas': ['fotoffice', 'negocio de fotografia', 'sistema para fotografos', 'gestion de estudio de fotografia'],
    },
    'sociedad-o-fotoclub': {
        'carpeta': f'{RAIZ}/fotoffice-sociedad/videos',
        'nombre': 'FOTOFFICE para tu sociedad o fotoclub',
        'lema': 'Socios, cuotas, carnets, sorteos y cursos de tu institución, en un mismo lugar.',
        'demo': 'Todo lo que ves es una demo: el Fotoclub Demo del Litoral y sus socios son inventados.',
        'total': 15,
        'hashtags': '#FOTOFFICE #Fotoclub',
        'etiquetas': ['fotoffice', 'fotoclub', 'sociedad de fotografos', 'gestion de socios', 'cuotas de socios'],
    },
    'cuanto-cobrar': {
        'carpeta': f'{RAIZ}/presupuestos/videos',
        'nombre': 'Cuánto cobrar como fotógrafo',
        'lema': 'Armá tu precio a partir de lo que necesitás para vivir, tus costos y tu mercado.',
        'demo': 'Los números son de ejemplo: cargá los tuyos en ¿Cuánto Cobro?, gratis dentro de FOTOFFICE.',
        'total': 26,
        'hashtags': '#CuantoCobrar #Fotografia',
        'etiquetas': ['cuanto cobrar fotografia', 'precios de fotografia', 'cotizar fotografia', 'fotoffice',
                      'presupuesto fotografo'],
    },
}

# clave: la de la página (lib/tutoriales/cursos.ts). etiqueta: lo que se lee en el título («1-B»).
COPYS = [
    # ── FOTOFFICE para tu negocio de fotografía ──
    {
        'curso': 'negocio-de-fotografia', 'clave': '1', 'etiqueta': '1',
        'archivo': 'N01-fotoffice-para-tu-negocio-de-fotografia.mp4',
        'titulo': 'Todo lo que hace FOTOFFICE por tu negocio',
        'gancho': ('El sistema que usamos todos los días en DNX Estudio, pensado para el fotógrafo que atiende al '
                   'público. Un recorrido rápido por todo lo que hace: la caja con turnos y arqueos, los proveedores '
                   'y el margen de cada producto, el stock, tu página web y tu tienda online, la foto carnet, las '
                   'polaroids, los fotolibros, los cuadros con el probador 3D, la digitalización de cassettes, las '
                   'comisiones y los sueldos del equipo, el alquiler del estudio y un bot que atiende por WhatsApp.'),
        'capitulos': [('0:00', 'Qué es FOTOFFICE'), ('0:22', 'Caja, proveedores y stock'),
                      ('0:39', 'Página web, tienda y mostrador'),
                      ('1:07', 'Comisiones, equipo y reservas'), ('1:22', 'El bot de WhatsApp')],
        'proxima': '¿Cuánto cuesta FOTOFFICE?',
        'etiquetas': ['dnx estudio', 'local de fotografia'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '1b', 'etiqueta': '1-B',
        'archivo': 'N01B-cuanto-cuesta-fotoffice.mp4',
        'titulo': '¿Cuánto cuesta FOTOFFICE?',
        'gancho': ('Hay dos caminos y elegís el que te conviene. El primero: un 5 % de todo lo que facturás, sin '
                   'monto fijo. Si en el mes facturás un millón de pesos, el costo es de cincuenta mil pesos; si no '
                   'vendés, no pagás. El segundo: un plan mensual a convenir según cuánto uses el sistema, que suele '
                   'convenir cuando el negocio ya tiene ventas estables. Si recién arrancás, empezá con el 5 %.'),
        'capitulos': [('0:00', 'Dos caminos'), ('0:14', 'Un 5 % de lo que facturás'),
                      ('0:33', 'El plan mensual a convenir'), ('0:43', 'Si recién arrancás')],
        'proxima': 'La caja del día',
        'etiquetas': ['precio fotoffice', 'cuanto cuesta'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '2', 'etiqueta': '2',
        'archivo': 'N02-la-caja-del-dia.mp4',
        'titulo': 'La caja del día',
        'gancho': ('La caja es donde queda registrado todo el dinero que entra y sale de tu negocio. Ves el saldo '
                   'del efectivo del mostrador, la caja fuerte y Mercado Pago. Vendés desde el mostrador, elegís '
                   'cómo paga el cliente y la venta entra sola en la cuenta que corresponde. Anotás los gastos con '
                   'su categoría y, en Reportes, ves cuánto entró, cuánto salió y el margen de lo que vendiste.'),
        'capitulos': [('0:00', 'El saldo de cada cuenta'), ('0:20', 'Vender desde el mostrador'),
                      ('0:43', 'Anotar un gasto'), ('0:59', 'Los reportes')],
        'proxima': 'Proveedores y cuentas a pagar',
        'etiquetas': ['caja del negocio', 'arqueo de caja'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '3', 'etiqueta': '3',
        'archivo': 'N03-proveedores-y-cuentas-a-pagar.mp4',
        'titulo': 'Proveedores y cuentas a pagar',
        'gancho': ('Los laboratorios y comercios a los que les comprás, y lo que les debés. Cargás la lista de precios '
                   'de cada proveedor y, cuando cambia, subís la nueva y se actualizan todos los costos de una vez. '
                   'Ves lo que te cuesta cada producto, el margen y el precio. En cada pedido cargás lo que le vas a '
                   'pagar al proveedor, y en A pagar queda todo junto: lo vencido y lo que vence en los próximos días.'),
        'capitulos': [('0:00', 'Las listas de precios'), ('0:25', 'Costo, margen y precio'),
                      ('0:40', 'El costo de cada pedido'), ('0:54', 'Lo que tenés que pagar')],
        'proxima': 'Stock de insumos y de productos',
        'etiquetas': ['proveedores', 'cuentas a pagar', 'laboratorio fotografico'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '4', 'etiqueta': '4',
        'archivo': 'N04-stock-de-insumos-y-productos.mp4',
        'titulo': 'Stock de insumos y de productos',
        'gancho': ('Los insumos que usás para producir, como el ribbon de la impresora, y los productos que vendés, '
                   'como los portarretratos. El sistema te avisa qué hay que comprar. Cargás la mercadería que llega, '
                   'le decís qué insumo gasta cada producto y, cuando vendés, el stock baja solo. Con los productos '
                   'es igual, y cuando contás lo que hay en el local, ajustás por conteo.'),
        'capitulos': [('0:00', 'Qué hay que comprar'), ('0:19', 'Cargar una entrada'),
                      ('0:34', 'La receta de consumo'), ('0:48', 'El stock baja solo'), ('1:00', 'Contar y ajustar')],
        'proxima': 'Tu página web',
        'etiquetas': ['stock', 'insumos de fotografia'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '5', 'etiqueta': '5',
        'archivo': 'N05-tu-pagina-web.mp4',
        'titulo': 'Tu página web',
        'gancho': ('Armás la página de tu negocio sin saber programar. La ves tal como la va a ver tu cliente y la '
                   'editás al costado: elegís la plantilla, cambiás el logo, los colores y las letras, y armás cada '
                   'página con bloques como la portada, tus trabajos, los testimonios y el formulario para pedir '
                   'presupuesto. Cuando está lista, publicás, y si tenés dominio propio lo conectás.'),
        'capitulos': [('0:00', 'Editar viendo la página'), ('0:11', 'Plantilla, diseño y menú'),
                      ('0:24', 'Las secciones'), ('0:46', 'Publicar y conectar tu dominio')],
        'proxima': 'La tienda online',
        'etiquetas': ['pagina web para fotografos', 'sitio web'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '6', 'etiqueta': '6',
        'archivo': 'N06-la-tienda-online.mp4',
        'titulo': 'La tienda online',
        'gancho': ('Tus clientes compran desde su casa y retiran en el local. Configurás el retiro, las devoluciones y '
                   'los avisos, conectás Mercado Pago y abrís la tienda. Marcás qué productos se venden online, con '
                   'el mismo stock del mostrador. El cliente elige, paga con Mercado Pago y el dinero entra directo '
                   'en tu cuenta. Cada pedido aparece por etapas y la venta entra sola en la caja.'),
        'capitulos': [('0:00', 'Configurar la tienda'), ('0:25', 'Publicar un producto'),
                      ('0:37', 'Así compra tu cliente'), ('0:52', 'Los pedidos online')],
        'proxima': 'Foto carnet en el mostrador',
        'etiquetas': ['tienda online', 'vender online'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '7', 'etiqueta': '7',
        'archivo': 'N07-foto-carnet-en-el-mostrador.mp4',
        'titulo': 'Foto carnet en el mostrador',
        'gancho': ('Una foto carnet en cuatro pasos. Elegís la foto y la medida del trámite, ajustás el encuadre con '
                   'las guías de coronilla y mentón, corregís la luz y el color, y elegís la impresora y la hoja. La '
                   'plancha se arma desde la foto original, sin perder calidad, y en un par de minutos el cliente se '
                   'va con sus fotos.'),
        'capitulos': [('0:00', 'La foto y la medida'), ('0:18', 'Encuadre y retoque'),
                      ('0:35', 'Armar la plancha')],
        'proxima': 'Polaroids',
        'etiquetas': ['foto carnet', 'foto 4x4'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '8', 'etiqueta': '8',
        'archivo': 'N08-polaroids.mp4',
        'titulo': 'Polaroids',
        'gancho': ('Fotos con el clásico marco blanco, para regalar o para decorar. Elegís para cuándo es la entrega, '
                   'subís las fotos del cliente, encuadrás cada una, le cambiás la textura del marco y le sumás un '
                   'texto. Elegís el tamaño, el acabado y las copias, y el sistema arma las hojas listas para imprimir.'),
        'capitulos': [('0:00', 'La entrega y el precio'), ('0:18', 'El diseño de cada polaroid'),
                      ('0:28', 'Tamaño, acabado y copias')],
        'proxima': 'Fotolibros',
        'etiquetas': ['polaroid', 'fotos polaroid'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '9', 'etiqueta': '9',
        'archivo': 'N09-fotolibros.mp4',
        'titulo': 'Fotolibros',
        'gancho': ('Un fotolibro con la medida real del pliego de cada laboratorio. Elegís el laboratorio, la medida y '
                   'las hojas, subís las fotos y el armado automático las reparte en orden. Retocás lo que quieras con '
                   'fondos, adornos y tipografías, le mandás un enlace al cliente para que lo comente y lo apruebe, '
                   'sin crear una cuenta, y exportás los archivos para el laboratorio.'),
        'capitulos': [('0:00', 'Un fotolibro nuevo'), ('0:16', 'El armado automático'),
                      ('0:27', 'Retocar el diseño'), ('0:43', 'Exportar para el laboratorio')],
        'proxima': 'Cuadros con el probador 3D',
        'etiquetas': ['fotolibro', 'album de fotos'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '10', 'etiqueta': '10',
        'archivo': 'N10-cuadros-con-el-probador-3d.mp4',
        'titulo': 'Cuadros con el probador 3D',
        'gancho': ('El cliente ve cómo quedan los cuadros en su propia pared, a escala, antes de comprarlos. Le sacás '
                   'una foto a la pared, marcás algo cuya medida conozcas, elegís el conjunto, la medida y el tipo de '
                   'cuadro, y cargás sus fotos. Le mandás la imagen final o el enlace para que lo pruebe desde su casa.'),
        'capitulos': [('0:00', 'La pared del cliente'), ('0:18', 'El conjunto y la medida'),
                      ('0:32', 'Mandárselo al cliente')],
        'proxima': 'Digitalización de videos analógicos',
        'etiquetas': ['cuadros', 'canvas'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '11', 'etiqueta': '11',
        'archivo': 'N11-digitalizacion-de-videos-analogicos.mp4',
        'titulo': 'Digitalización de videos analógicos',
        'gancho': ('Cassettes VHS y DVD pasados a digital. Conectás la videocasetera a una capturadora, grabás y '
                   'seguís usando la computadora. Cada cassette queda registrado y el sistema lo convierte solo a '
                   'full HD; si viene sin imagen, te avisa. Cuando el pedido está listo, el cliente recibe un enlace '
                   'para ver y descargar sus videos.'),
        'capitulos': [('0:00', 'Grabar un cassette'), ('0:19', 'La conversión automática'),
                      ('0:29', 'La entrega al cliente')],
        'proxima': 'Comisiones por venta',
        'etiquetas': ['digitalizacion vhs', 'pasar cassettes a digital'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '12', 'etiqueta': '12',
        'archivo': 'N12-comisiones-por-venta.mp4',
        'titulo': 'Comisiones por venta',
        'gancho': ('Un premio para las personas del equipo que atienden al público. Ponés el porcentaje de cada '
                   'persona y elegís qué productos dan comisión, por categoría o sueltos. La comisión se gana cuando '
                   'la venta queda cobrada entera, y cada vendedor ve las suyas del mes en el mostrador mientras vende.'),
        'capitulos': [('0:00', 'Quién cobra comisión'), ('0:19', 'Qué productos dan comisión'),
                      ('0:31', 'Lo ganado en el mes')],
        'proxima': 'Sueldos y jornadas del equipo',
        'etiquetas': ['comisiones', 'vendedores'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '13', 'etiqueta': '13',
        'archivo': 'N13-sueldos-y-jornadas-del-equipo.mp4',
        'titulo': 'Sueldos y jornadas del equipo',
        'gancho': ('El horario de cada persona, las jornadas que trabajó y lo que cobra. Cargás el horario de la '
                   'semana, el valor de la jornada y los aumentos con su fecha, y anotás los días especiales. Las '
                   'jornadas salen de la apertura y el cierre de la caja, comparadas con el horario de cada uno.'),
        'capitulos': [('0:00', 'El horario de cada persona'), ('0:17', 'El valor de la jornada'),
                      ('0:34', 'Las jornadas trabajadas'), ('0:44', 'Los saludos del equipo')],
        'proxima': 'Alquiler del estudio y reservas',
        'etiquetas': ['sueldos', 'equipo de trabajo'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '14', 'etiqueta': '14',
        'archivo': 'N14-alquiler-del-estudio-y-reservas.mp4',
        'titulo': 'Alquiler del estudio y reservas',
        'gancho': ('Cargás el espacio que alquilás, como el estudio con ciclorama: los días y horarios, la duración '
                   'mínima, el tiempo de limpieza y el precio por hora o por paquete. Tus clientes reservan desde tu '
                   'página web y vos aprobás o cancelás. Para tus sesiones de fotos usás una agenda como la de Google.'),
        'capitulos': [('0:00', 'El espacio que alquilás'), ('0:15', 'Horarios y precio'),
                      ('0:30', 'Las reservas'), ('0:40', 'La agenda de sesiones')],
        'proxima': 'El bot de atención y los pedidos de impresión',
        'etiquetas': ['alquiler de estudio', 'reservas'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '15', 'etiqueta': '15',
        'archivo': 'N15-bot-de-atencion-y-pedidos-de-impresion.mp4',
        'titulo': 'El bot de atención y los pedidos de impresión',
        'gancho': ('Un bot que contesta a tus clientes por WhatsApp a cualquier hora, con los precios de tu catálogo, '
                   'la dirección y el horario. Lo que no puede resolver se lo pasa a una persona. Arma los pedidos de '
                   'impresión y, en la bandeja, ves todos los chats. Si querés seguir vos, tocás Tomar.'),
        'capitulos': [('0:00', 'Qué contesta el bot'), ('0:17', 'Una clienta pide impresiones'),
                      ('0:28', 'La bandeja de WhatsApp'), ('0:38', 'Tomar el chat')],
        'proxima': 'Consultas, cotizaciones, pedidos y clientes',
        'etiquetas': ['bot de whatsapp', 'pedidos de impresion'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '16', 'etiqueta': '16',
        'archivo': 'N16-consultas-cotizaciones-pedidos-y-clientes.mp4',
        'titulo': 'Consultas, cotizaciones, pedidos y clientes',
        'gancho': ('El circuito de un trabajo. Cada consulta entra a un tablero por etapas, armás la cotización con '
                   'su vencimiento y ves si el cliente la vio o la aceptó. Cuando acepta, pasa a ser un pedido con su '
                   'plan de cuotas, lo cobrado, el saldo, los costos y las tareas. Y todo queda en la ficha del cliente.'),
        'capitulos': [('0:00', 'Las consultas por etapas'), ('0:18', 'Las cotizaciones'),
                      ('0:28', 'El pedido'), ('0:38', 'La ficha del cliente')],
        'proxima': 'Los informes de tu negocio',
        'etiquetas': ['cotizaciones', 'clientes'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '17', 'etiqueta': '17',
        'archivo': 'N17-los-informes-de-tu-negocio.mp4',
        'titulo': 'Los informes de tu negocio',
        'gancho': ('Cómo va tu negocio de un vistazo: lo que te deben y lo que tenés que pagar, los resultados por '
                   'rubro y por mes, las ventas por producto, cliente o vendedor, el flujo de caja de los próximos '
                   'meses y lo cobrado contra el tope de tu categoría del monotributo, con un semáforo.'),
        'capitulos': [('0:00', 'El tablero'), ('0:19', 'Resultados y ventas'),
                      ('0:30', 'Flujo de caja y monotributo')],
        'proxima': 'Tu gestor comercial',
        'etiquetas': ['informes', 'monotributo'],
    },
    {
        'curso': 'negocio-de-fotografia', 'clave': '18', 'etiqueta': '18',
        'archivo': 'N18-tu-gestor-comercial.mp4',
        'titulo': 'Tu gestor comercial',
        'gancho': ('Vender bien es tan importante como sacar buenas fotos. Cada consulta es una tarjeta en tu embudo '
                   'de ventas, con el dinero en juego de cada etapa y el aviso de las que se están enfriando. La '
                   'cotización sale en minutos con tres opciones, calculadas con tus costos y tus horas; el cliente '
                   'la abre en el celular, elige y reserva la fecha. Cuando acepta, el trabajo pasa a proyectos, y el '
                   'informe del embudo te muestra cuántas consultas ganaste y qué evento te deja más dinero.'),
        'capitulos': [('0:00', 'Tu embudo de ventas'), ('0:37', 'Mover una consulta y ver todo junto'),
                      ('0:55', 'La cotización con tres opciones'), ('1:10', 'El cliente elige y reserva'),
                      ('1:23', 'Proyectos e informe del embudo')],
        'proxima': None,
        'etiquetas': ['embudo de ventas', 'cotizaciones', 'crm para fotografos'],
    },
    # ── FOTOFFICE para tu sociedad o fotoclub ──
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '1b', 'etiqueta': '1-B',
        'archivo': 'S01B-cuanto-cuesta-fotoffice-institucion.mp4',
        'titulo': '¿Cuánto cuesta FOTOFFICE para una institución?',
        'gancho': ('Por mes, la institución paga cero pesos: no hay abono ni plan que contratar. El costo es un 5 % '
                   'de cada cuota que cobrás, y solo cuando un socio paga. Si la cuota es de diez mil pesos, el costo '
                   'es de quinientos pesos y a la institución le quedan nueve mil quinientos. Si un mes no cobrás '
                   'cuotas, no pagás nada. Así, un fotoclub chico puede empezar sin invertir y crecer a su ritmo.'),
        'capitulos': [('0:00', 'Cero pesos por mes'), ('0:16', 'Un 5 % de cada cuota'),
                      ('0:38', 'Todo lo que incluye')],
        'proxima': 'Socios y categorías',
        'etiquetas': ['precio fotoffice'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '2', 'etiqueta': '2',
        'archivo': 'S02-socios-y-categorias.mp4',
        'titulo': 'Socios y categorías',
        'gancho': ('El padrón de tu fotoclub: cada socio con su categoría, su estado y si tiene deuda, con filtros y '
                   'para exportar. Sumás un socio en un minuto, definís las categorías (profesional, estudiante, '
                   'aficionado u honorario) con su propia cuota, aprobás las solicitudes que llegan desde la página '
                   'web e importás el padrón que ya tenés en una planilla.'),
        'capitulos': [('0:00', 'El padrón de socios'), ('0:21', 'Sumar un socio'), ('0:33', 'Las categorías'),
                      ('0:43', 'Solicitudes e importación')],
        'proxima': 'La cuota mensual',
        'etiquetas': ['padron de socios', 'categorias de socios'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '3', 'etiqueta': '3',
        'archivo': 'S03-la-cuota-mensual.mp4',
        'titulo': 'La cuota mensual',
        'gancho': ('Cuánto cobrás, cuándo vence y cómo se les avisa a los socios. Ves la deuda total y el saldo de '
                   'cada socio; con Mercado Pago conectado, el socio paga desde su portal y la cuota se marca sola. '
                   'Cargás el valor general o por categoría, los aumentos con su fecha, y el recordatorio sale solo '
                   'por correo el día 5 de cada mes. Y el socio que trae a un colega recibe una bonificación.'),
        'capitulos': [('0:00', 'Cuotas y deuda'), ('0:23', 'Valores por categoría y aumentos'),
                      ('0:38', 'El recordatorio automático y el calendario')],
        'proxima': 'El carnet de socio',
        'etiquetas': ['cuota mensual', 'cobro de cuotas'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '4', 'etiqueta': '4',
        'archivo': 'S04-el-carnet-de-socio.mp4',
        'titulo': 'El carnet de socio',
        'gancho': ('El carnet digital con código QR y, si el socio lo pide, también impreso. Con un botón emitís el '
                   'carnet de todos los socios activos, seguís cada tarjeta impresa hasta entregarla y le cambiás '
                   'al diseño los colores y la tipografía. El socio lo lleva en el celular y el QR comprueba que '
                   'está al día.'),
        'capitulos': [('0:00', 'Emitir los carnets'), ('0:16', 'El carnet impreso y su diseño'),
                      ('0:31', 'Así lo ve el socio')],
        'proxima': 'Recordatorios a los socios',
        'etiquetas': ['carnet de socio', 'carnet digital'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '5', 'etiqueta': '5',
        'archivo': 'S05-recordatorios-y-saludos.mp4',
        'titulo': 'Recordatorios a los socios',
        'gancho': ('Cómo te comunicás con los socios sin escribir los correos uno por uno. Elegís el remitente y ves '
                   'todo lo que sale: el blog, el resumen semanal, las fechas y saludos y tus propias campañas. El '
                   'sistema saluda solo en cada cumpleaños y aniversario de ingreso, da la bienvenida, invita a '
                   'volver y saluda en las fiestas. Cada saludo lo encendés, lo apagás o lo editás.'),
        'capitulos': [('0:00', 'Los correos a los socios'), ('0:25', 'Fechas y saludos'),
                      ('0:41', 'Fiestas y horario de envío')],
        'proxima': 'Beneficios y sponsors',
        'etiquetas': ['correo a socios', 'recordatorios'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '6', 'etiqueta': '6',
        'archivo': 'S06-beneficios-y-sponsors.mp4',
        'titulo': 'Beneficios y sponsors',
        'gancho': ('Sumamos un sponsor y su beneficio para los socios. Las marcas de la red DNX aparecen listas para '
                   'agregar; elegís dónde se muestran y hasta cuándo, y cargás el beneficio, que el socio ve en su '
                   'portal. Si preferís, el sponsor mismo carga su logo y su beneficio con un enlace. En el comercio, '
                   'el socio muestra su carnet y usa el beneficio.'),
        'capitulos': [('0:00', 'Sumar un sponsor'), ('0:17', 'Dónde aparece y el beneficio'),
                      ('0:34', 'El enlace para el sponsor y así lo usa el socio')],
        'proxima': 'Sorteos y entrega de premios',
        'etiquetas': ['sponsors', 'beneficios para socios'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '7', 'etiqueta': '7',
        'archivo': 'S07-sorteos-y-entrega-de-premios.mp4',
        'titulo': 'Sorteos y entrega de premios',
        'gancho': ('Un incentivo para que los socios estén al día. Cada mes armás un sorteo en el que participan solo '
                   'los socios al día, y el resultado sale de un número público que cualquiera puede comprobar. '
                   'Cargás los premios con el aliado que los dona, lo proyectás en vivo el día del acto y seguís cada '
                   'entrega. Es un módulo en desarrollo que suma mejoras todo el tiempo.'),
        'capitulos': [('0:00', 'Un sorteo por mes'), ('0:20', 'Premios y sorteo en vivo'),
                      ('0:30', 'La prueba y la entrega')],
        'proxima': 'Venta de merchandising',
        'etiquetas': ['sorteos para socios', 'sorteo verificable'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '8', 'etiqueta': '8',
        'archivo': 'S08-venta-de-merchandising.mp4',
        'titulo': 'Venta de merchandising',
        'gancho': ('Remeras, tazas y todo lo que tu institución quiera vender. Cargás cada producto con su precio, su '
                   'foto y su stock por talle, y con un clic lo publicás en la tienda online de tu página. Los socios '
                   'pagan con Mercado Pago y retiran en la sede; cada pedido se sigue hasta la entrega y el dinero '
                   'entra en la caja de la institución.'),
        'capitulos': [('0:00', 'El catálogo y los talles'), ('0:19', 'Publicarlo en la tienda'),
                      ('0:33', 'La compra y los pedidos online')],
        'proxima': 'Página web y venta online',
        'etiquetas': ['merchandising', 'tienda online'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '9', 'etiqueta': '9',
        'archivo': 'S09-pagina-web-y-venta-online.mp4',
        'titulo': 'Página web y venta online',
        'gancho': ('Tu fotoclub con su propia página web, sin contratar a nadie. Elegís la plantilla de institución, '
                   'armás las secciones (portada, quiénes son, cómo asociarse, el blog y el contacto), la ves en la '
                   'computadora y en el celular, elegís los colores y la publicás. En el menú quedan los cursos, las '
                   'reservas y la tienda.'),
        'capitulos': [('0:00', 'La plantilla de institución'), ('0:15', 'Las secciones'),
                      ('0:27', 'Celular, diseño y publicar'), ('0:40', 'Así la ven tus socios')],
        'proxima': 'El blog de la institución',
        'etiquetas': ['pagina web para fotoclub', 'sitio web'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '10', 'etiqueta': '10',
        'archivo': 'S10-el-blog-de-la-institucion.mp4',
        'titulo': 'El blog de la institución',
        'gancho': ('La voz de tu fotoclub: las salidas, los resultados de los concursos y las novedades, en tu página '
                   'web. Escribís el artículo con subtítulos, fotos y videos de YouTube o de Instagram, y lo publicás '
                   'en el momento o lo programás para el día y la hora que elijas. Las últimas notas aparecen solas '
                   'en la portada.'),
        'capitulos': [('0:00', 'Para qué sirve el blog'), ('0:13', 'Escribir un artículo'),
                      ('0:30', 'Publicar, programar y así lo leen los socios')],
        'proxima': 'Cursos presenciales, virtuales y grabados',
        'etiquetas': ['blog', 'novedades del fotoclub'],
    },
    {
        'curso': 'sociedad-o-fotoclub', 'clave': '11', 'etiqueta': '11',
        'archivo': 'S11-cursos-presenciales-virtuales-y-grabados.mp4',
        'titulo': 'Cursos presenciales, virtuales y grabados',
        'gancho': ('Tu fotoclub vende sus propios cursos: presenciales, en vivo o grabados. Creás el curso con su '
                   'docente, su portada y su descripción. Los presenciales van por ediciones, con fecha, lugar, '
                   'precio y cupos; los grabados, por clases que el alumno mira cuando quiere. Y si lo marcás gratis '
                   'para socios, el socio activo lo toma sin pagar.'),
        'capitulos': [('0:00', 'Tus cursos'), ('0:13', 'Crear un curso'), ('0:23', 'Ediciones y clases grabadas'),
                      ('0:37', 'Gratis para socios y la página del curso')],
        'proxima': None,
        'etiquetas': ['cursos de fotografia', 'cursos online'],
    },
    # ── Cuánto cobrar como fotógrafo ──
    {
        'curso': 'cuanto-cobrar', 'clave': '1', 'etiqueta': '1',
        'archivo': 'P01 - Cuánto necesitás ganar por mes.mp4',
        'titulo': '¿Cuánto necesitás ganar por mes?',
        'gancho': ('Te piden una cotización y no sabés qué número poner. En este curso separamos dos palabras: '
                   'presupuesto, lo que necesitás para vivir, y cotización, el precio que le das a tu trabajo. La '
                   'cotización sale del presupuesto, nunca al revés. Cargamos los gastos de vida, rubro por rubro, en '
                   '¿Cuánto Cobro?, la herramienta gratis de FOTOFFICE.'),
        'capitulos': [('0:00', 'No saber qué número poner'), ('0:18', 'Presupuesto y cotización'),
                      ('0:35', 'Qué vida querés darte'), ('0:56', 'Tus gastos en ¿Cuánto Cobro?')],
        'proxima': '¿Y si no vivís solo de la fotografía?',
        'etiquetas': ['gastos de vida'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '2', 'etiqueta': '2',
        'archivo': 'P02 - Y si no vivís solo de la fotografía.mp4',
        'titulo': '¿Y si no vivís solo de la fotografía?',
        'gancho': ('«Como tengo otro sueldo, puedo cobrar más barato.» Hacemos la cuenta con dos fotógrafos con el '
                   'mismo presupuesto: uno vive solo de la fotografía y le dedica cuarenta horas; el otro tiene un '
                   'empleo y le quedan dieciséis. En ¿Cuánto Cobro?, la hora de trabajo de los dos cuesta lo mismo. '
                   'Tu otro sueldo es para tu vida, no para subsidiar a tus clientes.'),
        'capitulos': [('0:00', 'Una idea peligrosa'), ('0:13', 'Dos fotógrafos, el mismo presupuesto'),
                      ('0:38', 'La cuenta en ¿Cuánto Cobro?'), ('1:12', 'Exactamente lo mismo')],
        'proxima': 'No todos tenemos los mismos gastos',
        'etiquetas': ['segundo trabajo'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '3', 'etiqueta': '3',
        'archivo': 'P03 - No todos tenemos los mismos gastos.mp4',
        'titulo': 'No todos tenemos los mismos gastos',
        'gancho': ('Dos fotógrafos igual de buenos pasan cotizaciones distintas porque sus gastos no se parecen: el '
                   'freelancer, el que tiene estudio y el que tiene empleados. ¿Cuánto Cobro? separa tus gastos de '
                   'vida de los del negocio. Copiar la cotización de otro no sirve, y esto no es una competencia de '
                   'precios: la vara sos vos.'),
        'capitulos': [('0:00', 'Por qué cotizan distinto'), ('0:14', 'Freelancer, estudio o empresa'),
                      ('0:54', 'Los gastos del negocio'), ('1:16', 'Copiar no sirve'),
                      ('1:26', 'No es una competencia de precios')],
        'proxima': 'Gastos fijos del negocio',
        'etiquetas': ['gastos del negocio'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '4', 'etiqueta': '4',
        'archivo': 'P04 - Gastos fijos del negocio.mp4',
        'titulo': 'Gastos fijos del negocio',
        'gancho': ('Un gasto fijo es el que pagás todos los meses, trabajes o no: el alquiler, los servicios, los '
                   'programas, la nube, la publicidad y el contador. Los que más se olvidan son los chiquitos. Los '
                   'cargamos en ¿Cuánto Cobro? y vemos cómo sube el costo de tu hora. Cada gasto que te olvidás lo '
                   'terminás pagando vos.'),
        'capitulos': [('0:00', 'Qué es un gasto fijo'), ('0:11', 'Los más comunes'),
                      ('0:26', 'Los que se olvidan'), ('0:40', 'Cargarlos en ¿Cuánto Cobro?')],
        'proxima': 'Los gastos variables de cada evento',
        'etiquetas': ['gastos fijos'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '5', 'etiqueta': '5',
        'archivo': 'P05 - Los gastos variables de cada evento.mp4',
        'titulo': 'Los gastos variables de cada evento',
        'gancho': ('Un gasto variable aparece solo cuando hacés un trabajo: combustible, peajes, comida, el segundo '
                   'fotógrafo, el alquiler de luces, las impresiones. Cada evento es distinto, por eso van en cada '
                   'cotización y no en tu perfil. Armamos la cotización de una boda en una estancia y vemos cómo se '
                   'mueve el precio.'),
        'capitulos': [('0:00', 'Qué es un gasto variable'), ('0:25', 'Cada evento es distinto'),
                      ('0:39', 'La cotización de una boda'), ('1:10', 'Conceptos aparte')],
        'proxima': 'Lo que vale tu hora de trabajo',
        'etiquetas': ['gastos variables', 'cotizar una boda'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '6', 'etiqueta': '6',
        'archivo': 'P06 - Lo que vale tu hora de trabajo.mp4',
        'titulo': 'Lo que vale tu hora de trabajo',
        'gancho': ('Cuánto vale una hora de tu trabajo: todo lo que necesitás por mes dividido por todas las horas '
                   'que trabajás. No todas son de evento: editás, respondés consultas, administrás y te capacitás. Lo '
                   'cargás en Disponibilidad. Una boda de seis horas lleva veinte horas de trabajo.'),
        'capitulos': [('0:00', 'La hora de trabajo'), ('0:25', 'Las horas que no se ven'),
                      ('0:38', 'La disponibilidad'), ('0:59', 'Una boda son veinte horas')],
        'proxima': 'Insumos y equipos',
        'etiquetas': ['hora de trabajo', 'valor de la hora'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '7', 'etiqueta': '7',
        'archivo': 'P07 - Insumos y equipos.mp4',
        'titulo': 'Insumos y equipos',
        'gancho': ('Los insumos se gastan y se reponen seguido; los equipos duran años y hay que renovarlos. El error '
                   'es pagarlos cuando se rompen con el dinero de ese mes. Apartás un poco todos los meses: un lente '
                   'de un millón doscientos mil pesos que dura cuatro años son veinticinco mil pesos por mes. Lo '
                   'cargás en Equipamiento.'),
        'capitulos': [('0:00', 'Insumos y equipos'), ('0:20', 'Apartar todos los meses'),
                      ('0:43', 'Cargarlo en ¿Cuánto Cobro?')],
        'proxima': 'Tu cámara se gasta',
        'etiquetas': ['equipo fotografico', 'insumos'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '8', 'etiqueta': '8',
        'archivo': 'P08 - Tu cámara se gasta.mp4',
        'titulo': 'Tu cámara se gasta',
        'gancho': ('El obturador tiene una vida útil. Si la cámara cuesta tres millones y medio de pesos y aguanta '
                   'trescientos mil disparos, cada disparo cuesta once pesos con sesenta y siete: una boda de dos mil '
                   'quinientos disparos son veintinueve mil pesos de cámara. Lo cargás una vez y en cada cotización '
                   'el desgaste se suma solo. Así la próxima cámara la pagan tus clientes.'),
        'capitulos': [('0:00', 'La vida del obturador'), ('0:12', 'Lo que cuesta cada disparo'),
                      ('0:26', 'Cargar tu cámara'), ('0:44', 'Cuándo renovar')],
        'proxima': 'Impresiones: nunca menos del 100 %',
        'etiquetas': ['obturador', 'desgaste de la camara'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '9', 'etiqueta': '9',
        'archivo': 'P09 - Impresiones nunca menos del 100.mp4',
        'titulo': 'Impresiones: nunca menos del 100 %',
        'gancho': ('Todo lo que imprimís tiene un costo: el laboratorio, el embalaje y el envío. Un margen del cien '
                   'por ciento es cobrar el doble, y nunca menos, porque las impresiones fallan: si hay que volver a '
                   'imprimir, sale de ese margen. Lo cargamos como producto físico en la cotización.'),
        'capitulos': [('0:00', 'El costo de una impresión'), ('0:12', 'Qué es el margen'),
                      ('0:22', 'Por qué nunca menos del 100 %'), ('0:37', 'El producto físico en la cotización')],
        'proxima': 'Vacaciones y emergencias también se cobran',
        'etiquetas': ['impresiones', 'margen de ganancia'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '10', 'etiqueta': '10',
        'archivo': 'P10 - Vacaciones y emergencias también se cobran.mp4',
        'titulo': 'Vacaciones y emergencias también se cobran',
        'gancho': ('Cuando trabajás por tu cuenta, nadie te paga las vacaciones, y los imprevistos llegan. Ese dinero '
                   'sale de tus cotizaciones: unas vacaciones de un millón doscientos mil pesos por año son cien mil '
                   'pesos por mes. Lo cargás en Fondo de emergencia y en Vacaciones y ahorro. Descansar también es '
                   'parte del trabajo.'),
        'capitulos': [('0:00', 'Nadie te paga las vacaciones'), ('0:19', 'Sale de tus cotizaciones'),
                      ('0:36', 'Cargarlo en ¿Cuánto Cobro?')],
        'proxima': 'Oferta y demanda',
        'etiquetas': ['vacaciones', 'fondo de emergencia'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '11', 'etiqueta': '11',
        'archivo': 'P11 - Oferta y demanda.mp4',
        'titulo': 'Oferta y demanda',
        'gancho': ('La oferta son los fotógrafos que hacen lo mismo que vos; tu demanda, las consultas que te llegan. '
                   'El que recién arranca no tiene quince consultas por semana; el que trabaja hace diez años, sí. '
                   'Cuando la demanda es alta, podés subir tu cotización. Y la demanda no depende solo de los años: '
                   'se construye.'),
        'capitulos': [('0:00', 'Oferta y demanda'), ('0:14', 'El que recién arranca'),
                      ('0:31', 'Subir la cotización'), ('0:43', 'La demanda se construye')],
        'proxima': '¿En qué momento está tu negocio?',
        'etiquetas': ['oferta y demanda'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '12', 'etiqueta': '12',
        'archivo': 'P12 - En qué momento está tu negocio.mp4',
        'titulo': '¿En qué momento está tu negocio?',
        'gancho': ('Hay cinco momentos: estoy comenzando, estoy creciendo, tengo un negocio estable, tengo una marca '
                   'consolidada y tengo alta demanda. El costo de tu hora no cambia; cambia la cotización recomendada. '
                   'Sé honesto al elegir, y a medida que crece tu demanda, subís un escalón.'),
        'capitulos': [('0:00', 'Los cinco momentos'), ('0:21', 'Qué cambia y qué no'),
                      ('0:37', 'Sé honesto'), ('0:47', 'Subir un escalón')],
        'proxima': 'Filtrar por precio',
        'etiquetas': ['posicionamiento'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '13', 'etiqueta': '13',
        'archivo': 'P13 - Filtrar por precio.mp4',
        'titulo': 'Filtrar por precio',
        'gancho': ('Usar tu cotización para elegir con quién trabajás, cuando te llegan más consultas de las que podés '
                   'atender. Al subirla, algunos se van, pero los que se quedan valoran tu trabajo. Solo funciona si '
                   'tenés demanda, y el filtro no es solo el número: un buen portfolio hace que tu cotización tenga '
                   'sentido.'),
        'capitulos': [('0:00', 'Qué es filtrar por precio'), ('0:18', 'Menos trabajos, pero mejores'),
                      ('0:28', 'Solo con demanda'), ('0:38', 'Mostrar el valor')],
        'proxima': '«En mi pueblo hay muchos fotógrafos»',
        'etiquetas': ['filtrar clientes'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '14', 'etiqueta': '14',
        'archivo': 'P14 - En mi pueblo hay muchos fotógrafos.mp4',
        'titulo': '«En mi pueblo hay muchos fotógrafos»',
        'gancho': ('«Acá no se puede cobrar más.» Es mentira: la cantidad de fotógrafos va en proporción a los '
                   'habitantes, en un pueblo de veinte mil y en una ciudad de un millón. La competencia es la misma '
                   'en todos lados. Lo que cambia es cómo te diferenciás: tu trabajo, tu nicho, tu presentación y tu '
                   'marketing.'),
        'capitulos': [('0:00', 'Una frase que escuchamos siempre'), ('0:10', 'Uno cada dos mil personas'),
                      ('0:27', 'Cómo te diferenciás')],
        'proxima': 'Precio y valor',
        'etiquetas': ['competencia', 'diferenciarse'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '15', 'etiqueta': '15',
        'archivo': 'P15 - Precio y valor.mp4',
        'titulo': 'Precio y valor',
        'gancho': ('El precio es lo que el cliente paga; el valor, lo que percibe de tu trabajo. Y es el valor el que '
                   'decide si sos caro o barato. Lo construyen la calidad de tus fotos, la experiencia, tu marca, tu '
                   'reputación y lo emocional. No alcanza con hacer un buen trabajo: hay que demostrarlo con un buen '
                   'portfolio, testimonios, una presentación cuidada y respuestas rápidas.'),
        'capitulos': [('0:00', 'Precio y valor no son lo mismo'), ('0:22', 'Qué construye el valor'),
                      ('0:37', 'Hay que demostrarlo')],
        'proxima': 'Especializate en un nicho',
        'etiquetas': ['precio y valor', 'valor percibido'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '16', 'etiqueta': '16',
        'archivo': 'P16 - Especializate en un nicho.mp4',
        'titulo': 'Especializate en un nicho',
        'gancho': ('Quince años, bodas, recién nacidos, deportes o producto: el que es el mejor en su nicho cobra lo '
                   'mejor, porque los clientes buscan al especialista. Fuera de tu nicho sos uno más. Para entrar a '
                   'uno nuevo, unos trabajos por canje pueden armarte el portfolio: es una inversión, no un regalo. '
                   'Elegí pocos nichos y hacelos muy bien.'),
        'capitulos': [('0:00', 'Qué es un nicho'), ('0:12', 'El especialista cobra mejor'),
                      ('0:29', 'Entrar a un nicho nuevo'), ('0:40', 'Pocos y muy bien')],
        'proxima': '¿Por qué algunos cobran barato?',
        'etiquetas': ['nicho fotografico', 'especializacion'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '17', 'etiqueta': '17',
        'archivo': 'P17 - Por qué algunos cobran barato.mp4',
        'titulo': '¿Por qué algunos cobran barato?',
        'gancho': ('Un presupuesto de vida bajo, poca experiencia, no tener portfolio ni referencias, pocas consultas '
                   'o miedo a no ser contratado. Y del otro lado, el que cobra caro tiene experiencia, contactos, '
                   'filtra por precio o le dio a su trabajo un valor diferencial. La buena noticia: casi todas las '
                   'causas de cobrar barato se pueden cambiar, y el miedo se va cuando sabés tu mínimo.'),
        'capitulos': [('0:00', 'Por qué cobrar barato'), ('0:21', 'Por qué cobrar caro'),
                      ('0:35', 'Casi todo se puede cambiar'), ('0:47', 'Tu mínimo')],
        'proxima': 'Cuánto cobrar tus fotos en ComprameLaFoto',
        'etiquetas': ['cobrar barato', 'precios bajos'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '18', 'etiqueta': '18',
        'archivo': 'P18 - Cuánto cobrar tus fotos en ComprameLaFoto.mp4',
        'titulo': 'Cuánto cobrar tus fotos en ComprameLaFoto',
        'gancho': ('Vender fotos de eventos tiene su propia lógica: ponés un precio por foto o por pack. Antes, mirá '
                   'la oferta y la demanda del evento, y preguntate si tus fotos se pueden sacar con un celular. Los '
                   'packs bajan el precio por foto, pero el más chico ya tiene que dejarte ganancia. Una impresión '
                   'que te cuesta mil pesos no se cobra menos de seis mil. Y una referencia real: el precio por foto '
                   'digital más elegido es de tres mil pesos.'),
        'capitulos': [('0:00', 'Precio por foto o por pack'), ('0:11', 'La oferta y la demanda del evento'),
                      ('0:27', 'Lo que el celular no logra'), ('0:47', 'Los packs'),
                      ('0:58', 'La foto impresa'), ('1:13', 'Una referencia real')],
        'proxima': 'Más allá del boca en boca',
        'etiquetas': ['comprame la foto', 'vender fotos de eventos', 'precio por foto'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '19', 'etiqueta': '19',
        'archivo': 'P19 - Más allá del boca en boca.mp4',
        'titulo': 'Más allá del boca en boca',
        'gancho': ('El boca en boca es la mejor publicidad, pero no alcanza: si solo dependés de que te recomienden, '
                   'tu demanda depende de otros. Hoy los clientes te buscan en redes y en Google antes de escribirte, '
                   'y esto vale también para los que trabajamos hace veinte años. Publicá seguido, mostrá tu nicho, '
                   'contá el detrás de escena y respondé rápido.'),
        'capitulos': [('0:00', 'El boca en boca no alcanza'), ('0:12', 'Te buscan antes de escribirte'),
                      ('0:22', 'Los que recién arrancan'), ('0:39', 'Cada publicación es una vidriera')],
        'proxima': 'El portfolio vende por vos',
        'etiquetas': ['marketing para fotografos', 'redes sociales'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '20', 'etiqueta': '20',
        'archivo': 'P20 - El portfolio vende por vos.mp4',
        'titulo': 'El portfolio vende por vos',
        'gancho': ('Tu portfolio trabaja las veinticuatro horas y es lo que más sube el valor percibido: el cliente '
                   'entiende tu cotización antes de leerla. Mostrá pocas fotos y muy buenas, ordenalo por nicho, '
                   'mostrá trabajos completos y actualizalo seguido.'),
        'capitulos': [('0:00', 'Tu mejor vendedor'), ('0:19', 'Pocas y muy buenas'),
                      ('0:29', 'Trabajos completos y actualizados')],
        'proxima': 'Tu primera cotización con ¿Cuánto Cobro?',
        'etiquetas': ['portfolio fotografico'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '21', 'etiqueta': '21',
        'archivo': 'P21 - Tu primera cotización con Cuánto Cobro.mp4',
        'titulo': 'Tu primera cotización con ¿Cuánto Cobro?',
        'gancho': ('Llegó el momento de juntar todo. Con tu perfil cargado, agregás a la cotización un ítem calculado '
                   'con ¿Cuánto Cobro?: la boda de Lucía, seis horas de cobertura, doce de edición y dos de viaje. Te '
                   'da dos números: el mínimo sostenible, por debajo del cual trabajás a pérdida, y el recomendado '
                   'según el momento de tu negocio. Sumás el álbum o las impresiones y ves el total, el costo y tu '
                   'margen. Cien por ciento gratis en FOTOFFICE.'),
        'capitulos': [('0:00', 'Juntar todo'), ('0:13', 'Cargar el trabajo'), ('0:26', 'Mínimo y recomendado'),
                      ('0:38', 'Total, costo y margen'), ('0:50', 'Entre las dos decidís vos')],
        'proxima': 'El PDF de presentación',
        'etiquetas': ['cuanto cobro', 'primera cotizacion'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '22', 'etiqueta': '22',
        'archivo': 'P22 - El PDF de presentación.mp4',
        'titulo': 'El PDF de presentación',
        'gancho': ('Tu cotización no debería llegar sola. Armá un PDF de presentación con una frase que impacte, '
                   'quién sos, testimonios, tu trabajo, los paquetes, preguntas frecuentes y las formas de pago. '
                   '¿Con precios o sin precios? Depende de cómo llega el cliente y de cuántas consultas tenés. Y '
                   'armá uno por nicho.'),
        'capitulos': [('0:00', 'Las partes de la presentación'), ('0:25', 'Arrancá fuerte y sumá testimonios'),
                      ('0:37', '¿Con precios o sin precios?'), ('0:51', 'Uno por nicho')],
        'proxima': 'La entrevista',
        'etiquetas': ['presentacion para clientes', 'pdf de presentacion'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '23', 'etiqueta': '23',
        'archivo': 'P23 - La entrevista.mp4',
        'titulo': 'La entrevista',
        'gancho': ('La entrevista es donde se cierran los trabajos. Hacela cuanto antes y con quien decide, en tu '
                   'estudio, en un café o por videollamada, y con un álbum en la mano. Preguntá más de lo que '
                   'hablás, preparate para el «es caro» o el «lo voy a pensar», y cerrá con una seña para reservar '
                   'la fecha y un plan de pago claro.'),
        'capitulos': [('0:00', 'Cuanto antes y con quien decide'), ('0:13', 'Dónde y con qué'),
                      ('0:24', 'Preguntá más de lo que hablás'), ('0:35', 'Las objeciones'), ('0:46', 'Cerrar')],
        'proxima': 'Ninguna consulta sin respuesta',
        'etiquetas': ['entrevista con el cliente', 'cerrar ventas'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '24', 'etiqueta': '24',
        'archivo': 'P24 - Ninguna consulta sin respuesta.mp4',
        'titulo': 'Ninguna consulta sin respuesta',
        'gancho': ('La consulta que no respondés la responde otro fotógrafo. En FOTOFFICE todas las consultas llegan '
                   'a un mismo lugar, ordenadas por etapas, y desde cada una creás la cotización. En Cotizaciones ves '
                   'el estado de todas: borrador, enviada, vista, aceptada o vencida. Respondé rápido y hacé '
                   'seguimiento.'),
        'capitulos': [('0:00', 'Cada consulta es un trabajo'), ('0:10', 'Las consultas por etapas'),
                      ('0:22', 'Cotizaciones y su estado'), ('0:38', 'Respondé rápido y hacé seguimiento')],
        'proxima': 'Te escribieron «info»',
        'etiquetas': ['consultas de clientes', 'seguimiento'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '25', 'etiqueta': '25',
        'archivo': 'P25 - Te escribieron info.mp4',
        'titulo': 'Te escribieron «info»',
        'gancho': ('Una sola palabra. ¿Le pasás la cotización o le proponés una entrevista? Depende de cómo llega el '
                   'cliente y de cuánto tiempo tenés. Si viene recomendado, entrevista; si es un contacto frío, '
                   'primero mostrale el valor; si tenés muchas consultas, la cotización directa ya filtra por precio. '
                   'Lo que nunca: dejar el «info» sin respuesta.'),
        'capitulos': [('0:00', 'Una sola palabra'), ('0:16', 'Recomendado o contacto frío'),
                      ('0:31', 'Cuando tenés muchas consultas'), ('0:42', 'Nunca sin respuesta')],
        'proxima': 'Que tu WhatsApp cotice solo',
        'etiquetas': ['responder consultas', 'whatsapp'],
    },
    {
        'curso': 'cuanto-cobrar', 'clave': '26', 'etiqueta': '26',
        'archivo': 'P26 - Que tu WhatsApp cotice solo.mp4',
        'titulo': 'Que tu WhatsApp cotice solo',
        'gancho': ('Aunque estés en pleno evento o durmiendo, el bot de FOTOFFICE responde las consultas por WhatsApp, '
                   'pregunta la fecha, las horas y los invitados, y arma la cotización con tu perfil de ¿Cuánto '
                   'Cobro? Vos tenés el control: nada sale al cliente sin que lo apruebes. Ese es el camino de este '
                   'curso: conocer tus números, cargarlos y dejar que trabajen por vos.'),
        'capitulos': [('0:00', 'El bot que cotiza'), ('0:23', 'Vos tenés el control'),
                      ('0:37', 'El camino de este curso')],
        'proxima': None,
        'etiquetas': ['bot de whatsapp', 'cotizacion automatica'],
    },
]


def titulo_youtube(c):
    curso = CURSOS[c['curso']]
    return f"{c['titulo']} | {curso['nombre']}, clase {c['etiqueta']}"


def descripcion(c):
    curso = CURSOS[c['curso']]
    clave = c['clave']
    partes = [c['gancho']]
    if c['capitulos']:
        partes.append('En esta clase:\n' + '\n'.join(f'{t} {x}' for t, x in c['capitulos']))
    if c.get('proxima'):
        punto = '' if c['proxima'][-1] in '?»' else '.'
        partes.append(f"▶ Próxima clase: {c['proxima']}{punto}")
    partes.append(
        '━━━━━━━━━━━━━━━━━━━━━━━━\n'
        f"🎓 {curso['nombre']}\n{curso['lema']}\n"
        f"Clase {c['etiqueta']} de {curso['total']}. {curso['demo']}\n\n"
        f"🎬 El curso completo\n{SITIO}/tutoriales/{c['curso']}#clase-{clave}\n\n"
        f"👉 Entrá a FOTOFFICE\n{SITIO}\n\n"
        '💬 ¿Te quedó una duda? Dejala en los comentarios.\n'
        '━━━━━━━━━━━━━━━━━━━━━━━━\n'
        f"{curso['hashtags']}")
    return '\n\n'.join(partes)


def manifiesto():
    return {
        'canal': 'DNX ESTUDIO (dnxfotografia@gmail.com)',
        'listas': LISTAS,
        '_nota': ('Cursos en video de FOTOFFICE. Se sube con subir.py --manifiesto <este archivo>. '
                  'Lo genera generar-manifiesto.py, en esta misma carpeta.'),
        'videos': [{
            'archivo': f"{CURSOS[c['curso']]['carpeta']}/{c['archivo']}",
            'portada': f"{CURSOS[c['curso']]['carpeta']}/portadas/{pathlib.Path(c['archivo']).stem}.png",
            'lista': c['curso'],
            'titulo': titulo_youtube(c),
            'descripcion': descripcion(c),
            'etiquetas': CURSOS[c['curso']]['etiquetas'] + c['etiquetas'],
            'categoria': '27',
            'curso': c['curso'],
            'clave': c['clave'],
        } for c in COPYS],
    }


def segundos(tiempo):
    m, s = tiempo.split(':')
    return int(m) * 60 + int(s)


def duracion(ruta):
    salida = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta],
                            capture_output=True, text=True, check=True).stdout
    return round(float(salida))


def detalle_para_la_pagina():
    """Lo que muestra cada clase en /tutoriales: descripción, duración y capítulos."""
    bloques = []
    for slug, curso in CURSOS.items():
        filas = []
        for c in (c for c in COPYS if c['curso'] == slug):
            capitulos = ', '.join(f'{{ en: {segundos(t)}, texto: {json.dumps(x, ensure_ascii=False)} }}'
                                  for t, x in c['capitulos'])
            filas.append(f"    {json.dumps(c['clave'])}: {{\n"
                         f"      duracionSegundos: {duracion(curso['carpeta'] + '/' + c['archivo'])},\n"
                         f"      descripcion: {json.dumps(c['gancho'], ensure_ascii=False)},\n"
                         f"      capitulos: [{capitulos}],\n    }},")
        bloques.append(f'  {json.dumps(slug)}: {{\n' + '\n'.join(filas) + '\n  },')
    return ('// Generado por docs/demos/tutoriales/fotoffice/generar-manifiesto.py: no editar a mano.\n'
            'import type { DetalleClase } from "./curso";\n\n'
            'export const DETALLES: Record<string, Record<string, DetalleClase>> = {\n'
            + '\n'.join(bloques) + '\n};\n')


if __name__ == '__main__':
    destino = pathlib.Path(sys.argv[1])
    m = manifiesto()
    for v in m['videos']:
        assert len(v['titulo']) <= 100, v['titulo']
        assert len(v['descripcion']) <= 5000
        assert '<' not in v['descripcion'] and '>' not in v['descripcion'], v['titulo']
        assert not re.search(r'\b(plata|velocidad|split)\b', v['descripcion'], re.I), v['titulo']
        assert sum(len(t) for t in v['etiquetas']) < 450
    for v in m['videos']:
        assert pathlib.Path(v['portada']).exists(), v['portada']
    for slug, curso in CURSOS.items():
        numeradas = [c for c in COPYS if c['curso'] == slug and c['etiqueta'].isdigit()]
        assert len(numeradas) <= curso['total'], slug
    for c in COPYS:
        tiempos = [segundos(t) for t, _ in c['capitulos']]
        assert tiempos[0] == 0 and len(tiempos) >= 3, c['archivo']
        assert all(b - a >= 10 for a, b in zip(tiempos, tiempos[1:])), c['archivo']
    if len(sys.argv) > 2:
        pathlib.Path(sys.argv[2]).write_text(detalle_para_la_pagina(), encoding='utf-8')
    destino.write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{len(m['videos'])} videos; ejemplo:\n\n{m['videos'][0]['titulo']}\n{m['videos'][0]['descripcion']}")
