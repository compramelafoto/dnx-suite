import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookieOnResponse } from "@/lib/auth";
import { Role, LabApprovalStatus, TokenPurpose } from "@/lib/prisma";
import { DEFAULT_LAB_PRODUCTS } from "@/lib/default-lab-products";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";
import { getPostLoginDestination } from "@/lib/auth/post-login-destination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback de Google OAuth
 * Recibe el c?digo de autorizaci?n y crea/inicia sesi?n del usuario
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const rawState = searchParams.get("state") || "PHOTOGRAPHER";
    const origin = new URL(req.url).origin;
    const baseUrl = origin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const isCuantoCobroFlow = rawState.startsWith("CC:");
    const cuantoCobroRedirect = isCuantoCobroFlow ? rawState.slice(3) : null;
    const state = isCuantoCobroFlow ? "PHOTOGRAPHER" : rawState;

    const isAuto = state === "AUTO";

    // Determinar el rol y la p?gina de redirecci?n seg?n el state
    let role: "PHOTOGRAPHER" | "CUSTOMER" | "LAB" | "ORGANIZER" = "PHOTOGRAPHER";
    let loginPath = isAuto ? "/login" : "/fotografo/login";
    let redirectPath = "/fotografo/dashboard";

    if (isCuantoCobroFlow && cuantoCobroRedirect?.startsWith("/")) {
      loginPath = "/cuantocobro/login";
      redirectPath = cuantoCobroRedirect;
      role = "PHOTOGRAPHER";
    } else if (state === "CUSTOMER" || state === "CLIENT") {
      role = "CUSTOMER";
      loginPath = "/cliente/login";
      redirectPath = getPostLoginDestination("CUSTOMER");
    } else if (state === "LAB") {
      role = "LAB";
      loginPath = "/lab/login";
      redirectPath = getPostLoginDestination("LAB");
    } else if (state === "ORGANIZER") {
      role = "ORGANIZER";
      loginPath = "/login";
      redirectPath = getPostLoginDestination("ORGANIZER");
    } else {
      redirectPath = getPostLoginDestination("PHOTOGRAPHER");
    }

    const resolveRedirectPath = (userRole: Role) => getPostLoginDestination(userRole);

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Error al autenticar con Google")}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("C?digo de autorizaci?n no recibido")}`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Configuraci?n de Google OAuth incompleta")}`
      );
    }

    // 1. Intercambiar c?digo por token de acceso
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

    // 2. Obtener informaci?n del usuario de Google
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const googleUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error("User info error:", googleUser);
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("Error al obtener informaci?n del usuario")}`
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
          `${baseUrl}/registro?error=${encodeURIComponent("Seleccion? el tipo de cuenta para continuar con Google")}`
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
            ...(userRole === Role.PHOTOGRAPHER ? { workingCoverageRadiusKm: 50 } : {}),
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
      const verifyUrl = `${process.env.APP_URL || baseUrl}/verify-email?token=${verifyToken}`;

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
        console.error("GOOGLE CALLBACK: error enviando verificaci?n", emailErr);
      }
    }

    const allowedRolesByState: Record<string, Role[]> = {
      PHOTOGRAPHER: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN],
      CUSTOMER: [Role.CUSTOMER],
      CLIENT: [Role.CUSTOMER],
      LAB: [Role.LAB, Role.LAB_PHOTOGRAPHER],
      ORGANIZER: [Role.ORGANIZER],
      AUTO: [Role.PHOTOGRAPHER, Role.CUSTOMER, Role.LAB, Role.LAB_PHOTOGRAPHER, Role.ORGANIZER],
    };
    const allowedRoles: Role[] = isCuantoCobroFlow
      ? [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]
      : (allowedRolesByState[state] ?? [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);

    // Verificar que el rol coincida; si no, redirigir al destino correcto por su rol real (mejor UX)
    if (!allowedRoles.includes(user.role)) {
      if (isCuantoCobroFlow) {
        return NextResponse.redirect(
          `${baseUrl}/cuantocobro?error=${encodeURIComponent("acceso")}`,
        );
      }
      redirectPath = resolveRedirectPath(user.role);
    }

    // 4. URL de redirecci?n con datos del usuario en query params (para sessionStorage en cliente)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    if (isAuto) {
      redirectPath = resolveRedirectPath(user.role);
    }

    if (isCuantoCobroFlow && cuantoCobroRedirect?.startsWith("/")) {
      redirectPath = cuantoCobroRedirect;
    }

    const redirectUrl = new URL(`${baseUrl}${redirectPath}`);
    redirectUrl.searchParams.set("user", JSON.stringify(userData));

    // 5. Redirigir y poner la cookie EN LA MISMA respuesta (cr?tico para que el navegador la reciba)
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const response = NextResponse.redirect(redirectUrl.toString());
    try {
      // Solo dnx_session (ETAPA 03 / P0-06). Expira auth-token residual.
      await setAuthCookieOnResponse(response, authUser);
    } catch (sessionErr) {
      console.error("GOOGLE CALLBACK SESSION ERROR >>>", sessionErr);
      const loginPath = "/login";
      return NextResponse.redirect(
        `${baseUrl}${loginPath}?error=${encodeURIComponent("No se pudo crear la sesión")}`,
      );
    }
    return response;
  } catch (err: any) {
    console.error("GOOGLE CALLBACK ERROR >>>", err);
    // Por defecto redirigir a login de fot?grafo si no se puede determinar el rol
    const loginPath = "/fotografo/login";
    const baseUrl = new URL(req.url).origin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}${loginPath}?error=${encodeURIComponent("Error en el callback de Google")}`
    );
  }
}
