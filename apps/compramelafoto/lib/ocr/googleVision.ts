import { ImageAnnotatorClient } from "@google-cloud/vision";

type OcrToken = {
  textRaw: string;
  textNorm: string;
  confidence: number | null;
};

let client: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (client) return client;
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON no está configurado");
  }
  
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (parseErr: any) {
    throw new Error(`GOOGLE_APPLICATION_CREDENTIALS_JSON no es un JSON válido: ${parseErr?.message}`);
  }

  // CRÍTICO: El error "DECODER routines::unsupported" en Vercel/serverless
  // se debe a que la clave privada necesita tener los saltos de línea correctamente formateados
  // La clave privada viene con \n como texto literal y necesita convertirse a saltos reales
  if (credentials.private_key) {
    // Reemplazar todas las variaciones posibles de saltos de línea
    credentials.private_key = credentials.private_key
      .replace(/\\n/g, "\n")  // Reemplazar \n literal por salto real
      .replace(/\\\\n/g, "\n") // Reemplazar \\n por salto real
      .replace(/\\r\\n/g, "\n") // Reemplazar \r\n por \n
      .replace(/\\r/g, "\n");   // Reemplazar \r por \n
    
    // Validar que la clave privada tiene el formato correcto
    // Debe empezar con "-----BEGIN PRIVATE KEY-----" y terminar con "-----END PRIVATE KEY-----"
    if (!credentials.private_key.includes("-----BEGIN")) {
      throw new Error("La clave privada no tiene el formato correcto (debe incluir BEGIN PRIVATE KEY)");
    }
  }

  // Validar que las credenciales tienen los campos necesarios
  if (!credentials.type || credentials.type !== "service_account") {
    throw new Error("Las credenciales deben ser de tipo 'service_account'");
  }
  
  if (!credentials.private_key || !credentials.client_email) {
    throw new Error("Las credenciales deben incluir 'private_key' y 'client_email'");
  }

  // Crear cliente con opciones adicionales para mejor compatibilidad en serverless
  // El problema del decoder puede estar relacionado con cómo se firman los JWTs
  client = new ImageAnnotatorClient({ 
    credentials,
    // Agregar opciones para mejor compatibilidad en entornos serverless
    fallback: true,
  });
  
  return client;
}

function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "");
}

export async function extractOcrTokensFromImage(params: {
  buffer?: Buffer;
  imageUrl?: string;
}): Promise<OcrToken[]> {
  const { buffer, imageUrl } = params;
  if (!buffer && !imageUrl) {
    return [];
  }

  // Validar buffer antes de enviarlo
  if (buffer) {
    // Verificar que es un Buffer válido
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("El buffer no es un Buffer válido de Node.js");
    }
    
    // Verificar que no está vacío
    if (buffer.length === 0) {
      throw new Error("El buffer está vacío");
    }
    
    // Verificar que parece ser una imagen válida (JPEG, PNG, etc.)
    const start = buffer.slice(0, 4);
    const isValidImage = 
      (start[0] === 0xFF && start[1] === 0xD8) || // JPEG
      (start[0] === 0x89 && start[1] === 0x50 && start[2] === 0x4E && start[3] === 0x47) || // PNG
      (start[0] === 0x47 && start[1] === 0x49 && start[2] === 0x46) || // GIF
      (start[0] === 0x52 && start[1] === 0x49 && start[2] === 0x46 && start[3] === 0x46); // WebP/RIFF
    
    if (!isValidImage) {
      throw new Error(`El buffer no parece ser una imagen válida (inicio: ${start.toString('hex')})`);
    }
    
    // Verificar tamaño máximo (20MB para Google Vision API)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (buffer.length > maxSize) {
      throw new Error(`El buffer es demasiado grande (${buffer.length} bytes, máximo: ${maxSize} bytes)`);
    }
  }

  const vision = getVisionClient();
  
  try {
    // Google Vision API puede tener problemas con Buffers directos en entornos serverless
    // Convertir a base64 para máxima compatibilidad
    let imageContent: Buffer | string = buffer!;
    
    if (buffer && Buffer.isBuffer(buffer)) {
      // Convertir buffer a base64 - Google Vision API acepta ambos formatos,
      // pero base64 es más confiable en entornos serverless como Vercel
      imageContent = buffer.toString('base64');
    }
    
    const [result] = await vision.textDetection(
      buffer
        ? { image: { content: imageContent } }
        : { image: { source: { imageUri: imageUrl! } } }
    );
    const annotations = result.textAnnotations || [];

    const rawTokens = annotations.length > 1
    ? annotations.slice(1).map((a) => ({
        textRaw: a.description || "",
        confidence: a.confidence ?? null,
      }))
    : (annotations[0]?.description || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((text) => ({ textRaw: text, confidence: null }));

    const tokens = rawTokens
      .map((token) => {
        const textRaw = (token.textRaw || "").trim();
        if (!textRaw) return null;
        const textNorm = normalizeText(textRaw);
        if (!textNorm) return null;
        return {
          textRaw,
          textNorm,
          confidence: token.confidence ?? null,
        };
      })
      .filter((t): t is OcrToken => Boolean(t));

    return tokens;
  } catch (err: any) {
    const errorMsg = String(err?.message ?? err);
    const errorCode = err?.code || err?.statusCode || err?.status || "UNKNOWN";
    
    // Log detallado del error
    console.error("Google Vision API error:", {
      error: errorMsg,
      code: errorCode,
      bufferSize: buffer?.length,
      bufferStart: buffer ? buffer.slice(0, 8).toString('hex') : undefined,
      bufferEnd: buffer ? buffer.slice(-8).toString('hex') : undefined,
      isBuffer: Buffer.isBuffer(buffer),
      stack: err?.stack?.substring(0, 500),
    });
    
    throw err;
  }
}
