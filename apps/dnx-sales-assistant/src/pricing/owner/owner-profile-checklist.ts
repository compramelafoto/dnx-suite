import { loadOwnerIdentityConfig, maskOwnerEmail } from "./owner-identity.js";
import { resolveOwnerPricingProfile } from "./resolve-owner-pricing-profile.js";

export function buildOwnerProfileChecklist(env: NodeJS.ProcessEnv = process.env): {
  exitCode: number;
  lines: string[];
  verdict: "A" | "B" | "C" | "D";
} {
  const identity = loadOwnerIdentityConfig(env);
  const lines: string[] = ["DNX owner-profile:checklist", ""];

  const tgOk =
    Boolean(identity.telegramOwnerUserId) &&
    Boolean(identity.telegramOwnerChatId);
  const emailOk = Boolean(identity.ownerEmail);

  lines.push(
    `Identidad Telegram: ${tgOk ? "OK" : "FALTA (OWNER_USER_ID / OWNER_CHAT_ID)"}`,
  );
  lines.push(
    `Correo propietario: ${emailOk ? `OK (${maskOwnerEmail(identity.ownerEmail)})` : "FALTA"}`,
  );

  if (!tgOk || !emailOk) {
    lines.push("Perfil económico de Dani: NO CONFIGURADO (identidad incompleta)");
    lines.push("");
    lines.push(
      "La autorización para utilizar el bot de Telegram no determina por sí sola qué perfil económico debe utilizar Cuánto Cobro.",
    );
    return { exitCode: 1, lines, verdict: "C" };
  }

  const resolved = resolveOwnerPricingProfile(
    {
      channel: "TELEGRAM",
      telegramUserId: identity.telegramOwnerUserId,
      telegramChatId: identity.telegramOwnerChatId,
      ownerEmail: identity.ownerEmail,
    },
    identity,
  );

  if (resolved.status === "READY") {
    lines.push("Perfil base: OK");
    lines.push("Plantillas de servicios: OK");
    lines.push(`Fuente: ${resolved.source}`);
    lines.push(`Profile ID: ${resolved.profile.id}`);
    lines.push("");
    lines.push("Veredicto: A — El perfil real existe y puede cargarse de forma segura.");
    return { exitCode: 0, lines, verdict: "A" };
  }

  if (resolved.status === "INCOMPLETE") {
    lines.push("Perfil base: INCOMPLETO");
    lines.push(`Motivo: ${resolved.reason}`);
    lines.push("Campos/áreas:");
    for (const m of resolved.missingFields.slice(0, 15)) {
      lines.push(`  - ${m}`);
    }
    lines.push("");
    lines.push(
      "Veredicto: D — Existe información parcial y requiere completar configuración.",
    );
    return { exitCode: 1, lines, verdict: "D" };
  }

  if (resolved.status === "SYNTHETIC_BLOCKED") {
    lines.push("Perfil base: BLOQUEADO (sintético)");
    lines.push(resolved.reason);
    lines.push("");
    lines.push(
      "Veredicto: C — No existe identidad ni perfil utilizable (sintético inválido).",
    );
    return { exitCode: 1, lines, verdict: "C" };
  }

  lines.push("Perfil base: FALTA");
  lines.push("Plantillas de servicios: FALTAN o no listas");
  lines.push("Gastos profesionales: FALTAN (archivo .local)");
  lines.push("Equipo: FALTA");
  lines.push("Disponibilidad anual: FALTA");
  lines.push("Factor comercial: FALTA");
  lines.push("Moneda: FALTA");
  lines.push(`Detalle: ${resolved.reason}`);
  lines.push("");
  lines.push(
    "Archivos esperados (ejemplo): config/pricing/owners/dnxfotografia.local.json",
  );
  lines.push("                           config/pricing/dnx-service-templates.local.json");
  lines.push("");
  lines.push(
    "Veredicto: B — Existe identidad propietaria, pero no existe un perfil económico completo utilizable.",
  );
  lines.push(
    "(Puede existir un User en seed del monorepo; eso no carga un perfil de Cuánto Cobro aquí.)",
  );

  return { exitCode: 1, lines, verdict: "B" };
}

export function runOwnerProfileValidate(
  env: NodeJS.ProcessEnv = process.env,
): { exitCode: number; lines: string[] } {
  const checklist = buildOwnerProfileChecklist(env);
  const lines = ["DNX owner-profile:validate", ...checklist.lines.slice(1)];
  if (checklist.verdict === "A") {
    lines.push("Resultado: OK");
  } else {
    lines.push("Resultado: NO LISTO");
  }
  return { exitCode: checklist.exitCode, lines };
}
