/**
 * Prompt sugerido para convertir un listado escolar (p. ej. pegado desde Excel) al CSV
 * esperado por ComprameLaFoto. Copiado tal cual para el botón «Copiar prompt» en las UIs de importación.
 */
export const ROSTER_CHATGPT_CSV_CONVERSION_PROMPT = `Te voy a pasar un listado escolar copiado desde Excel.

Necesito que lo conviertas al formato CSV separado por comas compatible con ComprameLaFoto.

IMPORTANTE:
- Mantener una fila por alumno.
- No agregar explicaciones.
- No agregar texto extra.
- Entregar solamente el CSV listo para pegar.
- Mantener tildes y caracteres correctamente.
- Si faltan columnas, dejarlas vacías.
- Separar SIEMPRE por comas.
- No usar punto y coma.

Formato exacto esperado:

level,shift,courseName,division,firstName,lastName,externalStudentId,dni

Ejemplo:

Primaria,Mañana,3ro,A,Juan,Pérez,LEG-1001,40111222
Primaria,Mañana,3ro,A,Ana,Gómez,LEG-1002,41222333

Interpretación de columnas:
- Nivel → level
- Turno → shift
- Curso → courseName
- División → division
- Nombre → firstName
- Apellido → lastName
- Legajo / Matrícula / ID alumno → externalStudentId
- DNI → dni

IMPORTANTE:
- Si existen tanto legajo como DNI, conservar ambos.
- Si falta uno, dejarlo vacío.
- Mantener todos los alumnos.
- No eliminar filas.
- Corregir automáticamente formatos inconsistentes.
- Entregar el resultado listo para copiar y pegar en ComprameLaFoto.`;
