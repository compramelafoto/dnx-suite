/**
 * Las palabras que la gente usa de verdad, por ruta del menú.
 *
 * Es lo que separa un buscador que sirve de uno decorativo: nadie escribe el nombre del menú,
 * escribe la palabra que tiene en la cabeza. "Plata" tiene que llegar a Cobros.
 *
 * Vive separado del menú porque va a crecer cada vez que alguien no encuentre algo, y crecer
 * acá no obliga a tocar la navegación. Una ruta que no figura igual se encuentra por su
 * título, su sección y su descripción.
 */
export const NAV_KEYWORDS: Record<string, string[]> = {
  // Inicio
  "/workspace": ["panel", "principal", "tablero", "resumen", "home", "portada"],

  // Socios
  "/members": ["usuarios", "gente", "padron", "altas", "asociados", "afiliados", "listado", "buscar socio"],
  "/members/solicitudes": ["pedidos", "asociarse", "pendientes", "aprobar", "nuevos socios", "inscripcion"],
  "/members/cuotas": ["pagos", "deuda", "morosos", "vencimiento", "plata", "cobranza", "pagaron", "deben"],
  "/members/carnets": ["credencial", "tarjeta", "identificacion", "imprimir"],
  "/members/disenador": ["diseño", "plantilla", "placas", "editor"],
  "/members/categories": ["profesional", "estudiante", "honorario", "tipos de socio"],
  "/members/cuotas/configuracion": ["valor", "precio", "monto", "vencimiento", "calendario", "aumento"],

  // Sorteos
  "/sorteos": ["premios", "rifa", "ganadores", "concurso", "aliados", "marcas"],
  "/sorteos/entregas": ["premios", "ganadores", "entregar", "retirar"],

  // Comisión
  "/gobierno": ["comision directiva", "proyectos", "etapas", "gestion"],
  "/gobierno/tareas": ["pendientes", "delegar", "vencidas", "responsables"],
  "/gobierno/reuniones": ["acta", "temario", "asamblea", "orden del dia"],
  "/gobierno/tipos": ["plantillas", "modelos de proyecto"],

  // Comunicación
  "/comunicacion/placas": ["bienvenida", "redes", "instagram", "publicar", "nuevo socio"],
  "/comunicacion/placas/socio-de-la-semana": ["destacado", "viernes", "redes", "instagram"],
  "/comunicacion/campanas": ["mail", "email", "newsletter", "correo masivo", "difusion", "envio"],
  "/comunicacion/fechas": ["cumpleaños", "aniversario", "saludos", "feriados", "efemerides"],
  "/comunicacion/correo": ["mail", "email", "avisos", "notificaciones", "envios"],
  "/comunicacion/plantillas": ["diseño", "placas", "plantilla"],

  // Coberturas
  "/coberturas": ["eventos", "pedidos", "convocatorias", "fotografos"],
  "/coberturas/colaboradores": ["fotografos", "voluntarios", "habilitados"],

  // Cursos
  "/dashboard/courses": ["capacitacion", "talleres", "clases", "ediciones", "workshop"],
  "/dashboard/mercado-de-cursos": ["reventa", "revender", "otros cursos", "acuerdos"],
  "/dashboard/cobros-de-cursos": ["plata", "comision", "liquidacion", "ganancias"],
  "/dashboard/sales": ["cobros", "facturacion", "vendido"],
  "/courses/teachers": ["profesores", "instructores", "dictan"],
  "/courses/leads": ["alumnos", "anotados", "interesados", "inscriptos"],
  "/evaluaciones": ["notas", "calificaciones", "examenes", "trabajos practicos"],
  "/courses/settings": ["ajustes", "moneda", "comision"],

  // Reservas
  "/reservas": ["turnos", "ocupacion", "semana", "calendario", "alquiler", "reservar"],
  "/reservas/espacios": ["alquiler", "salon", "sala", "estudio", "aula"],
  "/reservas/extras": ["equipamiento", "equipos", "accesorios", "luces"],
  "/reservas/configuracion": ["feriado", "cancelacion", "tarifas", "plazos", "precios"],

  // Agenda
  "/agenda": ["calendario", "citas", "reunion", "sesion", "evento", "turno", "semana", "mes", "recordatorio", "cumpleanos", "vencimientos"],

  // Consultas (antes Captación)
  "/dashboard/service-leads/forms": ["presupuesto", "contacto", "formulario"],
  "/consultas": ["captacion", "bandeja", "tablero", "contactos", "interesados", "consultas", "presupuestos"],
  "/presupuestos": ["cotizacion", "cotizar", "precio", "cuanto cobro", "propuesta", "vencidos"],
  "/pedidos": ["pedido", "cobro", "cobrar", "cuotas", "recibo", "saldo", "seña", "sena"],
  "/proyectos": ["proyecto", "trabajo", "entrega", "entregas", "tablero", "etapas", "tareas", "equipo", "atraso", "suspendido"],

  // Presencia pública
  "/website": ["web", "pagina", "sitio", "portal", "home publica", "constructor", "menu"],
  "/website/blog": ["articulos", "notas", "noticias", "publicar", "novedades"],
  "/website/dominio": ["dominio propio", "url", "direccion web", "dns"],

  // Institución
  "/workspace/configuracion": ["ajustes", "logo", "domicilio", "datos", "nombre", "configuracion"],
  "/workspace/configuracion/comision": ["autoridades", "presidente", "tesorero", "secretario", "roles", "permisos"],
  "/workspace/configuracion/integraciones": ["conexiones", "servicios", "google", "whatsapp", "calendario", "contactos"],
  "/workspace/configuracion/cobros": ["plata", "dinero", "facturacion", "mercado pago", "mp", "cobrar", "cuenta bancaria"],

  // Plataforma
  "/admin": ["plataforma", "administracion"],
  "/admin/workspaces": ["instituciones", "organizaciones", "clubes"],
  "/admin/users": ["cuentas", "personas"],
  "/admin/owners": ["propietarios", "titulares", "duenos"],

  // Portal del socio
  "/portal": ["inicio", "panel", "resumen"],
  "/portal/carnet": ["credencial", "tarjeta", "qr"],
  "/portal/cuotas": ["pagar", "pagos", "deuda", "debo", "mercado pago", "plata"],
  "/portal/perfil": ["mis datos", "datos personales", "foto", "contraseña", "telefono", "direccion"],
  "/portal/portfolio": ["mis fotos", "galeria", "trabajos"],
  "/portal/beneficios": ["descuentos", "aliados", "promociones", "convenios"],
  "/portal/reservas": ["turno", "alquilar", "salon", "estudio", "reservar"],
  "/portal/coberturas": ["eventos", "convocatorias", "anotarme"],
  "/portal/sorteos": ["premios", "rifa", "participar"],
  "/portal/cursos": ["talleres", "clases", "inscribirme", "capacitacion"],
  "/portal/proyectos": ["comision", "gestion"],
  "/portal/tareas": ["pendientes", "asignadas"],
  "/portal/recomendados": ["proveedores", "aliados", "laboratorios", "comercios"],
};
