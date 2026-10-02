import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { fechaHoraBA } from "@/lib/ficha/formato";
import {
  anioEnBuenosAires,
  asegurarSecuencias,
  historialSecuencia,
  leerSecuencias,
  type ClaveSecuencia,
} from "@/lib/numeracion/secuencias";
import { describirCambioSecuencia } from "./historial";
import { SecuenciaFila, type SecuenciaVista } from "./secuencia-fila";

export const dynamic = "force-dynamic";

const NOMBRES: Record<ClaveSecuencia, string> = {
  CONSULTA: "Consultas",
  PRESUPUESTO: "Presupuestos",
  PEDIDO: "Pedidos",
  CONTRATO: "Contratos",
  PROYECTO: "Proyectos",
};

export default async function ConfiguracionNumeracionPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura de secuencias.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Numeración" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden cambiar la numeración.
        </p>
      </div>
    );
  }

  // Un workspace sin secuencias arranca con las iniciales.
  await asegurarSecuencias(workspace.id);
  const hoy = new Date();
  const secuencias = await leerSecuencias(workspace.id, hoy);
  const historiales = await Promise.all(secuencias.map((s) => historialSecuencia(workspace.id, s.key)));
  const anio = anioEnBuenosAires(hoy);

  const vistas: SecuenciaVista[] = secuencias.map((s, i) => ({
    clave: s.key,
    nombre: NOMBRES[s.key],
    prefijo: s.prefix,
    conAnio: s.withYear,
    digitos: s.digits,
    proximo: s.proximo,
    ultimoUsado: s.minimoProximo - 1,
    vistaPrevia: s.vistaPrevia,
    historial: historiales[i]!.map((h) => ({
      id: h.id,
      quien: h.actorLabel ?? "Alguien del equipo",
      cuando: fechaHoraBA(h.createdAt),
      cambios: describirCambioSecuencia(h.before, h.after),
    })),
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Numeración"
        description="Cómo se numeran las consultas, presupuestos, pedidos, contratos y proyectos. El próximo número no puede volver a uno ya usado."
      />
      {vistas.map((v) => (
        <SecuenciaFila key={v.clave} s={v} anio={anio} />
      ))}
    </div>
  );
}
