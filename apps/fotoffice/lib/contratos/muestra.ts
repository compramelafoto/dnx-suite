/**
 * Pedido de ejemplo para la vista previa de una plantilla (Configuración → Contratos → Plantillas).
 * Módulo PURO. Todos los datos son inventados; sólo la empresa sale de los ajustes (si están cargados).
 */
import { aBloques, type Bloque } from "./formato";
import { completarContrato, contextoContrato, revisarPlantillaContrato, type ContextoContratoEntrada } from "./variables";

export type EmpresaMuestra = { nombre: string | null; cuit: string | null; domicilio: string | null };

export function entradaDeMuestra(empresa: EmpresaMuestra, hoy: Date): ContextoContratoEntrada {
  return {
    pedido: { numero: "P-0001", totalArs: 450000 },
    items: [
      { nombre: "Cobertura fotográfica de casamiento (8 horas)", cantidad: 1, precioUnitario: 360000, total: 360000 },
      { nombre: "Álbum de 30 hojas", cantidad: 1, precioUnitario: 90000, total: 90000 },
    ],
    cuotas: [
      { position: 1, dueDate: "2027-01-10", amountArs: 150000 },
      { position: 2, dueDate: "2027-02-10", amountArs: 150000 },
      { position: 3, dueDate: "2027-03-10", amountArs: 150000 },
    ],
    contratantes: [
      { nombre: "Ana Gómez", docType: "DNI", docNumber: "30.111.222", address: "Av. Siempre Viva 742", city: "Rosario", email: "ana@ejemplo.com", phone: "341 555-0101" },
      { nombre: "Luis Pérez", docType: "DNI", docNumber: "31.222.333", address: "Mitre 1250", city: "Rosario", email: "luis@ejemplo.com", phone: "341 555-0102" },
    ],
    empresa: {
      nombre: empresa.nombre ?? "Tu empresa (ejemplo)",
      cuit: empresa.cuit ?? "20-12345678-9",
      domicilio: empresa.domicilio ?? "Calle Ejemplo 123, Rosario",
    },
    evento: { nombre: "Casamiento de Ana y Luis", fecha: "2027-04-17" },
    numero: "C-0001",
    hoy,
  };
}

export type VistaPrevia =
  | { ok: true; bloques: Bloque[]; vacias: string[] }
  | { ok: false; errores: string[]; desconocidas: string[] };

/** Completa el cuerpo con el pedido de ejemplo y lo pasa a bloques, o devuelve qué está mal escrito. */
export function vistaPreviaDePlantilla(cuerpo: string, empresa: EmpresaMuestra, hoy: Date): VistaPrevia {
  const r = completarContrato(cuerpo, contextoContrato(entradaDeMuestra(empresa, hoy)));
  if (!r.ok) return { ok: false, errores: r.errores.map((e) => e.mensaje), desconocidas: r.desconocidas };
  return { ok: true, bloques: aBloques(r.texto), vacias: r.vacias };
}

/** Texto para mostrar al guardar una plantilla con errores, o null si está bien. */
export function erroresDePlantilla(cuerpo: string): string[] | null {
  const r = revisarPlantillaContrato(cuerpo);
  return r.ok ? null : [...new Set(r.errores.map((e) => e.mensaje))];
}
