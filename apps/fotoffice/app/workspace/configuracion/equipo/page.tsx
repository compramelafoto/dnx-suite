import { redirect } from "next/navigation";

/**
 * La pantalla "Equipo" de la etapa 0.1 (invitar con rol Administrador/Equipo/Colaborador) quedó
 * oculta en el merge con main: quién ve qué lo decide "Roles y Comisión directiva"
 * (Integrantes · Cargos · Roles, permisos por módulo). Para no tener dos pantallas que compiten
 * por los mismos permisos, la dirección vieja lleva a la de main. Las tablas
 * (`WorkspaceInvitation`, `WorkspaceAdminEvent`) y el aceptar invitación siguen, por las
 * invitaciones que ya se hubieran mandado.
 */
export default function EquipoPage() {
  redirect("/workspace/configuracion/comision");
}
