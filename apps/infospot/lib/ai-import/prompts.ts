import {
  ARTICLE_CSV_HEADERS,
  EVENT_CSV_HEADERS,
  type AiImportContext,
} from "./schemas";

export const PRIVACY_WARNING =
  "No pegues contraseñas, documentos privados, datos bancarios ni información sensible en una IA externa.";

export function getEventImportPrompt(): string {
  return `Analizá cuidadosamente el flyer, imagen o texto que te voy a proporcionar.

Necesito que extraigas únicamente información comprobable para dar de alta
un evento en Info Spot.

No inventes datos.

Si un dato no aparece o no puede deducirse con seguridad, dejalo vacío.

Devolvé solamente un CSV válido, sin explicaciones antes ni después.

Usá exactamente estos encabezados y en este mismo orden:

${EVENT_CSV_HEADERS.join(",")}

Reglas:

- Generá una sola fila de datos.
- Formato de fecha: YYYY-MM-DD.
- Formato de hora: HH:mm.
- Booleanos: true o false.
- Si un valor contiene comas, encerralo entre comillas dobles.
- No inventes nombres, precios, teléfonos, horarios ni ubicaciones.
- Si solo aparece día y mes pero no año, dejá la fecha vacía y anotá la duda en notes_for_editor.
- Si el flyer indica que buscan fotógrafos, completá requires_photographers=true.
- Si indica inscripción, convocatoria o búsqueda de participantes, completá requires_participants=true.
- Si el evento es gratuito, completá is_free=true.
- Si no hay información suficiente sobre gratuidad, dejá is_free vacío.
- En source_name indicá "Flyer", "Instagram", "Facebook", "Comunicado" o la fuente visible.
- En notes_for_editor escribí cualquier duda o dato que deba verificarse.

Ahora analizá la imagen o texto adjunto y devolvé únicamente el CSV.`;
}

export function getArticleImportPrompt(): string {
  return `Analizá cuidadosamente la imagen, flyer, comunicado o texto que te voy a proporcionar.

Necesito que generes una estructura inicial para una nota periodística de Info Spot.

No inventes hechos, resultados, declaraciones, cifras ni protagonistas.

Si un dato no puede verificarse, dejalo vacío o señalalo en notes_for_editor.

Devolvé solamente un CSV válido, sin explicaciones antes ni después.

Usá exactamente estos encabezados:

${ARTICLE_CSV_HEADERS.join(",")}

Reglas:

- Generá una sola fila.
- Fechas en formato YYYY-MM-DD.
- Si un campo contiene comas, encerralo entre comillas dobles.
- tags separados con el carácter |.
- El cuerpo debe ser una base editable, no una nota definitiva.
- No uses tono promocional excesivo.
- No afirmes resultados ni datos que no estén en la fuente.
- En fact_check_notes indicá qué información debe comprobar el redactor.
- En notes_for_editor agregá dudas o campos faltantes.
- No incluyas explicaciones fuera del CSV.

Ahora analizá la imagen o texto adjunto y devolvé únicamente el CSV.`;
}

export function getImportPrompt(context: AiImportContext): string {
  return context === "EVENT" ? getEventImportPrompt() : getArticleImportPrompt();
}

export function getCsvExample(context: AiImportContext): string {
  if (context === "EVENT") {
    return `${EVENT_CSV_HEADERS.join(",")}
"Carrera 10K Costanera","Carrera urbana en la costanera","Descripción completa del evento...","Deportes","","2026-08-15","08:00","2026-08-15","12:00","Costanera Sur","Av. Example 123","Buenos Aires","CABA","Argentina","Org Ejemplo","contacto@ejemplo.com","","https://ejemplo.com","https://ejemplo.com/inscripcion","","","","false","false","","","true","","ARS","Flyer","","Portada del flyer","Organización","","Verificar horario de largada"`;
  }
  return `${ARTICLE_CSV_HEADERS.join(",")}
"Título de la nota","Subtítulo opcional","Extracto breve","## Lead\\n\\nCuerpo en markdown...","Deportes","","Redacción Info Spot","Carrera 10K","2026-08-15","Buenos Aires","CABA","Flyer","","","","Portada","Organización","deporte|carrera","","Verificar nombres propios"`;
}
