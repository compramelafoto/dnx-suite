/**
 * Las palabras que la gente usa de verdad, por destino del menú.
 *
 * Es lo que separa un buscador que sirve de uno decorativo: nadie escribe el nombre del menú,
 * escribe la palabra que tiene en la cabeza. "Plata" tiene que llegar a Mercado Pago.
 *
 * La clave es el link EXACTO al que lleva el ítem, con su `?tab=` o `?view=` si lo tiene
 * (por ejemplo `/fotografo/configuracion?tab=mercadopago`), porque varias opciones comparten
 * la misma ruta y solo cambian la pestaña. Si un link con query no figura, `keywordsFor` prueba
 * con la ruta sola. Sirve para los cinco menús: fotógrafo, laboratorio, organizador, cliente y
 * admin (las rutas no se pisan entre paneles, salvo `/cuenta/cambiar-contrasena`, que es lo
 * mismo en todos).
 *
 * Vive separado del menú porque va a crecer cada vez que alguien no encuentre algo, y crecer
 * acá no obliga a tocar la navegación. Un ítem que no figura igual se encuentra por su título,
 * su sección y su descripción.
 */
export const MENU_KEYWORDS: Record<string, string[]> = {
  // ── Compartido ──────────────────────────────────────────────────────────────
  "/cuenta/cambiar-contrasena": ["clave", "password", "contraseña", "seguridad", "acceso", "login", "cuenta"],

  // ── Fotógrafo ───────────────────────────────────────────────────────────────
  "/fotografo/dashboard": ["panel", "principal", "tablero", "resumen", "home", "portada"],
  "/fotografo/pedidos": ["ventas", "compras", "ordenes", "vendí", "entregas", "descargas", "pendientes"],
  "/dashboard/albums": ["album", "albumes", "eventos", "fotos", "galerias", "mis albumes", "subir fotos"],
  "/dashboard/albums/new": ["nuevo album", "crear evento", "subir fotos", "cargar fotos", "publicar"],
  "/fotografo/eventos": ["colaborativo", "varios fotografos", "evento compartido", "maraton", "carrera"],
  "/fotografo/remociones": ["bajas", "borrar foto", "eliminar", "privacidad", "quitar foto", "reclamo"],
  "/fotografo/escuelas": ["colegio", "escuela", "jardin", "instituciones", "escolar", "egresados"],
  "/fotografo/escuelas/pedidos": ["colegio", "pedidos del colegio", "escolar", "padres", "ventas escolares"],
  "/dashboard/designs": ["plantillas", "diseño", "editor", "carpeta", "orla", "mural", "fotolibro"],
  "/dashboard/design-projects": ["revision", "aprobar", "proyectos de diseño", "correcciones"],
  "/dashboard/sales-settings": ["precios", "precio por foto", "vender", "cobrar", "tarifas", "descuentos"],
  "/dashboard/productos": ["packs", "combos", "promociones", "paquetes", "precios"],
  "/dashboard/productos?view=recomendados": ["sugeridos", "packs listos", "combos armados", "plantillas de precio"],
  "/fotografo/configuracion?tab=upselling": ["extras", "adicionales", "upselling", "agregados", "vender mas"],
  "/fotografo/configuracion?tab=productos": ["impresiones", "copias", "papel", "imprimir", "productos impresos"],
  "/fotografo/configuracion?tab=mercadopago": ["plata", "cobros", "cobrar", "pagos", "mercado pago", "mp", "cuenta", "vincular"],
  "/fotografo/clientes": ["compradores", "contactos", "gente", "emails", "base de clientes"],
  "/fotografo/analytics": ["estadisticas", "metricas", "visitas", "numeros", "reportes", "rendimiento"],
  "/fotografo/configuracion": ["ajustes", "preferencias", "cuenta", "perfil"],
  "/fotografo/configuracion?tab=datos": ["perfil", "mis datos", "nombre", "telefono", "whatsapp", "bio"],
  "/fotografo/configuracion?tab=diseno": ["marca", "logo", "colores", "marca de agua", "watermark", "estilo", "portada"],
  "/fotografo/configuracion/notificaciones": ["avisos", "emails", "correo", "alertas", "notificar"],
  "/fotografo/laboratorio": ["imprenta", "laboratorio", "imprimir", "copias", "lab"],
  "/dashboard/camera-connection": ["camara", "wifi", "ftp", "conectar camara", "subida automatica", "tethering"],
  "/dashboard/referrals": ["referidos", "invitar", "recomendar", "comision", "marketing", "ganar plata"],
  "/fotografo/notificaciones": ["avisos", "novedades", "alertas", "campanita"],
  "/fotografo/comunidad": ["foro", "fotografos", "grupo", "red", "colegas"],
  "/testimonios": ["opinion", "reseña", "comentario", "recomendacion"],
  "/fotografo/soporte": ["ayuda", "problema", "consulta", "contacto", "reclamo"],
  "/fotografo/soporte?tab=incidencias": ["ayuda", "problema", "error", "ticket", "reclamo", "no funciona"],
  "/fotografo/soporte?tab=politicas": ["terminos", "condiciones", "reglas", "privacidad", "legal"],
  "/fotografo/soporte?tab=tutoriales": ["videos", "como se usa", "guia", "aprender", "manual"],
  "/fotografo/soporte?tab=faqs": ["preguntas frecuentes", "dudas", "ayuda"],

  // ── Laboratorio ─────────────────────────────────────────────────────────────
  "/lab/dashboard": ["panel", "principal", "tablero", "resumen", "home", "portada"],
  "/lab/pedidos": ["ventas", "ordenes", "imprimir", "produccion", "envios", "pendientes"],
  "/lab/albumes": ["album", "albumes", "eventos", "fotos", "galerias"],
  "/lab/albumes?tab=albums": ["album", "eventos", "fotos", "galerias"],
  "/lab/albumes?tab=interesados": ["interesados", "avisame", "contactos", "leads", "esperando"],
  "/lab/clientes": ["compradores", "contactos", "fotografos", "base de clientes"],
  "/lab/productos": ["precios", "impresiones", "copias", "papel", "tamaños", "catalogo", "lista de precios"],
  "/lab/referrals": ["referidos", "invitar", "recomendar", "comision", "ganar plata"],
  "/lab/configuracion/datos": ["perfil", "mis datos", "direccion", "telefono", "ajustes"],
  "/lab/configuracion/diseno": ["marca", "logo", "colores", "estilo", "marca de agua"],
  "/lab/configuracion/mercadopago": ["plata", "cobros", "cobrar", "pagos", "mercado pago", "mp", "vincular"],
  "/lab/configuracion/descuentos": ["promociones", "cupones", "rebaja", "oferta", "por cantidad"],
  "/lab/configuracion/upselling": ["extras", "adicionales", "agregados", "vender mas"],
  "/lab/comunidad": ["foro", "grupo", "red", "colegas"],
  "/lab/soporte": ["ayuda", "problema", "consulta", "contacto"],
  "/lab/soporte?tab=incidencias": ["ayuda", "problema", "error", "ticket", "reclamo", "no funciona"],
  "/lab/soporte?tab=politicas": ["terminos", "condiciones", "reglas", "privacidad", "legal"],
  "/lab/soporte?tab=tutoriales": ["videos", "como se usa", "guia", "aprender", "manual"],
  "/lab/soporte?tab=faqs": ["preguntas frecuentes", "dudas", "ayuda"],

  // ── Organizador ─────────────────────────────────────────────────────────────
  "/organizador/dashboard": ["mis eventos", "panel", "inicio", "tablero", "carreras", "fiestas"],
  "/organizador/events/new": ["crear evento", "nuevo", "alta", "armar evento"],
  "/organizador/comisiones": ["plata", "ganancias", "cobrar", "retiro", "porcentaje", "liquidacion"],
  "/organizador/landing": ["pagina", "sitio", "web", "perfil publico", "link", "vidriera"],
  "/organizador/comunidad": ["foro", "grupo", "red"],
  "/organizador/soporte": ["ayuda", "problema", "consulta", "contacto", "reclamo"],

  // ── Cliente ─────────────────────────────────────────────────────────────────
  "/cliente/dashboard": ["inicio", "panel", "mi cuenta", "home"],
  "/cliente/pedidos": ["compras", "mis fotos", "descargas", "bajar fotos", "ordenes", "lo que compre"],
  "/cliente/soporte": ["ayuda", "problema", "reclamo", "no me llego", "consulta", "contacto"],

  // ── Admin ───────────────────────────────────────────────────────────────────
  "/admin": ["dashboard", "inicio", "panel", "tablero", "resumen", "home"],
  "/admin#funnel-compra": ["embudo", "conversion", "abandono", "checkout", "carrito"],
  "/admin/conversion": ["embudo", "checkout", "abandono", "carrito", "funnel"],
  "/admin/pedidos": ["ventas", "ordenes", "compras", "entregas", "descargas"],
  "/admin/clientes": ["compradores", "contactos", "usuarios"],
  "/admin/interesados": ["leads", "avisame", "contactos", "esperando"],
  "/admin/fotooffice-interesados": ["fotoffice", "leads", "asociaciones", "instituciones"],
  "/admin/pagos-mp-anomalias": ["mercado pago", "pagos raros", "errores de pago", "webhook", "plata", "conciliacion"],
  "/admin/homologacion-mp-split-1n": ["mercado pago", "split", "reparto", "homologacion", "evidencias"],
  "/admin/albums?visibility=public": ["album", "eventos", "fotos", "publicos", "galerias"],
  "/admin/albums?visibility=private": ["album", "eventos", "fotos", "privados", "ocultos"],
  "/admin/eventos": ["colaborativos", "organizadores", "carreras"],
  "/admin/escuelas": ["colegio", "escuela", "jardin", "instituciones", "escolar"],
  "/admin/usuarios?tab=administradores-escuela": ["colegio", "directivos", "admins de escuela"],
  "/admin/catalog-templates": ["productos", "plantillas", "catalogo", "impresiones"],
  "/admin/upselling": ["extras", "adicionales", "agregados"],
  "/admin/template-v2/revision": ["aprobar", "revision", "plantillas nuevas"],
  "/admin/plantillas": ["v1", "plantillas viejas", "diseño"],
  "/admin/plantillas/disenador": ["editor", "v1", "diseñador"],
  "/admin/proyectos": ["diseño", "proyectos", "trabajos"],
  "/admin/usuarios": ["cuentas", "gente", "roles", "permisos", "buscar usuario"],
  "/admin/fotografos": ["fotografos", "fotografas", "vendedores"],
  "/admin/fotografos/mapa": ["mapa", "ubicacion", "provincias", "ciudades", "donde"],
  "/admin/laboratorios": ["labs", "imprentas", "impresion"],
  "/admin/usuarios?tab=organizadores": ["organizadores", "eventos", "carreras"],
  "/admin/recomendados": ["labs recomendados", "destacados", "sugeridos"],
  "/admin/finanzas": ["plata", "ingresos", "facturacion", "ganancias", "comisiones", "numeros"],
  "/admin/finanzas-dnx": ["plata", "gastos", "costos", "sueldos", "dnx", "presupuesto"],
  "/admin/referral-payouts": ["referidos", "pagos", "liquidar", "plata"],
  "/admin/referral-stats": ["referidos", "estadisticas", "metricas"],
  "/admin/organizer-commission-withdrawals": ["retiros", "organizadores", "comisiones", "transferencias", "plata"],
  "/admin/mensajes": ["mensajes", "chat", "contacto", "consultas"],
  "/admin/emails": ["correo", "mail", "envios", "plantillas de mail", "resend"],
  "/admin/email-marketing": ["newsletter", "campaña", "mail masivo", "difusion"],
  "/admin/marketing/charlas": ["charla", "webinar", "encuentro", "taller"],
  "/admin/marketing/cursos/fotografia-basica-funes": ["curso", "funes", "fotografia basica", "inscriptos"],
  "/admin/banner": ["portada", "home", "carrusel", "destacado"],
  "/admin/blog": ["articulos", "notas", "noticias", "publicar"],
  "/admin/testimonios": ["opiniones", "reseñas", "comentarios"],
  "/admin/tutoriales": ["videos", "guias", "ayuda", "manual"],
  "/admin/comunidad/para-fotografos": ["comunidad", "foro", "fotografos"],
  "/admin/comunidad/proveedores": ["proveedores", "partners", "aliados", "marcas"],
  "/admin/soporte": ["incidencias", "tickets", "ayuda", "reclamos", "problemas"],
  "/admin/auditoria": ["logs", "registro", "historial", "quien hizo"],
  "/admin/antifraude": ["fraude", "estafa", "sospechoso", "bloqueo"],
  "/admin/auditoria-selfies": ["selfie", "reconocimiento facial", "caras"],
  "/admin/procesamiento-fotos": ["cola", "procesamiento", "miniaturas", "subidas", "colgadas"],
  "/admin/equipos-fotograficos": ["camaras", "lentes", "equipos", "exif"],
  "/admin/ia": ["inteligencia artificial", "reconocimiento facial", "caras", "rekognition"],
  "/admin/privacidad/solicitudes": ["arco", "datos personales", "privacidad", "borrar datos", "baja"],
  "/admin/informe-diario": ["reporte", "resumen del dia", "numeros", "informe"],
  "/admin/salud-plataforma": ["estado", "errores", "caidas", "monitoreo", "salud"],
  "/admin/configuracion": ["ajustes", "parametros", "fee", "comision", "general"],
  "/admin/r2": ["almacenamiento", "storage", "archivos", "espacio", "bucket", "cloudflare"],
};

/** Una línea por destino, solo donde el nombre del menú no alcanza a explicar qué hay. */
export const MENU_DESCRIPTIONS: Record<string, string> = {
  "/fotografo/pedidos": "Ventas de tus álbumes y su estado",
  "/fotografo/configuracion?tab=mercadopago": "Vinculá tu cuenta para cobrar las ventas",
  "/fotografo/configuracion?tab=diseno": "Logo, colores y marca de agua",
  "/fotografo/remociones": "Pedidos de baja de fotos por privacidad",
  "/dashboard/sales-settings": "Precios y reglas de venta de tus fotos",
  "/dashboard/camera-connection": "Subí fotos directo desde la cámara",
  "/dashboard/referrals": "Invitá colegas y ganá comisión",
  "/lab/configuracion/mercadopago": "Vinculá tu cuenta para cobrar",
  "/organizador/comisiones": "Lo que ganaste por tus eventos y los retiros",
  "/cliente/pedidos": "Tus compras y las descargas de fotos",
  "/admin/pagos-mp-anomalias": "Pagos de Mercado Pago que no cerraron bien",
  "/admin/r2": "Espacio ocupado por las fotos en Cloudflare R2",
};

function sinQuery(href: string): string {
  return href.split(/[?#]/)[0] || href;
}

/** Sinónimos del destino exacto; si no figura, los de la ruta sin `?tab=`/`?view=`. */
export function keywordsFor(href: string): string[] | undefined {
  return MENU_KEYWORDS[href] ?? MENU_KEYWORDS[sinQuery(href)];
}

export function descriptionFor(href: string): string | undefined {
  return MENU_DESCRIPTIONS[href];
}
