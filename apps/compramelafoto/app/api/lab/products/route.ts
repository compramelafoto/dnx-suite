import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const labId = searchParams.get("labId");

    if (!labId) {
      return NextResponse.json({ error: "labId es requerido" }, { status: 400 });
    }

    const labIdNum = parseInt(labId);
    if (isNaN(labIdNum)) {
      return NextResponse.json({ error: "labId inválido" }, { status: 400 });
    }

    // Verificar que el laboratorio existe
    const lab = await prisma.lab.findUnique({
      where: { id: labIdNum },
      select: { id: true },
    });

    if (!lab) {
      console.warn(`Laboratorio ${labIdNum} no encontrado`);
      return NextResponse.json([], { status: 200 }); // Devolver array vacío en lugar de error
    }

    const products = await prisma.labProduct.findMany({
      where: {
        labId: labIdNum,
      },
      orderBy: [
        { name: "asc" },
        { size: "asc" },
        { acabado: "asc" },
      ],
    });

    console.log(`Productos encontrados para lab ${labIdNum}:`, products.length);
    return NextResponse.json(products);
  } catch (error: any) {
    console.error("Error obteniendo productos:", error);
    console.error("Error stack:", error.stack);
    
    // Si es un error de Prisma relacionado con campos faltantes, dar un mensaje más claro
    if (error.message?.includes("Unknown arg") || error.message?.includes("does not exist")) {
      return NextResponse.json(
        { 
          error: "Error en el modelo de base de datos. Ejecutá: npx prisma generate",
          detail: error.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Error obteniendo productos", detail: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { labId, products } = body;

    if (!labId) {
      return NextResponse.json({ error: "labId es requerido" }, { status: 400 });
    }

    const labIdNum = parseInt(labId);
    if (isNaN(labIdNum)) {
      return NextResponse.json({ error: "labId inválido" }, { status: 400 });
    }

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "products debe ser un array" }, { status: 400 });
    }

    // Verificar que el laboratorio existe
    const lab = await prisma.lab.findUnique({
      where: { id: labIdNum },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Transacción para actualizar productos
    const result = await prisma.$transaction(async (tx) => {
      // Eliminar productos que ya no están en la lista
      const existingProducts = await tx.labProduct.findMany({
        where: { labId: labIdNum },
      });

      const existingIds = new Set(products.map((p: any) => p.id).filter(Boolean));
      const toDelete = existingProducts.filter((p) => !existingIds.has(p.id));

      for (const product of toDelete) {
        await tx.labProduct.delete({
          where: { id: product.id },
        });
      }

      // Actualizar o crear productos
      const updatedProducts = [];
      for (const product of products) {
        const { id, name, size, acabado, photographerPrice, retailPrice, currency, isActive } = product;

        if (!name || photographerPrice === undefined || retailPrice === undefined) {
          continue; // Saltar productos inválidos
        }

        const productData = {
          labId: labIdNum,
          name: name.trim(),
          size: size?.trim() || null,
          acabado: acabado?.trim() || null, // Mantener el texto tal como lo escribió el laboratorio (sin convertir a mayúsculas)
          photographerPrice: parseInt(String(photographerPrice)),
          retailPrice: parseInt(String(retailPrice)),
          currency: currency || "ARS",
          isActive: isActive !== false,
        };

        if (id) {
          // Actualizar producto existente
          const updated = await tx.labProduct.update({
            where: { id: parseInt(String(id)) },
            data: productData,
          });
          updatedProducts.push(updated);
        } else {
          // Crear nuevo producto
          const created = await tx.labProduct.create({
            data: productData,
          });
          updatedProducts.push(created);
        }
      }

      return updatedProducts;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error guardando productos:", error);

    // Si hay campos faltantes en el schema
    if (error.message?.includes("Unknown arg") || error.message?.includes("does not exist")) {
      return NextResponse.json(
        {
          error: "Modelo LabProduct no encontrado en el schema. Ejecutá: npx prisma migrate dev --name add_lab_products",
          detail: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Error guardando productos", detail: error.message },
      { status: 500 }
    );
  }
}
