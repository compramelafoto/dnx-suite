import sharp from "sharp";
import { uploadToR2, generateR2Key, getPublicUrl } from "./r2-client";
import fs from "fs/promises";
import path from "path";

// Marca de agua: PNG 35% tamaño, grid 3x3 (9 marcas) + texto "@compramelafoto" centrado

// Configurar sharp para usar /tmp en Vercel (único directorio escribible)
// Esto es crítico en Vercel donde el filesystem es read-only excepto /tmp
// Sharp necesita escribir archivos temporales durante operaciones complejas como composite()
try {
  // En Vercel, configurar Sharp para usar /tmp (único directorio escribible)
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    // Configurar SHARP_TMPDIR para que use /tmp en Vercel
    // /tmp es el único directorio escribible en Vercel (limitado a 512MB por invocación)
    process.env.SHARP_TMPDIR = "/tmp";
    
    // Deshabilitar caché de archivos pero permitir que Sharp use /tmp para temporales
    // files: 0 deshabilita caché persistente, pero Sharp aún puede usar /tmp para operaciones temporales
    sharp.cache({ files: 0, memory: 50 });
  } else {
    // En desarrollo local, usar solo memoria
    sharp.cache({ files: 0, memory: 50 });
  }
} catch (err) {
  // Si falla la configuración, continuar (sharp usará configuración por defecto)
  console.warn("⚠️ No se pudo configurar sharp cache:", err);
}

// Constantes de configuración (reducidas ~50% para menos intrusión visual)
const WATERMARK_OPACITY = 0.35625; // Opacidad del texto central (50% de la anterior)
const WATERMARK_PNG_OPACITY = 0.2109375; // Opacidad del logo PNG (50% de la anterior)
const WATERMARK_SCALE = 0.125; // ~12.5% del ancho (50% del anterior 25%)
const PREVIEW_MAX_WIDTH = 1000;
const PREVIEW_QUALITY = 70;
const PREVIEW_DPI = 72;
const ORIGINAL_QUALITY = 100;
const ORIGINAL_DPI = 300;

let cachedAdobeProfilePath: string | null | undefined;

function normalizeToJpegName(originalName: string): string {
  const trimmed = (originalName || "archivo").trim();
  const base = trimmed.replace(/\.[^/.]+$/, "") || "archivo";
  return `${base}.jpg`;
}

async function loadAdobeRgbProfilePath(): Promise<string | null> {
  if (cachedAdobeProfilePath !== undefined) return cachedAdobeProfilePath;

  try {
    const customPath = process.env.PRINT_ICC_PROFILE_PATH;
    if (customPath) {
      cachedAdobeProfilePath = customPath;
      return cachedAdobeProfilePath;
    }

    let buffer: Buffer | null = null;
    const base64 = process.env.PRINT_ICC_PROFILE_BASE64;
    if (base64) {
      buffer = Buffer.from(base64, "base64");
    } else {
      const fallbackPath = path.join(process.cwd(), "assets", "icc", "AdobeRGB1998.icc");
      buffer = await fs.readFile(fallbackPath);
    }

    if (!buffer) {
      cachedAdobeProfilePath = null;
      return null;
    }

    const tmpDir = process.env.SHARP_TMPDIR || "/tmp";
    const tmpPath = path.join(tmpDir, "adobe-rgb-1998.icc");
    try {
      await fs.access(tmpPath);
    } catch {
      await fs.writeFile(tmpPath, buffer);
    }

    cachedAdobeProfilePath = tmpPath;
    return cachedAdobeProfilePath;
  } catch (err) {
    console.warn("⚠️ Perfil Adobe RGB no disponible, se usará sRGB.");
    cachedAdobeProfilePath = null;
    return null;
  }
}

function withPrintMetadata(density: number, iccPath: string | null) {
  return iccPath ? { density, icc: iccPath } : { density };
}

export async function convertImageToJpeg(
  imageBuffer: Buffer,
  originalName: string,
  quality: number,
  density: number
): Promise<{ buffer: Buffer; outputName: string }> {
  const iccPath = await loadAdobeRgbProfilePath();
  const outputName = normalizeToJpegName(originalName);
  const buffer = await sharp(imageBuffer)
    .rotate()
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .withMetadata(withPrintMetadata(density, iccPath))
    .toBuffer();

  return { buffer, outputName };
}

/**
 * Carga la imagen de marca de agua desde R2 o fallback local
 * 
 * IMPORTANTE: En Vercel, solo lee (no escribe). Si el archivo no existe, simplemente retorna null.
 * En producción, el watermark debería estar en R2 también.
 */
async function loadWatermarkImage(): Promise<Buffer | null> {
  // Intentar cargar desde filesystem local (solo lectura, no escritura)
  // En Vercel, si el archivo no existe, simplemente retornamos null
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const watermarkPath = path.join(process.cwd(), "public", "watermark.png");
    // Solo lectura, no escritura - esto es seguro en Vercel
    return await fs.readFile(watermarkPath);
  } catch (err: any) {
    // En Vercel, si el archivo no existe o hay error de lectura, simplemente continuar sin watermark
    if (err.code === "ENOENT" || err.code === "EROFS") {
      console.warn(
        "⚠️ watermark.png no encontrado o no accesible. Las fotos se procesarán sin marca de agua PNG (solo texto)."
      );
      return null;
    }
    console.error("Error cargando watermark.png:", err?.message || err);
    return null;
  }
}

/**
 * Crea un overlay de texto SVG con "Compramelafoto.com - Fotoffice.com" centrado
 */
function createInstagramTextOverlay(
  imageWidth: number,
  imageHeight: number
): { input: Buffer; top: number; left: number } | null {
  const text = "Compramelafoto.com - Fotoffice.com";

  const maxTextWidth = Math.floor(imageWidth * 0.4);
  const maxFontSizeByHeight = Math.floor(imageHeight * 0.2);
  let fontSize = Math.max(16, Math.floor(imageWidth / 25));
  if ((text.length * fontSize * 0.6) > maxTextWidth) {
    fontSize = Math.floor((maxTextWidth / text.length) * 1.2);
    fontSize = Math.max(10, fontSize);
  }
  fontSize = Math.min(fontSize, Math.max(10, maxFontSizeByHeight));

  const textWidth = Math.floor(text.length * fontSize * 0.6);
  const textHeight = Math.floor(fontSize * 1.5);

  if (textWidth >= imageWidth || textHeight >= imageHeight) {
    return null;
  }

  const svg = `
    <svg width="${textWidth}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
      <g opacity="${WATERMARK_OPACITY}">
        <text 
          x="50%" 
          y="50%" 
          font-family="Arial, sans-serif" 
          font-size="${fontSize}" 
          font-weight="bold" 
          fill="white" 
          text-anchor="middle"
          dominant-baseline="middle"
          stroke="black" 
          stroke-width="${Math.floor(fontSize * 0.12)}"
          stroke-opacity="0.6"
          paint-order="stroke fill">
          ${text}
        </text>
      </g>
    </svg>
  `;

  const svgBuffer = Buffer.from(svg);

  const left = Math.floor((imageWidth - textWidth) / 2);
  const top = Math.floor((imageHeight - textHeight) / 2);

  return {
    input: svgBuffer,
    top,
    left,
  };
}

/**
 * Aplica la marca de agua a una imagen
 */
async function applyWatermarkToImage(imageBuffer: Buffer): Promise<Buffer> {
  const watermarkBuffer = await loadWatermarkImage();
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("No se pudo obtener las dimensiones de la imagen");
  }

  // Array para acumular todos los composites
  const composites: Array<{ input: Buffer; top: number; left: number; blend?: sharp.Blend; opacity?: number }> = [];

  // Aplicar marca de agua PNG si existe (~12.5% del ancho, reducida 50%)
  // Colocarla 9 veces en un grid 3x3
  if (watermarkBuffer) {
    const watermark = sharp(watermarkBuffer);
    const watermarkMetadata = await watermark.metadata();

    if (watermarkMetadata.width && watermarkMetadata.height) {
      // Calcular tamaño de la marca de agua según WATERMARK_SCALE
      // Asegurar que sea menor que la imagen y las celdas del grid
      const cellWidth = Math.floor(metadata.width / 3);
      const cellHeight = Math.floor(metadata.height / 3);
      const maxWatermarkWidth = Math.max(1, Math.min(Math.floor(metadata.width * WATERMARK_SCALE), cellWidth - 2, metadata.width - 2));
      const maxWatermarkHeight = Math.max(1, Math.min(Math.floor(metadata.height * WATERMARK_SCALE), cellHeight - 2, metadata.height - 2));
      if (maxWatermarkWidth <= 1 || maxWatermarkHeight <= 1) {
        // Imagen muy pequeña, omitir marca de agua PNG
        // Continuar solo con el texto central
        const textOverlay = createInstagramTextOverlay(metadata.width, metadata.height);
        if (textOverlay) {
          composites.push({
            input: textOverlay.input,
            top: textOverlay.top,
            left: textOverlay.left,
            blend: "over" as sharp.Blend,
          });
        }
        const processed = image.composite(composites);
        return await processed.toBuffer();
      }
      const watermarkWidth = maxWatermarkWidth;
      const watermarkHeight = Math.floor(
        (watermarkMetadata.height * watermarkWidth) / watermarkMetadata.width
      );
      if (watermarkHeight <= 1 || watermarkHeight > maxWatermarkHeight) {
        // Ajustar para no exceder el alto máximo disponible
        const adjustedWidth = Math.max(1, Math.floor((watermarkMetadata.width * maxWatermarkHeight) / watermarkMetadata.height));
        if (adjustedWidth <= 1) {
          return await image.toBuffer();
        }
        // Recalcular ancho/alto con el límite de alto
        const adjustedHeight = Math.min(maxWatermarkHeight, Math.floor((watermarkMetadata.height * adjustedWidth) / watermarkMetadata.width));
        const resizedWatermark = await watermark
          .resize(adjustedWidth, adjustedHeight, { fit: "inside" })
          .png()
          .toBuffer();
        const offsetX = Math.max(0, Math.floor((cellWidth - adjustedWidth) / 2));
        const offsetY = Math.max(0, Math.floor((cellHeight - adjustedHeight) / 2));
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            composites.push({
              input: resizedWatermark,
              top: Math.max(0, row * cellHeight + offsetY),
              left: Math.max(0, col * cellWidth + offsetX),
              blend: "over" as sharp.Blend,
              opacity: WATERMARK_PNG_OPACITY,
            });
          }
        }
        // Saltar el flujo normal, ya aplicamos el watermark ajustado
        const textOverlay = createInstagramTextOverlay(metadata.width, metadata.height);
        if (textOverlay) {
          composites.push({
            input: textOverlay.input,
            top: textOverlay.top,
            left: textOverlay.left,
            blend: "over" as sharp.Blend,
          });
        }
        const processed = image.composite(composites);
        return await processed.toBuffer();
      }

      // Redimensionar la marca de agua una sola vez
      const resizedWatermark = await watermark
        .resize(watermarkWidth, watermarkHeight, { fit: "inside" })
        .png()
        .toBuffer();

      // Calcular posiciones para grid 3x3 (centradas en cada celda)
      const offsetX = Math.max(0, Math.floor((cellWidth - watermarkWidth) / 2));
      const offsetY = Math.max(0, Math.floor((cellHeight - watermarkHeight) / 2));

      // Aplicar 9 marcas de agua en grid 3x3
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          composites.push({
            input: resizedWatermark,
            top: Math.max(0, row * cellHeight + offsetY),
            left: Math.max(0, col * cellWidth + offsetX),
            blend: "over" as sharp.Blend,
            opacity: WATERMARK_PNG_OPACITY,
          });
        }
      }
    }
  }

  // Agregar texto central "@compramelafoto.com" al array de composites
  const textOverlay = createInstagramTextOverlay(metadata.width, metadata.height);
  if (textOverlay) {
    composites.push({
      input: textOverlay.input,
      top: textOverlay.top,
      left: textOverlay.left,
      blend: "over" as sharp.Blend,
    });
  }

  // Aplicar todos los composites de una vez
  const processed = image.composite(composites);
  return await processed.toBuffer();
}

/**
 * Procesa una foto: crea versión preview (con marca de agua) y original (sin marca)
 * 
 * IMPORTANTE: Esta función NO escribe archivos en disco. Todo se procesa en memoria usando buffers.
 * Los archivos se suben directamente a R2 sin pasar por el filesystem local.
 * 
 * @param imageBuffer - Buffer de la imagen original (en memoria)
 * @param originalName - Nombre original del archivo
 * @param applyWatermark - Si es true, aplica marca de agua al preview (PNG + texto "@compramelafoto")
 */
export async function processPhoto(
  imageBuffer: Buffer,
  originalName: string,
  applyWatermark: boolean = true,
  keyPrefix: string = "uploads"
): Promise<{
  previewUrl: string;
  originalKey: string;
  originalUrl: string;
  outputName: string;
}> {
  try {
    const outputName = normalizeToJpegName(originalName);
    const iccPath = await loadAdobeRgbProfilePath();

    // Validar que el buffer no está vacío
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Buffer de imagen vacío");
    }

    // Procesar imagen en memoria (sin escribir en disco)
    let image: sharp.Sharp;
    let metadata: sharp.Metadata;
    
    try {
      image = sharp(imageBuffer);
      metadata = await image.metadata();
    } catch (readErr: any) {
      const errorMsg = String(readErr?.message || readErr);
      const isDecoderError = errorMsg.toLowerCase().includes('decoder') || 
                             errorMsg.includes('1E08010C') ||
                             errorMsg.toLowerCase().includes('unsupported') ||
                             errorMsg.toLowerCase().includes('vips');
      
      console.error("Error leyendo metadatos de imagen original:", {
        originalName,
        error: errorMsg,
        isDecoderError,
        bufferSize: imageBuffer.length,
        firstBytes: imageBuffer.slice(0, 8).toString('hex'),
      });
      
      if (isDecoderError) {
        throw new Error(`Imagen corrupta o formato no soportado: no se pueden leer metadatos (${errorMsg})`);
      }
      throw new Error(`Error leyendo imagen: ${errorMsg}`);
    }

    if (!metadata.width || !metadata.height) {
      throw new Error(`No se pudieron obtener las dimensiones de la imagen (width: ${metadata.width}, height: ${metadata.height})`);
    }
    
    // Validar formato soportado
    const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'tiff', 'heic', 'heif'];
    if (!metadata.format || !supportedFormats.includes(metadata.format)) {
      throw new Error(`Formato de imagen no soportado: ${metadata.format || 'desconocido'}`);
    }

    // Preview: versión reducida con marca de agua si applyWatermark es true
    let previewBuffer: Buffer;
    
    if (applyWatermark) {
      // Redimensionar primero para reducir memoria y complejidad
      const targetWidth = Math.min(Math.floor(metadata.width * 0.5), PREVIEW_MAX_WIDTH);
      const targetHeight = Math.floor((metadata.height * targetWidth) / metadata.width);
      
      const resizedBuffer = await sharp(imageBuffer)
        .rotate()
        .resize(targetWidth, targetHeight, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toBuffer();
      
      // Aplicar marca de agua (PNG + texto "@compramelafoto" centrado)
      previewBuffer = await applyWatermarkToImage(resizedBuffer);
    } else {
      // Sin marca de agua, solo redimensionar
      previewBuffer = imageBuffer;
    }
    
    // Procesar el preview final
    // PRESERVAR METADATOS EXIF: usar keepMetadata() para mantener información del fotógrafo, cámara, fecha, GPS, etc.
    const previewProcessed = sharp(previewBuffer)
      .rotate()
      .resize(PREVIEW_MAX_WIDTH, null, {
      withoutEnlargement: true,
      fit: "inside",
    });
    
    // Convertir a buffer en memoria (NO escribir en disco)
    // keepMetadata() preserva todos los metadatos EXIF originales (cámara, fecha, GPS, copyright, etc.)
    const previewBufferProcessed = await previewProcessed
      .jpeg({
        quality: PREVIEW_QUALITY,
        mozjpeg: true,
        progressive: true,
      })
      .keepMetadata() // ← PRESERVAR metadatos EXIF originales (cámara, fecha, GPS, copyright, etc.)
      .withMetadata(withPrintMetadata(PREVIEW_DPI, iccPath)) // Agregar DPI y perfil ICC sin eliminar EXIF
      .toBuffer(); // ← Solo buffer en memoria, NO .toFile()

    // Original sin marca de agua (alta calidad)
    // Todo en memoria, sin escribir archivos temporales
    // IMPORTANTE: Preservar metadatos EXIF originales para seguridad (información del fotógrafo, cámara, fecha, GPS, etc.)
    // Usar JPEG estándar para máxima compatibilidad con Google Vision API y AWS Rekognition
    let originalBuffer: Buffer;
    try {
      // Procesar imagen preservando metadatos EXIF originales
      // keepMetadata() mantiene toda la información EXIF: cámara, fecha, GPS, copyright, autor, etc.
      originalBuffer = await sharp(imageBuffer)
        .rotate()
        .jpeg({
          quality: ORIGINAL_QUALITY,
          mozjpeg: false, // NO usar mozjpeg - usar JPEG estándar para máxima compatibilidad
          progressive: false, // No usar progressive JPEG para evitar problemas con decoders
          optimizeScans: false, // Desactivar optimizaciones que pueden causar problemas
        })
        .keepMetadata() // ← PRESERVAR metadatos EXIF originales (cámara, fecha, GPS, copyright, autor, etc.)
        .withMetadata({ density: ORIGINAL_DPI }) // Agregar DPI sin eliminar EXIF existente
        .toBuffer(); // ← Solo buffer en memoria, NO .toFile()
      
      // Validar que el buffer es un JPEG válido antes de subirlo
      const jpegStart = originalBuffer.slice(0, 2);
      if (jpegStart[0] !== 0xFF || jpegStart[1] !== 0xD8) {
        throw new Error(`Buffer original no es un JPEG válido (inicio: ${jpegStart.toString('hex')})`);
      }
      
      // Validar que Sharp puede leer el buffer generado (verificación adicional)
      try {
        const validationImage = sharp(originalBuffer);
        const validationMetadata = await validationImage.metadata();
        if (!validationMetadata.width || !validationMetadata.height) {
          throw new Error(`JPEG generado no tiene dimensiones válidas`);
        }
        
        // Verificar que el formato es JPEG
        if (validationMetadata.format !== 'jpeg' && validationMetadata.format !== 'jpg') {
          throw new Error(`Formato del JPEG generado es inválido: ${validationMetadata.format}`);
        }
      } catch (validationErr: any) {
        console.error("Error validando JPEG generado:", {
          originalName,
          error: validationErr?.message,
          bufferSize: originalBuffer.length,
          firstBytes: originalBuffer.slice(0, 8).toString('hex'),
        });
        throw new Error(`JPEG generado no es válido: ${validationErr?.message}`);
      }
      
      console.log("Imagen original procesada correctamente:", {
        originalName,
        originalSize: imageBuffer.length,
        processedSize: originalBuffer.length,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
      });
    } catch (originalProcessErr: any) {
      const errorMsg = String(originalProcessErr?.message || originalProcessErr);
      const isDecoderError = errorMsg.toLowerCase().includes('decoder') || 
                             errorMsg.includes('1E08010C') ||
                             errorMsg.toLowerCase().includes('unsupported') ||
                             errorMsg.toLowerCase().includes('vips');
      
      console.error("Error procesando imagen original:", {
        originalName,
        error: errorMsg,
        isDecoderError,
        bufferSize: imageBuffer.length,
        firstBytes: imageBuffer.slice(0, 8).toString('hex'),
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
      });
      
      if (isDecoderError) {
        throw new Error(`Imagen corrupta o formato no soportado: no se puede procesar (${errorMsg})`);
      }
      throw new Error(`Error procesando imagen original: ${errorMsg}`);
    }

    // Generar keys únicas para R2
    // generateR2Key ya maneja correctamente la extensión, solo agregamos el prefijo
    // Si originalName = "uuid.jpg", entonces:
    // - previewKey será "uploads/newUuid-preview_uuid.jpg" (sin duplicar extensión)
    // - originalKey será "uploads/newUuid-original_uuid.jpg" (sin duplicar extensión)
    const previewKey = generateR2Key(`preview_${outputName}`, keyPrefix);
    const originalKey = generateR2Key(`original_${outputName}`, keyPrefix);

    // Subir ambas versiones directamente a R2 (sin pasar por disco)
    const [previewResult, originalResult] = await Promise.all([
      uploadToR2(previewBufferProcessed, previewKey, "image/jpeg", {
        type: "preview",
        originalName: outputName,
      }),
      uploadToR2(originalBuffer, originalKey, "image/jpeg", {
        type: "original",
        originalName: outputName,
      }),
    ]);

    return {
      previewUrl: previewResult.url,
      originalKey,
      originalUrl: originalResult.url,
      outputName,
    };
  } catch (error: any) {
    console.error("ERROR en processPhoto:", {
      originalName,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorName: error?.name,
    });
    throw error;
  }
}
