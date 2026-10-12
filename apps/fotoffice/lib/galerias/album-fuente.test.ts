import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const BASE = "../../app/w/[workspaceSlug]/galeria/[token]";
const page = leer(`${BASE}/page.tsx`);
const acciones = leer(`${BASE}/acciones.ts`);
const album = leer("../../components/galeria-publica/galeria-album.tsx");
const visor = leer("../../components/galeria-publica/album-visor.tsx");
const decision = leer("../../components/galeria-publica/album-decision.tsx");
const servidor = leer("./publico-album.ts");
const cuerpoDe = (n: string) => {
  const i = acciones.indexOf(`export async function ${n}(`);
  const j = acciones.indexOf("\nexport async function ", i + 10);
  return acciones.slice(i, j === -1 ? undefined : j);
};

describe("prueba de álbum del cliente (fuente)", () => {
  it("la página usa su propia pantalla para ALBUM, antes de la vuelta de pago, con la ronda sólo como número", () => {
    expect(page).toMatch(/r\.galeria\.kind === "ALBUM"\) \{[\s\S]*<GaleriaAlbum\s/);
    expect(page.indexOf('kind === "ALBUM"')).toBeLessThan(page.indexOf('pago === "ok"'));
    expect(page).toContain("[1-9][0-9]{0,5}");
  });
  it("las acciones de álbum pasan por el freno por IP; decidir es la más estricta y manda el correo con after()", () => {
    expect(cuerpoDe("comentarLaminaAction")).toMatch(/await entrar\("comentar-lamina", \d+, slug\)/);
    expect(cuerpoDe("decidirAlbumAction")).toContain('entrar("decidir-album", 10,');
    expect(cuerpoDe("decidirAlbumAction")).toMatch(/after\(\(\) => avisarDecisionAlbum\(r\.aviso\)\)/);
  });
  it("las acciones sólo reciben slug y token del navegador (nunca el cliente, la ronda ni el workspace)", () => {
    expect(acciones).toMatch(/comentarLaminaAction\(slug: unknown, token: unknown, fotoId: unknown, texto: unknown, pin: unknown\)/);
    expect(acciones).toMatch(/decidirAlbumAction\(slug: unknown, token: unknown, decision: unknown, mensaje: unknown\)/);
  });
  it("el servidor vuelve a resolver el token en cada paso y ata la lámina a la ronda abierta de la galería", () => {
    expect(servidor).toContain("resolverTokenGaleria(workspaceId, token)");
    expect(servidor).toMatch(/galeriaId: r\.galeria\.id, rondaId: ronda\.id, status: "LISTA", id: fotoId/);
    expect(servidor).toContain('status: "EN_PROGRESO"');
    expect(servidor).toContain("prisma.$transaction");
  });
  it("la pantalla es de sólo lectura sin ronda abierta o tras decidir, y no tiene selección ni compra", () => {
    expect(album).toContain("vista.puedeComentar && !decision");
    expect(album).not.toMatch(/elegirFotoAction|enviarSeleccionAction|pagarFotosExtraAction|descargarOriginalAction/);
    expect(album).toContain("Aprobar el álbum");
    expect(album).toContain("Pedir cambios");
    expect(album).toContain("Enviaste tu decisión el");
    expect(album).not.toMatch(/\bplata\b/i);
  });
  it("hojea con flechas, teclado y deslizar, y tiene la tira de miniaturas y el selector de rondas", () => {
    expect(album).toContain('"ArrowLeft"');
    expect(album).toContain('"ArrowRight"');
    expect(visor).toContain("onTouchStart");
    expect(visor).toContain("onTouchEnd");
    expect(album).toContain("Lámina {indice + 1} de {total}");
    expect(album).toContain('aria-label="Todas las láminas"');
    expect(album).toContain('aria-label="Rondas"');
  });
  it("el pin se mide contra la imagen real (object-fit contain), las imágenes no se arrastran ni llevan referer", () => {
    expect(visor).toContain("rectDeImagenContenida(");
    expect(visor).toContain("puntoRelativo(");
    for (const f of [album, visor]) {
      expect(f).toContain("draggable={false}");
      expect(f).toContain('referrerPolicy="no-referrer"');
      expect(f).toContain("onContextMenu");
    }
  });
  it("pedir cambios sin comentarios exige el mensaje también en la pantalla de confirmación", () => {
    expect(decision).toContain("const obligatorio = !aprueba && comentarios === 0");
    expect(decision).toContain("Mensaje para el estudio (opcional)");
  });
  it("el correo al estudio sale de un módulo propio y los textos no dicen «plata»", () => {
    const aviso = leer("./avisos-album.ts");
    expect(aviso).toContain("destinatarioDelPresupuesto(");
    expect(aviso).toContain("TOPE_AVISOS_ESTUDIO_DIA");
    for (const f of [aviso, decision, servidor, leer("./album-reglas.ts")]) expect(f).not.toMatch(/\bplata\b/i);
  });
});
