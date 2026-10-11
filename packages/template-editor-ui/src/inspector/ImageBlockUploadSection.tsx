"use client";

import { useRef, useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import {
  setVariableBindings,
  type TemplateV2EditorDispatch,
  type TemplateV2VariableBinding,
} from "@repo/template-editor-core";
import { requestTemplateVersionImageUpload } from "@repo/template-editor-core";
import { getTemplateV2VariableByKey } from "@repo/template-editor-core";
import { cn } from "../primitives/cn";
import {
  getInsertableImageVariablesForProduct,
  type TemplateProductId,
} from "@repo/template-editor-core";

/*
 * Este panel estaba escrito alrededor de una sola variable, `branding.schoolLogoUrl`, con un
 * botón fijo que decía "Logo escuela (dinámico)". En FotoOffice ofrecía el logo de un colegio
 * que ahí no existe, y no había forma de atar la imagen a la foto del socio.
 *
 * Ahora las opciones salen del catálogo del producto, igual que en el riel de inserción.
 */

function stripSrcBindingsForBlock(
  bindings: TemplateV2VariableBinding[],
  blockId: string
): TemplateV2VariableBinding[] {
  return bindings.filter((b) => !(b.blockId === blockId && b.targetPath === "src"));
}

type Props = {
  templateId: string;
  versionId: string;
  blockId: string;
  src: string;
  sourceObj: Record<string, unknown>;
  variableBindings: TemplateV2VariableBinding[];
  updateConfig: (patch: Record<string, unknown>) => void;
  dispatch: TemplateV2EditorDispatch;
  inputBase: string;
  /** La plataforma de esta plantilla. Gobierna qué imágenes se pueden atar. */
  product: TemplateProductId | "unknown";
};

const smallBtn =
  "h-6 rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-2 text-[11px] font-medium text-[color:var(--te-ink)] transition-colors hover:bg-[color:var(--te-chrome-sunken)] disabled:opacity-50";

export function ImageBlockUploadSection({
  templateId,
  versionId,
  blockId,
  src,
  sourceObj,
  variableBindings,
  updateConfig,
  dispatch,
  inputBase,
  product,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variableKey = typeof sourceObj.variableKey === "string" ? sourceObj.variableKey.trim() : "";
  /** La imagen sale de un dato, no de un archivo subido. */
  const isSchoolLogoDynamic = variableKey !== "";
  const varDef = variableKey ? getTemplateV2VariableByKey(variableKey) : undefined;
  const imagenesDelProducto = getInsertableImageVariablesForProduct(product);

  const hasStaticImage = src.trim() !== "";

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const url = await requestTemplateVersionImageUpload(templateId, versionId, file);
      updateConfig({ src: url, source: { ...sourceObj, variableKey: "" } });
      dispatch(setVariableBindings(stripSrcBindingsForBlock(variableBindings, blockId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setError(null);
    updateConfig({ src: "", source: { ...sourceObj, variableKey: "" } });
    dispatch(setVariableBindings(stripSrcBindingsForBlock(variableBindings, blockId)));
  }

  function useSchoolLogoDynamic(clave: string) {
    setError(null);
    updateConfig({
      src: "",
      source: { ...sourceObj, variableKey: clave },
    });
    const next = stripSrcBindingsForBlock(variableBindings, blockId);
    dispatch(
      setVariableBindings([
        ...next,
        {
          blockId,
          variableKey: clave,
          targetPath: "src",
        },
      ])
    );
  }

  return (
    <InspectorPanel title="Imagen">
      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onFileChange}
      />

      {isSchoolLogoDynamic ? (
        <div className="mb-3 rounded-lg border border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)] px-2.5 py-2 text-[11px] leading-snug text-[color:var(--te-ink)]">
          <p className="font-medium text-[color:var(--te-accent)]">Logo de la escuela (dinámico)</p>
          <p className="mt-1 text-[color:var(--te-ink-muted)]">
            En el pedido se usará el PNG con fondo transparente cargado al dar de alta la escuela en la plataforma. En el
            editor ves una vista previa de diseño.
          </p>
        </div>
      ) : null}

      {!isSchoolLogoDynamic && varDef ? (
        <p className="mb-2 rounded-md border border-[color:var(--te-line)] bg-[color:var(--te-chrome)] px-2 py-1.5 text-[10px] text-[color:var(--te-ink-muted)]">
          Variable de imagen: <span className="font-mono">{variableKey}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        {hasStaticImage && !isSchoolLogoDynamic ? (
          <div className="h-10 w-14 shrink-0 overflow-hidden rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-chrome-sunken)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ) : isSchoolLogoDynamic ? (
          <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-[var(--te-radius)] border border-dashed border-[color:var(--te-accent-wash)] bg-[color:var(--te-chrome-sunken)] text-[9px] font-medium text-[color:var(--te-accent)]">
            Logo
          </div>
        ) : (
          <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-[var(--te-radius)] border border-dashed border-[color:var(--te-line-strong)] bg-[color:var(--te-chrome-sunken)] text-[10px] text-[color:var(--te-ink-faint)]">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
            {isSchoolLogoDynamic
              ? "Vinculado al logo institucional"
              : hasStaticImage
                ? "Imagen asignada al bloque"
                : "Sin imagen: en el lienzo se ve el recuadro de ejemplo"}
          </p>
          {uploading ? (
            <p className="mt-0.5 text-[11px] text-[color:var(--te-accent)]">Subiendo…</p>
          ) : null}
          {error ? (
            <p className="mt-0.5 text-[11px] text-[color:var(--te-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {!isSchoolLogoDynamic ? (
          <>
            <button type="button" className={smallBtn} disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {hasStaticImage ? "Reemplazar imagen" : "Subir imagen"}
            </button>
            {hasStaticImage ? (
              <button type="button" className={smallBtn} disabled={uploading} onClick={clearImage}>
                Quitar imagen
              </button>
            ) : null}
            {imagenesDelProducto.length > 0 ? (
              <select
                className={cn(inputBase, "w-full")}
                value=""
                disabled={uploading}
                aria-label="Atar la imagen a un dato"
                onChange={(e) => {
                  if (e.target.value) useSchoolLogoDynamic(e.target.value);
                }}
              >
                <option value="">Atar a un dato…</option>
                {imagenesDelProducto.map((v) => (
                  <option key={v.key} value={v.key} title={v.description}>
                    {v.label}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : (
          <button type="button" className={smallBtn} disabled={uploading} onClick={clearImage}>
            Cambiar a imagen fija o subir archivo
          </button>
        )}
      </div>

      {!isSchoolLogoDynamic ? (
        <details>
          <summary className="cursor-pointer select-none text-[11px] text-[color:var(--te-ink-muted)]">
            Pegar una dirección (URL)
          </summary>
          <div className="mt-1">
            <input
              className={cn(inputBase, "font-mono text-[11px]")}
              value={src}
              placeholder="https://…"
              onChange={(e) => {
                updateConfig({ src: e.target.value, source: { ...sourceObj, variableKey: "" } });
                dispatch(setVariableBindings(stripSrcBindingsForBlock(variableBindings, blockId)));
              }}
            />
          </div>
        </details>
      ) : null}
    </InspectorPanel>
  );
}
