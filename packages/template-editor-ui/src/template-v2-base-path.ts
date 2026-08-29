/**
 * Dónde vive el editor de plantillas dentro de la app que lo hospeda.
 *
 * El paquete lo tenía escrito a mano en cuatro lugares, con la ruta de
 * ComprameLaFoto. FotoOffice reusa el editor y lo monta en otro lado, así que
 * navegar después de crear una plantilla lo mandaba a una ruta inexistente: 404.
 *
 * El default es el de ComprameLaFoto para que su comportamiento no cambie.
 */
export const DEFAULT_TEMPLATE_V2_BASE_PATH = "/fotografo/diseno/plantillas/v2";

/** `{base}/{templateId}/{versionId}` */
export function templateV2EditorPath(
  basePath: string,
  templateId: string,
  versionId: string,
): string {
  return `${basePath}/${encodeURIComponent(templateId)}/${encodeURIComponent(versionId)}`;
}
