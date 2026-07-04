import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role, LabApprovalStatus, TokenPurpose } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";
import { LAB_TERMS_VERSION } from "@/lib/terms/labTerms";
import { DEFAULT_LAB_PRODUCTS } from "@/lib/default-lab-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name ?? "").toString().trim();
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();
    const phone = (body.phone ?? "").toString().trim() || null;
    const address = (body.address ?? "").toString().trim() || null;
    const city = (body.city ?? "").toString().trim() || null;
    const province = (body.province ?? "").toString().trim() || null;
    const country = (body.country ?? "").toString().trim() || "Argentina";
    const termsAccepted = body.termsAccepted === true; // OBLIGATORIO

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nombre del laboratorio, email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (!termsAccepted) {
      return NextResponse.json(
        { error: "Debes aceptar los Términos y Condiciones para registrarte" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 400 }
      );
    }

    // Verificar si ya existe un lab con ese email
    const existingLab = await prisma.lab.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingLab) {
      return NextResponse.json(
        { error: "Este email ya está registrado para otro laboratorio" },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    const marketingOptIn = !!body.marketingOptIn;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

    const userData: Record<string, unknown> = {
      email,
      name,
      password: hashedPassword,
      role: Role.LAB,
      marketingOptIn,
    };
    if (marketingOptIn) {
      userData.marketingOptInAt = new Date();
      userData.marketingOptInIp = ip;
      userData.marketingOptInSource = "signup";
      userData.unsubscribeToken = randomBytes(24).toString("hex");
    }

    // Crear usuario y laboratorio en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario como LAB
      const user = await tx.user.create({
        data: userData as any,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      // Crear laboratorio asociado (sin aprobación manual)
      const lab = await tx.lab.create({
        data: {
          name,
          email,
          phone,
          address,
          city,
          province,
          country,
          userId: user.id,
          approvalStatus: LabApprovalStatus.APPROVED,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          approvalStatus: true,
        },
      });

      // Obtener productos del laboratorio de referencia (el que tiene más productos activos)
      // Usar ese como plantilla por defecto para todos los laboratorios nuevos
      let productsToCopy = DEFAULT_LAB_PRODUCTS;
      
      try {
        // Buscar todos los laboratorios que tengan productos (excluyendo el que acabamos de crear)
        const labsWithProducts = await tx.lab.findMany({
          where: {
            id: { not: lab.id },
          },
          include: {
            products: {
              where: {
                isActive: true,
              },
              orderBy: [
                { name: "asc" },
                { size: "asc" },
                { acabado: "asc" },
              ],
            },
          },
        });

        // Encontrar el laboratorio con más productos activos
        let referenceLab = labsWithProducts
          .filter(l => l.products && l.products.length > 0)
          .sort((a, b) => (b.products?.length || 0) - (a.products?.length || 0))[0];

        // Si encontramos un laboratorio con productos, usar esos productos como plantilla
        if (referenceLab && referenceLab.products && referenceLab.products.length > 0) {
          console.log(`Usando productos del laboratorio "${referenceLab.name}" (${referenceLab.products.length} productos) como plantilla para el nuevo laboratorio`);
          productsToCopy = referenceLab.products.map((product) => ({
            name: product.name,
            size: product.size || "",
            acabado: product.acabado || "",
            photographerPrice: product.photographerPrice,
            retailPrice: product.retailPrice,
            currency: product.currency,
            isActive: product.isActive,
          }));
        } else {
          console.log("No se encontraron laboratorios con productos, usando productos por defecto");
        }
      } catch (err: any) {
        // Si hay error al buscar productos de referencia, usar los productos por defecto
        console.warn("No se pudieron obtener productos de referencia, usando productos por defecto:", err.message);
      }

      // Crear productos para el nuevo laboratorio
      const productsToCreate = productsToCopy.map((product) => ({
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
        await tx.labProduct.createMany({
          data: productsToCreate,
        });
      }

      return { user, lab };
    });

    // Crear documento de términos y aceptación FUERA de la transacción
    // Manejar el caso donde las tablas aún no existen
    let termsDoc: any = null;
    try {
      termsDoc = await prisma.termsDocument.findFirst({
        where: {
          role: Role.LAB,
          version: LAB_TERMS_VERSION,
        },
      });

      if (!termsDoc) {
        const { LAB_TERMS_TEXT } = await import("@/lib/terms/labTerms");
        try {
          termsDoc = await prisma.termsDocument.create({
            data: {
              role: Role.LAB,
              version: LAB_TERMS_VERSION,
              contentMd: LAB_TERMS_TEXT,
              isActive: true,
            },
          });
        } catch (createErr: any) {
          // Si falla por constraint único, intentar obtenerlo de nuevo
          if (createErr.code === "P2002") {
            termsDoc = await prisma.termsDocument.findFirst({
              where: {
                role: Role.LAB,
                version: LAB_TERMS_VERSION,
              },
            });
          } else {
            // Si las tablas no existen aún, continuar sin crear la aceptación
            console.warn("No se pudo crear documento de términos (tablas pueden no existir aún):", createErr.message);
          }
        }
      }

      // Crear aceptación de términos solo si el documento existe
      if (termsDoc) {
        try {
          const acceptedIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
          const acceptedUserAgent = req.headers.get("user-agent") || null;

          await prisma.termsAcceptance.create({
            data: {
              userId: result.user.id,
              role: Role.LAB,
              termsDocumentId: termsDoc.id,
              termsVersion: LAB_TERMS_VERSION,
              acceptedIp,
              acceptedUserAgent,
            },
          });
        } catch (acceptErr: any) {
          // Si falla, registrar pero no bloquear el registro
          console.warn("No se pudo crear aceptación de términos:", acceptErr.message);
        }
      }
    } catch (err: any) {
      // Si las tablas no existen, continuar sin crear la aceptación
      console.warn("No se pudo acceder a términos (tablas pueden no existir aún):", err.message);
    }

    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpires = new Date();
    verifyExpires.setHours(verifyExpires.getHours() + 24);
    const verifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${verifyToken}`;

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token: hashToken(verifyToken),
        purpose: TokenPurpose.VERIFY_EMAIL,
        expiresAt: verifyExpires,
      },
    });

    try {
      const { subject, html } = buildVerifyEmail({
        firstName: result.user.name || undefined,
        verifyUrl,
      });
      await sendEmail({
        to: result.user.email,
        subject,
        html,
        templateKey: "AUTH01_VERIFY_EMAIL",
        meta: { userId: result.user.id },
      });
    } catch (emailErr) {
      console.error("REGISTER LAB: error enviando verificación", emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Cuenta de laboratorio creada. Revisá tu email para verificarla.",
        user: result.user,
        lab: result.lab,
        pendingApproval: false,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("REGISTER LAB ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear cuenta de laboratorio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
