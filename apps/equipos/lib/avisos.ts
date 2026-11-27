import { MAX_PHOTOS_PER_ITEM } from "@/lib/archivos";
import {
  MENSAJE_AVISO_RESPONDIDO,
  MENSAJE_MAXIMO_PEDIDOS,
  MENSAJE_MUCHOS_CANCELADOS,
  MENSAJE_PEDIDO_NO_ACTIVO,
  MENSAJE_PEDIDO_NO_RENOVABLE,
  MENSAJE_PEDIDO_SIN_IDENTIDAD,
} from "@/lib/busco/pedidos";
import { EquipoError, MENSAJE_IDENTIDAD_CON_PUBLICACION } from "@/lib/inventario/equipos";
import { MENSAJE_CUENTA_SUSPENDIDA, MENSAJE_MOTIVO } from "@/lib/usuarios/bloqueo";
import { MENSAJE_REPORTE_PROPIO, MENSAJE_REPORTE_SIN_RELACION } from "@/lib/usuarios/reportes";
import { VentaError } from "@/lib/ventas/ventas";

/**
 * Avisos que vuelven en la URL (`?ok=` / `?error=`) después de una acción. Por la URL viaja sólo
 * un CÓDIGO; la página lo traduce con un mapa fijo. Nunca se muestra el valor de la URL: cualquiera
 * puede armar un enlace con un texto inventado («Pagá la seña a este CBU…»). Un código desconocido
 * no muestra nada.
 */

export type MapaAvisos = Readonly<Record<string, string>>;

/** Texto fijo del aviso para un código del mapa; cualquier otro valor (o ninguno) da `null`. */
export function avisoDeCodigo(
  mapa: MapaAvisos,
  codigo: string | string[] | undefined | null,
): string | null {
  const c = Array.isArray(codigo) ? codigo[0] : codigo;
  if (!c || !Object.prototype.hasOwnProperty.call(mapa, c)) return null;
  return mapa[c];
}

/** Lo único que el vendedor ve de una revisión: nunca el motivo. */
export const TEXTO_EN_REVISION =
  "Tu publicación está en revisión. Te avisamos por correo cuando esté publicada.";

/** Avisos de éxito de las acciones de inventario, publicaciones, informe y cuenta. */
export const AVISOS_OK = {
  SUGERENCIA_CONFIRMADA: "Equipo agregado a tu inventario.",
  SUGERENCIA_DESCARTADA: "Listo, no te lo volvemos a sugerir.",
  EQUIPO_AGREGADO: "Equipo agregado.",
  CAMBIOS_GUARDADOS: "Cambios guardados.",
  FOTO_AGREGADA: "Foto agregada.",
  COMPROBANTE_GUARDADO: "Comprobante guardado.",
  DENUNCIA_RECIBIDA: "Recibimos tu denuncia. La vamos a revisar.",
  RECUPERADO: "Listo, marcamos el equipo como recuperado.",
  PUBLICADO: "Tu equipo ya está publicado.",
  EN_REVISION: TEXTO_EN_REVISION,
  PAUSADA: "Publicación pausada. Nadie la ve hasta que la reanudes.",
  REANUDADA: "Publicación reanudada.",
  CERRADA: "Publicación cerrada.",
  INFORME_GENERADO: "Informe generado. Ya podés descargar el PDF.",
  POLIZA_GUARDADA: "Fecha de renovación guardada.",
  POLIZA_QUITADA: "Quitamos la fecha de renovación.",
  VENTA_MARCADA:
    "Listo. Le avisamos al comprador: tiene 7 días para confirmar la compra desde su cuenta.",
  COMPRA_CONFIRMADA: "Confirmaste la compra. El equipo ya figura en «Mi equipo», con su historial.",
  COMPRA_RECHAZADA: "Listo. Le avisamos al vendedor que no compraste el equipo.",
  CALIFICACION_GUARDADA: "Gracias por calificar. Tu opinión ayuda a que todos compren y vendan tranquilos.",
  FAVORITO_GUARDADO: "Listo, la guardaste en tus favoritos.",
  FAVORITO_QUITADO: "La quitaste de tus favoritos.",
  ALERTA_CREADA: "Alerta creada. Te avisamos por correo cuando se publique un equipo así.",
  ALERTA_BORRADA: "Alerta borrada. Ya no te avisamos por esa búsqueda.",
  PEDIDO_CREADO:
    "Pedido guardado. Si alguien tiene ese equipo, le avisamos; cuando lo publique, te mandamos el enlace por correo.",
  PEDIDO_RENOVADO: "Pedido renovado por 30 días más.",
  PEDIDO_CANCELADO: "Pedido cancelado.",
  AVISO_RECHAZADO: "Listo, no le vamos a decir nada al comprador.",
  AVISO_YA_PUBLICADO: "Listo. Tu equipo ya está publicado: le mandamos el enlace al comprador.",
  PREFERENCIAS_GUARDADAS: "Preferencias guardadas.",
  REPORTE_USUARIO_ENVIADO:
    "Recibimos tu reporte. Lo revisamos y, si hace falta, tomamos medidas. La otra persona no se entera de que la reportaste.",
} as const satisfies MapaAvisos;

export type CodigoOk = keyof typeof AVISOS_OK;

/**
 * Avisos de error. Los textos son los mismos mensajes fijos que tira la librería
 * (`EquipoError`): `codigoDeError` busca el código del mensaje. Los mensajes que llevan datos
 * (por ejemplo el nombre del equipo) caen en el texto general de su `code`.
 */
export const AVISOS_ERROR = {
  // Generales, por `EquipoError.code`.
  NO_ENCONTRADO: "No encontramos lo que buscabas.",
  DATO_INVALIDO: "Revisá los datos e intentá de nuevo.",
  ARCHIVO_INVALIDO: "Ese archivo no sirve. Usá JPG, PNG o WEBP (o PDF para comprobantes), de hasta 4 MB.",
  LIMITE_FOTOS: `Cada equipo admite hasta ${MAX_PHOTOS_PER_ITEM} fotos.`,
  FALTA_COMPROBANTE: "Para denunciar un robo hace falta el comprobante de compra.",
  YA_DENUNCIADO: "Este equipo ya tiene una denuncia.",
  NO_DENUNCIABLE: "Este equipo figura como vendido.",
  EN_DENUNCIA:
    "Este equipo tiene una denuncia: no se pueden cambiar su estado, serie, tipo, marca ni modelo. Si lo recuperaste, usá «Lo recuperé».",
  FALTA_VALOR: "Cargá el valor en pesos y en dólares de cada equipo para incluirlo en el informe.",
  NO_ASEGURABLE: "Un equipo robado, perdido o vendido no se puede incluir en el informe.",
  CON_PUBLICACION: "Este equipo tiene una publicación activa; pausala o cerrala primero.",
  ERROR: "No pudimos completar la operación. Probá de nuevo.",

  // «No encontrado» según la pantalla.
  NO_ENCONTRADO_EQUIPO: "No encontramos ese equipo.",
  NO_ENCONTRADA_PUBLICACION: "No encontramos esa publicación.",
  NO_ENCONTRADOS_EQUIPOS: "No encontramos alguno de esos equipos.",

  // Inventario.
  CON_PUBLICACION_IDENTIDAD: MENSAJE_IDENTIDAD_CON_PUBLICACION,
  VALOR_PESOS: "Valor en pesos: usá un número entero, sin decimales.",
  VALOR_DOLARES: "Valor en dólares: usá un número entero, sin decimales.",
  FALTA_MARCA: "La marca no puede quedar vacía.",
  FALTA_MODELO: "El modelo no puede quedar vacío.",
  ESTADO_NO_MANUAL: "Ese estado no se puede elegir a mano.",
  FORMATO_COMPROBANTE: "Formato no permitido. Usá JPG, PNG, WEBP o PDF.",
  FORMATO_FOTO: "Formato no permitido. Usá JPG, PNG o WEBP.",
  ARCHIVO_PESADO: "El archivo pesa más de 4 MB.",
  ARCHIVO_VACIO: "El archivo está vacío.",
  ELEGI_ARCHIVO: "Elegí un archivo.",
  ELEGI_TIPO: "Elegí el tipo de equipo.",

  // Denuncias.
  FALTA_FECHA_HECHO: "Indicá la fecha del hecho.",
  FECHA_FUTURA: "La fecha del hecho no puede ser futura.",
  NO_RECUPERABLE: "Sólo se puede marcar como recuperado un equipo robado o perdido.",
  ELEGI_INCIDENTE: "Elegí si fue un robo o una pérdida.",

  // Informe para el seguro.
  ELEGI_EQUIPOS: "Elegí al menos un equipo.",
  SIN_IDENTIDAD: "Necesitás tener la identidad verificada.",
  FECHA_INVALIDA: "Esa fecha no es válida.",

  // Publicaciones.
  NO_MODIFICABLE: "Esta publicación ya no se puede modificar.",
  NO_PUBLICABLE: "Este equipo no se puede publicar en su estado actual.",
  YA_PUBLICADO: "Este equipo ya tiene una publicación.",
  FALTA_FOTO: "Subí al menos una foto del equipo.",
  FALTA_SERIE: "Para cámaras y lentes el número de serie es obligatorio.",
  FALTA_FOTO_SERIE: "Subí una foto del número de serie grabado en el equipo.",
  PRECIO: "El precio tiene que ser un número entero de pesos, mayor a cero.",
  PRECIO_USD: "El valor de referencia en dólares tiene que ser un número entero.",
  PROVINCIA: "Elegí una provincia de la lista.",
  CIUDAD: "Indicá la ciudad.",
  MONTURA: "Elegí una montura de la lista.",
  CONSENTIMIENTO:
    "Para publicar tenés que aceptar que el artículo pueda salir en las redes del portal.",
  DESCRIPCION_LARGA: "La descripción no puede superar los 2000 caracteres.",
  ACCESORIOS_LARGOS: "Los accesorios no pueden superar los 500 caracteres.",
  BATERIAS: "La cantidad de baterías tiene que ser un número entero de 0 a 10.",
  ELEGI_ESTADO: "Elegí el estado del equipo.",

  // Ventas y calificaciones (los textos de `VentaError` y de `rateSale`).
  NO_ENCONTRADA_VENTA: "No encontramos esa venta.",
  NO_CONSULTO: "Esa persona no consultó por esta publicación.",
  YA_VENDIDA: "Esta publicación ya está marcada como vendida.",
  NO_PENDIENTE: "Esta venta ya no está pendiente de confirmación.",
  VENCIDA: "El plazo para confirmar esta compra venció.",
  ELEGI_COMPRADOR: "Elegí a quién le vendiste el equipo.",
  PRECIO_VENTA: "El precio tiene que ser un número entero mayor a cero.",
  ELEGI_ESTRELLAS: "La calificación va de 1 a 5 estrellas.",
  COMENTARIO_LARGO: "El comentario puede tener hasta 300 caracteres.",
  YA_CALIFICASTE: "Ya calificaste esta operación.",
  PLAZO_CALIFICAR: "El plazo para calificar esta operación venció.",
  CALIFICAR_SIN_CONFIRMAR: "Sólo se puede calificar una compra confirmada.",

  // Favoritos y alertas (los textos de `toggleFavorite` y `createAlert`).
  FAVORITO_PROPIO: "No podés guardar tu propia publicación.",
  ALERTA_SIN_FILTROS: "Elegí al menos un filtro para crear la alerta.",
  MAXIMO_ALERTAS: "Llegaste al máximo de 10 alertas activas.",
  NO_ENCONTRADA_ALERTA: "No encontramos esa alerta.",

  // «Busco» (los textos de `pedidos.ts`).
  NO_ENCONTRADO_PEDIDO: "No encontramos ese pedido.",
  NO_ENCONTRADO_AVISO: "No encontramos ese aviso.",
  PEDIDO_SIN_IDENTIDAD: MENSAJE_PEDIDO_SIN_IDENTIDAD,
  MAXIMO_PEDIDOS: MENSAJE_MAXIMO_PEDIDOS,
  MUCHOS_CANCELADOS: MENSAJE_MUCHOS_CANCELADOS,
  PEDIDO_NO_RENOVABLE: MENSAJE_PEDIDO_NO_RENOVABLE,
  PEDIDO_NO_ACTIVO: MENSAJE_PEDIDO_NO_ACTIVO,
  AVISO_RESPONDIDO: MENSAJE_AVISO_RESPONDIDO,
  MARCA_MODELO_LARGOS: "La marca o el modelo son demasiado largos.",
  PRECIO_MAXIMO: "El precio máximo tiene que ser un número entero de pesos, mayor a cero.",
  ELEGI_RESPUESTA: "Elegí una respuesta.",

  // Cuenta bloqueada y reportes de usuario (los textos de `bloqueo.ts` y `reportes.ts`).
  CUENTA_SUSPENDIDA: MENSAJE_CUENTA_SUSPENDIDA,
  MOTIVO_REPORTE: MENSAJE_MOTIVO,
  REPORTE_PROPIO: MENSAJE_REPORTE_PROPIO,
  REPORTE_SIN_RELACION: MENSAJE_REPORTE_SIN_RELACION,

  // Cuenta.
  TELEFONO_INVALIDO:
    "Ingresá un celular argentino válido, con código de área (por ejemplo 341 555-1234).",
} as const satisfies MapaAvisos;

export type CodigoError = keyof typeof AVISOS_ERROR;

const POR_TEXTO = new Map<string, CodigoError>(
  (Object.entries(AVISOS_ERROR) as [CodigoError, string][]).map(([k, v]) => [v, k]),
);

/** Código de un mensaje fijo conocido; `null` si el texto no está en el mapa. */
export function codigoDeMensaje(mensaje: string): CodigoError | null {
  return POR_TEXTO.get(mensaje) ?? null;
}

/**
 * Código para `?error=`: el del mensaje fijo de la librería si está en el mapa; si no, el de su
 * `code`; un error inesperado se registra y queda como «ERROR».
 */
export function codigoDeError(
  err: unknown,
  opciones: { noEncontrado?: CodigoError; origen?: string } = {},
): CodigoError {
  if (err instanceof EquipoError) {
    if (err.code === "NO_ENCONTRADO") return opciones.noEncontrado ?? "NO_ENCONTRADO";
    const porTexto = codigoDeMensaje(err.message);
    if (porTexto) return porTexto;
    if (Object.prototype.hasOwnProperty.call(AVISOS_ERROR, err.code)) return err.code as CodigoError;
    return "DATO_INVALIDO";
  }
  if (err instanceof VentaError) {
    return err.code === "NO_ENCONTRADA" ? (opciones.noEncontrado ?? "NO_ENCONTRADA_VENTA") : err.code;
  }
  console.error(`[${opciones.origen ?? "acciones"}] Error inesperado:`, err);
  return "ERROR";
}
