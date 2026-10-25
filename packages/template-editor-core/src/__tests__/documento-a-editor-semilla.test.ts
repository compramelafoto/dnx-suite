import { test } from "node:test";
import assert from "node:assert/strict";
import { documentoAEditor } from "../design-studio-bridge";
import { resolveBracePlaceholdersInText } from "../resolve-text-brace-variables";

/**
 * Un diseño de fábrica (documento de impresión) que se siembra en el editor tiene que verse en
 * el lienzo igual que como se imprime. Antes la imagen atada a un dato aparecía como "Imagen
 * libre", el logo con "contain" se recortaba y las mayúsculas se perdían.
 */
const documento = {
  schemaVersion: 1,
  metadata: { name: "Prueba" },
  format: { medium: "PRINT", width: 100, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
  sides: [
    {
      id: "a",
      name: "A",
      background: "#ffffff",
      blocks: [
        { id: "logo", type: "image", x: 0, y: 0, width: 10, height: 10, variableKey: "organizerLogo", fit: "contain" },
        { id: "foto", type: "image", x: 0, y: 0, width: 10, height: 10, variableKey: "entryImage", fit: "cover", mask: "circle" },
        { id: "t", type: "text", x: 0, y: 0, width: 50, height: 10, fontId: "dmSans", fontSize: 10, color: "#000", content: "{{prizeLabel}}", textTransform: "uppercase" },
      ],
    },
  ],
};

test("la imagen atada a un dato queda donde la buscan el lienzo y el inspector", () => {
  const { blocks } = documentoAEditor(documento);
  const logo = blocks[0]!.configJson as { source?: { variableKey?: string }; fit?: string };
  const foto = blocks[1]!.configJson as { source?: { variableKey?: string }; maskShape?: string };
  assert.equal(logo.source?.variableKey, "organizerLogo");
  assert.equal(logo.fit, "contain");
  assert.equal(foto.source?.variableKey, "entryImage");
  assert.equal(foto.maskShape, "circle");
});

test("las mayúsculas del diseño llegan al editor", () => {
  const { blocks } = documentoAEditor(documento);
  assert.equal((blocks[2]!.configJson as { textTransform?: string }).textTransform, "uppercase");
});

test("un texto mezclado resuelve cualquier clave que tenga valor de muestra", () => {
  assert.equal(
    resolveBracePlaceholdersInText("{prizeLabel} · {categoryName}", { prizeLabel: "1.er premio", categoryName: "Paisaje" }),
    "1.er premio · Paisaje",
  );
  assert.equal(resolveBracePlaceholdersInText("{desconocida}", {}), "{desconocida}");
});
