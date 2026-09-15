/**
 * Dónde vive el editor de plantillas dentro de la app que lo hospeda.
 *
 * Cada app lo monta en otro lado, así que **quien lo use tiene que declararlo**. Antes había
 * un valor por defecto —la ruta de ComprameLaFoto— y eso convertía el olvido en una trampa
 * silenciosa: la plantilla se creaba bien y la navegación posterior terminaba en un 404 con la
 * ruta de otra app. Le pasó a FotoOffice, se le puso su ruta, y el default quedó armado para
 * la siguiente. Le volvió a pasar a Clickatón.
 *
 * Sin valor por defecto, el que falta lo caza el chequeo de tipos y no el usuario.
 */
export const TEMPLATE_V2_BASE_PATHS = {
  compramelafoto: "/fotografo/diseno/plantillas/v2",
  fotoffice: "/members/disenador",
  clickaton: "/admin/plantillas",
} as const;

/** `{base}/{templateId}/{versionId}` */
export function templateV2EditorPath(
  basePath: string,
  templateId: string,
  versionId: string,
): string {
  return `${basePath}/${encodeURIComponent(templateId)}/${encodeURIComponent(versionId)}`;
}
