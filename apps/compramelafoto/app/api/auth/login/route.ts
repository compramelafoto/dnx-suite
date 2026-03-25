import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookieOnResponse } from "@/lib/auth";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { sendEmail } from "@/emails/send";
import { buildLoginAlertEmail } from "@/emails/templates/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Buscar usuario
    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          password: true,
          tags: true,
        },
      });
    } catch (userErr) {
      console.warn("LOGIN: error leyendo usuario, usando fallback", userErr);
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          password: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Verificar contraseña
    if (!user.password) {
      return NextResponse.json(
        { error: "Usuario sin contraseña configurada" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ip = (forwardedFor.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
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

    // REGLA 8: Permitir login aunque no esté APPROVED, pero devolver información de bloqueos
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

    // Retornar usuario (sin password) con información de bloqueos
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

    // Cookie en la misma respuesta para que el navegador la reciba (legacy + DNX)
    await setAuthCookieOnResponse(response, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      labId,
    });

    return response;
  } catch (err: any) {
    console.error("LOGIN ERROR >>>", err);
    return NextResponse.json(
      { error: "Error en el login", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
