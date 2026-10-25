import { adminRoutes } from "@/config/admin/navigation";

/**
 * Las palabras que la gente usa de verdad, por ruta del menú del panel.
 *
 * Nadie escribe el nombre exacto del menú: escribe lo que tiene en la cabeza. "Plata" tiene
 * que llegar a Números por edición, "anotados" a Inscripciones.
 *
 * Vive separado de `navigation.ts` porque va a crecer cada vez que alguien no encuentre algo,
 * y crecer acá no obliga a tocar el menú. Una ruta que no figura igual se encuentra por su
 * título, su sección y su descripción.
 */
export const ADMIN_NAV_KEYWORDS: Partial<Record<string, string[]>> = {
  // Operación
  [adminRoutes.dashboard]: ["panel", "principal", "tablero", "resumen", "home", "portada"],
  [adminRoutes.editions]: [
    "maraton",
    "fecha",
    "consignas",
    "temas",
    "jurados",
    "placas",
    "cronograma",
    "concurso",
    "evento",
  ],
  [adminRoutes.templates]: ["diseño", "placas", "diplomas", "editor", "piezas", "graficas"],
  [adminRoutes.homeBanners]: ["portada", "carrusel", "imagenes", "destacados", "slider"],
  [adminRoutes.venues]: ["lugares", "locales", "ciudades", "acreditacion", "puntos"],
  [adminRoutes.catalog]: ["remeras", "kit", "merchandising", "tienda", "envio", "talles"],
  [adminRoutes.registrations]: [
    "participantes",
    "anotados",
    "inscriptos",
    "pagos",
    "reservas",
    "efectivo",
    "acreditados",
    "fotos subidas",
  ],
  [adminRoutes.people]: ["participantes", "usuarios", "fotografos", "ficha", "contactos", "gente"],
  [adminRoutes.promotions]: ["cupones", "descuentos", "regalo", "bonificacion", "codigo"],
  [adminRoutes.affiliates]: ["afiliados", "embajadores", "codigo propio", "comision"],
  [adminRoutes.commissions]: ["pagar", "transferencias", "liquidar", "afiliados", "plata"],
  [adminRoutes.social]: ["redes", "instagram", "posteos", "publicar", "avisos", "difusion"],
  [adminRoutes.sponsors]: ["auspiciantes", "marcas", "logos", "aliados", "premios", "beneficios"],
  [adminRoutes.sponsorsInventory]: ["espacios", "publicidad", "disponibles", "ocupados", "auspicios"],
  [adminRoutes.sponsorsSellers]: ["vendedores", "comerciales", "ventas", "permisos"],
  [adminRoutes.contents]: ["blog", "notas", "articulos", "noticias", "publicar"],
  [adminRoutes.editionResults]: [
    "finanzas",
    "plata",
    "ingresos",
    "costos",
    "ganancia",
    "balance",
    "mercado pago",
    "recaudacion",
  ],
  [adminRoutes.messages]: ["consultas", "contacto", "correo", "mails", "bandeja", "forma parte"],
  [adminRoutes.testimonials]: ["encuesta", "opiniones", "reseñas", "satisfaccion", "comentarios"],
  [adminRoutes.clickatoner]: ["destacado", "semana", "redes", "participante destacado"],
  [adminRoutes.referrals]: ["referidos", "invitaciones", "amigos", "link", "recomendados"],

  // Sistema
  [adminRoutes.settings]: ["ajustes", "preferencias", "datos generales", "opciones"],
  [adminRoutes.financePartner]: ["mercado pago", "cobrar", "cuenta", "plata", "conectar", "split"],
  [adminRoutes.integrations]: ["mercado pago", "resend", "correo", "conexiones", "variables", "servicios"],
};
