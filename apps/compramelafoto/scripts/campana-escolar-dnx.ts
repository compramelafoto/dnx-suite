#!/usr/bin/env node
/**
 * Campaña de correo de DNX Estudio a colegios (fotografía escolar).
 *
 * Los prospectos viven en `SchoolOutreachProspect` (base de CLF): una fila por administración, sólo
 * las que superaron los filtros (exclusiones, cruce con `School`, radio y contacto). El texto del
 * correo está en `lib/dnx-escolar/campaign-email.ts`.
 *
 * Comandos (desde apps/compramelafoto):
 *   tsx scripts/campana-escolar-dnx.ts importar <prospectos.json>   carga/actualiza prospectos (idempotente)
 *   tsx scripts/campana-escolar-dnx.ts vista-previa [groupKey]       escribe .html y .txt en ./tmp-campana-escolar/
 *   tsx scripts/campana-escolar-dnx.ts prueba <email>                 envía UNA prueba con [PRUEBA] (sin tocar la base)
 *   tsx scripts/campana-escolar-dnx.ts enviar --confirmar=ENVIAR [--limite=N]
 *   tsx scripts/campana-escolar-dnx.ts estado                         consulta a Resend rebotes/quejas y resume
 *   tsx scripts/campana-escolar-dnx.ts marcar <groupKey> <RESPONDIO|NO_CONTACTAR|LISTO|PENDIENTE_VALIDACION> [nota]
 *
 * Variables: DATABASE_URL (base de CLF de producción para la campaña real), RESEND_API_KEY.
 * `enviar` vuelve a cruzar contra `School` justo antes de mandar y deja afuera altas nuevas.
 */
import "./_cargar-env-local";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { Resend } from "resend";

import { prisma } from "@/lib/prisma";
import { buildCampaignEmail, DNX_ESCOLAR_CAMPAIGN_KEY } from "@/lib/dnx-escolar/campaign-email";
import {
  BLOCKING_STATES,
  decideAfterFailure,
  isProspectState,
  normalizeEmail,
  normalizePhone,
  sendIdempotencyKey,
  STALE_CLAIM_MS,
  stateFromProviderEvent,
  type ProspectState,
} from "@/lib/dnx-escolar/campaign-states";
import { matchProspectToClf, type ClfSchoolRow } from "@/lib/dnx-escolar/clf-school-match";

const CAMPAIGN = process.env.DNX_ESCOLAR_CAMPAIGN_KEY || DNX_ESCOLAR_CAMPAIGN_KEY;
/** Resend admite 10/s; un correo cada 1,5 s es frío y prolijo para dominios escolares. */
const PAUSA_MS = 1500;
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

type ProspectInput = {
  groupKey: string;
  ids: string[];
  displayName: string;
  locality: string;
  levels?: string | null;
  email: string;
  phone?: string | null;
  addresses?: string[];
  emails?: string[];
  phones?: string[];
  notes?: string | null;
  /** School.id que Daniel decidió contactar igual pese a estar cargado en CLF. */
  clfSchoolIdAllowed?: number | null;
};

type SendError = { statusCode?: number | null; name?: string | null; message?: string };

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function loadSchools(): Promise<ClfSchoolRow[]> {
  return prisma.school.findMany({
    select: { id: true, name: true, city: true, address: true, contactEmail: true, contactPhone: true },
  });
}

/** null = puede seguir; string = motivo para dejarlo afuera. */
function clfBlock(p: ProspectInput, schools: ClfSchoolRow[]): { reason: string; schoolId: number | null } | null {
  const match = matchProspectToClf(
    {
      institutionName: p.displayName,
      locality: p.locality,
      addresses: p.addresses ?? [],
      emails: p.emails ?? [p.email],
      phones: p.phones ?? [],
    },
    schools
  );
  if (!match) return null;
  if (p.clfSchoolIdAllowed != null && match.schoolId === p.clfSchoolIdAllowed) return null;
  return {
    schoolId: match.schoolId,
    reason:
      match.kind === "inequivoca"
        ? `Ya cargado en CLF (School ${match.schoolId}: ${match.reason})`
        : `Posible coincidencia CLF (School ${match.schoolId}: ${match.reason}); resolver identidad`,
  };
}

async function importar(file: string) {
  const prospects = JSON.parse(readFileSync(resolve(file), "utf8")) as ProspectInput[];
  const schools = await loadSchools();
  const now = new Date();
  let creados = 0;
  let actualizados = 0;
  const omitidos: string[] = [];

  for (const p of prospects) {
    const email = normalizeEmail(p.email);
    if (!email) {
      omitidos.push(`${p.groupKey}: email inválido`);
      continue;
    }
    const block = clfBlock(p, schools);
    if (block) {
      omitidos.push(`${p.groupKey}: ${block.reason}`);
      continue;
    }
    const blocked = await prisma.schoolOutreachProspect.findFirst({
      where: { email, status: { in: [...BLOCKING_STATES] } },
      select: { id: true, status: true },
    });
    const existing = await prisma.schoolOutreachProspect.findUnique({
      where: { campaignKey_groupKey: { campaignKey: CAMPAIGN, groupKey: p.groupKey } },
    });
    const data = {
      institutionName: p.displayName,
      locality: p.locality,
      levels: p.levels ?? null,
      sourceIds: p.ids,
      email,
      phone: normalizePhone(p.phone),
      notes: p.notes ?? null,
      clfSchoolId: p.clfSchoolIdAllowed ?? null,
      clfCheckedAt: now,
    };
    if (existing) {
      // Nunca reabre un prospecto ya enviado, rebotado o dado de baja.
      await prisma.schoolOutreachProspect.update({ where: { id: existing.id }, data });
      actualizados++;
      continue;
    }
    await prisma.schoolOutreachProspect.create({
      data: {
        ...data,
        campaignKey: CAMPAIGN,
        groupKey: p.groupKey,
        status: blocked ? "NO_CONTACTAR" : "LISTO",
        lastAction: blocked ? `Importado bloqueado: email en estado ${blocked.status}` : "Importado tras filtros",
        lastActionAt: now,
      },
    });
    creados++;
  }
  console.log(JSON.stringify({ campaña: CAMPAIGN, creados, actualizados, omitidos }, null, 2));
}

async function vistaPrevia(groupKey?: string) {
  const dir = resolve(process.cwd(), "tmp-campana-escolar");
  mkdirSync(dir, { recursive: true });
  let name = "Colegio de ejemplo";
  if (groupKey) {
    const p = await prisma.schoolOutreachProspect.findUnique({
      where: { campaignKey_groupKey: { campaignKey: CAMPAIGN, groupKey } },
    });
    if (!p) throw new Error(`No existe ${groupKey}`);
    name = p.institutionName;
  }
  const email = buildCampaignEmail({ institutionName: name });
  writeFileSync(resolve(dir, "vista-previa.html"), email.html);
  writeFileSync(resolve(dir, "vista-previa.txt"), `Asunto: ${email.subject}\nDe: ${email.from}\nResponder a: ${email.replyTo}\n\n${email.text}\n`);
  console.log(`Vista previa en ${dir}`);
}

function resendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Falta RESEND_API_KEY");
  return new Resend(key);
}

async function prueba(to: string, name = "Colegio de prueba") {
  const email = buildCampaignEmail({ institutionName: name });
  const { data, error } = await resendClient().emails.send({
    from: email.from,
    to,
    replyTo: email.replyTo,
    subject: `[PRUEBA] ${email.subject}`,
    html: email.html,
    text: email.text,
    headers: email.headers,
  });
  if (error) throw new Error(`Resend rechazó la prueba: ${error.name} ${error.message}`);
  console.log(`Prueba aceptada por Resend: ${data?.id} → ${to}`);
}

async function enviar() {
  if (arg("confirmar") !== "ENVIAR") {
    throw new Error("Para enviar a colegios hay que pasar --confirmar=ENVIAR");
  }
  const limite = Number(arg("limite") ?? "25");
  const resend = resendClient();

  // Libera reservas abandonadas (un corte a mitad de envío).
  await prisma.schoolOutreachProspect.updateMany({
    where: { campaignKey: CAMPAIGN, status: "ENVIANDO", claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) }, sentAt: null },
    data: { status: "LISTO", claimedAt: null, lastAction: "Reserva vencida: vuelve a la cola", lastActionAt: new Date() },
  });

  const schools = await loadSchools(); // control CLF justo antes de enviar
  const cola = await prisma.schoolOutreachProspect.findMany({
    where: { campaignKey: CAMPAIGN, status: "LISTO" },
    orderBy: { id: "asc" },
    take: limite,
  });
  const resultado: Record<string, number> = { enviados: 0, fallidos: 0, reintentar: 0, bloqueados: 0 };

  for (const p of cola) {
    const now = new Date();
    const block = clfBlock(
      { groupKey: p.groupKey, ids: p.sourceIds, displayName: p.institutionName, locality: p.locality, email: p.email, clfSchoolIdAllowed: p.clfSchoolId },
      schools
    );
    const optOut = await prisma.schoolOutreachProspect.findFirst({
      where: { email: p.email, status: { in: [...BLOCKING_STATES] }, NOT: { id: p.id } },
      select: { id: true },
    });
    const yaEnviado = await prisma.schoolOutreachProspect.findFirst({
      where: { campaignKey: CAMPAIGN, email: p.email, sentAt: { not: null }, NOT: { id: p.id } },
      select: { id: true },
    });
    if (block || optOut || yaEnviado) {
      await prisma.schoolOutreachProspect.update({
        where: { id: p.id },
        data: {
          status: block ? "PENDIENTE_VALIDACION" : "NO_CONTACTAR",
          clfCheckedAt: now,
          lastAction: block?.reason ?? (optOut ? "Email dado de baja o rebotado" : "Email ya contactado en esta campaña"),
          lastActionAt: now,
        },
      });
      resultado.bloqueados++;
      continue;
    }

    // Reserva condicional: si otra corrida la tomó, no la manda dos veces.
    const claim = await prisma.schoolOutreachProspect.updateMany({
      where: { id: p.id, status: "LISTO" },
      data: { status: "ENVIANDO", claimedAt: now, clfCheckedAt: now, attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;

    const email = buildCampaignEmail({ institutionName: p.institutionName });
    let sendError: SendError | null = null;
    let providerId: string | undefined;
    try {
      const { data, error } = await resend.emails.send(
        {
          from: email.from,
          to: p.email,
          replyTo: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
          tags: [{ name: "campana", value: CAMPAIGN.replace(/[^a-zA-Z0-9_-]/g, "_") }],
        },
        { idempotencyKey: sendIdempotencyKey(CAMPAIGN, p.groupKey) }
      );
      if (error) sendError = { statusCode: error.statusCode, name: error.name, message: error.message };
      providerId = data?.id;
    } catch (e) {
      sendError = { statusCode: null, name: "network_error", message: e instanceof Error ? e.message : String(e) };
    }

    const after = new Date();
    if (!sendError && providerId) {
      await prisma.schoolOutreachProspect.update({
        where: { id: p.id },
        data: { status: "ENVIADO", providerMessageId: providerId, sentAt: after, lastError: null, lastAction: "Enviado (aceptado por Resend)", lastActionAt: after },
      });
      resultado.enviados++;
      console.log(`✓ ${p.institutionName} <${p.email}> ${providerId}`);
    } else {
      const decision = decideAfterFailure(sendError ?? {}, p.attempts + 1);
      await prisma.schoolOutreachProspect.update({
        where: { id: p.id },
        data: {
          status: decision.status,
          claimedAt: null,
          lastError: `${sendError?.name ?? "sin_id"}: ${sendError?.message ?? "Resend no devolvió id"}`.slice(0, 500),
          lastAction: decision.retry ? "Fallo transitorio: queda para reintentar" : "Fallo definitivo",
          lastActionAt: after,
        },
      });
      resultado[decision.retry ? "reintentar" : "fallidos"]++;
      console.log(`✗ ${p.institutionName} <${p.email}> ${sendError?.name}: ${sendError?.message}`);
    }
    await esperar(PAUSA_MS);
  }
  console.log(JSON.stringify(resultado));
}

async function estado() {
  const resend = resendClient();
  const enviados = await prisma.schoolOutreachProspect.findMany({
    where: { campaignKey: CAMPAIGN, status: "ENVIADO", providerMessageId: { not: null } },
  });
  for (const p of enviados) {
    const { data } = await resend.emails.get(p.providerMessageId!);
    const next = stateFromProviderEvent(data?.last_event);
    if (next) {
      await prisma.schoolOutreachProspect.update({
        where: { id: p.id },
        data: { status: next, lastAction: `Resend informa: ${data?.last_event}`, lastActionAt: new Date() },
      });
    }
    await esperar(250);
  }
  const resumen = await prisma.schoolOutreachProspect.groupBy({
    by: ["status"],
    where: { campaignKey: CAMPAIGN },
    _count: { _all: true },
  });
  const filas = await prisma.schoolOutreachProspect.findMany({
    where: { campaignKey: CAMPAIGN },
    orderBy: { id: "asc" },
    select: { groupKey: true, institutionName: true, email: true, status: true, sentAt: true, providerMessageId: true, lastAction: true, lastActionAt: true },
  });
  console.log(JSON.stringify({ campaña: CAMPAIGN, resumen, filas }, null, 2));
}

async function marcar(groupKey: string, status: string, nota?: string) {
  if (!isProspectState(status) || !["RESPONDIO", "NO_CONTACTAR", "LISTO", "PENDIENTE_VALIDACION"].includes(status)) {
    throw new Error("Estado permitido: RESPONDIO, NO_CONTACTAR, LISTO o PENDIENTE_VALIDACION");
  }
  const p = await prisma.schoolOutreachProspect.findUnique({
    where: { campaignKey_groupKey: { campaignKey: CAMPAIGN, groupKey } },
  });
  if (!p) throw new Error(`No existe ${groupKey}`);
  if (status === "LISTO" && (p.sentAt || BLOCKING_STATES.has(p.status as ProspectState))) {
    throw new Error("No se puede volver a LISTO un prospecto ya enviado, rebotado o dado de baja");
  }
  await prisma.schoolOutreachProspect.update({
    where: { id: p.id },
    data: { status, lastAction: nota ? `Marcado ${status}: ${nota}` : `Marcado ${status}`, lastActionAt: new Date() },
  });
  console.log(`${groupKey} → ${status}`);
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
  switch (cmd) {
    case "importar":
      if (!a) throw new Error("Falta el archivo de prospectos");
      return importar(a);
    case "vista-previa":
      return vistaPrevia(a);
    case "prueba":
      if (!a) throw new Error("Falta el email de prueba");
      return prueba(a, b);
    case "enviar":
      return enviar();
    case "estado":
      return estado();
    case "marcar":
      if (!a || !b) throw new Error("Uso: marcar <groupKey> <estado> [nota]");
      return marcar(a, b, c);
    default:
      throw new Error("Comandos: importar | vista-previa | prueba | enviar | estado | marcar");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
