"use client";

import { useRef, useState } from "react";
import Button from "../primitives/Button";
import { FieldLabel, InspectorPanel } from "../inspector/InspectorPanel";
import {
  setVariableBindings,
  type TemplateV2EditorDispatch,
  type TemplateV2VariableBinding,
} from "@repo/template-editor-core";
import { requestTemplateVersionImageUpload } from "@repo/template-editor-core";
import { getTemplateV2VariableByKey } from "@repo/template-editor-core";
import { cn } from "../primitives/cn";

const SCHOOL_LOGO_VARIABLE_KEY = "branding.schoolLogoUrl";

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
};

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
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variableKey = typeof sourceObj.variableKey === "string" ? sourceObj.variableKey.trim() : "";
  const isSchoolLogoDynamic = variableKey === SCHOOL_LOGO_VARIABLE_KEY;
  const varDef = variableKey ? getTemplateV2VariableByKey(variableKey) : undefined;

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

  function useSchoolLogoDynamic() {
    setError(null);
    updateConfig({
      src: "",
      source: { ...sourceObj, variableKey: SCHOOL_LOGO_VARIABLE_KEY },
    });
    const next = stripSrcBindingsForBlock(variableBindings, blockId);
    dispatch(
      setVariableBindings([
        ...next,
        {
          blockId,
          variableKey: SCHOOL_LOGO_VARIABLE_KEY,
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
          <p className="mt-1 text-[#6b5b4d]">
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

      <div className="flex flex-wrap items-center gap-3">
        {hasStaticImage && !isSchoolLogoDynamic ? (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[color:var(--te-line)] bg-[color:var(--te-chrome)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ) : isSchoolLogoDynamic ? (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-[color:var(--te-accent-wash)] bg-[#fffdfb] text-[9px] font-medium text-[color:var(--te-accent)]">
            Logo
          </div>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-[color:var(--te-ink-faint)] bg-[color:var(--te-chrome)] text-[10px] text-[color:var(--te-ink-faint)]">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[color:var(--te-ink)]">
            {isSchoolLogoDynamic
              ? "Vinculado al logo institucional"
              : hasStaticImage
                ? "Imagen asignada al bloque"
                : "Sin imagen fija (se verá el placeholder en el lienzo)"}
          </p>
          {uploading ? (
            <p className="mt-0.5 text-[11px] text-[color:var(--te-accent)]">Subiendo…</p>
          ) : null}
          {error ? (
            <p className="mt-0.5 text-[11px] text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {!isSchoolLogoDynamic ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {hasStaticImage ? "Reemplazar imagen" : "Subir imagen"}
            </Button>
            {hasStaticImage ? (
              <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={clearImage}>
                Quitar imagen
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={useSchoolLogoDynamic}
              title="Usa el logo PNG (fondo transparente) configurado al dar de alta la escuela"
            >
              Logo escuela (dinámico)
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={clearImage}>
            Cambiar a imagen fija o subir archivo
          </Button>
        )}
      </div>

      {!isSchoolLogoDynamic ? (
        <details className="mt-2 rounded-lg border border-dashed border-[color:var(--te-line)] bg-[color:var(--te-chrome)] px-2 py-1.5">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-[color:var(--te-ink-muted)]">
            URL manual (opcional)
          </summary>
          <div className="mt-2 space-y-1">
            <FieldLabel>URL de la imagen</FieldLabel>
            <input
              className={cn(inputBase, "font-mono text-[11px]")}
              value={src}
              placeholder="https://…"
              onChange={(e) => {
                updateConfig({ src: e.target.value, source: { ...sourceObj, variableKey: "" } });
                dispatch(setVariableBindings(stripSrcBindingsForBlock(variableBindings, blockId)));
              }}
            />
            <p className="text-[10px] text-[color:var(--te-ink-faint)]">
              Podés pegar un enlace público o usar el botón de subida arriba.
            </p>
          </div>
        </details>
      ) : null}
    </InspectorPanel>
  );
}
