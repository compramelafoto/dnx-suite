/**
 * Organizador demo de la serie de turismo: «Turismo Demo Patagonia», una empresa de turismo
 * inventada que se ve en la vista «organizador» de la demo (`/organizador/dashboard`).
 *
 * Como los demás usuarios demo: etiqueta `DEMO_PRESENTACION`, correo `.test`, una contraseña
 * aleatoria que nadie conoce (se entra desde la demo) y el token de Mercado Pago falso.
 */

import { randomBytes } from "node:crypto";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@repo/auth";
import { DEMO_TAG, esUsuarioDemo, MP_TOKEN_DEMO } from "@/lib/demos/identidad";
import { DEMO_ESCOLAR } from "@/lib/demos/escolar/datos";

/** Id del organizador demo, o `null` si todavía no se creó. */
export async function getOrganizadorTurismoDemoId(): Promise<number | null> {
  const u = await prisma.user.findUnique({
    where: { email: DEMO_ESCOLAR.organizadorTurismo.email },
    select: { id: true, tags: true },
  });
  return u && esUsuarioDemo(u) ? u.id : null;
}

/**
 * Crea el organizador demo si falta (se puede llamar las veces que haga falta). Si el correo ya
 * existe sin la etiqueta demo, no lo toca: no convierte en demo a un usuario que no lo es.
 */
export async function asegurarOrganizadorTurismoDemo(): Promise<number> {
  const d = DEMO_ESCOLAR.organizadorTurismo;
  const existente = await prisma.user.findUnique({
    where: { email: d.email },
    select: { id: true, tags: true, role: true },
  });
  if (existente) {
    if (!esUsuarioDemo(existente)) {
      throw new Error("El correo del organizador demo es de un usuario que no es demo: no se toca.");
    }
    if (String(existente.role) !== Role.ORGANIZER) {
      await prisma.user.update({ where: { id: existente.id }, data: { role: Role.ORGANIZER } });
    }
    return existente.id;
  }
  const creado = await prisma.user.create({
    data: {
      email: d.email,
      name: d.nombre,
      companyName: d.nombre,
      role: Role.ORGANIZER,
      tags: [DEMO_TAG],
      // Nadie entra con contraseña: se entra desde la demo.
      password: hashPassword(randomBytes(24).toString("hex")),
      emailVerifiedAt: new Date(),
      city: "Bariloche",
      province: "Río Negro",
      // Nunca se usa para cobrar: en la demo el pago es simulado.
      mpAccessToken: MP_TOKEN_DEMO,
      mpConnectedAt: new Date(),
    } as never,
    select: { id: true },
  });
  return creado.id;
}
