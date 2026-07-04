import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role, PrintFinish, ProductMaterial } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

interface ValidationError {
  row: number;
  column: string;
  message: string;
  value?: any;
}

export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    // Obtener labId del usuario
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });
    }

    // Leer archivo Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 });
    }

    // Validar headers
    const headers = rows[0] as string[];
    const requiredHeaders = [
      "product_variant_id",
      "product_name",
      "category",
      "description",
      "size",
      "finish",
      "material",
      "sla_days",
      "price_retail_ars",
      "price_wholesale_ars",
      "active",
    ];

    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Faltan columnas requeridas: ${missingHeaders.join(", ")}` },
        { status: 400 }
      );
    }

    // Validar todas las filas antes de procesar (TODO/NADA)
    const validationErrors: ValidationError[] = [];
    const dataRows = rows.slice(1); // Saltar header

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any;
      const rowNum = i + 2; // +2 porque empezamos desde fila 2 (header es 1)

      // Validar product_name (obligatorio)
      if (!row.product_name || String(row.product_name).trim() === "") {
        validationErrors.push({
          row: rowNum,
          column: "product_name",
          message: "El nombre del producto es obligatorio",
          value: row.product_name,
        });
      }

      // Validar sla_days (obligatorio y >= 0)
      const slaDays = parseInt(String(row.sla_days || 0));
      if (isNaN(slaDays) || slaDays < 0) {
        validationErrors.push({
          row: rowNum,
          column: "sla_days",
          message: "SLA debe ser un número entero >= 0",
          value: row.sla_days,
        });
      }

      // Validar finish si category es IMPRESION
      if (row.category === "IMPRESION" || row.category === "impr") {
        if (!row.finish || (row.finish !== "BRILLO" && row.finish !== "MATE")) {
          validationErrors.push({
            row: rowNum,
            column: "finish",
            message: "Para impresiones, finish debe ser BRILLO o MATE",
            value: row.finish,
          });
        }
        if (!row.size || String(row.size).trim() === "") {
          validationErrors.push({
            row: rowNum,
            column: "size",
            message: "Para impresiones, size es obligatorio",
            value: row.size,
          });
        }
      }

      // Validar precios (si están presentes, deben ser enteros >= 0)
      if (row.price_retail_ars !== "" && row.price_retail_ars != null) {
        const retailPrice = parseInt(String(row.price_retail_ars));
        if (isNaN(retailPrice) || retailPrice < 0) {
          validationErrors.push({
            row: rowNum,
            column: "price_retail_ars",
            message: "Precio minorista debe ser un número entero >= 0",
            value: row.price_retail_ars,
          });
        }
      }

      if (row.price_wholesale_ars !== "" && row.price_wholesale_ars != null) {
        const wholesalePrice = parseInt(String(row.price_wholesale_ars));
        if (isNaN(wholesalePrice) || wholesalePrice < 0) {
          validationErrors.push({
            row: rowNum,
            column: "price_wholesale_ars",
            message: "Precio mayorista debe ser un número entero >= 0",
            value: row.price_wholesale_ars,
          });
        }
      }

      // Validar product_variant_id si está presente (debe existir)
      if (row.product_variant_id && String(row.product_variant_id).trim() !== "") {
        const variantId = parseInt(String(row.product_variant_id));
        if (isNaN(variantId)) {
          validationErrors.push({
            row: rowNum,
            column: "product_variant_id",
            message: "ID de variante inválido",
            value: row.product_variant_id,
          });
        }
      }
    }

    // Si hay errores, retornar reporte
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Errores de validación encontrados",
          validationErrors,
          message: `Se encontraron ${validationErrors.length} error(es) de validación. Corregí el archivo e intentá nuevamente.`,
        },
        { status: 400 }
      );
    }

    // Procesar importación (TODO/NADA - si todo está bien, aplicar todos los cambios)
    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of dataRows) {
        const variantId = row.product_variant_id ? parseInt(String(row.product_variant_id)) : null;
        const productName = String(row.product_name).trim();
        const category = row.category ? String(row.category).trim() : null;
        const description = row.description ? String(row.description).trim() : null;
        const size = row.size ? String(row.size).trim() : null;
        const finish = row.finish === "BRILLO" ? PrintFinish.BRILLO : row.finish === "MATE" ? PrintFinish.MATE : null;
        const material =
          row.material === "CANVAS"
            ? ProductMaterial.CANVAS
            : row.material === "WOOD"
            ? ProductMaterial.WOOD
            : null;
        const slaDays = parseInt(String(row.sla_days || 5));
        const priceRetail = row.price_retail_ars !== "" && row.price_retail_ars != null ? parseInt(String(row.price_retail_ars)) : null;
        const priceWholesale =
          row.price_wholesale_ars !== "" && row.price_wholesale_ars != null
            ? parseInt(String(row.price_wholesale_ars))
            : null;
        const isActive = String(row.active || "SI").toUpperCase() === "SI";

        if (variantId) {
          // Actualizar existente
          // Verificar que existe y pertenece al lab
          const existing = await tx.labProductVariant.findUnique({
            where: { id: variantId },
            select: { labId: true },
          });

          if (!existing || existing.labId !== lab.id) {
            throw new Error(`Variante con ID ${variantId} no encontrada o no pertenece a tu laboratorio`);
          }

          // Actualizar solo campos proporcionados (si precio está vacío, mantener el existente)
          const updateData: any = {
            productName,
            category,
            description,
            size,
            finish,
            material,
            slaDays,
            isActive,
          };

          // Solo actualizar precios si se proporcionaron valores
          if (priceRetail !== null) {
            updateData.priceRetailArs = priceRetail;
          }
          if (priceWholesale !== null) {
            updateData.priceWholesaleArs = priceWholesale;
          }

          await tx.labProductVariant.update({
            where: { id: variantId },
            data: updateData,
          });

          updated++;
        } else {
          // Crear nuevo
          await tx.labProductVariant.create({
            data: {
              labId: lab.id,
              productName,
              category,
              description,
              size,
              finish,
              material,
              slaDays,
              priceRetailArs: priceRetail,
              priceWholesaleArs: priceWholesale,
              isActive,
            },
          });

          created++;
        }
      }
    });

    // Registrar en audit log
    try {
      await prisma.adminLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          actorEmail: user.email,
          entity: "CatalogImport",
          entityId: lab.id,
          action: "IMPORT_CATALOG",
          description: `Importación de catálogo: ${created} creados, ${updated} actualizados`,
          afterData: { created, updated, totalRows: dataRows.length },
        },
      });
    } catch (logErr) {
      console.warn("Error registrando en audit log:", logErr);
    }

    return NextResponse.json({
      success: true,
      message: `Importación exitosa: ${created} producto(s) creado(s), ${updated} producto(s) actualizado(s)`,
      created,
      updated,
    });
  } catch (err: any) {
    console.error("Error importando catálogo:", err);
    return NextResponse.json(
      { error: "Error al importar catálogo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
