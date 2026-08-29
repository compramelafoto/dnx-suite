/**
 * Editor visual Template V2.
 *
 * Montable en cualquier app Next del monorepo: la app aporta la sesión, la base
 * y el almacenamiento vía `setTemplateV2Runtime` de `@repo/template-editor-core`,
 * y renderiza `TemplateEditorShell` en la ruta que quiera.
 */
export { TemplateEditorShell } from "./TemplateEditorShell";
export { TemplateEditorCanvas } from "./TemplateEditorCanvas";
export { TemplateEditorInspector } from "./TemplateEditorInspector";
export { TemplateEditorLayers } from "./TemplateEditorLayers";
export { TemplateCanvasRenderer } from "./TemplateCanvasRenderer";
export { TemplateVersionList } from "./TemplateVersionList";
export { TemplateDiagnosticsPanel } from "./TemplateDiagnosticsPanel";
export { TemplateBlockContextToolbar } from "./TemplateBlockContextToolbar";
export { TemplateTextFormatToolbar } from "./TemplateTextFormatToolbar";
export { TemplateVariableBraceInsertPanel } from "./TemplateVariableBraceInsertPanel";
export { TemplateBlockSafeAreaAlignmentStrip } from "./TemplateBlockSafeAreaAlignmentStrip";
export { TemplateEditorExitModal } from "./TemplateEditorExitModal";
export { CanvasSizeModal } from "./CanvasSizeModal";
export { CreateTemplateV2Button } from "./CreateTemplateV2Button";
export { GoogleFontsLoader } from "./GoogleFontsLoader";
export { useTemplateEditorAutosave } from "./useTemplateEditorAutosave";
export { useTemplateEditorHotkeys } from "./useTemplateEditorHotkeys";
export {
  DEFAULT_TEMPLATE_V2_BASE_PATH,
  templateV2EditorPath,
} from "./template-v2-base-path";

export * from "./theme";
export * from "./chrome/ToolControls";
