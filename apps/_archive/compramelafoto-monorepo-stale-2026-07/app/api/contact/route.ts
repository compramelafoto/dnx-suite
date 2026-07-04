import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let name = "";
    let email = "";
    let message = "";
    let role = "";
    let photographerId: number | null = null;
    let labId: number | null = null;
    let documentUrl: string | null = null;

    // Manejar FormData (con archivo) o JSON (sin archivo)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = (formData.get("name") as string || "").toString().trim();
      email = (formData.get("email") as string || "").toString().trim().toLowerCase();
      message = (formData.get("message") as string || "").toString().trim();
      role = (formData.get("role") as string || "").toString().trim();
      const photographerIdStr = formData.get("photographerId") as string | null;
      photographerId = photographerIdStr ? Number(photographerIdStr) : null;
      const labIdStr = formData.get("labId") as string | null;
      labId = labIdStr ? Number(labIdStr) : null;

      // Manejar archivo adjunto
      const file = formData.get("document") as File | null;
      if (file && file.size > 0) {
        try {
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const originalName = file.name || "documento";
          
          // Detectar Content-Type
          const contentType = file.type || (originalName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
          
          // Generar key única para R2
          const key = generateR2Key(`contact-doc_${originalName}`, "contact");
          
          // Subir a R2
          const { url } = await uploadToR2(buffer, key, contentType, {
            type: "contact_document",
            originalName,
          });
          
          documentUrl = url;
        } catch (fileErr: any) {
          console.error("Error guardando archivo:", fileErr);
          // Continuar sin el archivo si hay error
        }
      }
    } else {
      // Manejar JSON (sin archivo)
      const body = await req.json().catch(() => ({}));
      name = (body.name ?? "").toString().trim();
      email = (body.email ?? "").toString().trim().toLowerCase();
      message = (body.message ?? "").toString().trim();
      role = (body.role ?? "").toString().trim();
      photographerId = body.photographerId ? Number(body.photographerId) : null;
      labId = body.labId ? Number(body.labId) : null;
      documentUrl = body.documentUrl || null;
    }

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Nombre, email y mensaje son requeridos" },
        { status: 400 }
      );
    }

    // Obtener email del admin (por ahora usar variable de entorno o un email fijo)
    const adminEmail = process.env.ADMIN_EMAIL || "admin@compramelafoto.com";

    // Obtener información del fotógrafo si existe
    let photographerInfo = "";
    if (photographerId) {
      const photographer = await prisma.user.findUnique({
        where: { id: photographerId },
        select: { name: true, email: true },
      });
      if (photographer) {
        photographerInfo = `\n\nFotógrafo: ${photographer.name || photographer.email} (ID: ${photographerId})`;
      }
    }

    // Construir información del rol
    const roleInfo = role ? `\n\nRol: ${role}` : "";

    // Construir información del documento
    const documentInfo = documentUrl ? `\n\nDocumento adjunto: ${documentUrl}` : "";

    // Guardar mensaje en la base de datos
    try {
      // Verificar que el modelo existe
      if (!prisma.contactMessage) {
        console.error("ERROR: prisma.contactMessage no está disponible. Ejecutá: npx prisma generate && reiniciá el servidor");
        // Continuar sin guardar en BD, pero loguear el mensaje
      } else {
        await prisma.contactMessage.create({
          data: {
            name,
            email,
            role: role || null,
            message,
            documentUrl: documentUrl || null,
            photographerId: photographerId || null,
            labId: labId || null,
            isRead: false,
          },
        });
      }
    } catch (dbError: any) {
      console.error("Error guardando mensaje en BD:", dbError);
      
      // Si el error es que la tabla no existe, informar al usuario
      if (dbError?.code === "P2001" || dbError?.message?.includes("does not exist") || dbError?.message?.includes("Unknown table")) {
        console.error("ERROR: La tabla ContactMessage no existe en la base de datos. Ejecutá: npx prisma db push");
        // Continuar sin guardar en BD, pero loguear el mensaje
      } else if (dbError?.code === "P2003" || dbError?.message?.includes("Foreign key constraint")) {
        console.warn("Error de relación en BD, pero el mensaje es válido");
      } else {
        // Re-lanzar el error si es otro tipo de error crítico
        throw dbError;
      }
    }

    // Aquí deberías enviar el email usando un servicio como SendGrid, Resend, etc.
    // Por ahora, solo logueamos el mensaje
    console.log("=== CONTACTO DESDE COMPRAMELAFOTO ===");
    console.log(`De: ${name} <${email}>`);
    if (role) console.log(`Rol: ${role}`);
    console.log(`Mensaje: ${message}`);
    if (documentUrl) console.log(`Documento: ${documentUrl}`);
    console.log(photographerInfo);
    if (labId) console.log(`\n\nLaboratorio ID: ${labId}`);
    console.log("=====================================");

    // TODO: Implementar envío de email real
    // Ejemplo con Resend:
    // await resend.emails.send({
    //   from: "noreply@compramelafoto.com",
    //   to: adminEmail,
    //   subject: "Nueva consulta desde ComprameLaFoto",
    //   html: `<p><strong>De:</strong> ${name} <${email}></p>${roleInfo ? `<p><strong>Rol:</strong> ${role}</p>` : ""}<p><strong>Mensaje:</strong> ${message}</p>${documentInfo}${photographerInfo}`,
    // });

    return NextResponse.json(
      { success: true, message: "Mensaje enviado correctamente" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/contact ERROR >>>", err);
    return NextResponse.json(
      { error: "Error enviando mensaje", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
