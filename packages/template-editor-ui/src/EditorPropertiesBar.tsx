"use client";

import type {
  TemplateProductId,
  TemplateV2Block,
  TemplateV2EditorDispatch,
  TemplateV2EditorState,
} from "@repo/template-editor-core";
import { Popover } from "./primitives/Popover";
import { TemplateBlockContextToolbar } from "./TemplateBlockContextToolbar";
import { TemplateDiagnosticsPanel } from "./TemplateDiagnosticsPanel";
import { TemplateEditorInspector } from "./TemplateEditorInspector";
import { TemplateTextFormatToolbar } from "./TemplateTextFormatToolbar";
import { cn } from "./primitives/cn";

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  selectedBlock: TemplateV2Block | null;
  templateId: string;
  versionId: string;
  product: TemplateProductId | "unknown";
  /** Abre el diálogo de tamaño del lienzo, que vive en el Shell. */
  onOpenCanvasSize: () => void;
  className?: string;
};

/**
 * Las propiedades de lo que está seleccionado, en una sola línea sobre el lienzo.
 *
 * Antes vivían en una columna de 320px a la derecha que además cargaba las capas y la revisión
 * rápida: le comía al lienzo casi un tercio del ancho para mostrar controles que la mayor
 * parte del tiempo estaban vacíos. Ahora la derecha es sólo capas y las propiedades siguen a
 * la selección, arriba.
 *
 * Alto fijo y `overflow-x`, nunca `flex-wrap`: si algo no entra, se corre en horizontal. Que
 * esta fila no pueda crecer hacia abajo es lo que sostiene que el editor entre en una
 * pantalla; envolviendo, cada bloque estrecho le robaría otro renglón al lienzo.
 *
 * Lo que no cabe en la línea se abre en desplegables anclados, no en un panel.
 */
export function EditorPropertiesBar({
  state,
  dispatch,
  selectedBlock,
  templateId,
  versionId,
  product,
  onOpenCanvasSize,
  className,
}: Props) {
  const hasSelection = state.selectedBlockIds.length > 0;
  const isText = selectedBlock?.type === "TEXT" || selectedBlock?.type === "VARIABLE_TEXT";
  const inlineToolbarClass = "flex-nowrap items-center bg-transparent p-0";

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden border-t border-[color:var(--te-line)] bg-[color:var(--te-chrome-sunken)] px-2",
        className,
      )}
      role="toolbar"
      aria-label="Propiedades"
      data-testid="template-v2-properties-bar"
    >
      {hasSelection ? (
        <>
          {isText ? (
            <TemplateTextFormatToolbar
              state={state}
              dispatch={dispatch}
              shellClassName={inlineToolbarClass}
            />
          ) : (
            <TemplateBlockContextToolbar
              state={state}
              dispatch={dispatch}
              templateId={templateId}
              versionId={versionId}
              shellClassName={inlineToolbarClass}
            />
          )}

          <Popover
            label="Más"
            title="Propiedades del bloque"
            width={300}
            data-testid="template-v2-properties-more"
          >
            <TemplateEditorInspector
              selectedBlock={selectedBlock}
              selectedBlockCount={state.selectedBlockIds.length}
              selectedBlockIds={state.selectedBlockIds}
              blocks={state.blocks}
              canvas={state.canvas}
              templateId={templateId}
              versionId={versionId}
              variableBindings={state.variableBindings}
              dispatch={dispatch}
              product={product}
            />
          </Popover>
        </>
      ) : (
        <>
          <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-[color:var(--te-ink-faint)]">
            Hoja
          </span>
          <button
            type="button"
            onClick={onOpenCanvasSize}
            className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-2 text-[11px] font-medium text-[color:var(--te-ink)] transition-colors hover:border-[color:var(--te-line-strong)] hover:bg-[color:var(--te-chrome)]"
          >
            {Math.round(state.canvas.width)} × {Math.round(state.canvas.height)} px
          </button>
          <Popover label="Fondo y márgenes" title="Hoja" width={300}>
            <TemplateEditorInspector
              selectedBlock={null}
              selectedBlockCount={0}
              selectedBlockIds={[]}
              blocks={state.blocks}
              canvas={state.canvas}
              templateId={templateId}
              versionId={versionId}
              variableBindings={state.variableBindings}
              dispatch={dispatch}
              product={product}
            />
          </Popover>
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
        <Popover label="Revisión" title="Revisión rápida" width={320}>
          <TemplateDiagnosticsPanel
            blocks={state.blocks}
            canvas={state.canvas}
            dispatch={dispatch}
            embedded
          />
        </Popover>
      </div>
    </div>
  );
}
