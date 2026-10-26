import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/w/[workspaceSlug]/videos/[token]/actions", () => ({ comprarDescargaAction: vi.fn(), extenderAction: vi.fn() }));
vi.mock("@/components/digitalizacion/pedir-envio", () => ({ PedirEnvio: () => null }));
vi.mock("@/components/digitalizacion/ver-video", () => ({ VerVideo: () => null }));
vi.mock("@/components/pedidos/pedido-publico", () => ({ MarcaPublica: ({ children }: { children: unknown }) => children, ContactoPublico: () => null }));

import type { VistaVideosPublica } from "@/lib/digitalizacion/servidor/videos-publicos";
import { PaginaVideos } from "./pagina-videos";

const vista: VistaVideosPublica = {
  organizacion: { nombre: "Foto Positiva", logoUrl: null, whatsappUrl: null, email: null },
  pedidoNumero: "P-12",
  cliente: "Ana",
  saldoMinor: 0,
  cancelado: false,
  urlPedido: null,
  borradosAt: null,
  videosVencenAt: new Date("2026-11-21T15:00:00Z"),
  cassettesVencenAt: new Date("2026-11-21T15:00:00Z"),
  habilitados: true,
  videos: [{ id: "g1", titulo: "Cassette 1", duracionSeg: 3600, quedan: 3, total: 3, vistaPrevia: true, vistaPreviaAgotada: false, puedeComprar: false, descargaPendiente: null }],
  noDigitalizables: [{ id: "n7", texto: "Cassette 7: no se pudo digitalizar (Cinta cortada)" }],
  puedeExtender: false,
  extensionPendiente: null,
  envio: { puedePedir: false, estado: null, direccion: null, precioMinor: null, urlPagar: null },
};

describe("PaginaVideos: cassettes que no se pudieron digitalizar", () => {
  it("los muestra con su motivo y sin botones", () => {
    const html = renderToStaticMarkup(<PaginaVideos modo="PUBLICA" vista={vista} slug="fp" token="t" aviso={null} estudio={null} franjas={[]} />);
    expect(html).toContain("Cassette 7: no se pudo digitalizar (Cinta cortada)");
    expect(html).not.toContain("/descargar/n7");
    expect(html).not.toContain("/ver/n7");
    expect(html).toContain("/descargar/g1");
  });
  it("sin ninguno, no aparece nada", () => {
    const html = renderToStaticMarkup(<PaginaVideos modo="PUBLICA" vista={{ ...vista, noDigitalizables: [] }} slug="fp" token="t" aviso={null} estudio={null} franjas={[]} />);
    expect(html).not.toContain("no se pudo digitalizar");
  });
});
