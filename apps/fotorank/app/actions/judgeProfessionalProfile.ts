"use server";

import { revalidatePath } from "next/cache";
import {
  prisma,
  type FotorankJudgeCompensationMode,
  type FotorankJudgePriceUnit,
  type FotorankJudgePricingMode,
} from "@repo/db";
import { requireJudgeAuth } from "../lib/judge-auth";
import { normalizarInstagram, normalizarUrl } from "../lib/fotorank/judges/publicSignupForm";
import { otrosLinksATexto, parsearOtrosLinks } from "../lib/fotorank/judges/otherLinks";
import { deleteJudgeAvatarByKey, saveJudgeAvatar } from "../lib/fotorank/judges/judgeAssetStorage";
import { judgeAvatarSrc } from "../lib/fotorank/judges/judgeAvatarSrc";

export type ProfileActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const COMP_MODES = new Set<FotorankJudgeCompensationMode>(["VOLUNTEER", "PAID", "BOTH"]);
const PRICE_MODES = new Set<FotorankJudgePricingMode>(["FIXED", "STARTING_AT", "NEGOTIABLE", "NOT_SHOWN"]);
const PRICE_UNITS = new Set<FotorankJudgePriceUnit>(["PER_CONTEST", "PER_CATEGORY", "PER_HOUR", "CUSTOM"]);

function parseList(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function judgeGetProfessionalProfileForEditAction(): Promise<
  ProfileActionResult<Record<string, unknown>>
> {
  const judge = await requireJudgeAuth();
  const profile = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
  });
  if (!profile) return { ok: false, error: "No se encontró tu perfil. Contactá soporte." };
  return {
    ok: true,
    data: {
      ...profile,
      specialtiesText: Array.isArray(profile.specialtiesJson)
        ? (profile.specialtiesJson as string[]).join(", ")
        : "",
      languagesText: Array.isArray(profile.languagesJson) ? (profile.languagesJson as string[]).join(", ") : "",
      otherLinksText: otrosLinksATexto(profile.otherLinksJson),
    },
  };
}

export async function judgeUpdateProfessionalProfileAction(input: {
  displayNameOverride?: string | null;
  professionalHeadline?: string | null;
  shortBio?: string | null;
  specialtiesText?: string;
  experienceYears?: number | null;
  languagesText?: string;
  region?: string | null;
  city?: string | null;
  country?: string | null;
  portfolioUrl?: string | null;
  website?: string | null;
  instagram?: string | null;
  otherLinksText?: string;
  phone?: string | null;
  isAvailableForJuryWork?: boolean;
  availabilityNotes?: string | null;
  availableRemote?: boolean;
  availableInPerson?: boolean;
  preferredContestScopes?: string | null;
  compensationMode?: string;
  pricingMode?: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  priceNotes?: string | null;
  priceUnit?: string | null;
  isListedInProfessionalDirectory?: boolean;
  showPricingPublicly?: boolean;
  showLocationPublicly?: boolean;
  showWebsitePublicly?: boolean;
  showInstagramPublicly?: boolean;
}): Promise<ProfileActionResult> {
  const judge = await requireJudgeAuth();

  const cm = (input.compensationMode ?? "VOLUNTEER") as FotorankJudgeCompensationMode;
  const pm = (input.pricingMode ?? "NOT_SHOWN") as FotorankJudgePricingMode;
  if (!COMP_MODES.has(cm)) return { ok: false, error: "Modalidad de compensación no válida." };
  if (!PRICE_MODES.has(pm)) return { ok: false, error: "Modalidad de precio no válida." };

  let pu: FotorankJudgePriceUnit | null = null;
  if (input.priceUnit?.trim()) {
    if (!PRICE_UNITS.has(input.priceUnit as FotorankJudgePriceUnit)) {
      return { ok: false, error: "Unidad de precio no válida." };
    }
    pu = input.priceUnit as FotorankJudgePriceUnit;
  }

  const specialtiesJson = parseList(input.specialtiesText ?? "");
  const languagesJson = parseList(input.languagesText ?? "");

  await prisma.fotorankJudgeProfile.update({
    where: { judgeAccountId: judge.id },
    data: {
      displayNameOverride: input.displayNameOverride?.trim() || null,
      professionalHeadline: input.professionalHeadline?.trim() || null,
      shortBio: input.shortBio?.trim() || null,
      specialtiesJson: specialtiesJson,
      experienceYears: input.experienceYears != null ? Math.max(0, Math.min(80, input.experienceYears)) : null,
      languagesJson: languagesJson,
      region: input.region?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || null,
      portfolioUrl: input.portfolioUrl ? normalizarUrl(input.portfolioUrl) : null,
      website: input.website ? normalizarUrl(input.website) : null,
      instagram: input.instagram ? normalizarInstagram(input.instagram) : null,
      otherLinksJson: parsearOtrosLinks(input.otherLinksText ?? ""),
      // El teléfono no sale nunca al público: lo ven sólo los organizadores.
      phone: input.phone?.trim() || null,
      isAvailableForJuryWork: input.isAvailableForJuryWork ?? true,
      availabilityNotes: input.availabilityNotes?.trim() || null,
      availableRemote: input.availableRemote ?? true,
      availableInPerson: input.availableInPerson ?? false,
      preferredContestScopes: input.preferredContestScopes?.trim() || null,
      compensationMode: cm,
      pricingMode: pm,
      priceAmount: input.priceAmount != null && Number.isFinite(input.priceAmount) ? input.priceAmount : null,
      priceCurrency: input.priceCurrency?.trim() || null,
      priceNotes: input.priceNotes?.trim() || null,
      priceUnit: pu,
      // Lo que el jurado PIDE. Lo que está publicado lo escribe la aprobación de
      // DNX: el directorio es común a toda la plataforma y nadie se publica solo.
      wantsDirectoryListing: input.isListedInProfessionalDirectory ?? false,
      showPricingPublicly: input.showPricingPublicly ?? false,
      showLocationPublicly: input.showLocationPublicly ?? true,
      showWebsitePublicly: input.showWebsitePublicly ?? true,
      showInstagramPublicly: input.showInstagramPublicly ?? true,
    },
  });

  const pub = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
    select: { publicSlug: true },
  });
  if (pub?.publicSlug) revalidatePath(`/jurados/publico/${pub.publicSlug}`);
  revalidatePath("/jurado/perfil");
  revalidatePath("/jurados/directorio");
  return { ok: true };
}

export async function judgeUploadOwnAvatarAction(
  formData: FormData,
): Promise<ProfileActionResult<{ src: string }>> {
  const judge = await requireJudgeAuth();

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  const f = file as File;
  const body = new Uint8Array(await f.arrayBuffer());

  const saved = await saveJudgeAvatar({ judgeAccountId: judge.id, body, mime: f.type || "" });
  if (!saved.ok) return { ok: false, error: saved.error };

  const anterior = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
    select: { id: true, avatarUrl: true, publicSlug: true },
  });
  if (!anterior) return { ok: false, error: "No se encontró tu perfil. Contactá soporte." };

  await prisma.fotorankJudgeProfile.update({
    where: { judgeAccountId: judge.id },
    data: { avatarUrl: saved.key },
  });

  // La anterior se borra DESPUÉS de guardar la nueva: si el borrado falla, el
  // perfil ya tiene foto igual.
  if (anterior.avatarUrl && anterior.avatarUrl !== saved.key) {
    await deleteJudgeAvatarByKey(anterior.avatarUrl);
  }

  revalidatePath("/jurado/perfil");
  if (anterior.publicSlug) revalidatePath(`/jurados/publico/${anterior.publicSlug}`);
  revalidatePath("/jurados/directorio");

  return { ok: true, data: { src: judgeAvatarSrc({ id: anterior.id, avatarUrl: saved.key }) ?? "" } };
}

export async function judgeRemoveOwnAvatarAction(): Promise<ProfileActionResult> {
  const judge = await requireJudgeAuth();

  const actual = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
    select: { avatarUrl: true, publicSlug: true },
  });
  if (!actual) return { ok: false, error: "No se encontró tu perfil. Contactá soporte." };

  await prisma.fotorankJudgeProfile.update({
    where: { judgeAccountId: judge.id },
    data: { avatarUrl: null },
  });
  if (actual.avatarUrl) await deleteJudgeAvatarByKey(actual.avatarUrl);

  revalidatePath("/jurado/perfil");
  if (actual.publicSlug) revalidatePath(`/jurados/publico/${actual.publicSlug}`);
  revalidatePath("/jurados/directorio");

  return { ok: true };
}
