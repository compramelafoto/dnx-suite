import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** El menú lleva a las configuraciones de WhatsApp y Telegram: antes sólo se llegaba escribiendo la dirección. */
const nav = readFileSync(join(__dirname, "shell-nav.tsx"), "utf8");
const bloque = (desde: string, hasta: string) => nav.slice(nav.indexOf(desde), nav.indexOf(hasta, nav.indexOf(desde)));

describe("menú: WhatsApp y Telegram", () => {
  it("Configuración (dueño o admin) tiene WhatsApp y Telegram", () => {
    const institucion = bloque("const institucion: Item[] = canManageWorkspaceSettings", "\n  ];\n");
    expect(institucion).toContain('href: "/workspace/configuracion/whatsapp"');
    expect(institucion).toContain('href: "/workspace/configuracion/telegram"');
  });
});
