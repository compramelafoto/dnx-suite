/**
 * Las palabras que la gente usa de verdad, por ruta del menú de la redacción.
 *
 * Nadie escribe el nombre exacto del menú: escribe lo que tiene en la cabeza. "Borradores"
 * tiene que llegar a Bandeja, "fotos" a Material.
 *
 * Vive separado del menú porque va a crecer cada vez que alguien no encuentre algo, y crecer
 * acá no obliga a tocar `redaccion-ia.ts`. Una ruta que no figura igual se encuentra por su
 * título, su sección y su pista (`hint`).
 */
export const REDACCION_NAV_KEYWORDS: Partial<Record<string, string[]>> = {
  // Centro Editorial
  "/redaccion": ["inicio", "panel", "escritorio", "hoy", "mesa de trabajo", "home"],
  "/redaccion/bandeja": [
    "notas",
    "noticias",
    "borradores",
    "pendientes",
    "revision",
    "escribir",
    "historias",
    "mis notas",
  ],
  "/redaccion/coberturas": ["fotos", "albumes", "coberturas", "imagenes", "galeria", "comprame la foto"],
  "/redaccion/eventos": ["eventos", "calendario", "fechas", "convocatorias", "proximos", "agenda"],
  "/redaccion/bandeja?vista=publicadas": ["publicadas", "notas", "noticias", "online", "visibles", "en el sitio"],
  "/redaccion/distribucion": ["home", "destacados", "tapa", "principal", "orden", "portada"],
  "/redaccion/ayuda": ["ayuda", "guia", "tutorial", "como se hace", "paso a paso", "publicar"],
  "/redaccion#estadisticas": ["metricas", "numeros", "visitas", "lecturas", "actividad", "rendimiento"],

  // Dirección
  "/admin": ["direccion", "director", "administracion", "panel"],
  "/admin/aprobaciones": ["aprobar", "revisar", "pendientes", "rechazar", "autorizar", "notas en revision"],
  "/admin/usuarios": ["equipo", "periodistas", "redactores", "roles", "permisos", "invitar", "usuarios"],
  "/admin/eventos": ["eventos", "agenda", "calendario", "cargar evento"],
  "/admin/ayuda": ["ayuda", "guia", "publicar", "tutorial"],
  "/admin/configuracion": ["ajustes", "medio", "datos del medio", "preferencias", "opciones"],
};
