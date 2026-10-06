/**
 * Las palabras que la gente usa de verdad, por ruta del menú.
 *
 * Nadie escribe "Asignaciones": escribe "repartir fotos" o "qué jurado ve qué". Sin esto el
 * buscador sólo encuentra a quien ya sabe cómo se llama cada cosa, que es justo quien no lo
 * necesita.
 *
 * Vive separado del menú porque va a crecer cada vez que alguien no encuentre algo, y crecer
 * acá no obliga a tocar la navegación. Una ruta que no figura igual se encuentra por su
 * título, su sección y su descripción.
 */
export const MENU_KEYWORDS: Record<string, string[]> = {
  // Fotógrafo
  "/mi-actividad": ["inicio", "panel", "resumen", "home", "mi cuenta", "novedades"],
  "/participaciones": ["mis fotos", "fotos", "inscripciones", "inscripcion", "obras", "envios", "resultados", "pagos"],
  "/": ["concursos abiertos", "participar", "inscribirme", "convocatorias", "salones", "buscar concurso", "sitio"],
  "/onboarding": ["crear concurso", "nuevo concurso", "organizar", "empezar", "registrar organizacion"],

  // Jurado
  "/jurado/panel": ["calificar", "votar", "puntaje", "notas", "puntuar", "evaluar", "juzgar", "fotos para calificar"],
  "/jurado/invitaciones": ["invitacion", "aceptar", "rechazar", "convocatoria", "me invitaron"],
  "/jurado/perfil": ["mi perfil", "biografia", "curriculum", "cv", "foto de perfil", "datos", "cobro"],

  // Concursos
  "/dashboard": ["inicio", "panel", "tablero", "resumen", "estadisticas", "home"],
  "/concursos": ["crear concurso", "nuevo concurso", "salones", "inscripcion", "bases", "fechas", "editar concurso", "fotos recibidas"],
  "/categorias": ["temas", "secciones", "rubros", "color", "monocromo", "libre"],

  // Jurados
  "/jurados/directorio": ["buscar jurado", "directorio", "bolsa de jurados", "contratar", "encontrar jurado"],
  "/jurados/directorio/invitaciones": ["invitar", "invitaciones enviadas", "pendientes", "aceptaron", "rechazaron"],
  "/jurados": ["mis jurados", "lista de jurados", "jueces", "panel de jurados", "invitar por correo", "historial"],
  "/jurados/asignaciones": ["asignar", "repartir", "distribuir fotos", "que jurado ve que", "categorias por jurado"],

  // Resultados
  "/ranking": ["resultados", "puntajes", "notas", "ganadores", "premios", "posiciones", "tabla", "publicar resultados"],
  "/diplomas": ["certificados", "premios", "menciones", "descargar diploma", "imprimir"],

  // Organización
  "/dashboard/settings": ["configuracion", "ajustes", "logo", "datos", "nombre", "mercado pago", "pagos", "cobros"],

  // Plataforma (super admin)
  "/super-admin": ["panorama", "admin", "estadisticas", "tablero", "resumen general"],
  "/super-admin#organizaciones": ["clubes", "fotoclubes", "instituciones", "organizadores"],
  "/super-admin#concursos": ["todos los concursos", "salones", "concursos de todos"],
  "/super-admin#usuarios": ["cuentas", "personas", "fotografos", "gente", "buscar usuario"],
  "/super-admin/jurados": ["revisar fichas", "aprobar jurados", "cola", "pendientes", "validar jurado"],
  "/super-admin/clickaton": ["clickaton", "sincronizar", "conexion", "integracion", "maraton"],
  "/super-admin#logs": ["logs", "registro", "historial", "auditoria", "quien hizo que", "actividad"],
};
