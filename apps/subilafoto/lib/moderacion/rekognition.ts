import "server-only";

import {
  CONFIANZA_MINIMA,
  codigoDeError,
  normalizarEtiquetas,
  type AnalisisDelProveedor,
  type ProveedorDeModeracion,
} from "./proveedor";

/**
 * Moderación con Amazon Rekognition (`DetectModerationLabels`).
 *
 * Es la única pieza del sistema que sabe que existe Amazon. Todo lo demás
 * habla con `ProveedorDeModeracion`.
 *
 * Las credenciales son de un usuario IAM propio, `subilafoto-moderacion`, con
 * permiso para **una sola operación**. Si esa clave se filtra, lo peor que
 * puede hacer quien la tenga es gastar dinero analizando imágenes.
 *
 * La imagen se manda por bytes y no por referencia a S3 porque el bucket es de
 * Cloudflare R2, no de AWS: Rekognition no puede ir a buscarla sola.
 */
export function rekognition(): ProveedorDeModeracion {
  return {
    nombre: "aws-rekognition",

    async analizar(imagen: Uint8Array): Promise<AnalisisDelProveedor> {
      const arranque = Date.now();
      try {
        // Import diferido: así el cliente de AWS no entra en el paquete de las
        // rutas que no moderan nada, que son casi todas.
        const { RekognitionClient, DetectModerationLabelsCommand } = await import(
          "@aws-sdk/client-rekognition"
        );

        const cliente = new RekognitionClient({ region: process.env.AWS_REGION });
        const respuesta = await cliente.send(
          new DetectModerationLabelsCommand({
            Image: { Bytes: imagen },
            MinConfidence: CONFIANZA_MINIMA,
          }),
        );

        return {
          ok: true,
          etiquetas: normalizarEtiquetas(respuesta.ModerationLabels),
          modelo: respuesta.ModerationModelVersion ?? null,
          latenciaMs: Date.now() - arranque,
        };
      } catch (error) {
        // No se relanza a propósito: quien llama tiene que poder registrar el
        // fallo y retener la foto, no quedarse sin decisión.
        return {
          ok: false,
          codigoDeError: codigoDeError(error),
          latenciaMs: Date.now() - arranque,
        };
      }
    },
  };
}
