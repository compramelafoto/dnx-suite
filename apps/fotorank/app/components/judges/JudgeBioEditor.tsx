"use client";

import { useMemo, useState } from "react";
import { Button, Card, FormField, spacing, radius, useResolvedTheme } from "@repo/design-system";
import type { JudgeBioBlock, JudgeBioDocument } from "../../lib/fotorank/judges/judgeBioRich";
import { emptyJudgeBioDocument, parseAndValidateJudgeBioDocument } from "../../lib/fotorank/judges/judgeBioRich";
import { JudgeBioRenderer } from "./JudgeBioRenderer";

function parseInitial(initial: unknown): JudgeBioDocument {
  const p = parseAndValidateJudgeBioDocument(initial);
  return p.ok ? p.doc : emptyJudgeBioDocument();
}

function blockTypeLabel(type: JudgeBioBlock["type"]): string {
  switch (type) {
    case "paragraph":
      return "Párrafo";
    case "heading":
      return "Título";
    case "bulletList":
      return "Lista con viñetas";
    case "numberedList":
      return "Lista numerada";
    case "link":
      return "Enlace";
    default:
      return "Bloque";
  }
}

export function JudgeBioEditor({
  initialJson,
  name = "fullBioRichJson",
}: {
  initialJson: unknown;
  name?: string;
}) {
  const theme = useResolvedTheme();
  const [doc, setDoc] = useState<JudgeBioDocument>(() => parseInitial(initialJson));

  const serialized = useMemo(() => JSON.stringify(doc), [doc]);

  const controlStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: radius.button,
    border: `1px solid ${theme.border.subtle}`,
    background: theme.surface.base,
    color: theme.text.primary,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: "0.95rem",
    outline: "none",
  };

  function updateBlock(index: number, patch: Partial<JudgeBioBlock>) {
    setDoc((prev) => {
      const blocks = [...prev.blocks];
      const cur = blocks[index];
      if (!cur) return prev;
      blocks[index] = { ...cur, ...patch } as JudgeBioBlock;
      return { ...prev, blocks };
    });
  }

  function removeBlock(index: number) {
    setDoc((prev) => ({ ...prev, blocks: prev.blocks.filter((_, i) => i !== index) }));
  }

  function moveBlock(index: number, delta: -1 | 1) {
    setDoc((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      const tmp = blocks[index]!;
      blocks[index] = blocks[j]!;
      blocks[j] = tmp;
      return { ...prev, blocks };
    });
  }

  function addBlock(type: JudgeBioBlock["type"]) {
    setDoc((prev) => {
      let block: JudgeBioBlock;
      switch (type) {
        case "paragraph":
          block = { type: "paragraph", text: "" };
          break;
        case "heading":
          block = { type: "heading", level: 2, text: "" };
          break;
        case "bulletList":
          block = { type: "bulletList", items: [""] };
          break;
        case "numberedList":
          block = { type: "numberedList", items: [""] };
          break;
        case "link":
          block = { type: "link", text: "", url: "https://" };
          break;
        default:
          return prev;
      }
      return { ...prev, blocks: [...prev.blocks, block] };
    });
  }

  return (
    <div data-testid="judge-bio-editor" style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      <input type="hidden" name={name} value={serialized} readOnly data-testid="judge-bio-rich-json" />

      <div>
        <p style={{ fontWeight: 600, color: theme.text.primary, marginBottom: spacing[2], fontSize: "0.9rem" }}>
          Agregar contenido
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
          <Button type="button" variant="outline" size="sm" data-testid="judge-bio-add-paragraph" onClick={() => addBlock("paragraph")}>
            + Párrafo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("heading")}>
            + Título
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("bulletList")}>
            + Lista
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("numberedList")}>
            + Lista numerada
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("link")}>
            + Enlace
          </Button>
        </div>
        <p style={{ color: theme.text.secondary, fontSize: "0.85rem", marginTop: spacing[2], marginBottom: 0 }}>
          Mismo formato que verá el jurado en su perfil público: sin HTML libre; el servidor valida al guardar.
        </p>
      </div>

      {doc.blocks.length === 0 ? (
        <p style={{ color: theme.text.secondary, fontSize: "0.9rem" }}>
          Todavía no hay bloques. Usá los botones de arriba para armar la bio.
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
        {doc.blocks.map((block, index) => (
          <div
            key={index}
            style={{
              border: `1px solid ${theme.border.subtle}`,
              borderRadius: radius.button,
              padding: spacing[4],
              background: theme.surface.base,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing[2],
                marginBottom: spacing[3],
                borderBottom: `1px solid ${theme.border.subtle}`,
                paddingBottom: spacing[2],
              }}
            >
              <span style={{ fontWeight: 600, color: theme.text.primary, fontSize: "0.9rem" }}>
                {blockTypeLabel(block.type)} · Bloque {index + 1} de {doc.blocks.length}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index >= doc.blocks.length - 1}
                >
                  Bajar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(index)}>
                  Quitar
                </Button>
              </div>
            </div>

            {block.type === "paragraph" ? (
              <FormField label="Texto del párrafo">
                <textarea
                  data-testid="judge-bio-paragraph"
                  data-bio-block-index={index}
                  rows={4}
                  value={block.text}
                  onChange={(e) => updateBlock(index, { text: e.target.value })}
                  style={{ ...controlStyle, minHeight: "5rem", resize: "vertical" }}
                />
              </FormField>
            ) : null}

            {block.type === "heading" ? (
              <>
                <FormField label="Tamaño del título">
                  <select
                    value={block.level}
                    onChange={(e) => updateBlock(index, { level: Number(e.target.value) === 3 ? 3 : 2 })}
                    style={controlStyle}
                  >
                    <option value={2}>Principal (más grande)</option>
                    <option value={3}>Secundario</option>
                  </select>
                </FormField>
                <FormField label="Texto">
                  <input
                    value={block.text}
                    onChange={(e) => updateBlock(index, { text: e.target.value })}
                    style={controlStyle}
                  />
                </FormField>
              </>
            ) : null}

            {(block.type === "bulletList" || block.type === "numberedList") ? (
              <FormField label="Ítems (uno por línea)">
                <textarea
                  rows={5}
                  value={block.items.join("\n")}
                  onChange={(e) => {
                    const items = e.target.value.split("\n");
                    setDoc((prev) => {
                      const blocks = [...prev.blocks];
                      const cur = blocks[index];
                      if (cur?.type === "bulletList") blocks[index] = { type: "bulletList", items };
                      else if (cur?.type === "numberedList") blocks[index] = { type: "numberedList", items };
                      return { ...prev, blocks };
                    });
                  }}
                  style={{ ...controlStyle, minHeight: "6rem", resize: "vertical", fontFamily: "inherit" }}
                />
              </FormField>
            ) : null}

            {block.type === "link" ? (
              <>
                <FormField label="Texto que se muestra">
                  <input
                    value={block.text}
                    onChange={(e) => updateBlock(index, { text: e.target.value })}
                    style={controlStyle}
                  />
                </FormField>
                <FormField label="Dirección (https://…)">
                  <input
                    value={block.url}
                    onChange={(e) => updateBlock(index, { url: e.target.value })}
                    style={controlStyle}
                  />
                </FormField>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <Card data-testid="judge-bio-preview">
        <p style={{ fontWeight: 600, color: theme.text.primary, marginBottom: spacing[3], fontSize: "0.95rem" }}>
          Vista previa
        </p>
        <p style={{ fontSize: "0.8rem", color: theme.text.secondary, marginTop: 0, marginBottom: spacing[3] }}>
          Misma estructura segura que el perfil público (tamaños compactos).
        </p>
        {doc.blocks.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: theme.text.secondary, margin: 0 }}>Sin contenido para previsualizar.</p>
        ) : (
          <div
            style={{
              border: `1px dashed ${theme.border.subtle}`,
              borderRadius: radius.button,
              padding: spacing[4],
              maxHeight: "280px",
              overflowY: "auto",
            }}
          >
            <JudgeBioRenderer doc={doc} variant="preview" />
          </div>
        )}
      </Card>
    </div>
  );
}
