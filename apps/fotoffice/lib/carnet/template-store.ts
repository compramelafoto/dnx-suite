import "server-only";
import { CARNET_TEMPLATE_KEY, carnetDesignDocument } from "./template";
import {
  createKeyedTemplate,
  loadKeyedTemplate,
  type CreateKeyedTemplateResult,
  type LoadedTemplate,
} from "@/lib/template-v2/keyed-template";

/**
 * La plantilla del carnet, guardada en el módulo de diseño.
 *
 * Hasta ahora el diseño vivía en código y no había forma de editarlo. Acá se lo copia a una
 * plantilla real que la institución puede abrir en el editor y modificar.
 *
 * La creación es **explícita**: nunca ocurre por visitar una ruta. Es el mismo criterio que
 * gobierna el resto de FotoOffice — visitar una pantalla no debe crear datos.
 *
 * Se busca por su marca (`templateKey`) y no por ser "la última editada": así la buscaba antes,
 * y en cuanto la institución tuvo una segunda plantilla —una placa—, editar esa otra devolvía
 * el carnet al diseño de fábrica sin aviso. Ver `lib/template-v2/keyed-template.ts`.
 */

const CARNET_NAME = "Carnet de socio";

export type CarnetTemplate = LoadedTemplate;

/**
 * Busca la plantilla del carnet de una institución.
 *
 * Devuelve `null` si todavía no la creó: quien llama decide si usar el diseño de fábrica o
 * pedirle a alguien que la cree.
 */
export async function findCarnetTemplate(workspaceId: string): Promise<CarnetTemplate | null> {
  return loadKeyedTemplate({
    workspaceId,
    templateKey: CARNET_TEMPLATE_KEY,
    documentName: CARNET_NAME,
    fallbackCanvas: { width: 1011, height: 638 },
  });
}

export type CreateCarnetResult = CreateKeyedTemplateResult;

/**
 * Copia el diseño de fábrica a una plantilla editable de la institución.
 *
 * Idempotente: si ya existe, la devuelve sin tocarla. Volver a crearla borraría el trabajo de
 * quien la haya editado.
 */
export async function createCarnetTemplate(input: {
  workspaceId: string;
  userId: number;
}): Promise<CreateCarnetResult> {
  return createKeyedTemplate({
    workspaceId: input.workspaceId,
    userId: input.userId,
    templateKey: CARNET_TEMPLATE_KEY,
    name: CARNET_NAME,
    description: "El diseño de la credencial de socio, frente y dorso.",
    document: carnetDesignDocument(),
  });
}
