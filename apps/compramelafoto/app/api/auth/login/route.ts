import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookieOnResponse } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { normalizeIdentityEmail, verifyUserPassword } from "@repo/auth";
import { createHash, randomUUID } from "crypto";
import { sendEmail } from "@/emails/send";
import { buildLoginAlertEmail } from "@/emails/templates/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  console.log("[auth_timing] login_start", { requestId, ts: startedAt });
  try {
    const bodyValidationStart = Date.now();
    const body = await req.json().catch(() => ({}));
    const emailRaw = (body.email ?? "").toString();
    const password = (body.password ?? "").toString();
    const normalized = normalizeIdentityEmail(emailRaw);
    const email = normalized.ok ? normalized.email : "";
    console.log("[auth_timing] login_stage", {
      requestId,
      stage: "body_validation_done",
      durationMs: Date.now() - bodyValidationStart,
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
    });

    if (!email || !password) {
      console.log("[auth_timing] login_done", {
        requestId,
        durationMs: Date.now() - startedAt,
        status: 400,
        reason: "missing_credentials",
      });
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Identidad central DNX: scrypt canónico + bcrypt legacy + rehash progresivo
    const passwordCompareStart = Date.now();
    const verified = await verifyUserPassword({ email, password });
    console.log("[auth_timing] login_stage", {
      requestId,
      stage: "password_compare_done",
      durationMs: Date.now() - passwordCompareStart,
      isValid: verified.ok,
      rehashed: verified.ok ? verified.rehashed : false,
      userId: verified.ok ? verified.user.id : undefined,
    });

    if (!verified.ok) {
      const status = 401;
      const reason =
        verified.reason === "NO_PASSWORD"
          ? "missing_password_hash"
          : verified.reason === "NOT_FOUND"
            ? "user_not_found"
            : "invalid_password";
      console.log("[auth_timing] login_done", {
        requestId,
        durationMs: Date.now() - startedAt,
        status,
        reason,
      });
      if (verified.reason === "NO_PASSWORD") {
        return NextResponse.json(
          { error: "Usuario sin contraseña configurada" },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 },
      );
    }

    const userLookupStart = Date.now();
    let user: {
      id: number;
      email: string;
      name: string | null;
      role: string;
      tags?: string[];
    } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: verified.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tags: true,
        },
      });
    } catch (userErr) {
      console.warn("LOGIN: error leyendo usuario, usando fallback", userErr);
      user = {
        id: verified.user.id,
        email: verified.user.email,
        name: verified.user.name,
        role: verified.user.role,
      };
    }
    console.log("[auth_timing] login_stage", {
      requestId,
      stage: "user_lookup_done",
      durationMs: Date.now() - userLookupStart,
      userFound: Boolean(user),
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 },
      );
    }

    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ip = (forwardedFor.split(",")[0] || req.headers.get("x-real-ip") || "").trim();

    // REGLA 8: Permitir login aunque no esté APPROVED, pero devolver información de bloqueos
    const roleChecksStart = Date.now();
    let labId: number | undefined;
    let labApprovalStatus: string | undefined;
    let labMpConnected: boolean = false;
    let labNeedsTerms: boolean = false;
    
    if (user.role === Role.LAB || user.role === Role.LAB_PHOTOGRAPHER) {
      let lab: any = null;
      try {
        lab = await prisma.lab.findUnique({
          where: { userId: user.id },
          select: { 
            id: true, 
            approvalStatus: true,
            mpConnectedAt: true,
            mpAccessToken: true,
            mpUserId: true,
          },
        });
      } catch (labErr) {
        console.warn("LOGIN: error leyendo lab, usando fallback", labErr);
        lab = await prisma.lab.findUnique({
          where: { userId: user.id },
          select: { id: true, approvalStatus: true },
        });
      }
      
      if (lab) {
        labId = lab.id; // SIEMPRE devolver labId aunque no esté aprobado
        labApprovalStatus = lab.approvalStatus;
        // Verificar conexión MP
        labMpConnected = !!(lab.mpConnectedAt && lab.mpAccessToken && lab.mpUserId);
      }
    }

    // REGLA 2: Verificar T&C para LAB y PHOTOGRAPHER
    let needsTermsAcceptance = false;
    let termsVersion: string | null = null;
    
    if (user.role === Role.LAB || user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.PHOTOGRAPHER) {
      try {
        // Obtener versión activa de términos para el rol
        const activeTermsDoc = await prisma.termsDocument.findFirst({
          where: {
            role: user.role === Role.LAB_PHOTOGRAPHER ? Role.LAB : user.role,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
        });

        if (activeTermsDoc) {
          termsVersion = activeTermsDoc.version;
          
          // Verificar si el usuario aceptó esta versión
          const acceptance = await prisma.termsAcceptance.findFirst({
            where: {
              userId: user.id,
              role: user.role === Role.LAB_PHOTOGRAPHER ? Role.LAB : user.role,
              termsVersion: activeTermsDoc.version,
            },
          });

          if (!acceptance) {
            needsTermsAcceptance = true;
          }
        }
      } catch (err) {
        // Si las tablas no existen aún, continuar sin bloquear
        console.warn("Error verificando términos:", err);
      }
    }
    console.log("[auth_timing] login_stage", {
      requestId,
      stage: "role_checks_done",
      durationMs: Date.now() - roleChecksStart,
      userId: user.id,
      role: user.role,
    });

    // Retornar usuario (sin password) con información de bloqueos
    const responseBuildStart = Date.now();
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          ...(labId && { labId }),
        },
        // Información de bloqueos y requisitos
        ...(labId && {
          labStatus: {
            approvalStatus: labApprovalStatus,
            canOperate: labMpConnected && !needsTermsAcceptance,
            needsMpConnection: !labMpConnected,
            needsTermsAcceptance,
            termsVersion,
          },
        }),
        ...((user.role === Role.PHOTOGRAPHER || user.role === Role.LAB_PHOTOGRAPHER) && {
          photographerStatus: {
            needsTermsAcceptance,
            termsVersion,
          },
        }),
      },
      { status: 200 }
    );
    console.log("[auth_timing] login_stage", {
      requestId,
      stage: "response_build_done",
      durationMs: Date.now() - responseBuildStart,
      userId: user.id,
    });

    // Cookie canónica dnx_session (sin fallback auth-token — ETAPA 03 / P0-06)
    const cookieStart = Date.now();
    try {
      await setAuthCookieOnResponse(response, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        labId,
      });
    } catch (sessionErr) {
      console.error("[auth_timing] login_session_failed", {
        requestId,
        userId: user.id,
        error: String(sessionErr),
      });
      return NextResponse.json(
        { error: "No se pudo crear la sesión. Intentá de nuevo." },
        { status: 503 },
      );
    }
    console.log("[auth_timing] login_stage", {
      requestId,
      stage: "cookie_set_done",
      durationMs: Date.now() - cookieStart,
      userId: user.id,
    });

    // No bloquear el login con tareas secundarias (emails/logs/auditoría).
    void (async () => {
      const deviceHash = createHash("sha256")
        .update(`${userAgent}|${ip}`)
        .digest("hex");
      const ipHash = createHash("sha256").update(ip || "unknown").digest("hex");

      const loginDeviceModel = (prisma as any).userLoginDevice;
      let existingDevice = null;
      if (loginDeviceModel?.findUnique) {
        try {
          existingDevice = await loginDeviceModel.findUnique({
            where: {
              userId_deviceHash: {
                userId: user.id,
                deviceHash,
              },
            },
          });

          if (existingDevice) {
            await loginDeviceModel.update({
              where: { id: existingDevice.id },
              data: { lastSeenAt: new Date() },
            });
          } else {
            await loginDeviceModel.create({
              data: {
                userId: user.id,
                deviceHash,
                ipHash,
                userAgent: userAgent || null,
                lastSeenAt: new Date(),
              },
            });
          }
        } catch (deviceErr) {
          console.warn("LOGIN ALERT: error registrando dispositivo", deviceErr);
          existingDevice = null;
        }
      }

      const shouldSendLoginAlert = !existingDevice || (user.tags || []).includes("SECURITY_ALERTS");
      if (shouldSendLoginAlert) {
        try {
          const { subject, html } = buildLoginAlertEmail({
            firstName: user.name || undefined,
            deviceLabel: userAgent || undefined,
            ip: ip || undefined,
            when: new Date().toLocaleString("es-AR"),
          });
          await sendEmail({
            to: user.email,
            subject,
            html,
            templateKey: "AUTH04_LOGIN_ALERT",
            meta: { userId: user.id },
          });
        } catch (emailErr) {
          console.error("LOGIN ALERT: error enviando aviso", emailErr);
        }
      }

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (updateErr) {
        console.warn("LOGIN: error actualizando lastLoginAt", updateErr);
      }
    })();

    console.log("[auth_timing] login_done", {
      requestId,
      durationMs: Date.now() - startedAt,
      status: 200,
      userId: user.id,
      role: user.role,
    });
    return response;
  } catch (err: any) {
    console.error("[auth_timing] login_error", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: String(err?.message ?? err),
    });
    console.error("LOGIN ERROR >>>", err);
    return NextResponse.json(
      { error: "Error en el login", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
