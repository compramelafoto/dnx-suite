import type { Clase } from "../constantes";

export type SemillaCircuito = {
  name: string;
  kind: Clase;
  isDefault?: boolean;
  stages: {
    name: string;
    days: number;
    color?: string;
    leadStatus?: string;
    tasks?: { title: string; days?: number; required?: boolean }[];
  }[];
};

export const MOTIVOS_INICIALES = ["Precio", "Fecha no disponible", "Eligió a otro", "No respondió", "Canceló el evento", "Otro"];

type Etapa = SemillaCircuito["stages"][number];

/** Etapa con tareas opcionales. "Finalizado" sale en verde; el resto, en gris. */
function e(name: string, days: number, tasks?: string[]): Etapa {
  return {
    name,
    days,
    color: name === "Finalizado" ? "verde" : "gris",
    ...(tasks ? { tasks: tasks.map((title) => ({ title })) } : {}),
  };
}

/** Etapas de un embudo de venta: azul y violeta alternados. */
function venta(name: string, etapas: [string, number, string?][], isDefault = false): SemillaCircuito {
  return {
    name,
    kind: "VENTA",
    ...(isDefault ? { isDefault: true } : {}),
    stages: etapas.map(([n, d, leadStatus], i) => ({
      name: n,
      days: d,
      color: i % 2 === 0 ? "azul" : "violeta",
      ...(leadStatus ? { leadStatus } : {}),
    })),
  };
}

function trabajo(name: string, stages: Etapa[]): SemillaCircuito {
  return { name, kind: "TRABAJO", stages };
}

export const CIRCUITOS_DNX: SemillaCircuito[] = [
  venta("Colaboradores", [["Enviar fotografías", 1], ["se subió un posteo", 1]]),
  venta(
    "Embudo de Ventas DNX 2022",
    [
      ["Recepción de la oportunidad", 2, "NEW"],
      ["WSP - Recepción del Presupuesto", 1, "CONTACTED"],
      ["Coordinar entrevista", 1, "QUOTED"],
      ["Cliente potencial", 1, "INTERESTED"],
      ["Cliente dudoso", 1],
      ["Confeccionar contrato", 1],
    ],
    true,
  ),
  venta("Plataforma 360", [["Enviar fotografías de evento", 1]]),
  venta("Workshops", [["Recepción de la oportunidad", 2], ["Se envió Whatsapp", 1], ["Entrevista realizada", 1], ["Confeccionar contrato", 1]]),

  trabajo("Base 360°", [e("Coordinar operador de base y flete", 3), e("Crear logo para marca de agua del evento", 1), e("Instalar base 360° en evento", 1)]),
  trabajo("Cobertura y edición de fotografía de evento", [
    e("Tomar fotografías", 1),
    e("Descarga / Backup de archivos", 1),
    e("Edición", 10),
    e("Publicación de galería Proof + Drive", 1),
    e("Seleccionar y copiar en Drive 10 o 20 fotos para post de RRSS", 1),
    e("Compartir con cliente", 1),
    e("Finalizado", 0),
  ]),
  trabajo("Cobertura y edición de Video de evento", [
    e("Capturar video", 1),
    e("Descarga/Backup de archivos", 1),
    e("Edición", 15),
    e("Publicar en Drive", 1),
    e("Compartir a cliente", 1),
    e("Finalizado", 0),
  ]),
  trabajo("Diseño de invitación web", [
    e("Contacto con el cliente", 2, ["Enviar enlace con código de descuento para que adquiera la invitación en invigo.com.ar"]),
    e("Diseñar la invitación", 2, ["Entregar la invitación", "Solicitar devolución"]),
    e("Correcciones o entrega", 1, ["Hacer modificaciones", "Entregar definitivamente"]),
  ]),
  trabajo("Edición de placa gráfica o diseño", [
    e("Subir material e indicaciones al Google Drive", 1, ["Subir materiales al Drive/Canva", "Indicar el enlace"]),
    e("Edición de placa gráfica", 1, ["Seguir las indicaciones"]),
    e("Subir placa gráfica", 1, ["Subir al Drive", "Enviar el enlace de Drive o Canva"]),
    e("Esperar correcciones", 1, ["Esperar correcciones de Daniel / Sol"]),
    e("Realizar correcciones", 1),
    e("Finalizado", 1),
  ]),
  trabajo("Edición de Videos para RRSS", [
    e("Subir material en Drive", 1, ["Subir los videos", "Indicar el enlace (la carpeta lleva el número de proyecto, guion y nombre del video)"]),
    e("Edición de video", 1, ["Seguir las indicaciones del Drive"]),
    e("Subir video editado", 1),
    e("Esperar correcciones", 1, ["Esperar correcciones de Daniel / Sol"]),
    e("Editar, corregir y subir video final", 1),
    e("Finalizado", 1),
  ]),
  trabajo("Evento Social - Edición de Video Final de Fiesta", [
    e("Tomar videos en evento", 0),
    e("Editar video", 0, ["Organizar clips, música, cortes de cámara"]),
    e("Exportar", 0),
    e("Copiar a pendrive", 0),
    e("Finalizado", 0),
  ]),
  trabajo("Evento Social - Fotografías como 2do fotógrafo", [
    e("Tomar fotografías como 2do fotógrafo", 1),
    e("Descarga / Backup / envío de fotografías", 1),
    e("Finalizado", 0),
  ]),
  trabajo("Fotolibro", [
    e("Esperar selección del cliente", 7, ["Indicar cantidad de fotos a seleccionar"]),
    e("Diseño de fotolibro", 2),
    e("Publicar galería del fotolibro", 1, ["Publicar el diseño para verificación y aprobación"]),
    e("Esperar aprobación", 1),
    e("Corregir diseño", 1, ["Corregir según indicaciones del cliente"]),
    e("Aprobación final", 1),
    e("Envío a impresión", 1),
    e("Impresión de fotolibro", 7, ["Aguardar confirmación de envío al depósito en Rosario"]),
    e("Entregar al cliente", 2),
    e("Finalizado", 0),
  ]),
  trabajo("Impresión de Fotografías", [
    e("Editar fotografías", 1),
    e("Enviar fotografías por email al laboratorio", 1),
    e("Retirar", 1, ["Retirar las impresas en el proveedor"]),
    e("Finalizado", 0),
  ]),
  trabajo("Impresión de Fotografías para Números de MESA", [
    e("Editar fotografías", 1),
    e("Editar en Photoshop e insertar número", 1),
    e("Enviar por email al laboratorio", 1),
    e("Retirar", 1),
    e("Finalizado", 0),
  ]),
  trabajo("Impresiones a laboratorio", [
    e("Enviar pedido", 1, [
      "Editar si hace falta",
      "Subir al Drive",
      "Enviar a La Isla con plantilla de correo",
      "Cargar el enlace de envío dentro del pedido",
    ]),
    e("Cargar número de pedido de La Isla", 1),
    e("Retirar de laboratorio", 1),
    e("Pedido listo para entregar", 1, ["Avisar al cliente", "Esperar el retiro"]),
    e("Pedido retirado", 1),
  ]),
  trabajo("Pendrive", [e("Copiar imágenes / video a pendrive", 1), e("Entregar al cliente", 1), e("Finalizado", 0)]),
  trabajo("Publicar Video en RRSS", [
    e("Subir video a la red social", 1, ["Dejarlo en borrador"]),
    e("Redactar copy", 1),
    e("Diseñar miniatura/portada", 1, ["Usar las plantillas de Canva por red"]),
    e("Publicar/programar", 1, ["Si es YouTube, pedirle a Daniel una historia de Instagram que invite al canal"]),
  ]),
  trabajo("Servicio de Proyección en Vivo Selpix", [
    e("Configuración", 0, [
      "Fondo personalizado",
      "Estilo/título/fecha",
      "Generar y descargar QR",
      "Enviar QR al cliente o salón para imprimir",
      "Pedir contacto del DJ o técnico",
      "Enviar enlace al DJ",
      "Instrucciones de proyección",
      "Verificar internet y pantalla del salón",
      "Enviar email y WhatsApp al cliente con enlace y QR",
    ]),
    e("Verificar el día del evento", 1),
    e("Enviar material por Drive", 3),
  ]),
  trabajo("Sesión Fotográfica", [
    e("Capturar imágenes", 0),
    e("Descarga / Backup", 1),
    e("Edición", 1),
    e("Exportación", 1),
    e("Publicar galería de pruebas", 1),
    e("Seleccionar y copiar en Drive 10 o 20 fotos para RRSS", 1),
    e("Entrega al cliente (web/pendrive)", 2),
    e("Finalizado", 0),
  ]),
  // Las tareas de Alboom eran una copia de las de Selpix: se deja sin tareas para completar.
  trabajo("Stand de glitter", [e("Configurar plataforma", 20)]),
];
