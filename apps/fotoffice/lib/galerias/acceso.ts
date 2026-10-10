import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de Galería (etapa 7) sobre el adaptador de main, igual que `lib/proyectos/acceso.ts`.
 * Ver = leer; Gestionar = crear, subir, ordenar, publicar. Sin base ni sesión.
 */
export const GALLERY_MODULE_KEY = "gallery";

export type CtxGalerias = CtxConsultas;

export function puedeVerGalerias(ctx: CtxGalerias): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", GALLERY_MODULE_KEY);
}

export function puedeGestionarGalerias(ctx: CtxGalerias): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", GALLERY_MODULE_KEY);
}

export function puedeConfigurarGalerias(ctx: CtxGalerias): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "configurar");
}

export const MENSAJES_GALERIA = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  noExiste: "No encontramos esa galería.",
  fotoNoExiste: "No encontramos esa foto.",
  archivada: "La galería está archivada: no se le agregan fotos.",
  topeFotos: "La galería ya tiene el máximo de 3.000 fotos.",
  tipo: "Sólo se pueden subir fotos JPG o PNG.",
  tamano: "Cada foto puede pesar hasta 50 MB.",
  nombre: "El archivo tiene que tener nombre.",
  preparar: "No pudimos preparar la subida. Probá de nuevo.",
  subidaIncompleta: "La subida no se completó. Probá de nuevo.",
  verificar: "No pudimos verificar la subida. Probá de nuevo.",
  guardar: "No se pudo guardar el cambio.",
  portada: "Elegí una foto lista de esta galería.",
  orden: "El orden indicado no es válido.",
  // Galería
  proyecto: "No encontramos ese proyecto.",
  buscarProyectos: "Para buscar proyectos necesitás permiso para ver Proyectos.",
  nombreGaleria: "El nombre tiene que tener entre 1 y 120 caracteres.",
  mensajeGaleria: "El mensaje puede tener hasta 2.000 caracteres.",
  modoSeleccion: "Elegí si la selección es libre o por cantidad.",
  modoDescarga: "Elegí cómo se descargan las fotos.",
  modoOrden: "Elegí cómo se ordenan las fotos.",
  comentarios: "Indicá si el cliente puede comentar.",
  sinFotosListas: "Subí al menos una foto antes de publicar la galería.",
  yaPublicada: "La galería ya está publicada.",
  yaArchivada: "La galería ya está archivada.",
  noEstaArchivada: "La galería no está archivada.",
  carrera: "Otra persona cambió esta galería al mismo tiempo. Recargá la página y probá de nuevo.",
  // Clientes de la galería
  clienteNoExiste: "No encontramos a ese cliente de la galería.",
  contacto: "No encontramos ese contacto.",
  contactoRepetido: "Ese contacto ya está en la galería.",
  topeClientes: "La galería ya tiene el máximo de 30 clientes.",
  nombreCliente: "Escribí el nombre del cliente (hasta 120 caracteres).",
  correoInvalido: "El correo no es válido.",
  telefonoInvalido: "El teléfono no es válido.",
  sinDatosDeContacto: "Cargá un correo o un teléfono para poder avisarle.",
  buscarClientes: "Para buscar contactos necesitás permiso para ver Clientes.",
  publicarPrimero: "La galería es un borrador: publicala para poder compartir los enlaces.",
  galeriaArchivada: "La galería está archivada: reactivala para compartir los enlaces.",
  clienteAnulado: "El enlace de este cliente está anulado. Generá uno nuevo para compartirlo.",
  sinCorreo: "Este cliente no tiene correo. Cargalo o mandale el enlace por WhatsApp.",
  sinTelefono: "Este cliente no tiene un teléfono que sirva para WhatsApp. Hace falta el código de país, por ejemplo +54 9 341 555 0000.",
  sinSitio: "No se pudo armar el enlace: revisá el sitio de la organización (Configuración).",
  sinClaveEnlace: "El envío de enlaces no está configurado. Avisale a quien administra FOTOFFICE.",
  envioEnCurso: "Estamos mandando el correo. El resultado queda en el Historial de la galería.",
  // Ajustes
  ajustesInvalidos: "Revisá los valores por omisión: no son válidos.",
} as const;
