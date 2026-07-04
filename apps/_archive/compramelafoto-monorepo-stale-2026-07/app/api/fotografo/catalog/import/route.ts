import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
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
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 });
    }

    const headers = rows[0] as string[];
    const requiredHeaders = [
      "product_variant_id",
      "product_name",
      "category",
      "size",
      "finish",
      "material",
      "sla_days",
      "price_retail_ars",
      "active",
    ];

    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Faltan columnas requeridas: ${missingHeaders.join(", ")}` },
        { status: 400 }
      );
    }

    const validationErrors: ValidationError[] = [];
    const dataRows = rows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any;
      const rowNum = i + 2;

      if (!row.product_name || String(row.product_name).trim() === "") {
        validationErrors.push({
          row: rowNum,
          column: "product_name",
          message: "El nombre del producto es obligatorio",
          value: row.product_name,
        });
      }

      const slaDays = parseInt(String(row.sla_days || 0));
      if (isNaN(slaDays) || slaDays < 0) {
        validationErrors.push({
          row: rowNum,
          column: "sla_days",
          message: "SLA debe ser un número entero >= 0",
          value: row.sla_days,
        });
      }

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

    let created = 0;
    let updated = 0;

    const prismaAny = prisma as any;
    if (!prismaAny.photographerProduct?.create || !prismaAny.photographerProduct?.update) {
      return NextResponse.json(
        { error: "No existe la tabla de productos de fotógrafo" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      for (const row of dataRows) {
        const variantId = row.product_variant_id ? parseInt(String(row.product_variant_id)) : null;
        const productName = String(row.product_name).trim();
        const size = row.size ? String(row.size).trim() : null;
        const acabado = row.finish ? String(row.finish).trim() : null;
        const priceRetail = row.price_retail_ars !== "" && row.price_retail_ars != null ? parseInt(String(row.price_retail_ars)) : 0;
        const isActive = String(row.active || "SI").toUpperCase() === "SI";

        const data = {
          userId: user.id,
          name: productName,
          size,
          acabado,
          retailPrice: priceRetail,
          currency: "ARS",
          isActive,
        };

        if (variantId) {
          const exists = await txAny.photographerProduct.findFirst({
            where: { id: variantId, userId: user.id },
          });
          if (exists) {
            await txAny.photographerProduct.update({
              where: { id: variantId },
              data,
            });
            updated++;
          } else {
            await txAny.photographerProduct.create({ data });
            created++;
          }
        } else {
          await txAny.photographerProduct.create({ data });
          created++;
        }
      }
    });

    return NextResponse.json({ created, updated });
  } catch (err: any) {
    console.error("Error importando catálogo:", err);
    return NextResponse.json(
      { error: "Error al importar catálogo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
