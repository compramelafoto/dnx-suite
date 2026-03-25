"use client";

import { useMemo, useState } from "react";
import { Button, FormField, spacing, radius, useResolvedTheme } from "@repo/design-system";
import type { JudgeOtherLinksDocument } from "../../lib/fotorank/judges/judgeBioRich";
import { emptyJudgeOtherLinksDocument, parseAndValidateJudgeOtherLinks } from "../../lib/fotorank/judges/judgeBioRich";

function parseInitial(initial: unknown): JudgeOtherLinksDocument {
  const p = parseAndValidateJudgeOtherLinks(initial);
  return p.ok ? p.doc : emptyJudgeOtherLinksDocument();
}

export function JudgeOtherLinksEditor({
  initialJson,
  name = "otherLinksJson",
}: {
  initialJson: unknown;
  name?: string;
}) {
  const theme = useResolvedTheme();
  const [doc, setDoc] = useState<JudgeOtherLinksDocument>(() => parseInitial(initialJson));
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

  function addLink() {
    setDoc((prev) => ({
      ...prev,
      links: [...prev.links, { label: "", url: "https://" }],
    }));
  }

  function updateLink(i: number, patch: Partial<{ label: string; url: string }>) {
    setDoc((prev) => {
      const links = [...prev.links];
      const cur = links[i];
      if (!cur) return prev;
      links[i] = { ...cur, ...patch };
      return { ...prev, links };
    });
  }

  function removeLink(i: number) {
    setDoc((prev) => ({ ...prev, links: prev.links.filter((_, j) => j !== i) }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
      <input type="hidden" name={name} value={serialized} readOnly />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: spacing[2] }}>
        <p style={{ color: theme.text.secondary, fontSize: "0.9rem", margin: 0 }}>
          Enlaces extra (portfolio, LinkedIn, etc.). Solo URLs http/https.
        </p>
        <Button type="button" variant="outline" onClick={addLink}>
          + Enlace
        </Button>
      </div>
      {doc.links.length === 0 ? (
        <p style={{ color: theme.text.secondary, fontSize: "0.9rem" }}>Sin enlaces adicionales.</p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        {doc.links.map((link, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${theme.border.subtle}`,
              borderRadius: radius.button,
              padding: spacing[3],
            }}
          >
            <FormField label="Etiqueta">
              <input value={link.label} onChange={(e) => updateLink(i, { label: e.target.value })} style={controlStyle} />
            </FormField>
            <FormField label="URL">
              <input value={link.url} onChange={(e) => updateLink(i, { url: e.target.value })} style={controlStyle} />
            </FormField>
            <Button type="button" variant="ghost" onClick={() => removeLink(i)}>
              Quitar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
