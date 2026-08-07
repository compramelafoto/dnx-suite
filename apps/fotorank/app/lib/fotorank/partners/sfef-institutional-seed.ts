import { prisma } from "@repo/db";
import {
  type DnxPartnerInstitutionalRole,
  type PartnerActor,
  type PartnerRecord,
  type ParticipationRecord,
} from "@repo/partners";
import { getFotorankPartnersService } from "./runtime";
import { ensureContestExists } from "./contest-partners-service";

/**
 * Seed institucional Santa Fe en Foco (Imp 05).
 *
 * Fuente config oficial (`santa-fe-en-foco-2026.ts`): ambos aparecen como
 * `role: "organizador"`. Imp 05 pide diferenciar:
 * - SFPR → ORGANIZER
 * - Cámara de Senadores → CO_ORGANIZER
 * Landing: "Organizan" + "Coorganizan". No se infiere por aportes monetarios.
 */

const SFEF_ORGANIZERS = [
  {
    slug: "sfpr",
    name: "Sociedad de Fotógrafos Profesionales de Rosario",
    legalName: "Sociedad de Fotógrafos Profesionales de Rosario",
    institutionalRole: "ORGANIZER" as DnxPartnerInstitutionalRole,
    title: "Organizador",
    displayOrder: 10,
  },
  {
    slug: "camara-senadores-santa-fe",
    name: "Cámara de Senadores de la Provincia de Santa Fe",
    legalName: "Cámara de Senadores de la Provincia de Santa Fe",
    institutionalRole: "CO_ORGANIZER" as DnxPartnerInstitutionalRole,
    title: "Coorganizador",
    displayOrder: 20,
  },
] as const;

export type SfefInstitutionalSeedResult = {
  contestId: string;
  partners: Array<{
    partnerId: string;
    slug: string;
    created: boolean;
    participationId: string;
    participationCreated: boolean;
    institutionalRole: DnxPartnerInstitutionalRole;
  }>;
};

/**
 * Idempotente: asegura partners SFPR + Senadores y participaciones
 * en application=FOTO_RANK / contextType=CONTEST / contextId=contestId.
 */
export async function ensureSfefInstitutionalPartnersForContest(
  actor: PartnerActor,
  contestId: string,
): Promise<SfefInstitutionalSeedResult> {
  await ensureContestExists(contestId);
  const svc = getFotorankPartnersService();
  const out: SfefInstitutionalSeedResult = { contestId, partners: [] };

  for (const org of SFEF_ORGANIZERS) {
    // Prisma row puede tener más columnas que PartnerRecord; tipamos al contrato del servicio.
    let partner = (await prisma.dnxPartner.findUnique({
      where: { slug: org.slug },
    })) as PartnerRecord | null;
    let created = false;
    if (!partner) {
      partner = await svc.createPartner(actor, {
        name: org.name,
        legalName: org.legalName,
        slug: org.slug,
        type: "INSTITUTION",
        status: "ACTIVE",
      });
      created = true;
    } else if (partner.status === "ARCHIVED" || partner.status === "PROSPECT") {
      partner = await svc.updatePartner(actor, partner.id, {
        status: "ACTIVE",
        name: org.name,
        legalName: org.legalName,
      });
    }

    const existing = (await prisma.dnxPartnerParticipation.findMany({
      where: {
        partnerId: partner.id,
        application: "FOTO_RANK",
        contextType: "CONTEST",
        contextId: contestId,
        archivedAt: null,
        status: { notIn: ["ARCHIVED", "CANCELLED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    })) as ParticipationRecord[];

    let participationId: string;
    let participationCreated = false;

    if (existing[0]) {
      participationId = existing[0].id;
      await svc.updateParticipation(actor, participationId, {
        institutionalRole: org.institutionalRole,
        displayTier: "INSTITUTIONAL",
        displayOrder: org.displayOrder,
        title: org.title,
        status:
          existing[0].status === "ACTIVE" || existing[0].status === "CONFIRMED"
            ? existing[0].status
            : "CONFIRMED",
        requiresPayment: false,
        paymentMode: "NONE",
      });
    } else {
      const createdParticipation = await svc.createParticipation(actor, {
        partnerId: partner.id,
        application: "FOTO_RANK",
        contextType: "CONTEST",
        contextId: contestId,
        participationType: "INSTITUTIONAL_PARTNER",
        institutionalRole: org.institutionalRole,
        displayTier: "INSTITUTIONAL",
        displayOrder: org.displayOrder,
        publicRoleLabel: null,
        status: "CONFIRMED",
        requiresPayment: false,
        paymentMode: "NONE",
        title: org.title,
        allowDuplicateActive: false,
      });
      participationId = createdParticipation.participation.id;
      participationCreated = true;
    }

    out.partners.push({
      partnerId: partner.id,
      slug: org.slug,
      created,
      participationId,
      participationCreated,
      institutionalRole: org.institutionalRole,
    });
  }

  return out;
}
