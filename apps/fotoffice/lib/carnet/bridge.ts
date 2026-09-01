/**
 * El puente vive en `@repo/template-editor-core`: lo comparten la emisión del carnet y la vista
 * previa de todas las plataformas. Acá queda solo la reexportación para no cambiar los imports
 * de quienes ya lo usaban.
 */
export {
  editorADocumento,
  documentoAEditor,
  type EditorBlock,
  type EditorCanvas,
  type PuenteResultado,
  type SemillaEditor,
  type VariableSintetica,
} from "@repo/template-editor-core/rendering";
