/**
 * Render de humo de la pantalla de acreditación sin conexión.
 *
 * `next build` compila, pero no ejecuta el componente: un error de hooks o un
 * import roto recién aparecería con la pantalla en la mano, el día del evento.
 * Acá se renderiza de verdad (render inicial, sin efectos) y se verifica que
 * los carteles que necesita el operador estén en el HTML.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AccreditationScanner } from "@/components/admin/accreditation/AccreditationScanner";
import { ColaOfflinePanel } from "@/components/admin/accreditation/ColaOfflinePanel";
import { nuevaEntrada } from "@/lib/accreditation/ui/offline-queue";

const fallas: string[] = [];
let checks = 0;

function verificar(condicion: boolean, detalle: string) {
  checks += 1;
  if (!condicion) fallas.push(detalle);
}

function contiene(html: string, texto: string, detalle: string) {
  verificar(html.includes(texto), `${detalle} (falta: "${texto}")`);
}

// 1) El escáner completo, con aparatos para elegir.
const escaner = renderToStaticMarkup(
  createElement(AccreditationScanner, {
    editionId: "ed-prueba",
    devices: [
      { id: "dev-1", name: "Celu Dani" },
      { id: "dev-2", name: "Tablet mesa 2" },
    ],
  }),
);
contiene(escaner, "Aparato de la sede", "el selector de aparato se dibuja");
contiene(escaner, "Celu Dani", "los aparatos registrados aparecen en la lista");
contiene(escaner, "Sin identificar", "se puede escanear sin elegir aparato");
contiene(escaner, "Abrir cámara", "el escáner sigue entero");
contiene(escaner, "En línea", "el estado de conexión está a la vista");

// 2) Sin aparatos registrados no debe aparecer un selector vacío.
const sinAparatos = renderToStaticMarkup(
  createElement(AccreditationScanner, { editionId: "ed-prueba" }),
);
verificar(
  !sinAparatos.includes("Aparato de la sede"),
  "sin aparatos registrados no se muestra el selector",
);
contiene(sinAparatos, "Abrir cámara", "el escáner funciona igual sin aparatos");

// 3) La cola con casos reales: uno esperando, uno en conflicto, uno rechazado.
const ahora = new Date("2026-09-19T17:30:00.000Z");
const entradas = [
  nuevaEntrada({
    qr: "TOKEN-ABCDEF",
    shortCode: null,
    registrationIdHint: null,
    etiqueta: "QR …ABCDEF",
    deviceId: "dev-1",
    ahora,
    clave: "k1",
  }),
  {
    ...nuevaEntrada({
      qr: null,
      shortCode: null,
      registrationIdHint: "reg-2",
      etiqueta: "Ana Pérez",
      deviceId: "dev-1",
      ahora,
      clave: "k2",
    }),
    estado: "CONFLICTO" as const,
    motivo: "ALREADY_CHECKED_IN",
  },
  {
    ...nuevaEntrada({
      qr: null,
      shortCode: "999999",
      registrationIdHint: null,
      etiqueta: "Nº 999999",
      deviceId: "dev-1",
      ahora,
      clave: "k3",
    }),
    estado: "RECHAZADA" as const,
    motivo: "SHORT_CODE_NOT_FOUND",
  },
  {
    ...nuevaEntrada({
      qr: "TOKEN-YA-OK",
      shortCode: null,
      registrationIdHint: null,
      etiqueta: "QR …YA-OK",
      deviceId: "dev-1",
      ahora,
      clave: "k4",
    }),
    estado: "SINCRONIZADA" as const,
  },
];

const cola = renderToStaticMarkup(
  createElement(ColaOfflinePanel, {
    entradas,
    sinResolver: 3,
    enLinea: false,
    sincronizando: false,
    mensaje: null,
    onSincronizar: () => {},
    onQuitar: () => {},
    onLimpiar: () => {},
  }),
);
contiene(cola, "Sin conexión", "avisa que no hay señal");
contiene(cola, "3 sin sincronizar", "dice cuántas acreditaciones están en riesgo");
contiene(cola, "Seguí escaneando", "le dice al operador que puede seguir");
contiene(cola, "Ana Pérez", "muestra a quién corresponde cada pendiente");
contiene(cola, "Ya estaba acreditado", "traduce el conflicto a algo entendible");
contiene(cola, "No hay ningún participante con ese número", "explica el rechazo");
verificar(
  !cola.includes("ALREADY_CHECKED_IN"),
  "no muestra códigos técnicos crudos al operador",
);
verificar(
  !cola.includes("QR …YA-OK"),
  "lo ya acreditado no ensucia la lista de pendientes",
);
contiene(cola, "Limpiar las ya acreditadas", "se puede vaciar lo resuelto");

// 4) Todo en orden y en línea: sin ruido en pantalla.
const tranquilo = renderToStaticMarkup(
  createElement(ColaOfflinePanel, {
    entradas: [],
    sinResolver: 0,
    enLinea: true,
    sincronizando: false,
    mensaje: null,
    onSincronizar: () => {},
    onQuitar: () => {},
    onLimpiar: () => {},
  }),
);
contiene(tranquilo, "En línea", "el estado normal también se ve");
verificar(
  !tranquilo.includes("Sincronizar ahora"),
  "sin pendientes no ofrece sincronizar",
);

if (fallas.length > 0) {
  console.error(JSON.stringify({ ok: false, checks, fallas }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks }));
