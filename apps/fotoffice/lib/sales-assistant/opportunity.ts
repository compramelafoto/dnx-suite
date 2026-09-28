/**
 * La oportunidad tal como la entiende el analizador. No sabe de Alboom: el día que existan las
 * consultas propias de FOTOFFICE, son otra fuente que produce este mismo tipo.
 */
export type Movimiento = {
  fecha: Date;
  tipo: "ETAPA" | "CORREO" | "NOTA" | "OTRO";
  texto: string;
};

export type OportunidadVenta = {
  fuente: "ALBOOM";
  idExterno: string;
  titulo: string;
  tipoEvento: string | null;
  nombreCliente: string;
  apellidoCliente: string | null;
  telefono: string | null;
  email: string | null;
  fechaEvento: Date | null;
  lugar: string | null;
  ciudad: string | null;
  invitados: string | null;
  origen: string | null;
  descripcionCliente: string | null;
  embudo: string;
  etapa: string;
  etapaOrden: number;
  etapasTotal: number;
  abierta: boolean;
  creadaEn: Date;
  presupuestoEnviadoEn: Date | null;
  modificadaEn: Date;
  movimientos: Movimiento[];
};
