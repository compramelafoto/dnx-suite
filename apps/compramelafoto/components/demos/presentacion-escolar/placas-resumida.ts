import type { Placa } from "./placas";

/** Versión corta de la presentación: una idea por placa, para charlas de pocos minutos. */
export const PLACAS_RESUMIDA: Placa[] = [
  {
    etapa: "ComprameLaFoto",
    titulo: "Foto escolar, sin papeles ni efectivo",
    bajada: "Del colegio al sobre entregado, en un solo lugar.",
    visual: "portada",
  },
  {
    etapa: "ComprameLaFoto",
    titulo: "ComprameLaFoto",
    bajada: "Vendés tus fotos en línea y cobrás directo.",
    ancha: true,
    puntos: [
      { titulo: "Álbumes que venden solos" },
      { titulo: "Cada uno se encuentra con una selfie" },
      { titulo: "Cobro directo con Mercado Pago" },
      { titulo: "Todo se configura con DNX Bot" },
    ],
  },
  {
    etapa: "1 · El colegio",
    titulo: "Sumás al colegio",
    bajada: "Tu página de venta, el listado de alumnos y la comisión del colegio.",
    visual: "landing",
  },
  {
    etapa: "2 · Preventa",
    titulo: "Cobrás antes de la foto",
    bajada: "Cada familia paga su pack con Mercado Pago. El colegio no toca dinero.",
    visual: "preventa",
  },
  {
    etapa: "3 · Diseño",
    titulo: "Plantillas y diseñador",
    bajada: "Elegís un diseño y se completa solo para cada chico.",
    visual: "plantillas",
  },
  {
    etapa: "4 · La familia",
    titulo: "Se encuentra, elige y lo ve en 3D",
    bajada: "Selfie, elige sus fotos y aprueba su librito antes de imprimir.",
    visual: "libro3d",
  },
  {
    etapa: "5 · Entrega",
    titulo: "Imprenta y sobres con QR",
    bajada: "Un clic a la imprenta. Escaneás el sobre y queda entregado.",
    visual: "etiquetas",
  },
  {
    etapa: "Cierre",
    titulo: "Todo el circuito, en un lugar",
    bajada: "Menos trabajo a mano, más ventas.",
    ancha: true,
    puntos: [
      { titulo: "Preventa cobrada" },
      { titulo: "Fotos sin clasificar" },
      { titulo: "Diseños automáticos" },
      { titulo: "Entrega ordenada" },
    ],
  },
];
