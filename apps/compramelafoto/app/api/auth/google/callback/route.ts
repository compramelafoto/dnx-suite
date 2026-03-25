import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookieOnResponse } from "@/lib/auth";
import { Role, LabApprovalStatus, TokenPurpose } from "@prisma/client";
import { DEFAULT_LAB_PRODUCTS } from "@/lib/default-lab-products";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBaseUrl(originFromRequest: string): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    originFromRequest ||
    "http://localhost:3000"
  );
}

function resolveGoogleRedirectUri(baseUrl: string): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${baseUrl}/api/auth/google/callback`;
}

/**
 * Callback de Google OAuth
 * Recibe el código de autorización y crea/inicia sesión del usuario
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state") || "PHOTOGRAPHER"; // Recuperar el rol desde el state
    const origin = new URL(req.url).origin;
    const baseUrl = resolveBaseUrl(origin);

    const isAuto = state === "AUTO";

    // Determinar el rol y la página de redirección según el state
    let role: "PHOTOGRAPHER" | "CUSTOMER" | "LAB" | "ORGANIZER" = "PHOTOGRAPHER";
    let loginPath = isAuto ? "/login" : "/fotografo/login";
    let redirectPath = "/fotografo/dashboard";

    if (state === "CUSTOMER" || state === "CLIENT") {
      role = "CUSTOMER";
      loginPath = "/cliente/login";
      redirectPath = "/cliente/dashboard";
    } else if (state === "LAB") {
      role = "LAB";
      loginPath = "/lab/login";
      redirectPath = "/lab/dashboard";
    } else if (state === "ORGANIZER") {
      role = "ORGANIZER";
      loginPath = "/login";
      redirectPath = "/";
    }

    const resolveRedirectPath = (userRole: Role) => {
      if (userRole === Role.CUSTOMER) return "/cliente/dashboard";
      if (userRole === Role.LAB || userRole === Role.LAB_PHOTOGRAPHER) return "/lab/dashboard";
      if (userRole === Role.ORGANIZER) return "/organizador/dashboard";
      return "/fotografo/dashboard";
    };

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Error al autenticar con Google")}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Código de autorización no recibido")}`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = resolveGoogleRedirectUri(baseUrl);

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Configuración de Google OAuth incompleta")}`
      );
    }

    // 1. Intercambiar código por token de acceso
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token error:", tokenData);
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Error al obtener token de Google")}`
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Obtener información del usuario de Google
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const googleUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error("User info error:", googleUser);
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Error al obtener información del usuario")}`
      );
    }

    const { email, name, picture, id: googleId } = googleUser;

    if (!email) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Email no disponible en cuenta de Google")}`
      );
    }

    // 3. Buscar usuario existente
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    let isNewUser = false;

    if (!user) {
      if (isAuto) {
        return NextResponse.redirect(
          `${baseUrl}/registro?error=${encodeURIComponent("Seleccioná el tipo de cuenta para continuar con Google")}`
        );
      }
      // Crear usuario nuevo desde Google
      if (role === "LAB") {
        const labName = name?.toString().trim() || email.split("@")[0];
        const result = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: email.toLowerCase(),
              name: labName,
              role: Role.LAB,
              googleId: googleId || null,
            },
          });

          const lab = await tx.lab.create({
            data: {
              name: labName,
              email: email.toLowerCase(),
              userId: newUser.id,
              approvalStatus: LabApprovalStatus.APPROVED,
              isActive: true,
            },
          });

          // Crear productos por defecto
          const productsToCreate = DEFAULT_LAB_PRODUCTS.map((product) => ({
            labId: lab.id,
            name: product.name,
            size: product.size || null,
            acabado: product.acabado || null,
            photographerPrice: product.photographerPrice,
            retailPrice: product.retailPrice,
            currency: product.currency,
            isActive: product.isActive,
          }));

          if (productsToCreate.length > 0) {
            await tx.labProduct.createMany({ data: productsToCreate });
          }

          return newUser;
        });
        user = result;
        isNewUser = true;
      } else {
        const userRole =
          role === "CUSTOMER"
            ? Role.CUSTOMER
            : role === "ORGANIZER"
              ? Role.ORGANIZER
              : Role.PHOTOGRAPHER;
        const newUser = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name: name?.toString().trim() || null,
            role: userRole,
            googleId: googleId || null,
          },
        });
        user = newUser;
        isNewUser = true;
      }
    }

    // Actualizar googleId si no lo tiene
    if (!user.googleId && googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleId },
      });
    }

    if (isNewUser) {
      const verifyToken = randomBytes(32).toString("hex");
      const verifyExpires = new Date();
      verifyExpires.setHours(verifyExpires.getHours() + 24);
      const verifyUrl = `${resolveBaseUrl(baseUrl)}/verify-email?token=${verifyToken}`;

      await prisma.emailVerificationToken.create({
        data: {
          email: user.email,
          token: hashToken(verifyToken),
          purpose: TokenPurpose.VERIFY_EMAIL,
          expiresAt: verifyExpires,
        },
      });

      try {
        const { subject, html } = buildVerifyEmail({
          firstName: user.name || undefined,
          verifyUrl,
        });
        await sendEmail({
          to: user.email,
          subject,
          html,
          templateKey: "AUTH01_VERIFY_EMAIL",
          meta: { userId: user.id },
        });
      } catch (emailErr) {
        console.error("GOOGLE CALLBACK: error enviando verificación", emailErr);
      }
    }

    const allowedRolesByState: Record<string, Role[]> = {
      PHOTOGRAPHER: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER],
      CUSTOMER: [Role.CUSTOMER],
      CLIENT: [Role.CUSTOMER],
      LAB: [Role.LAB, Role.LAB_PHOTOGRAPHER],
      ORGANIZER: [Role.ORGANIZER],
      AUTO: [Role.PHOTOGRAPHER, Role.CUSTOMER, Role.LAB, Role.LAB_PHOTOGRAPHER, Role.ORGANIZER],
    };
    const allowedRoles = allowedRolesByState[state] || allowedRolesByState.PHOTOGRAPHER;

    // Verificar que el rol coincida; si no, redirigir al destino correcto por su rol real (mejor UX)
    if (!allowedRoles.includes(user.role)) {
      redirectPath = resolveRedirectPath(user.role);
    }

    // 4. URL de redirección con datos del usuario en query params (para sessionStorage en cliente)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    if (isAuto) {
      redirectPath = resolveRedirectPath(user.role);
    }

    const redirectUrl = new URL(`${baseUrl}${redirectPath}`);
    redirectUrl.searchParams.set("user", JSON.stringify(userData));

    // 5. Redirigir y poner la cookie EN LA MISMA respuesta (crítico para que el navegador la reciba)
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const response = NextResponse.redirect(redirectUrl.toString());
    // Legacy auth-token + DNX UserSession / dnx_session (+ Set-Cookie duplicados en headers si aplica)
    await setAuthCookieOnResponse(response, authUser);
    return response;
  } catch (err: any) {
    console.error("GOOGLE CALLBACK ERROR >>>", err);
    // Por defecto redirigir a login de fotógrafo si no se puede determinar el rol
    const loginPath = "/fotografo/login";
    const baseUrl = resolveBaseUrl(new URL(req.url).origin);
    return NextResponse.redirect(
      `${baseUrl}${loginPath}?error=${encodeURIComponent("Error en el callback de Google")}`
    );
  }
}
