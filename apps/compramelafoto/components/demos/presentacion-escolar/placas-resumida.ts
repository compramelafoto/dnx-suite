import type { Placa } from "./placas";

/** Versión corta de la presentación: una idea por placa, para charlas de pocos minutos. */
export const PLACAS_RESUMIDA: Placa[] = [
  {
    etapa: "ComprameLaFoto",
    titulo: "¿Qué es ComprameLaFoto?",
    bajada: "Vendés tus fotos en línea. Cada persona se encuentra con una selfie, paga y las recibe.",
    visual: "portada",
  },
  {
    etapa: "ComprameLaFoto",
    titulo: "Lo que hace ComprameLaFoto",
    bajada: "Eventos, deportes y colegios, cobrando directo en tu cuenta.",
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
    captura: "/demos/escolar/landing-publica.jpg",
    visual: "landing",
  },
  {
    etapa: "2 · Preventa",
    titulo: "Cobrás antes de la foto",
    bajada: "Cada familia paga su pack con Mercado Pago. El colegio no toca dinero.",
    captura: "/demos/escolar/packs.jpg",
    visual: "preventa",
  },
  {
    etapa: "3 · Diseño",
    titulo: "Plantillas y diseñador",
    bajada: "Elegís un diseño y se completa solo para cada chico.",
    captura: "/demos/escolar/plantillas-filtros.jpg",
    visual: "plantillas",
  },
  {
    etapa: "4 · La familia",
    titulo: "Se encuentra, elige y lo ve en 3D",
    bajada: "Selfie, elige sus fotos y aprueba su librito antes de imprimir.",
    captura: "/demos/escolar/librito-3d-tapa.jpg",
    visual: "libro3d",
  },
  {
    etapa: "4 · La familia",
    titulo: "Así lo ve la familia",
    bajada: "El librito real en 3D. Con «Siguiente» se pasan sus páginas.",
    libro3d: "sys_librito_mosaico_primaria_fin_de_ano",
  },
  {
    etapa: "5 · Entrega",
    titulo: "Imprenta y sobres con QR",
    bajada: "Un clic a la imprenta. Escaneás el sobre y queda entregado.",
    captura: "/demos/escolar/pantalla.jpg",
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
  {
    etapa: "Cierre",
    titulo: "Todo el ecosistema DNX",
    bajada: "Herramientas para fotógrafos, estudios e instituciones.",
    apps: true,
  },
];
